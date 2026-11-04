"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Payment, PurchaseRequest } from "@/contract";
import { API_MODE } from "@/lib/api";
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
  const [captureKey] = useIntentKey();

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
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (err: unknown) => void;
  }) => PayPalButtonsInstance;
}
declare global {
  interface Window { paypal?: PayPalNamespace }
}

function loadSdk(clientId: string): Promise<PayPalNamespace> {
  if (window.paypal) return Promise.resolve(window.paypal);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
    s.async = true;
    s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal SDK unavailable")));
    s.onerror = () => reject(new Error("PayPal SDK failed to load"));
    document.head.appendChild(s);
  });
}

function LivePayPalButtons({ request }: { request: PurchaseRequest }) {
  const api = useApi();
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<Payment | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "capturing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let buttons: PayPalButtonsInstance | null = null;
    (async () => {
      try {
        const cfg = await api.getCheckoutConfig();
        const paypal = await loadSdk(cfg.paypal_client_id);
        if (cancelled || !container.current) return;
        buttons = paypal.Buttons({
          style: { layout: "vertical", label: "paypal" },
          createOrder: async () => {
            setMessage(null);
            const res = await api.startCheckout(request.id);
            paymentRef.current = res.payment;
            setFallback(res.payment.paypal.payer_action_url);
            if (!res.payment.paypal.order_id) throw new Error("No PayPal order was created.");
            return res.payment.paypal.order_id;
          },
          onApprove: async () => {
            const p = paymentRef.current;
            if (!p) return;
            setStatus("capturing");
            await api.capturePayment(p.id, simulateFor(request, p));
            router.push(`/payments/${p.id}`);
          },
          onCancel: () => setMessage("You closed PayPal. Nothing was charged."),
          onError: (err) => {
            setMessage(errorMessage(err));
            setStatus("ready");
          },
        });
        await buttons.render(container.current);
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setMessage(e instanceof Error ? e.message : errorMessage(e));
        }
      }
    })();
    return () => {
      cancelled = true;
      buttons?.close?.();
    };
  }, [api, request, router]);

  return (
    <div>
      <p className="t-label text-muted">PayPal · Sandbox</p>
      <div ref={container} className="mt-4 min-h-[48px] max-w-[420px]" />
      {status === "loading" && <StatusLine>Loading PayPal</StatusLine>}
      {status === "capturing" && <StatusLine>Payer approved · confirming with PayPal</StatusLine>}
      {message && <p className="mt-3 t-small text-ink-2" role="status">{message}</p>}
      {fallback && (
        <a href={fallback} className="mt-3 inline-block t-small font-medium text-ink underline underline-offset-4">Popup blocked? Continue to PayPal ↗</a>
      )}
    </div>
  );
}
