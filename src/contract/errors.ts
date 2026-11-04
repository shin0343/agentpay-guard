// Source of truth: docs/API_CONTRACT.md §1.1.
import { z } from "zod";

export const ErrorCode = z.enum([
  "VALIDATION_FAILED", "AMOUNT_MISMATCH", "UNSUPPORTED_CURRENCY", "MALFORMED_JSON",
  "IDEMPOTENCY_KEY_REQUIRED", "IDEMPOTENCY_KEY_REUSED", "IDEMPOTENCY_IN_PROGRESS",
  "UNAUTHENTICATED", "FORBIDDEN", "CSRF_FAILED", "NOT_FOUND",
  "STATE_CONFLICT", "VERSION_CONFLICT", "POLICY_APPROVAL_EXPIRED", "CAPTURE_IN_PROGRESS",
  "PAYPAL_UNAVAILABLE", "PAYPAL_REJECTED", "RATE_LIMITED", "DEMO_DISABLED", "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorEnvelope = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    status: z.number().int(),
    request_id: z.string(),
    retryable: z.boolean(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;
