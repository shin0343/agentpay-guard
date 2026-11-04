"use client";

import { useSyncExternalStore } from "react";

const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" });

function subscribe(cb: () => void) {
  const t = setInterval(cb, 15_000);
  return () => clearInterval(t);
}

/** Small live clock in the footer — the hackathon runs on PST. */
export function PacificClock() {
  const value = useSyncExternalStore(subscribe, () => fmt.format(Date.now()), () => "--:--");
  return <time className="t-data text-muted" suppressHydrationWarning>{value}</time>;
}
