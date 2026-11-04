"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PurchaseRequest } from "@/contract";
import { isApiError } from "@/lib/api";
import { useApi, useHotkeys, useIntentKey, useQuery } from "@/lib/hooks";
import { Icon } from "@/components/ui/icon";
import { Button, ButtonLink, Dialog, Kbd, Notice, TextArea, cx } from "@/components/ui/primitives";
import { AgentQuote, LoadError, RequestHeader, errorMessage } from "./request-parts";
import { DetailSkeleton } from "./request-detail";
import { DecisionTrace, RiskMeter } from "./trace";
import { VerdictMark } from "./verdict";

/** Focused review: one decision, everything needed, nothing else (UX_BLUEPRINT §2.4). */
export function ReviewFocus({ id }: { id: string }) {
  const api = useApi();
  const router = useRouter();
  const req = useQuery(`request:${id}`, (a) => a.getPurchaseRequest(id));
  const queue = useQuery("review-queue", (a) => a.listPurchaseRequests({ status: ["IN_REVIEW"], limit: 100 }));
  const session = useQuery("session", (a) => a.getSession());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [decided, setDecided] = useState<PurchaseRequest | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [stay, setStay] = useState(false);
  const [key, renew] = useIntentKey();
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const r = decided ?? req.data;
  const isReviewer = session.data?.user.role === "reviewer";
  const others = (queue.data?.data ?? []).filter((x) => x.id !== id);
  const position = queue.data ? Math.max(1, (queue.data.data.findIndex((x) => x.id === id) + 1) || 1) : null;
  const nextId = others[0]?.id;

  const decide = async (action: "approve" | "reject") => {
    if (!r || busy) return;
    if (action === "reject" && note.trim().length < 3) {
      setError("Add a short note to reject.");
      noteRef.current?.focus();
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const out = await api.submitReview(r.id, { action, note: note.trim() || undefined }, r.version, { idempotencyKey: key });
      renew();
      setRejectOpen(false);
      setDecided(out);
    } catch (e) {
      if (isApiError(e) && (e.code === "STATE_CONFLICT" || e.code === "VERSION_CONFLICT")) {
        setConflict(e.message);
        setRejectOpen(false);
        void req.refetch();
      } else setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  // Auto-advance to the next item after a decision, unless the reviewer chooses to stay.
  useEffect(() => {
    if (!decided || stay || !nextId) return;
    const t = setTimeout(() => router.push(`/review/${nextId}`), 1500);
    return () => clearTimeout(t);
  }, [decided, stay, nextId, router]);

  const canDecide = !!r && r.status === "IN_REVIEW" && isReviewer && !decided;
  useHotkeys({ a: () => void decide("approve"), r: () => setRejectOpen(true) }, canDecide);

  if (req.error && !r) return <div className="mx-auto max-w-[760px] py-8 gutter"><LoadError error={req.error} retry={req.refetch} /></div>;
  if (!r) return <DetailSkeleton />;

  const flagged = r.evaluation?.policy.filter((p) => p.outcome === "review" || p.outcome === "block") ?? [];
  const risk = r.evaluation?.risk;
  const topSignals = (risk?.signals ?? []).filter((s) => s.severity !== "info").slice(0, 2);

  return (
    <article className="mx-auto max-w-[760px] space-y-8 pb-28 pt-6 gutter sm:pt-8">
      <div className="flex items-center justify-between">
        <Link href="/review" className="inline-flex items-center gap-1.5 t-small font-medium text-ink-2 hover:text-ink">
          <Icon name="arrowLeft" size={14} /> Review queue{others.length ? ` (${others.length} more)` : ""}
        </Link>
        {position && queue.data && r.status === "IN_REVIEW" && <span className="t-data text-muted">{position} of {queue.data.data.length}</span>}
      </div>

      <RequestHeader r={r} />

      {decided ? (
        <div className="space-y-4">
          <VerdictMark
            tone={decided.status === "ALLOWED" ? "allow" : "block"}
            word={decided.status === "ALLOWED" ? "Allowed." : "Rejected."}
            reason={decided.status === "ALLOWED" ? "Allowed by you. Payer approval is next." : "Rejected by you. Nothing will be paid."}
            tag={decided.status === "ALLOWED" ? "KEY 1 GRANTED" : "REJECTED"}
          />
          <div className="flex flex-wrap items-center gap-4">
            {nextId && !stay ? (
              <p className="t-small text-ink-2" role="status">
                Opening the next request… <button type="button" className="font-medium text-ink underline underline-offset-4" onClick={() => setStay(true)}>Stay</button>
              </p>
            ) : decided.status === "ALLOWED" ? (
              <ButtonLink variant="primary" href={`/requests/${decided.id}/checkout`} iconRight="arrowRight">Continue to PayPal</ButtonLink>
            ) : null}
            <Link href={`/requests/${decided.id}`} className="t-small font-medium text-ink underline-offset-4 hover:underline">View request</Link>
            {nextId && stay && <Link href={`/review/${nextId}`} className="t-small font-medium text-ink underline-offset-4 hover:underline">Next in queue</Link>}
          </div>
        </div>
      ) : r.status !== "IN_REVIEW" ? (
        <Notice
          title={conflict ?? "This request is no longer waiting for review."}
          action={<ButtonLink size="sm" href={`/requests/${r.id}`}>Open request</ButtonLink>}
        >
          {r.review ? `Decided by ${r.review.reviewer.name}.` : "Its state changed elsewhere."} The latest state is shown.
        </Notice>
      ) : null}

      {/* WHY THIS NEEDS YOU */}
      <section aria-labelledby="why">
        <h2 id="why" className="t-label text-ink">Why this needs you</h2>
        <ul className="mt-2 border-t border-rule">
          {flagged.map((p) => (
            <li key={p.rule_id} className="flex items-baseline gap-3 border-b border-rule py-3">
              <Icon name="alert" className={cx("shrink-0 translate-y-0.5", p.outcome === "block" ? "text-block" : "text-review")} />
              <span className="t-data w-10 shrink-0 text-muted">{p.rule_id}</span>
              <span className="t-body text-ink">{p.message}</span>
            </li>
          ))}
          {risk?.status === "completed" && risk.score !== null && (
            <li className="flex flex-col gap-2 border-b border-rule py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="flex items-baseline gap-3">
                <span aria-hidden className="text-muted">▸</span>
                <span className="t-data w-10 shrink-0 text-muted">AI</span>
                <span className="t-body text-ink">{topSignals.length ? topSignals.map((s) => s.label).join("; ") : risk.summary}</span>
              </span>
              <span className="sm:ml-auto"><RiskMeter score={risk.score} /></span>
            </li>
          )}
          {r.decision?.risk_escalated && (
            <li className="border-b border-rule py-3 t-small text-ink-2">Rules passed. The AI raised caution, so this waits for you.</li>
          )}
        </ul>
      </section>

      <AgentQuote text={r.justification} />

      {/* AFTER YOU APPROVE */}
      <section aria-labelledby="after">
        <h2 id="after" className="t-label text-ink">After you approve</h2>
        <div className="mt-2 grid grid-cols-1 divide-y divide-rule border-y border-rule sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <p className="flex items-center gap-3 py-3 sm:pr-4">
            <Icon name="key" className="text-muted" /><span className="t-label text-muted">Key 1</span><span className="t-body">Policy approval</span><span className="ml-auto t-small text-ink-2">you</span>
          </p>
          <p className="flex items-center gap-3 py-3 sm:pl-4">
            <Icon name="key" className="text-muted" /><span className="t-label text-muted">Key 2</span><span className="t-body">Payer approval</span><span className="ml-auto t-small text-ink-2">in PayPal</span>
          </p>
        </div>
      </section>

      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 t-small font-medium text-ink underline-offset-4 hover:underline">
          <Icon name="chevronRight" size={14} className="transition-transform duration-(--t-fast) group-open:rotate-90" />
          Show full trace
        </summary>
        <div className="mt-4"><DecisionTrace evaluation={r.evaluation} decision={r.decision} /></div>
      </details>

      {r.status === "IN_REVIEW" && !decided && (
        <section aria-label="Decision" className="space-y-4">
          {!isReviewer && session.data && (
            <Notice tone="review" title="Only reviewers can decide.">You are signed in as an operator. Switch role from the user menu.</Notice>
          )}
          <TextArea
            ref={noteRef}
            label="Note · required to reject, optional to approve"
            value={note}
            onChange={(e) => { setNote(e.target.value); if (error) setError(null); }}
            maxLength={500}
            rows={2}
            error={error}
            disabled={!isReviewer}
          />
          <div className="sticky bottom-0 -mx-(--gutter) flex items-center justify-between gap-3 border-t border-rule bg-paper/95 px-(--gutter) py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <Button variant="danger" disabled={!canDecide} onClick={() => setRejectOpen(true)}>
              Reject <span className="ml-1 hidden sm:inline"><Kbd>r</Kbd></span>
            </Button>
            <Button variant="primary" loading={busy === "approve"} disabled={!canDecide} onClick={() => void decide("approve")}>
              Approve purchase <span className="ml-1 hidden opacity-70 sm:inline">a</span>
            </Button>
          </div>
        </section>
      )}

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject this purchase?">
        <p className="mt-2 t-body text-ink-2">The agent will not be able to pay. Your note is recorded in the ledger.</p>
        <div className="mt-4">
          <TextArea label="Note · required" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} error={error} autoFocus />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="quiet" onClick={() => setRejectOpen(false)}>Keep reviewing</Button>
          <Button variant="danger" loading={busy === "reject"} onClick={() => void decide("reject")}>Reject purchase</Button>
        </div>
      </Dialog>
    </article>
  );
}
