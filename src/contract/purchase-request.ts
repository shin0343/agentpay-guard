// Source of truth: docs/API_CONTRACT.md §1.
import { z } from "zod";
import { DecisionOutcome, MerchantCategory, Money, PaymentStatus, RequestStatus, RuleOutcome, listOf } from "./common";

export const PurchaseItem = z.object({
  name: z.string().min(1).max(127),
  quantity: z.number().int().min(1).max(10_000),
  unit_amount: Money,
  sku: z.string().max(64).optional(),
  description: z.string().max(280).optional(),
});
export type PurchaseItem = z.infer<typeof PurchaseItem>;

export const Merchant = z.object({
  name: z.string().min(1).max(80),
  domain: z.string().max(253).optional(),
  category: MerchantCategory,
});
export type Merchant = z.infer<typeof Merchant>;

export const PurchaseRequestCreate = z.object({
  agent_reference: z.string().max(64).optional(),
  merchant: Merchant,
  items: z.array(PurchaseItem).min(1).max(20),
  amount: Money,
  justification: z.string().min(1).max(1000),
  metadata: z.record(z.string().max(40), z.string().max(200)).optional(),
});
export type PurchaseRequestCreate = z.infer<typeof PurchaseRequestCreate>;

export const PolicyResult = z.object({
  rule_id: z.string(),
  rule_key: z.string(),
  outcome: RuleOutcome,
  observed: z.string(),
  limit: z.string().nullable(),
  message: z.string().max(120),
});
export type PolicyResult = z.infer<typeof PolicyResult>;

export const RiskSignalCode = z.enum([
  "new_merchant", "amount_above_typical", "justification_mismatch",
  "urgency_pressure", "prompt_injection", "stored_value_instrument",
  "suspicious_merchant_domain", "velocity", "other",
]);

export const RiskSignal = z.object({
  code: RiskSignalCode,
  label: z.string().max(80),
  severity: z.enum(["info", "warn", "high"]),
  evidence: z.string().max(200).nullable(),
  source_field: z.string().nullable(),
});
export type RiskSignal = z.infer<typeof RiskSignal>;

export const RiskAssessment = z.object({
  status: z.enum(["completed", "unavailable", "timeout", "skipped"]),
  score: z.number().int().min(0).max(100).nullable(),
  level: z.enum(["low", "medium", "high"]).nullable(),
  recommendation: z.enum(["none", "escalate_to_review"]).nullable(),
  signals: z.array(RiskSignal).max(8),
  summary: z.string().max(280).nullable(),
  model: z.string().nullable(),
  prompt_version: z.string(),
  latency_ms: z.number().int().nullable(),
  assessed_at: z.string().nullable(),
});
export type RiskAssessment = z.infer<typeof RiskAssessment>;

export const Decision = z.object({
  id: z.string(),
  outcome: DecisionOutcome,
  policy_outcome: DecisionOutcome,
  risk_escalated: z.boolean(),
  reason_codes: z.array(z.string()),
  reason: z.string().max(120),
  decided_at: z.string(),
  expires_at: z.string().nullable(),
});
export type Decision = z.infer<typeof Decision>;

export const Review = z.object({
  id: z.string(),
  action: z.enum(["approve", "reject"]),
  reviewer: z.object({ id: z.string(), name: z.string() }),
  note: z.string().max(500).nullable(),
  decided_at: z.string(),
});
export type Review = z.infer<typeof Review>;

export const KeyState = z.object({
  state: z.enum(["granted", "waiting", "denied", "not_applicable"]),
  by: z.string().nullable(),
  at: z.string().nullable(),
  detail: z.string().max(80).nullable(),
});
export type KeyState = z.infer<typeof KeyState>;

export const NextAction = z.enum([
  "open_review", "start_checkout", "resume_checkout", "retry_payment", "cancel",
]);
export type NextAction = z.infer<typeof NextAction>;

export const PaymentSummary = z.object({
  id: z.string(),
  status: PaymentStatus,
  paypal_order_id: z.string().nullable(),
  paypal_capture_id: z.string().nullable(),
});
export type PaymentSummary = z.infer<typeof PaymentSummary>;

export const Evaluation = z.object({
  policy_set: z.object({ id: z.string(), name: z.string(), version: z.number().int() }),
  policy: z.array(PolicyResult),
  risk: RiskAssessment,
});
export type Evaluation = z.infer<typeof Evaluation>;

export const PurchaseRequest = z.object({
  id: z.string(),
  object: z.literal("purchase_request"),
  status: RequestStatus,
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  agent: z.object({ id: z.string(), name: z.string() }),
  agent_reference: z.string().nullable(),
  merchant: Merchant,
  items: z.array(PurchaseItem),
  amount: Money,
  justification: z.string(),
  metadata: z.record(z.string(), z.string()).nullable(),
  fingerprint: z.string(),
  duplicate_of: z.string().nullable(),
  evaluation: Evaluation.nullable(),
  decision: Decision.nullable(),
  review: Review.nullable(),
  keys: z.object({ policy: KeyState, payer: KeyState }),
  payment: PaymentSummary.nullable(),
  next_actions: z.array(NextAction),
});
export type PurchaseRequest = z.infer<typeof PurchaseRequest>;

export const PurchaseRequestList = listOf(PurchaseRequest).extend({
  summary: z.object({ needs_review: z.number().int(), allowed_today: Money }),
});
export type PurchaseRequestList = z.infer<typeof PurchaseRequestList>;

export const ReviewCreate = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});
export type ReviewCreate = z.infer<typeof ReviewCreate>;
