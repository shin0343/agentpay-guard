"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApi, type GuardApi } from "@/lib/api";

export function useApi(): GuardApi {
  return getApi();
}

interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Minimal data hook. Keeps the last good data visible while refetching (never wipe visible
 * state on error — UX_BLUEPRINT §3). Refreshes on adapter push events (mock) and on an
 * optional poll interval (live adapter, or fast polling while a request is evaluating).
 */
export function useQuery<T>(key: string | null, fn: (api: GuardApi) => Promise<T>, opts: { pollMs?: number } = {}): QueryState<T> {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const [result, setResult] = useState<{ key: string | null; data?: T; error: unknown }>({ key: null, error: null });
  const seq = useRef(0);
  const inFlight = useRef<{ key: string; promise: Promise<void> } | null>(null);

  const refetch = useCallback(async () => {
    if (key === null) return;
    if (inFlight.current?.key === key) return inFlight.current.promise;
    const mine = ++seq.current;
    const promise = (async () => {
      try {
        const next = await fnRef.current(getApi());
        if (mine === seq.current) setResult({ key, data: next, error: null });
      } catch (error) {
        if (mine === seq.current) setResult((previous) => ({ key, data: previous.key === key ? previous.data : undefined, error }));
      } finally {
        if (mine === seq.current) inFlight.current = null;
      }
    })();
    inFlight.current = { key, promise };
    return promise;
  }, [key]);

  useEffect(() => {
    if (key === null) return;
    // Initial fetch for this key; state updates happen asynchronously after the await.
    void refetch();
    const unsub = getApi().subscribe(() => void refetch());
    return () => {
      unsub();
      // This is a request generation counter, not a DOM ref. Invalidate late responses on navigation.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++seq.current;
      inFlight.current = null;
    };
  }, [key, refetch]);

  useEffect(() => {
    if (key === null || !opts.pollMs) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refetch();
    }, opts.pollMs);
    return () => clearInterval(t);
  }, [key, opts.pollMs, refetch]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void refetch(); };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [refetch]);

  const current = result.key === key;
  return { data: current ? result.data : undefined, error: current ? result.error : null, loading: key !== null && !current, refetch };
}

/** Ticks every `ms` — for countdowns and relative times. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/** Single-key shortcuts that never fire while the user is typing or a dialog is open. */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target) || document.querySelector("dialog[open]")) return;
      const h = ref.current[e.key];
      if (h) {
        e.preventDefault();
        h(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

/** Stable idempotency key per user intent; `renew()` after the intent completes. */
export function useIntentKey(): [string, () => void] {
  const [key, setKey] = useState(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())));
  return [key, () => setKey(crypto.randomUUID())];
}

/** Cursor pagination stays inside GuardApi; a refreshed first page wins over older rows. */
export function useLoadMore<T extends { id: string }>(key: string, first: { data: T[]; next_cursor: string | null } | undefined, fetchPage: (cursor: string) => Promise<{ data: T[]; next_cursor: string | null }>) {
  const [extra, setExtra] = useState<{ key: string; data: T[]; next_cursor: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const current = extra?.key === key ? extra : null;
  const cursor = current ? current.next_cursor : first?.next_cursor;
  const rows = [...new Map([...(current?.data ?? []), ...(first?.data ?? [])].map((row) => [row.id, row])).values()];
  // Preserve API order (newest first), with refreshed records replacing stale copies.
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = [...new Set([...(first?.data ?? []), ...(current?.data ?? [])].map((row) => row.id))].map((id) => byId.get(id)!);
  const loadMore = async () => {
    if (!cursor || busy) return;
    setBusy(true);
    setError(null);
    try {
      const page = await fetchPage(cursor);
      setExtra((previous) => ({ key, data: [...(previous?.key === key ? previous.data : []), ...page.data], next_cursor: page.next_cursor }));
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  };
  return { rows: ordered, hasMore: !!cursor, loadMore, busy, error };
}
