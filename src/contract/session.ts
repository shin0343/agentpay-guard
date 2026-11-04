// Source of truth: docs/API_CONTRACT.md §2.12–2.13, §2.15.
import { z } from "zod";
import { PurchaseRequest } from "./purchase-request";

export const Role = z.enum(["operator", "reviewer"]);
export type Role = z.infer<typeof Role>;

export const Session = z.object({
  user: z.object({ id: z.string(), name: z.string(), role: Role }),
});
export type Session = z.infer<typeof Session>;

export const PolicyRule = z.object({
  rule_id: z.string(),
  rule_key: z.string(),
  description: z.string(),
  params: z.record(z.string(), z.unknown()),
});
export type PolicyRule = z.infer<typeof PolicyRule>;

export const ActivePolicy = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int(),
  rules: z.array(PolicyRule),
  ai_policy: z.string(),
});
export type ActivePolicy = z.infer<typeof ActivePolicy>;

export const ScenarioKey = z.enum([
  "a_low_risk", "b_needs_review", "c_blocked", "d_retry", "d_duplicate", "e_capture_declined",
]);
export type ScenarioKey = z.infer<typeof ScenarioKey>;

export const ScenarioRun = z.object({
  purchase_request: PurchaseRequest,
  replayed: z.boolean(),
});
export type ScenarioRun = z.infer<typeof ScenarioRun>;
