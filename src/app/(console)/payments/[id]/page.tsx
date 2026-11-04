"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Payment } from "@/contract";
import { API_MODE } from "@/lib/api";
import { COPY, isVerifiedPaid, paymentOutcome, type Tone } from "@/lib/copy";
import { clock, formatMoney } from "@/lib/format";
import { useApi, useIntentKey, useQuery } from "@/lib/hooks";
import { Icon } from "@/components/ui/icon";
import { Button, ButtonLink, IdTag, Label, Notice, StatusLabel, StatusLine } from "@/components/ui/primitives";
import { DetailSkeleton } from "@/components/guard/request-detail";
import { LoadError, RequestActions, StaleNotice, errorMessage, requestTitle } from "@/components/guard/request-parts";
import { TwoKey, VerdictMark } from "@/components/guard/verdict";
import { simulateFor } from "@/components/guard/paypal-zone";

const ATTEMPT: Record<Payment["attempts"][number]["status"], { tone: Tone; word: string }> = {
  in_flight: { tone: "neutral", word: "Confirming" },
  completed: { tone: "neutral", word: "Capture confirmed" },
  pending: { tone: "review", word: "Pending" },
  declined: { tone: "block", word: "Declined" },
  failed: { tone: "block", word: "Failed" },
  unknown: { tone: "neutral", word: "Unknown" },
};

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const pay = useQuery(`payment:${id}`, (a) => a.getPayment(id), { pollMs: API_MODE === "live" ? 1500 : undefined });
  const p = pay.data;
  const req = useQuery(p ? `request:${p.purchase_request_id}` : null, (a) => a.getPurchaseRequest(p!.purchase_request_id), { pollMs: API_MODE === "live" ? 1500 : undefined });
  const r = req.data;
  const [firstStatus, setFirstStatus] = useState<string | null>(null);
  if (p && firstStatus === null) setFirstStatus(p.status);

  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [reconcileKey, renewReconcile] = useIntentKey();
  const [captureKey, renewCapture] = useIntentKey();
  const [capturing, setCapturing] = useState(false);
  const paymentId = p?.id;
  const paymentStatus = p?.status;
  const refreshPayment = pay.refetch;
  const refreshRequest = req.refetch;
  // A stable interval survives read polling and covers pending/unknown create/capture results.
  useEffect(() => {
    if (!paymentId || !["CAPTURING", "PENDING", "CREATING", "APPROVED"].includes(paymentStatus ?? "")) return;
    let running = false;
    let disposed = false;
    const timer = setInterval(async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        await api.reconcilePayment(paymentId);
        if (!disposed) { setReconcileError(null); await Promise.all([refreshPayment(), refreshRequest()]); }
      } catch (error) { if (!disposed) setReconcileError(errorMessage(error)); }
      finally { running = false; }
    }, 5000);
    return () => { disposed = true; clearInterval(timer); };
  }, [api, paymentId, paymentStatus, refreshPayment, refreshRequest]);

  const checkStatus = async () => {
    if (!p) return;
    setChecking(true);
    setReconcileError(null);
    try {
      await api.reconcilePayment(p.id, { idempotencyKey: reconcileKey });
      renewReconcile();
      await Promise.all([pay.refetch(), req.refetch()]);
    } catch (error) { setReconcileError(errorMessage(error)); }
    finally { setChecking(false); }
  };

  const confirmPayment = async () => {
    if (!p || !r || capturing) return;
    setCapturing(true);
    setReconcileError(null);
    try {
      await api.capturePayment(p.id, simulateFor(r, p), { idempotencyKey: captureKey });
      renewCapture();
    } catch (error) { setReconcileError(errorMessage(error)); }
    finally {
      await Promise.all([pay.refetch(), req.refetch()]);
      setCapturing(false);
    }
  };

  if (pay.error && !p) return <div className="mx-auto max-w-[680px] py-8 gutter"><LoadError error={pay.error} retry={pay.refetch} /></div>;
  if (req.error && !r) return <div className="mx-auto max-w-[680px] py-8 gutter"><LoadError error={req.error} retry={req.refetch} /></div>;
  if (!p || !r) return <DetailSkeleton />;

  const o = paymentOutcome(p, r);
  const verifiedPaid = isVerifiedPaid(p, r);
  const uncertain = ["CAPTURING", "PENDING", "CREATING", "APPROVED"].includes(p.status) || (p.status === "COMPLETED" && !verifiedPaid);
  const mock = p.paypal.environment === "mock";

  return (
    <article className="mx-auto w-full max-w-[680px] space-y-8 pb-24 pt-6 gutter sm:pt-10">
      <Link href={`/requests/${r.id}`} className="inline-flex items-center gap-1.5 t-small font-medium text-ink-2 hover:text-ink">
        <Icon name="arrowLeft" size={14} /> Request
      </Link>

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="t-label text-muted">Payment</p>
          <h1 className="mt-1 t-title">{requestTitle(r)} · {r.merchant.name}</h1>
        </div>
        <p className="t-amount-l">{formatMoney(p.amount)}</p>
      </header>

      {!!(pay.error || req.error) && <StaleNotice retry={() => { void pay.refetch(); void req.refetch(); }} />}
      <VerdictMark key={p.status} tone={o.tone} word={o.word} reason={o.reason} tag={o.tag} animate={p.status !== firstStatus} />
      {uncertain && <div className="space-y-3"><StatusLine>{COPY.confirmingPayment}</StatusLine><Button onClick={checkStatus} loading={checking}>{COPY.refresh}</Button></div>}
      {reconcileError && <Notice tone="review" title={COPY.returnUnconfirmed}>{reconcileError}</Notice>}
      {mock && p.status === "COMPLETED" && <Notice tone="review" title="Simulated result.">{COPY.mockCapture}</Notice>}

      <div className="space-y-4">
        <div className="border-y border-rule"><TwoKey keys={r.keys} /></div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {r.next_actions.includes("retry_payment") && (
            <ButtonLink variant="primary" href={`/requests/${r.id}/checkout`} iconRight="arrowRight">Try payment again</ButtonLink>
          )}
          {p.status === "APPROVED" && r.next_actions.includes("resume_checkout") && <Button variant="primary" loading={capturing} onClick={confirmPayment}>{COPY.confirmPayment}</Button>}
          {p.status !== "APPROVED" && r.next_actions.includes("resume_checkout") && (
            <ButtonLink variant="primary" href={`/requests/${r.id}/checkout`} iconRight="arrowRight">Continue to PayPal</ButtonLink>
          )}
          <Link href={`/ledger?q=${encodeURIComponent(r.id)}`} className="t-small font-medium text-ink underline-offset-4 hover:underline">View in ledger</Link>
          <RequestActions r={{ ...r, payment: null, next_actions: r.next_actions.filter((a) => a === "cancel") }} />
        </div>
      </div>

      <section aria-labelledby="attempts">
        <h2 id="attempts" className="t-label text-ink">Capture attempts</h2>
        {p.attempts.length === 0 ? (
          <p className="mt-2 border-y border-rule py-3 t-small text-muted">{COPY.noCapture}</p>
        ) : (
          <ol className="mt-2 border-t border-rule">
            {p.attempts.map((a) => (
              <li key={a.n} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-rule py-3 sm:gap-x-4">
                <span className="t-data text-muted">Attempt {a.n}</span>
                <span className="min-w-0 truncate t-data text-ink-2" title={a.paypal_request_id}>
                  {a.issue ?? a.paypal_request_id}
                </span>
                <span className="flex items-center gap-3">
                  <StatusLabel tone={ATTEMPT[a.status].tone}>{ATTEMPT[a.status].word}</StatusLabel>
                  <time className="hidden t-data text-muted sm:inline" dateTime={a.at}>{clock(a.at)}</time>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="ids">
        <h2 id="ids" className="t-label text-ink">References</h2>
        <dl className="mt-2 grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 border-t border-rule sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-x-6">
          {[
            ["Payment", p.id],
            [mock ? "Order (mock)" : "PayPal order", p.paypal.order_id],
            [mock ? "Capture (mock)" : "PayPal capture", p.paypal.capture_id],
            ["Request", r.id],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="border-b border-rule py-2.5"><Label>{k}</Label></dt>
              <dd className="min-w-0 border-b border-rule py-2.5">{v ? <IdTag id={v} full /> : <span className="t-data text-muted">—</span>}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
