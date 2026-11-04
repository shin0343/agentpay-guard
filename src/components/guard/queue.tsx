"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useRef, useState } from "react";
import type { RequestStatus } from "@/contract";
import { API_MODE } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useHotkeys, useNow, useQuery } from "@/lib/hooks";
import { Skeleton, SearchField, cx } from "@/components/ui/primitives";
import { EmptyState, LoadError, QueueRow } from "./request-parts";

const FILTERS: { key: string; label: string; status?: RequestStatus[] }[] = [
  { key: "all", label: "All" },
  { key: "review", label: "Needs review", status: ["IN_REVIEW"] },
  { key: "allowed", label: "Allowed", status: ["ALLOWED", "CHECKOUT_PENDING", "CAPTURING"] },
  { key: "blocked", label: "Blocked", status: ["BLOCKED", "REJECTED"] },
  { key: "paid", label: "Paid", status: ["PAID"] },
  { key: "failed", label: "Not paid", status: ["PAYMENT_FAILED"] },
];

/** The fixed-context pane: the agent request queue. */
export function RequestQueue({ selectedId, basePath = "/requests", fixedStatus, title = "Requests" }: {
  selectedId?: string; basePath?: string; fixedStatus?: RequestStatus[]; title?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const now = useNow(30_000);
  const status = fixedStatus ?? FILTERS.find((f) => f.key === filter)?.status;

  const list = useQuery(
    `queue:${status?.join(",") ?? "all"}:${query}`,
    (api) => api.listPurchaseRequests({ status, q: query || undefined, limit: 100 }),
    { pollMs: API_MODE === "live" ? 3000 : undefined },
  );
  const rows = list.data?.data ?? [];
  const idx = rows.findIndex((r) => r.id === selectedId);

  const go = (i: number) => {
    const r = rows[Math.max(0, Math.min(rows.length - 1, i))];
    if (!r) return;
    router.push(`${basePath}/${r.id}`);
    requestAnimationFrame(() => rowRefs.current[rows.indexOf(r)]?.focus());
  };
  useHotkeys({
    "/": () => searchRef.current?.focus(),
    j: () => go(idx + 1),
    k: () => go(idx < 0 ? 0 : idx - 1),
  });

  const s = list.data?.summary;
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-rule px-4 pb-4 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="t-display-m">{title}</h1>
          <span className="hidden t-small text-muted lg:inline" aria-hidden>j / k</span>
        </div>
        <p className="t-small text-ink-2" aria-live="polite">
          {s ? <>{s.needs_review} need review · {formatMoney(s.allowed_today)} allowed today</> : <span className="text-muted">Loading summary…</span>}
        </p>
        <SearchField ref={searchRef} label="Search ID, merchant, agent…" value={q} onChange={(e) => setQ(e.target.value)} />
        {!fixedStatus && (
          <div className="-mx-1.5 flex flex-wrap gap-0.5" role="group" aria-label="Filter by state">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cx(
                  "h-7 rounded-sm px-1.5 t-small font-medium transition-colors duration-(--t-fast)",
                  filter === f.key ? "bg-ink text-on-ink" : "text-ink-2 hover:bg-sunken",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 lg:overflow-y-auto">
        {list.error && !list.data ? (
          <div className="p-4"><LoadError error={list.error} retry={list.refetch} /></div>
        ) : list.loading ? (
          <div aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="space-y-2 border-b border-rule px-4 py-4">
                <Skeleton className="h-2 w-24" />
                <Skeleton className="h-2.5 w-3/4" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4">
            <EmptyState
              title={q ? "No matches." : fixedStatus ? "Nothing needs review." : "No agent requests yet."}
              line={q ? "Try an ID, merchant or agent name." : fixedStatus ? "New requests that need a person will appear here." : "Send a test request to see a decision."}
            />
          </div>
        ) : (
          <ul>
            {rows.map((r, i) => (
              <li key={r.id}>
                <QueueRow r={r} href={`${basePath}/${r.id}`} selected={r.id === selectedId} now={now} rowRef={(el) => { rowRefs.current[i] = el; }} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
