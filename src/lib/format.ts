import type { Money } from "@/contract";

const TZ = "America/Los_Angeles";

export const toCents = (value: string): number => {
  const [whole = "0", frac = "00"] = value.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
};

export const fromCents = (cents: number): Money => ({
  currency_code: "USD",
  value: `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`,
});

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** "$1,024.00". Money is always rendered from the decimal string, never from floats in arithmetic. */
export const formatMoney = (m: Money | number): string =>
  usd.format(typeof m === "number" ? m / 100 : toCents(m.value) / 100);

/** Keep the prefix and the last 4 characters: preq_…7F3K. */
export const shortId = (id: string): string => {
  const i = id.indexOf("_");
  if (i < 0 || id.length <= i + 7) return id;
  return `${id.slice(0, i + 1)}…${id.slice(-4)}`;
};

const clockFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** "14:02:11" in PST/PDT. */
export const clock = (iso: string): string => clockFmt.format(new Date(iso));
export const shortDate = (iso: string): string => dateFmt.format(new Date(iso));
export const dayKey = (iso: string | number): string => dayKeyFmt.format(new Date(iso));

export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
