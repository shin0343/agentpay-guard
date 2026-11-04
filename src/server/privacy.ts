/** Best-effort minimization, not a general PII/DLP guarantee. Never accept payment credentials. */
export function redact(text: string): string {
  return text
    .replace(
      /\b(?:sk-[A-Za-z0-9_-]{8,}|agk_test_[A-Za-z0-9_-]+)\b/g,
      "[REDACTED]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
    .replace(
      /\b(?:api[_ -]?key|password|secret|token)\s*[:=]\s*[^\s,;]+/gi,
      "[REDACTED]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[REDACTED]");
}
export function sanitize<T>(value: T, preservePaymentIds = false): T {
  if (typeof value === "string") return redact(value) as T;
  if (Array.isArray(value))
    return value.map((x) => sanitize(x, preservePaymentIds)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        redact(key),
        /^(?:.*secret.*|password|token|access_token|refresh_token|authorization|api[_-]?key|cookie)$/i.test(
          key,
        )
          ? "[REDACTED]"
          : preservePaymentIds &&
              /^(?:order_id|capture_id)$/.test(key) &&
              typeof val === "string" &&
              /^[A-Z0-9]{1,36}$/.test(val)
            ? val
            : sanitize(val, preservePaymentIds),
      ]),
    ) as T;
  return value;
}
