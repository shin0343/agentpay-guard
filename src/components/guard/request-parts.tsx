"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { AuditEvent, PurchaseRequest } from "@/contract";
import { API_MODE, isApiError } from "@/lib/api";
import { COPY, EVENT_LABEL, STATUS, auditSummary } from "@/lib/copy";
import { clock, formatMoney, relativeTime, shortId } from "@/lib/format";
import { useApi, useIntentKey, useNow, useQuery } from "@/lib/hooks";
import { Button, ButtonLink, Dialog, IdTag, Notice, StatusLabel, cx } from "@/components/ui/primitives";

export const requestTitle = (r: Pick<PurchaseRequest, "items">) =>
  `${r.items[0]?.name ?? "Purchase"}${r.items.length > 1 ? ` +${r.items.length - 1}` : ""}`;

export const errorMessage = (e: unknown) => (isApiError(e) ? e.message : COPY.connectionInterrupted);

// ── Header ─────────────────────────────────────────────────────────────────

export function RequestHeader({ r, back }: { r: PurchaseRequest; back?: ReactNode }) {
  const now = useNow(30_000);
  return (
    <header>
      {back}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="t-display-m text-balance">{requestTitle(r)}</h1>
          <p className="mt-1.5 t-small text-ink-2">
            {r.merchant.name} · <span className="font-mono">{r.agent.name}</span> · <time dateTime={r.created_at} title={r.created_at}>{relativeTime(r.created_at, now)}</time>
          </p>
        </div>
        <div className="flex shrink-0 flex-row items-baseline justify-between gap-4 sm:flex-col sm:items-end sm:gap-1">
          <p className="t-amount-l">{formatMoney(r.amount)}</p>
          <IdTag id={r.id} label="request ID" />
        </div>
      </div>
    </header>
  );
}

// ── Untrusted agent text ───────────────────────────────────────────────────

export function AgentQuote({ text, title = "What the agent said", sourceLabel = COPY.untrusted }: { text: string; title?: string; sourceLabel?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 260;
  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="t-label text-ink">{title}</h2>
        <span className="t-label text-muted">{sourceLabel}</span>
      </div>
      <blockquote className="mt-2 border-l-2 border-rule-strong pl-4">
        <p className={cx("t-body text-ink-2 whitespace-pre-wrap break-words text-pretty", !open && long && "line-clamp-4")}>{text}</p>
        {long && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 t-small font-medium text-ink underline-offset-4 hover:underline">
            {open ? "Show less" : "Show all"}
          </button>
        )}
      </blockquote>
    </section>
  );
}

// ── Queue row ──────────────────────────────────────────────────────────────

export function QueueRow({ r, href, selected, now, rowRef }: {
  r: PurchaseRequest; href: string; selected?: boolean; now: number; rowRef?: (el: HTMLAnchorElement | null) => void;
}) {
  const s = { ...STATUS[r.status], ...(r.status === "CHECKOUT_PENDING" && r.payment?.status === "APPROVED" ? { label: COPY.payerApproved } : {}) };
  return (
    <Link
      ref={rowRef}
      href={href}
      aria-current={selected ? "page" : undefined}
      className={cx(
        "relative block border-b border-rule px-4 py-3 transition-colors duration-(--t-fast) hover:bg-sunken/60 focus-visible:-outline-offset-2",
        selected && "bg-sunken before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-ink",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <StatusLabel tone={s.tone} live={s.live}>{s.label}</StatusLabel>
        <span className="t-amount text-ink">{formatMoney(r.amount)}</span>
      </div>
      <p className="mt-1 truncate t-body text-ink">{requestTitle(r)} <span className="text-ink-2">· {r.merchant.name}</span></p>
      <div className="mt-0.5 flex items-center justify-between gap-3">
        <span className="truncate t-small text-muted"><span className="font-mono">{r.agent.name}</span> · {relativeTime(r.created_at, now)}</span>
        <span className="t-data text-muted">{shortId(r.id)}</span>
      </div>
    </Link>
  );
}

// ── Primary action by status (UX_BLUEPRINT §2.2 table) ─────────────────────

export function RequestActions({ r, className }: { r: PurchaseRequest; className?: string }) {
  const api = useApi();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, renew] = useIntentKey();
  const a = r.next_actions;

  let primary: ReactNode = null;
  if (a.includes("open_review")) primary = <ButtonLink variant="primary" href={`/review/${r.id}`} iconRight="arrowRight">Open review</ButtonLink>;
  else if (r.payment?.status === "APPROVED" && a.includes("resume_checkout")) primary = <ButtonLink variant="primary" href={`/payments/${r.payment.id}`}>{COPY.confirmPayment}</ButtonLink>;
  else if (a.includes("start_checkout") || a.includes("resume_checkout")) primary = <ButtonLink variant="primary" href={`/requests/${r.id}/checkout`} iconRight="arrowRight">Continue to PayPal</ButtonLink>;
  else if (a.includes("retry_payment")) primary = <ButtonLink variant="primary" href={`/requests/${r.id}/checkout`} iconRight="arrowRight">Try payment again</ButtonLink>;

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.cancelPurchaseRequest(r.id, { idempotencyKey: key });
      renew();
      setConfirm(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!primary && !a.includes("cancel") && !r.payment) return null;

  return (
    <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-3", className)}>
      {primary}
      {r.payment && (
        <Link href={`/payments/${r.payment.id}`} className="t-small font-medium text-ink underline-offset-4 hover:underline">View payment</Link>
      )}
      {a.includes("cancel") && (
        <button type="button" onClick={() => setConfirm(true)} className="t-small font-medium text-block underline-offset-4 hover:underline">
          Cancel request
        </button>
      )}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Cancel this request?">
        <p className="mt-2 t-body text-ink-2">The agent&apos;s purchase will not go ahead. Any open PayPal order is abandoned.</p>
        {error && <p className="mt-3 t-small text-block" role="alert">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="quiet" onClick={() => setConfirm(false)}>Keep it</Button>
          <Button variant="danger" loading={busy} onClick={cancel}>Cancel request</Button>
        </div>
      </Dialog>
    </div>
  );
}

// ── Per-request ledger (last events) ───────────────────────────────────────

export function RequestLedger({ requestId, limit = 6 }: { requestId: string; limit?: number }) {
  const q = useQuery(`ledger:${requestId}`, (api) => api.listAuditEvents({ purchase_request_id: requestId, limit: 50 }), { pollMs: API_MODE === "live" ? 5000 : undefined });
  const events = q.data?.data ?? [];
  return (
    <section aria-labelledby={`ledger-${requestId}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={`ledger-${requestId}`} className="t-label text-ink">Ledger for this request</h2>
        <Link href={`/ledger?q=${encodeURIComponent(requestId)}`} className="t-small font-medium text-ink underline-offset-4 hover:underline">View all</Link>
      </div>
      <ol className="mt-2 border-t border-rule">
        {events.slice(0, limit).map((e) => <MiniEvent key={e.id} e={e} />)}
        {q.loading && <li className="py-2.5 t-small text-muted">Loading ledger…</li>}
      </ol>
      {!!q.error && <LoadError error={q.error} retry={q.refetch} />}
      {events.length > limit && <p className="mt-2 t-small text-muted">{events.length - limit} earlier events</p>}
    </section>
  );
}

function MiniEvent({ e }: { e: AuditEvent }) {
  return (
    <li className="grid grid-cols-[68px_1fr] gap-x-3 border-b border-rule py-2 sm:grid-cols-[72px_170px_1fr]">
      <time className="t-data text-muted" dateTime={e.occurred_at}>{clock(e.occurred_at)}</time>
      <span className="t-data text-ink">{EVENT_LABEL[e.type]}</span>
      {auditSummary(e) && <span className="col-span-2 col-start-2 t-small text-ink-2 sm:col-span-1 sm:col-start-auto">{auditSummary(e)}</span>}
    </li>
  );
}

/** Count of PayPal-facing operations for a request — the proof line for blocked requests. */
export function usePaypalCallCount(requestId: string): number | null {
  const q = useQuery(`ledger:${requestId}`, (api) => api.listAuditEvents({ purchase_request_id: requestId, limit: 100 }));
  if (!q.data) return null;
  return q.data.data.filter((e) => e.type === "checkout.created" || e.type.startsWith("payment.") || e.type.startsWith("payer.")).length;
}

// ── States ─────────────────────────────────────────────────────────────────

export function EmptyState({ title, line, action }: { title: string; line: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-1 py-10">
      <p className="t-display-m">{title}</p>
      <p className="t-body text-ink-2">{line}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  const notFound = isApiError(error) && error.code === "NOT_FOUND";
  const unauthenticated = isApiError(error) && error.status === 401;
  return (
    <Notice
      tone={notFound ? "neutral" : "block"}
      title={unauthenticated ? COPY.signInAgain : notFound ? "Nothing here." : "Couldn't load this."}
      action={unauthenticated ? <ButtonLink href={`/login?next=${encodeURIComponent(typeof window === "undefined" ? "/requests" : window.location.pathname + window.location.search)}`} size="sm">{COPY.signInAgain}</ButtonLink> : notFound ? <ButtonLink href="/requests" size="sm">Back to requests</ButtonLink> : <Button size="sm" onClick={retry}>Try again</Button>}
    >
      {notFound ? "This ID does not exist or is not visible to you." : errorMessage(error)}
    </Notice>
  );
}

export function StaleNotice({ retry }: { retry: () => void }) {
  return <Notice tone="review" title={COPY.staleData} action={<Button size="sm" onClick={retry}>{COPY.refresh}</Button>} />;
}
