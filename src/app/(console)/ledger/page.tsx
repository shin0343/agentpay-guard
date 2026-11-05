"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useDeferredValue, useEffect, useRef, useState } from "react";
import { AuditEventType, RequestStatus, type AuditEvent } from "@/contract";
import { API_MODE } from "@/lib/api";
import { COPY, EVENT_LABEL, STATUS, auditSummary, ledgerState } from "@/lib/copy";
import { clock, dayKey, formatMoney, shortDate } from "@/lib/format";
import { useApi, useHotkeys, useLoadMore, useNow, useQuery } from "@/lib/hooks";
import { Icon } from "@/components/ui/icon";
import { Button, IdTag, SearchField, Skeleton, StatusLabel, cx } from "@/components/ui/primitives";
import { EmptyState, LoadError, StaleNotice } from "@/components/guard/request-parts";

const SELECT = "h-10 rounded-md border border-rule-strong bg-raised pl-3 pr-8 t-small text-ink appearance-none bg-no-repeat";

function toCsv(rows: AuditEvent[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const head = ["seq", "occurred_at", "type", "purchase_request_id", "payment_id", "actor", "amount", "state_after", "summary", "hash", "prev_hash"];
  return [head.join(","), ...rows.map((e) => [e.seq, e.occurred_at, e.type, e.purchase_request_id, e.payment_id, e.actor.name, e.amount?.value, e.state_after, e.summary, e.hash, e.prev_hash].map(esc).join(","))].join("\n");
}

function Ledger() {
  const api = useApi();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [type, setType] = useState("");
  const [state, setState] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const query = useDeferredValue(q);
  const searchRef = useRef<HTMLInputElement>(null);
  useHotkeys({ "/": () => searchRef.current?.focus() });
  // Search is the primary action here — focus it on load, but not on touch devices (no surprise keyboard).
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => router.replace(query ? `/ledger?q=${encodeURIComponent(query)}` : "/ledger", { scroll: false }), 300);
    return () => clearTimeout(t);
  }, [query, router]);

  const filters = {
    q: query || undefined,
    type: type ? [type as AuditEventType] : undefined,
    state: state ? [state as RequestStatus] : undefined,
    limit: 100,
  };
  const list = useQuery(`audit:${query}:${type}:${state}`, (api) => api.listAuditEvents(filters), { pollMs: API_MODE === "live" ? 5000 : undefined });
  const chain = useQuery("chain", (api) => api.verifyAuditChain(), { pollMs: API_MODE === "live" ? 15000 : undefined });
  const pages = useLoadMore(`audit:${query}:${type}:${state}`, list.data, (cursor) => api.listAuditEvents({ ...filters, cursor }));
  const rows = pages.rows;
  const now = useNow(60_000);
  const today = dayKey(now);

  const exportCsv = () => {
    const url = api.auditCsvUrl(filters);
    if (url) {
      window.location.href = url;
      return;
    }
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agentpay-guard-ledger${API_MODE === "mock" ? "-mock" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] pb-24 pt-6 gutter sm:pt-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="t-display-m">Ledger</h1>
        <p className="t-small" aria-live="polite">
          {chain.error ? <span className="text-review">{COPY.chainUnavailable}</span> : chain.data ? (
            chain.data.ok ? (
              <span className="inline-flex items-center gap-1.5 text-ink-2">
                <Icon name="check" size={14} className="text-allow" />
                Chain verified · {chain.data.events} events · <span className="t-data text-muted">head {chain.data.head_hash.slice(0, 4)}…{chain.data.head_hash.slice(-3)}</span>
              </span>
            ) : (
              <span className="font-medium text-block">Chain broken at event {chain.data.broken_at_seq}. Investigate before trusting this ledger.</span>
            )
          ) : <span className="text-muted">Verifying chain…</span>}
        </p>
      </header>
      <p className="mt-1 t-small text-ink-2">Every decision and payment, append-only and hash-chained.</p>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchField ref={searchRef} label="Search ID, merchant, agent, PayPal ID…" value={q} onChange={(e) => setQ(e.target.value)} className="md:max-w-[420px] md:flex-1" />
        <div className="flex gap-3">
          <label className="relative flex-1 md:flex-none">
            <span className="sr-only">Event type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className={cx(SELECT, "w-full")}>
              <option value="">All events</option>
              {AuditEventType.options.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}
            </select>
            <Icon name="chevronDown" size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
          </label>
          <label className="relative flex-1 md:flex-none">
            <span className="sr-only">State after event</span>
            <select value={state} onChange={(e) => setState(e.target.value)} className={cx(SELECT, "w-full")}>
              <option value="">All states</option>
              {RequestStatus.options.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
            <Icon name="chevronDown" size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
          </label>
        </div>
        <Button size="md" variant="secondary" onClick={exportCsv} disabled={!rows.length} className="md:ml-auto">Export CSV</Button>
      </div>

      <div className="mt-6">
        {!!list.error && list.data && <div className="mb-4"><StaleNotice retry={list.refetch} /></div>}
        {!!list.error && !list.data ? (
          <LoadError error={list.error} retry={list.refetch} />
        ) : list.loading ? (
          <div className="space-y-4 border-t border-rule pt-4" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-3 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No matching events." line="Search by request ID, merchant, agent or PayPal ID." />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-0 table-fixed border-collapse">
            <caption className="sr-only">Audit events, newest first</caption>
            <thead>
              <tr className="border-b border-rule-strong text-left">
                <th scope="col" className="w-[72px] py-2 pr-3 font-normal md:w-[84px]"><span className="t-label text-muted">Time</span></th>
                <th scope="col" className="py-2 pr-3 font-normal"><span className="t-label text-muted">Event</span></th>
                <th scope="col" className="hidden w-[148px] py-2 pr-3 font-normal md:table-cell"><span className="t-label text-muted">Request</span></th>
                <th scope="col" className="hidden w-[188px] py-2 pr-3 font-normal lg:table-cell"><span className="t-label text-muted">Actor</span></th>
                <th scope="col" className="hidden w-[104px] py-2 pr-3 text-right font-normal sm:table-cell"><span className="t-label text-muted">Amount</span></th>
                <th scope="col" className="w-[136px] py-2 text-right font-normal md:w-[164px]"><span className="t-label text-muted">State</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const expanded = open === e.id;
                const s = ledgerState(e.type, e.state_after);
                return (
                  <Fragment key={e.id}>
                    <tr className={cx("border-b border-rule align-top transition-colors duration-(--t-fast) hover:bg-sunken/50", expanded && "bg-sunken/70")}>
                      <td className="pb-3 pr-3 pt-[22px]">
                        <time className="block t-data text-ink-2" dateTime={e.occurred_at} title={e.occurred_at}>{clock(e.occurred_at)}</time>
                        {dayKey(e.occurred_at) !== today && <span className="t-data text-muted">{shortDate(e.occurred_at)}</span>}
                      </td>
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={`evt-${e.id}`}
                          onClick={() => setOpen(expanded ? null : e.id)}
                          className="group inline-flex min-h-10 items-center gap-1.5 text-left"
                        >
                          <Icon name="chevronRight" size={12} className={cx("text-muted transition-transform duration-(--t-fast)", expanded && "rotate-90")} />
                          <span className="hidden t-data text-ink [overflow-wrap:anywhere] group-hover:underline underline-offset-4 md:inline">{e.type}</span>
                          <span className="t-small font-medium text-ink md:hidden">{EVENT_LABEL[e.type]}</span>
                        </button>
                        {auditSummary(e) && <p className="mt-0.5 line-clamp-2 t-small text-ink-2 md:line-clamp-none">{auditSummary(e)}</p>}
                        {e.purchase_request_id && <Link href={`/requests/${e.purchase_request_id}`} className="flex min-h-10 w-fit items-center t-data text-muted underline underline-offset-4 md:hidden">{e.purchase_request_id.slice(0, 5)}…{e.purchase_request_id.slice(-4)}</Link>}
                      </td>
                      <td className="hidden pb-3 pr-3 pt-[19px] md:table-cell">
                        {e.purchase_request_id ? (
                          <span className="inline-flex items-center gap-2">
                            <IdTag id={e.purchase_request_id} label="request ID" />
                            <Link href={`/requests/${e.purchase_request_id}`} aria-label={`Open request ${e.purchase_request_id}`} title="Open request" className="inline-flex size-6 items-center justify-center rounded-sm text-muted hover:bg-sunken hover:text-ink">
                              <Icon name="arrowRight" size={14} />
                            </Link>
                          </span>
                        ) : <span className="t-data text-muted">—</span>}
                      </td>
                      <td className="hidden pb-3 pr-3 pt-[21px] lg:table-cell">
                        <span className="t-small text-ink-2">{e.actor.name}</span>
                        <span className="block t-label text-muted">{e.actor.kind}</span>
                      </td>
                      <td className="hidden pb-3 pr-3 pt-[21px] text-right sm:table-cell">
                        <span className="t-amount text-ink">{e.amount ? formatMoney(e.amount) : ""}</span>
                      </td>
                      <td className="pb-3 pt-[21px] text-right">
                        {s && <StatusLabel tone={s.tone} className="justify-end">{s.label}</StatusLabel>}
                      </td>
                    </tr>
                    {expanded && (
                      <tr id={`evt-${e.id}`} className="border-b border-rule bg-sunken/70">
                        <td colSpan={6} className="px-0 pb-4 pt-1">
                          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 bg-raised p-4 t-data text-[12px]! sm:grid-cols-[160px_minmax(0,1fr)]">
                            {[
                              ["event", e.id],
                              ["seq", String(e.seq)],
                              ["actor", `${e.actor.kind} · ${e.actor.name}`],
                              ...(e.payment_id ? [["payment", e.payment_id]] : []),
                              ...Object.entries(e.data).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]),
                              ["hash", e.hash],
                              ["prev_hash", e.prev_hash],
                            ].map(([k, v]) => (
                              <Fragment key={k}>
                                <dt className="mt-2 break-all text-muted sm:mt-0">{k}</dt>
                                <dd className="min-w-0 break-all text-ink-2">{v}</dd>
                              </Fragment>
                            ))}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
        {pages.hasMore && <div className="mt-4"><Button loading={pages.busy} onClick={pages.loadMore}>{COPY.loadEvents}</Button></div>}
        {!!pages.error && <div className="mt-4"><LoadError error={pages.error} retry={pages.loadMore} /></div>}
      </div>
    </div>
  );
}

export default function LedgerPage() {
  return (
    <Suspense>
      <Ledger />
    </Suspense>
  );
}
