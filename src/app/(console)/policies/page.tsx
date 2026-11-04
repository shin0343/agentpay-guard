"use client";

import { useQuery } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/primitives";
import { LoadError } from "@/components/guard/request-parts";

export default function PoliciesPage() {
  const q = useQuery("policy", (api) => api.getActivePolicy());
  const p = q.data;
  return (
    <div className="mx-auto w-full max-w-[880px] pb-24 pt-6 gutter sm:pt-8">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="t-display-m">Policies</h1>
        {p && <p className="t-data text-muted">{p.name} · v{p.version} · read-only</p>}
      </header>
      <p className="mt-1 t-small text-ink-2">Deterministic rules. The same request always gets the same answer.</p>

      {q.error && !p ? (
        <div className="mt-6"><LoadError error={q.error} retry={q.refetch} /></div>
      ) : !p ? (
        <div className="mt-6 space-y-4" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-3 w-full" />)}</div>
      ) : (
        <>
          <ol className="mt-6 border-t border-rule">
            {p.rules.map((r) => (
              <li key={r.rule_id} className="grid grid-cols-[52px_1fr] gap-x-4 border-b border-rule py-4 sm:grid-cols-[64px_220px_1fr]">
                <span className="t-data text-muted">{r.rule_id}</span>
                <span className="t-data text-ink">{r.rule_key}</span>
                <span className="col-start-2 mt-1 t-body text-ink-2 sm:col-start-auto sm:mt-0">{r.description}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8 border-l-[3px] border-ink py-1 pl-5">
            <p className="t-label text-muted">AI boundary</p>
            <p className="mt-1 font-display text-[22px] leading-[30px]">{p.ai_policy}</p>
          </div>
        </>
      )}
    </div>
  );
}
