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
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(key !== null);
  const seq = useRef(0);

  const refetch = useCallback(async () => {
    if (key === null) return;
    const mine = ++seq.current;
    try {
      const next = await fnRef.current(getApi());
      if (mine !== seq.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (key === null) return;
    // Initial fetch for this key; state updates happen asynchronously after the await.
    void refetch();
    const unsub = getApi().subscribe(() => void refetch());
    return unsub;
  }, [key, refetch]);

  useEffect(() => {
    if (key === null || !opts.pollMs) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refetch();
    }, opts.pollMs);
    return () => clearInterval(t);
  }, [key, opts.pollMs, refetch]);

  return { data, error, loading: loading && data === undefined, refetch };
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
