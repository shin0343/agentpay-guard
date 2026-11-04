import type { ActivePolicy, PurchaseRequestCreate } from "@/contract";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import { canonical, Fault } from "../util";
// Deployment-controlled quotes. Merchant labels NEVER select a payment recipient.
const catalog = SCENARIOS.filter((s) => !s.key.startsWith("d_")).map(
  (s) => s.payload,
);
export function trustedQuote(
  input: Pick<PurchaseRequestCreate, "merchant" | "items">,
): boolean {
  let trusted = true;
  for (const item of input.items) {
    const known = catalog.find((p) =>
      p.items.some(
        (i) => i.name === item.name || (item.sku && i.sku === item.sku),
      ),
    );
    if (!known) {
      trusted = false;
      continue;
    }
    const quote = known.items.find(
      (i) => i.name === item.name || (item.sku && i.sku === item.sku),
    )!;
    if (
      canonical(input.merchant) !== canonical(known.merchant) ||
      canonical(item.unit_amount) !== canonical(quote.unit_amount)
    )
      throw new Fault(
        "VALIDATION_FAILED",
        422,
        "The proposal does not match the trusted merchant quote.",
      );
  }
  return trusted;
}
export const allowlist = [
  "Larkspur Data",
  "Wrenfield Type Foundry",
  "Halcyon Docs",
  "Tessel Cloud",
  "Orrin Office Supply",
  "Fathom Ad Network",
];
const keys = [
  "amount_auto_limit",
  "daily_budget",
  "blocked_category",
  "merchant_allowlist",
  "currency",
  "agent_scope",
  "duplicate_guard",
  "velocity",
];
const descriptions = [
  "Auto ≤ $250; review ≤ $1,000; above $1,000 blocked.",
  "Paid and reserved today ≤ $1,500; otherwise review.",
  "Gift cards, crypto, money transfer and gambling blocked.",
  "Unknown merchant requires review.",
  "USD only.",
  "Out-of-scope categories require review.",
  "Duplicate proposals within ten minutes blocked.",
  "More than five requests in ten minutes require review.",
];
export const activePolicy: ActivePolicy = {
  id: "pol_default",
  name: "Default",
  version: 3,
  rules: keys.map((rule_key, i) => ({
    rule_id: `P-0${i + 1}`,
    rule_key,
    description: descriptions[i]!,
    params:
      i === 0
        ? { auto_limit_cents: 25000, hard_cap_cents: 100000 }
        : i === 1
          ? { daily_budget_cents: 150000 }
          : {},
  })),
  ai_policy: "AI risk may escalate ALLOW → REVIEW. It cannot allow or block.",
};
