import type { DecisionOutcome, PolicyResult, RiskAssessment } from "@/contract";
import type { Agent, StoredRequest, StoreState } from "../model";
import { cents, hash, money } from "../util";
import { activePolicy, allowlist } from "./catalog";
export const localDay = (date: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
export function fingerprint(
  agent: string,
  r: Pick<StoredRequest, "merchant" | "amount" | "items">,
) {
  const quantities = new Map<string, number>();
  for (const item of r.items) {
    const name = item.name.toLowerCase();
    quantities.set(name, (quantities.get(name) ?? 0) + item.quantity);
  }
  return hash(
    [
      agent,
      r.merchant.name.trim().toLowerCase(),
      money(cents(r.amount.value)).value,
      r.amount.currency_code,
      [...quantities]
        .map(([name, quantity]) => `${name}×${quantity}`)
        .sort()
        .join(","),
    ].join("|"),
  );
}
export const reserved = [
  "EVALUATING",
  "IN_REVIEW",
  "ALLOWED",
  "CHECKOUT_PENDING",
  "CAPTURING",
  "PAYMENT_PENDING",
  "PAID",
];
export function evaluate(
  s: StoreState,
  r: StoredRequest,
  a: Agent,
  at: string,
): { rules: PolicyResult[]; duplicate: StoredRequest | undefined } {
  const history = Object.values(s.requests).filter(
    (x) => x.id !== r.id && x.agent.id === a.id,
  );
  const recent = history.filter(
    (x) => Date.parse(at) - Date.parse(x.created_at) < 600000,
  );
  const duplicate = recent.find(
    (x) =>
      (x.fingerprint === r.fingerprint ||
        fingerprint(a.id, x) === r.fingerprint) &&
      !["BLOCKED", "REJECTED", "CANCELLED", "EXPIRED"].includes(x.status),
  );
  const used = history
    .filter(
      (x) =>
        localDay(x.created_at) === localDay(at) && reserved.includes(x.status),
    )
    .reduce((n, x) => n + cents(x.amount.value), 0);
  const amount = cents(r.amount.value);
  const results: PolicyResult["outcome"][] = [
    amount > 100000 ? "block" : amount > 25000 ? "review" : "pass",
    used + amount > 150000 ? "review" : "pass",
    ["gift_cards", "crypto", "money_transfer", "gambling"].includes(
      r.merchant.category,
    )
      ? "block"
      : "pass",
    r.trusted_catalog && allowlist.includes(r.merchant.name)
      ? "pass"
      : "review",
    r.amount.currency_code === "USD" ? "pass" : "block",
    a.allowed_categories.includes(r.merchant.category) ? "pass" : "review",
    duplicate ? "block" : "pass",
    recent.length + 1 > 5 ? "review" : "pass",
  ];
  const observed = [
    `$${r.amount.value}`,
    `$${money(used + amount).value}`,
    r.merchant.category,
    r.merchant.name,
    r.amount.currency_code,
    r.merchant.category,
    duplicate?.id ?? "Unique",
    String(recent.length + 1),
  ];
  return {
    duplicate,
    rules: activePolicy.rules.map((rule, i) => ({
      rule_id: rule.rule_id,
      rule_key: rule.rule_key,
      outcome: results[i]!,
      observed: observed[i]!,
      limit: [
        "$250 auto · $1,000 cap",
        "$1,500 daily",
        "No stored value",
        "Trusted merchant",
        "USD",
        "Agent categories",
        "10 minutes",
        "5 per 10 minutes",
      ][i]!,
      message:
        results[i] === "pass"
          ? "Within policy."
          : results[i] === "block"
            ? "Blocked by spending policy."
            : "Human review required.",
    })),
  };
}
export function combine(
  rules: PolicyResult[],
  risk: RiskAssessment,
): DecisionOutcome {
  const outcome = policyOutcome(rules);
  if (outcome !== "ALLOW") return outcome;
  return risk.status !== "completed" ||
    risk.recommendation === "escalate_to_review" ||
    (risk.score ?? 100) >= 35
    ? "REVIEW"
    : "ALLOW";
}
export const policyOutcome = (rules: PolicyResult[]): DecisionOutcome =>
  rules.some((x) => x.outcome === "block")
    ? "BLOCK"
    : rules.some((x) => x.outcome === "review")
      ? "REVIEW"
      : "ALLOW";
