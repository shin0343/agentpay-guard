// Source of truth: docs/API_CONTRACT.md §1. Do not change shapes here without amending the doc first.
import { z } from "zod";

export const Money = z.object({
  currency_code: z.literal("USD"),
  value: z.string().regex(/^\d{1,7}\.\d{2}$/),
});
export type Money = z.infer<typeof Money>;

export const MerchantCategory = z.enum([
  "software", "api_credits", "compute", "data", "office_supplies",
  "travel", "advertising", "gift_cards", "crypto", "money_transfer",
  "gambling", "other",
]);
export type MerchantCategory = z.infer<typeof MerchantCategory>;

export const RequestStatus = z.enum([
  "RECEIVED", "EVALUATING", "IN_REVIEW", "ALLOWED", "BLOCKED", "REJECTED",
  "CHECKOUT_PENDING", "CAPTURING", "PAID", "PAYMENT_PENDING", "PAYMENT_FAILED",
  "EXPIRED", "CANCELLED",
]);
export type RequestStatus = z.infer<typeof RequestStatus>;

export const PaymentStatus = z.enum([
  "CREATING", "AWAITING_PAYER", "APPROVED", "CAPTURING",
  "COMPLETED", "PENDING", "DECLINED", "FAILED", "VOIDED", "EXPIRED",
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const DecisionOutcome = z.enum(["ALLOW", "REVIEW", "BLOCK"]);
export type DecisionOutcome = z.infer<typeof DecisionOutcome>;

export const RuleOutcome = z.enum(["pass", "review", "block", "skipped"]);
export type RuleOutcome = z.infer<typeof RuleOutcome>;

export const listOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    object: z.literal("list"),
    data: z.array(item),
    next_cursor: z.string().nullable(),
  });
