// Source of truth: docs/API_CONTRACT.md §1.
import { z } from "zod";
import { Money, RequestStatus, listOf } from "./common";

export const AuditEventType = z.enum([
  "checkout.failed", "payment.outcome_unknown", "payment.retry_requested",
  "request.received", "request.duplicate_detected", "idempotency.replayed",
  "policy.evaluated", "risk.assessed", "risk.unavailable", "decision.made",
  "review.approved", "review.rejected",
  "checkout.created", "payer.approved", "payer.cancelled",
  "payment.capture_requested", "payment.completed", "payment.pending",
  "payment.declined", "payment.failed", "payment.reconciled",
  "request.expired", "request.cancelled", "webhook.received",
]);
export type AuditEventType = z.infer<typeof AuditEventType>;

export const ActorKind = z.enum(["agent", "system", "ai", "reviewer", "operator", "paypal"]);
export type ActorKind = z.infer<typeof ActorKind>;

export const AuditEvent = z.object({
  id: z.string(),
  object: z.literal("audit_event"),
  seq: z.number().int(),
  type: AuditEventType,
  occurred_at: z.string(),
  purchase_request_id: z.string().nullable(),
  payment_id: z.string().nullable(),
  actor: z.object({ kind: ActorKind, id: z.string().nullable(), name: z.string() }),
  amount: Money.nullable(),
  state_after: RequestStatus.nullable(),
  summary: z.string().max(120),
  data: z.record(z.string(), z.unknown()),
  prev_hash: z.string(),
  hash: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEvent>;

export const AuditEventList = listOf(AuditEvent);
export type AuditEventList = z.infer<typeof AuditEventList>;

export const ChainVerification = z.union([
  z.object({ ok: z.literal(true), events: z.number().int(), head_hash: z.string() }),
  z.object({ ok: z.literal(false), broken_at_seq: z.number().int(), event_id: z.string() }),
]);
export type ChainVerification = z.infer<typeof ChainVerification>;
