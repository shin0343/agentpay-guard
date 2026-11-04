import type { PolicyResult } from "@/contract";
import type { Agent, StoredRequest, StoreState } from "../model";
import { cents } from "../util";
import { activePolicy, allowlist } from "../policy/catalog";
import { localDay, reserved } from "../policy/engine";
import { sanitize } from "../privacy";

/** Constructed from authenticated identity and server state, never client metadata. */
export function riskContext(
  s: StoreState,
  r: StoredRequest,
  agent: Agent,
  rules: PolicyResult[],
) {
  const at = Date.parse(r.created_at);
  const history = Object.values(s.requests).filter(
    (x) =>
      x.id !== r.id &&
      x.agent.id === agent.id &&
      Date.parse(x.created_at) <= at,
  );
  const recent = history.filter((x) => at - Date.parse(x.created_at) < 600000);
  const amounts = history
    .map((x) => cents(x.amount.value))
    .sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  return sanitize({
    agent: {
      id: agent.id,
      name: agent.name,
      authorized_purpose:
        agent.authorized_purpose ??
        "Purchases within authorized categories only",
      allowed_categories: agent.allowed_categories,
    },
    policy: {
      id: activePolicy.id,
      version: activePolicy.version,
      rules,
      limits: activePolicy.rules.map((x) => ({
        key: x.rule_key,
        params: x.params,
      })),
    },
    merchant: {
      allowlisted: allowlist.includes(r.merchant.name),
      trusted_catalog: r.trusted_catalog,
    },
    behavior: {
      history_count: history.length,
      median_amount_cents: !amounts.length
        ? null
        : amounts.length % 2
          ? amounts[mid]!
          : Math.floor((amounts[mid - 1]! + amounts[mid]!) / 2),
      attempts_last_ten_minutes: recent.length,
      denied_last_ten_minutes: recent.filter((x) =>
        ["BLOCKED", "REJECTED"].includes(x.status),
      ).length,
      same_merchant_attempts: recent.filter(
        (x) => x.merchant.name === r.merchant.name,
      ).length,
      reserved_today_cents: history
        .filter(
          (x) =>
            localDay(x.created_at) === localDay(r.created_at) &&
            reserved.includes(x.status),
        )
        .reduce((n, x) => n + cents(x.amount.value), 0),
      // Bounded facts only: no other purchase's free text or owner/payer identities.
      recent: recent.slice(-10).map((x) => ({
        amount: x.amount,
        category: x.merchant.category,
        status: x.status,
        at: x.created_at,
      })),
    },
  });
}
export type RiskContext = ReturnType<typeof riskContext>;
