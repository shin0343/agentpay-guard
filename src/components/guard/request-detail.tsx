"use client";

import Link from "next/link";
import { useState } from "react";
import { API_MODE } from "@/lib/api";
import { verdictFor } from "@/lib/copy";
import { shortId } from "@/lib/format";
import { useQuery } from "@/lib/hooks";
import { Icon } from "@/components/ui/icon";
import { Notice, Skeleton } from "@/components/ui/primitives";
import { AgentQuote, LoadError, RequestActions, RequestHeader, RequestLedger, usePaypalCallCount } from "./request-parts";
import { DecisionTrace } from "./trace";
import { TwoKey, VerdictMark } from "./verdict";

export function RequestDetail({ id, replayed, showBack = true }: { id: string; replayed?: boolean; showBack?: boolean }) {
  const [live, setLive] = useState(false);
  const q = useQuery(`request:${id}`, (api) => api.getPurchaseRequest(id), {
    pollMs: API_MODE === "live" ? (live ? 500 : 3000) : undefined,
  });
  const r = q.data;

  // Motion marks arrival: animate only what resolves while this view is open.
  const [firstStatus, setFirstStatus] = useState<string | null>(null);
  const [sawEvaluating, setSawEvaluating] = useState(false);
  if (r && firstStatus === null) setFirstStatus(r.status);
  if (r?.status === "EVALUATING" && !sawEvaluating) setSawEvaluating(true);
  const transient = r?.status === "EVALUATING" || r?.status === "CAPTURING" || r?.status === "RECEIVED";
  if (transient !== live && r) setLive(transient);

  const paypalCalls = usePaypalCallCount(id);

  if (q.error && !r) return <div className="mx-auto max-w-[880px] py-8 gutter"><LoadError error={q.error} retry={q.refetch} /></div>;
  if (!r) return <DetailSkeleton />;

  const v = verdictFor(r);
  const evaluating = r.status === "EVALUATING" || r.status === "RECEIVED";

  return (
    <article className="mx-auto max-w-[880px] space-y-8 pb-24 pt-6 gutter sm:pt-8" aria-labelledby="request-title">
      {showBack && (
        <Link href="/requests" className="inline-flex items-center gap-1.5 t-small font-medium text-ink-2 hover:text-ink lg:hidden">
          <Icon name="arrowLeft" size={14} /> Requests
        </Link>
      )}
      {replayed && (
        <Notice title="Retry replayed. No new request was created.">
          The agent resent the same Idempotency-Key, so the original response was returned.
        </Notice>
      )}

      <div id="request-title"><RequestHeader r={r} /></div>

      <VerdictMark key={r.status} tone={v.tone} word={v.word} reason={v.reason} tag={v.tag} animate={r.status !== firstStatus} />

      <div className="space-y-4">
        <div className="border-y border-rule"><TwoKey keys={r.keys} /></div>
        <RequestActions r={r} />
      </div>

      {r.duplicate_of && (
        <Notice tone="block" title={`Duplicate of ${shortId(r.duplicate_of)}.`} action={<Link href={`/requests/${r.duplicate_of}`} className="t-small font-medium underline underline-offset-4">Open original</Link>}>
          Same agent, merchant, amount and items within 10 minutes. No second payment can start.
        </Notice>
      )}

      <DecisionTrace evaluation={r.evaluation} decision={r.decision} evaluating={evaluating} animate={sawEvaluating} />

      <AgentQuote text={r.justification} />

      {(r.status === "BLOCKED" || r.status === "REJECTED") && paypalCalls !== null && (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-y border-rule py-3">
          <span className="whitespace-nowrap">
            <span className="t-label text-muted">PayPal calls</span> <span className="ml-1.5 t-amount text-ink">{paypalCalls}</span>
          </span>
          <span className="t-small text-muted">{r.status === "BLOCKED" ? "Blocked before any payment operation." : "Rejected before checkout."}</span>
        </p>
      )}

      <RequestLedger requestId={r.id} />
    </article>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[880px] space-y-6 pt-8 gutter" aria-busy="true" aria-label="Loading request">
      <div className="flex justify-between">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-7 w-28" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
