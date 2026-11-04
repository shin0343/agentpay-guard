// Source of truth: docs/API_CONTRACT.md §1.
import { z } from "zod";
import { Money, PaymentStatus } from "./common";
import { PurchaseRequest } from "./purchase-request";

export const CaptureAttempt = z.object({
  n: z.number().int().min(1),
  status: z.enum(["in_flight", "completed", "pending", "declined", "failed", "unknown"]),
  paypal_request_id: z.string(),
  paypal_debug_id: z.string().nullable(),
  issue: z.string().nullable(),
  at: z.string(),
});
export type CaptureAttempt = z.infer<typeof CaptureAttempt>;

export const PaymentFailure = z.object({
  code: z.enum([
    "PAYMENT_DECLINED", "PAYER_ACTION_REQUIRED", "ORDER_EXPIRED",
    "ATTEMPTS_EXCEEDED", "PAYPAL_ERROR", "POLICY_APPROVAL_EXPIRED",
  ]),
  paypal_issue: z.string().nullable(),
  message: z.string().max(120),
  retryable: z.boolean(),
});
export type PaymentFailure = z.infer<typeof PaymentFailure>;

export const Payment = z.object({
  id: z.string(),
  object: z.literal("payment"),
  purchase_request_id: z.string(),
  status: PaymentStatus,
  version: z.number().int(),
  amount: Money,
  paypal: z.object({
    // "mock" is a frontend-only value produced by the mock adapter. The live backend always returns "sandbox".
    environment: z.enum(["sandbox", "mock"]),
    order_id: z.string().nullable(),
    order_status: z.enum(["CREATED", "SAVED", "APPROVED", "VOIDED", "COMPLETED", "PAYER_ACTION_REQUIRED"]).nullable(),
    capture_id: z.string().nullable(),
    capture_status: z.enum(["COMPLETED", "DECLINED", "PARTIALLY_REFUNDED", "PENDING", "REFUNDED", "FAILED"]).nullable(),
    payer_action_url: z.url().nullable(),
  }),
  attempts: z.array(CaptureAttempt),
  failure: PaymentFailure.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Payment = z.infer<typeof Payment>;

export const RequestWithPayment = z.object({
  purchase_request: PurchaseRequest,
  payment: Payment,
});
export type RequestWithPayment = z.infer<typeof RequestWithPayment>;

export const CaptureCreate = z.object({
  simulate: z.enum(["none", "instrument_declined"]).default("none"),
});
export type CaptureCreate = z.input<typeof CaptureCreate>;

export const CheckoutConfig = z.object({
  paypal_client_id: z.string(),
  currency: z.literal("USD"),
  intent: z.literal("capture"),
});
export type CheckoutConfig = z.infer<typeof CheckoutConfig>;
