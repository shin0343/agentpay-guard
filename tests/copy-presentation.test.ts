import { describe, expect, it } from "vitest";
import type { KeyState, PolicyResult, PurchaseRequest } from "@/contract";
import { groupDollars, ledgerState, payerKeyNote, policyKeyNote, verdictFor } from "@/lib/copy";

// Step 7 design QA: presentation-only explanations of returned backend data. None of these
// recompute a policy outcome or change a key state. Report: docs/FINAL_DESIGN_QA.md

const key = (over: Partial<KeyState>): KeyState => ({ state: "granted", by: null, at: null, detail: null, ...over });
const rule = (rule_key: string, outcome: PolicyResult["outcome"]) => ({ rule_key, outcome }) as PolicyResult;
const blocked = (reason: string, policy: PolicyResult[]) =>
  ({ status: "BLOCKED", review: null, decision: { reason }, evaluation: { policy } }) as unknown as PurchaseRequest;

describe("groupDollars", () => {
  it("groups thousands in evidence strings without touching other text", () => {
    expect(groupDollars("$2400.00")).toBe("$2,400.00");
    expect(groupDollars("$3058.00 today")).toBe("$3,058.00 today");
    expect(groupDollars("$1250000")).toBe("$1,250,000");
    expect(groupDollars("$250 auto · $1,000 cap")).toBe("$250 auto · $1,000 cap");
    expect(groupDollars("preq_01M6PAT02AJK7SF54JHJ7W5CQ8")).toBe("preq_01M6PAT02AJK7SF54JHJ7W5CQ8");
    expect(groupDollars(null)).toBeNull();
  });
});

describe("approval key notes", () => {
  it("explains a not-applicable payer key from the request state", () => {
    const na = key({ state: "not_applicable", detail: "PayPal approval required" });
    expect(payerKeyNote(na.state, "BLOCKED")).toEqual({ word: "Not applicable", detail: "No payment can start" });
    expect(payerKeyNote(na.state, "IN_REVIEW")).toEqual({ word: "Not yet", detail: "Opens after policy approval" });
    expect(payerKeyNote(na.state, "EXPIRED")).toBeNull();
    expect(payerKeyNote("waiting", "IN_REVIEW")).toBeNull();
    expect(payerKeyNote("granted", "PAID")).toBeNull();
  });

  it("names the reviewer on a human-granted policy key, never on an automatic one", () => {
    expect(policyKeyNote(key({ by: "M. Okafor", detail: "rule set v3" }))).toEqual({ word: "Granted", detail: "by M. Okafor" });
    expect(policyKeyNote(key({ by: "policy", detail: "rule set v3" }))).toBeNull();
    expect(policyKeyNote(key({ by: "M. Okafor", detail: "by M. Okafor" }))).toBeNull();
    expect(policyKeyNote(key({ state: "waiting", by: "M. Okafor" }))).toBeNull();
    expect(policyKeyNote(key({ state: "waiting", detail: "Waiting for reviewer" }), "EVALUATING")).toEqual({ word: "Waiting", detail: "Evaluating" });
    expect(policyKeyNote(key({ state: "waiting", detail: "Waiting for reviewer" }), "IN_REVIEW")).toBeNull();
  });
});

describe("ledgerState", () => {
  it("labels a recorded payer approval without implying payment", () => {
    expect(ledgerState("payer.approved", "CHECKOUT_PENDING")).toEqual({ label: "Payer approved", tone: "review" });
    expect(ledgerState("checkout.created", "CHECKOUT_PENDING")?.label).toBe("Waiting for payer");
    expect(ledgerState("payment.completed", "PAID")?.label).toBe("Paid");
    expect(ledgerState("idempotency.replayed", null)).toBeNull();
  });
});

describe("blocked verdict reason", () => {
  it("replaces the generic backend reason with the returned blocking rules", () => {
    const generic = "Blocked by deterministic spending policy.";
    expect(verdictFor(blocked(generic, [rule("amount_auto_limit", "block"), rule("blocked_category", "block")])).reason)
      .toBe("Blocked item category and over the policy cap. Nothing reached PayPal.");
    expect(verdictFor(blocked(generic, [rule("duplicate_guard", "block")])).reason)
      .toBe("Duplicate of a recent purchase request. Nothing reached PayPal.");
    expect(verdictFor(blocked("Gift cards are a blocked category.", [rule("blocked_category", "block")])).reason)
      .toBe("Gift cards are a blocked category.");
  });
});
