import { createHash, randomBytes } from "node:crypto";
import type { ErrorCode } from "@/contract";
export const canonical = (v: unknown): string => {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  return `{${Object.entries(v)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
    .join(",")}}`;
};
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function id(prefix: string) {
  let n = BigInt(Date.now());
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = alphabet[Number(n & 31n)] + time;
    n >>= 5n;
  }
  return `${prefix}_${time}${Array.from(randomBytes(16), (b) => alphabet[b & 31]).join("")}`;
}
export const cents = (value: string) => Number(value.replace(".", ""));
export const money = (n: number) => ({
  currency_code: "USD" as const,
  value: `${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`,
});
export const now = () => new Date().toISOString();
export class Fault extends Error {
  constructor(
    public code: ErrorCode,
    public status: number,
    message: string,
    public details: Record<string, unknown> = {},
    public retryable = false,
  ) {
    super(message);
  }
}
export function requireState(ok: boolean, current: string, allowed: string[]) {
  if (!ok)
    throw new Fault(
      "STATE_CONFLICT",
      409,
      "This action is unavailable in the current state.",
      { current_status: current, allowed_from: allowed },
    );
}
