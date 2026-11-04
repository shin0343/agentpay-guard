"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Payment, PurchaseRequest } from "@/contract";
import { API_MODE, isApiError } from "@/lib/api";
import { COPY } from "@/lib/copy";
import { formatMoney } from "@/lib/format";
import { useApi, useIntentKey } from "@/lib/hooks";
import { Button, Notice, StatusLine } from "@/components/ui/primitives";
import { errorMessage } from "./request-parts";

/** Scenario E: the first capture is declined (PayPal Sandbox negative testing in live mode). */
export const simulateFor = (r: PurchaseRequest, p: Payment): "none" | "instrument_declined" =>
  r.metadata?.demo_simulate === "decline_first_capture" && p.attempts.length === 0 ? "instrument_declined" : "none";

export function PayPalZone({ request }: { request: PurchaseRequest }) {
  const willDecline = request.metadata?.demo_simulate === "decline_first_capture" && request.payment?.status !== "DECLINED";
  return (
    <section aria-label="Payer approval" className="rounded-lg border border-rule bg-raised p-5 sm:p-6">
      {API_MODE === "mock" ? <MockPayer request={request} /> : <LivePayPalButtons request={request} />}
      <p className="mt-4 t-small text-muted">{COPY.paypalPromise}</p>
      {willDecline && (
        <p className="mt-1 t-small text-review">
          Demo scenario E: the first capture is declined{API_MODE === "live" ? " via PayPal Sandbox negative testing" : ""} to show recovery.
        </p>
      )}
    </section>
  );
}

// ── Mock: an explicit simulation of the PayPal approval window ──────────────

function MockPayer({ request }: { request: PurchaseRequest }) {
  const api = useApi();
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "opening" | "window" | "capturing">("idle");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutKey, renewCheckout] = useIntentKey();
  const [captureKey, renewCapture] = useIntentKey();

  const open = async () => {
    setPhase("opening");
    setError(null);
    setClosed(false);
    try {
      const res = await api.startCheckout(request.id, { idempotencyKey: checkoutKey });
      renewCheckout();
      setPayment(res.payment);
      setPhase("window");
    } catch (e) {
      setError(errorMessage(e));
      setPhase("idle");
    }
  };

  const approve = async () => {
    if (!payment || !api.mockPayer) return;
    setPhase("capturing");
    setError(null);
    try {
      const approved = await api.mockPayer.approve(payment.id);
      await api.capturePayment(approved.id, simulateFor(request, approved), { idempotencyKey: captureKey });
      renewCapture();
      router.push(`/payments/${approved.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setPhase("window");
    }
  };

  const close = async () => {
    if (payment && api.mockPayer) await api.mockPayer.close(payment.id).catch(() => {});
    setClosed(true);
    setPhase("idle");
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="t-label text-review">[Mock] Simulated PayPal approval</p>
        <p className="t-data text-muted">{formatMoney(request.amount)}</p>
      </div>
      <p className="mt-1 t-small text-ink-2">No PayPal window opens and no PayPal API is called.</p>

      {phase === "window" || phase === "capturing" ? (
        <div className="mt-5 border-t border-rule pt-5 motion-fade">
          <p className="t-label text-muted">Simulated payer window · order {payment?.paypal.order_id}</p>
          <p className="mt-2 t-title">Approve {formatMoney(request.amount)} to {request.merchant.name}?</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" loading={phase === "capturing"} onClick={approve}>Approve as payer</Button>
            <Button variant="quiet" disabled={phase === "capturing"} onClick={close}>Close without approving</Button>
          </div>
          {phase === "capturing" && <div className="mt-3"><StatusLine>Payer approved · requesting capture</StatusLine></div>}
        </div>
      ) : (
        <div className="mt-5">
          <Button variant="primary" size="lg" loading={phase === "opening"} onClick={open} className="w-full sm:w-auto">
            Open PayPal (simulated)
          </Button>
        </div>
      )}
      {closed && <p className="mt-3 t-small text-ink-2" role="status">You closed PayPal. Nothing was charged.</p>}
      {error && <div className="mt-4"><Notice tone="block" title="Checkout didn't start.">{error}</Notice></div>}
    </div>
  );
}

// ── Live: the official PayPal JS SDK button, rendered unmodified ────────────

interface PayPalButtonsInstance { render: (el: HTMLElement) => Promise<void>; close?: () => void }
interface PayPalNamespace {
  Buttons: (opts: {
    style?: Record<string, unknown>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }, actions: { restart: () => Promise<void> }) => Promise<void>;
    onCancel?: () => void;
    onError?: (err: unknown) => void;
  }) => PayPalButtonsInstance;
}
declare global {
  interface Window { paypal?: PayPalNamespace }
}

let sdkPromise: Promise<PayPalNamespace> | null = null;
function loadSdk(clientId: string): Promise<PayPalNamespace> {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => fail(), 15_000);
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      sdkPromise = null;
      reject(new Error(COPY.checkoutUnavailable));
    };
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      if (window.paypal) resolve(window.paypal);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return sdkPromise;
}

function LivePayPalButtons({ request }: { request: PurchaseRequest }) {
  const api = useApi();
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const latestRequest = useRef(request);
  const paymentRef = useRef<Payment | null>(null);
  const checkoutKey = useRef<string | null>(null);
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "capturing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  useEffect(() => { latestRequest.current = request; }, [request]);

  useEffect(() => {
    let disposed = false;
    let buttons: PayPalButtonsInstance | null = null;
    const captureKeys = new Map<string, string>();
    (async () => {
      setStatus("loading");
      setMessage(null);
      try {
        const cfg = await api.getCheckoutConfig();
        if (disposed) return;
        const paypal = await loadSdk(cfg.paypal_client_id);
        if (disposed || !container.current) return;
        buttons = paypal.Buttons({
          style: { layout: "vertical", label: "paypal" },
          createOrder: async () => {
            setMessage(null);
            checkoutKey.current ??= crypto.randomUUID();
            const res = await api.startCheckout(request.id, { idempotencyKey: checkoutKey.current });
            paymentRef.current = res.payment;
            checkoutKey.current = null;
            setFallback(res.payment.paypal.payer_action_url);
            if (!res.payment.paypal.order_id) {
              router.push(`/payments/${res.payment.id}`);
              throw new Error(COPY.returnUnconfirmed);
            }
            return res.payment.paypal.order_id;
          },
          onApprove: async (_data, actions) => {
            const payment = paymentRef.current;
            if (!payment || disposed) return;
            setStatus("capturing");
            const intent = `${payment.id}:${payment.attempts.length}`;
            if (!captureKeys.has(intent)) captureKeys.set(intent, crypto.randomUUID());
            try {
              const result = await api.capturePayment(payment.id, simulateFor(latestRequest.current, payment), { idempotencyKey: captureKeys.get(intent) });
              paymentRef.current = result.payment;
              // PayPal's supported funding-decline recovery reopens payer approval on the same order.
              if (result.payment.status === "DECLINED" && result.payment.failure?.paypal_issue === "INSTRUMENT_DECLINED") {
                setStatus("ready");
                setMessage(result.payment.failure.message);
                await actions.restart();
                return;
              }
            } catch {
              // The server may have captured before the response was interrupted. Read this payment.
            }
            if (!disposed) router.push(`/payments/${payment.id}`);
          },
          onCancel: () => {
            setStatus("ready");
            setMessage(COPY.payerClosed);
            if (paymentRef.current) void api.recordPayerCancel(paymentRef.current.id).catch(() => {});
          },
          onError: () => {
            if (!disposed) { setMessage(COPY.checkoutRecovery); setStatus("error"); }
          },
        });
        await buttons.render(container.current);
        if (!disposed) setStatus("ready");
      } catch (error) {
        if (!disposed) { setStatus("error"); setMessage(isApiError(error) ? errorMessage(error) : COPY.checkoutRecovery); }
      }
    })();
    return () => { disposed = true; buttons?.close?.(); };
    // A refreshed request must never close an active payer popup.
  }, [api, request.id, router, reload]);

  const redirect = async () => {
    setRedirecting(true);
    setMessage(null);
    try {
      checkoutKey.current ??= crypto.randomUUID();
      const res = await api.startCheckout(request.id, { idempotencyKey: checkoutKey.current });
      paymentRef.current = res.payment;
      checkoutKey.current = null;
      const url = res.payment.paypal.payer_action_url;
      if (url) window.location.assign(url);
      else router.push(`/payments/${res.payment.id}`);
    } catch (error) { setMessage(errorMessage(error)); setRedirecting(false); }
  };

  return (
    <div>
      <p className="t-label text-muted">PayPal · Sandbox</p>
      <div ref={container} className="mt-4 min-h-[48px] max-w-[420px]" aria-busy={status === "loading"} />
      {status === "loading" && <StatusLine>{COPY.checkoutLoading}</StatusLine>}
      {status === "capturing" && <StatusLine>{COPY.confirmingPayment}</StatusLine>}
      {message && <div className="mt-3"><Notice tone={status === "error" ? "block" : "neutral"} title={status === "error" ? COPY.checkoutUnavailable : COPY.returnUnconfirmed}>{message}</Notice></div>}
      {status === "error" && <Button className="mt-4" onClick={() => setReload((n) => n + 1)}>{COPY.retryCheckout}</Button>}
      {status !== "capturing" && status !== "loading" && (
        <div className="mt-4 border-t border-rule pt-4">
          {fallback ? <a href={fallback} className="inline-flex min-h-10 items-center t-small font-medium text-ink underline underline-offset-4">{COPY.redirectCheckout}</a>
            : <Button variant="quiet" loading={redirecting} onClick={redirect}>{COPY.redirectCheckout}</Button>}
          <p className="t-small text-muted">{COPY.redirectHint}</p>
        </div>
      )}
    </div>
  );
}
