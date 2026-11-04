import { describe, expect, it } from "vitest";
import { Payment, PurchaseRequest, AuditEvent, type RiskAssessment } from "@/contract";
import { MockEngine, combine, emptyState } from "@/lib/api/mock/engine";
import { PEOPLE } from "@/lib/api/mock/seed";

const reviewer = { ...PEOPLE.reviewer };
const operator = { ...PEOPLE.operator };

function setup() {
  let t = Date.UTC(2026, 10, 10, 20, 0, 0);
  const engine = new MockEngine(() => t, emptyState());
  return { engine, advance: (ms: number) => (t += ms) };
}

function run(engine: MockEngine, key: Parameters<MockEngine["runScenario"]>[0]) {
  const res = engine.runScenario(key);
  if (res.created) engine.evaluate(res.created);
  return engine.get(res.request.id, "reviewer");
}

function pay(engine: MockEngine, id: string, simulate: "none" | "instrument_declined" = "none") {
  const { payment } = engine.startCheckout(id, operator);
  engine.payerApprove(payment.id);
  engine.beginCapture(payment.id, simulate, operator);
  return engine.settleCapture(payment.id, "reviewer");
}

const paypalEvents = (engine: MockEngine, id: string) =>
  engine.listAudit({ purchase_request_id: id }).data.filter((e) => e.type.startsWith("checkout.") || e.type.startsWith("payment.") || e.type.startsWith("payer."));

describe("mock engine — documented scenarios", () => {
  it("A: low risk is allowed, then paid through the simulated payer", () => {
    const { engine } = setup();
    const r = run(engine, "a_low_risk");
    expect(r.status).toBe("ALLOWED");
    expect(r.evaluation!.policy.every((p) => p.outcome === "pass")).toBe(true);
    expect(r.evaluation!.risk.score).toBe(12);
    expect(r.keys.policy.state).toBe("granted");
    expect(r.keys.payer.state).toBe("waiting");
    const { purchase_request, payment } = pay(engine, r.id);
    expect(purchase_request.status).toBe("PAID");
    expect(payment.paypal.environment).toBe("mock");
    expect(payment.paypal.capture_id).toMatch(/^MOCK-CAP-/);
  });

  it("B: over the auto limit with a new merchant needs review, then reviewer approval allows it", () => {
    const { engine } = setup();
    const r = run(engine, "b_needs_review");
    expect(r.status).toBe("IN_REVIEW");
    expect(r.decision!.reason).toBe("Over the $250 auto limit; merchant is new.");
    expect(r.next_actions).toContain("open_review");
    const after = engine.review(r.id, { action: "approve", note: "Budget confirmed." }, r.version, reviewer);
    expect(after.status).toBe("ALLOWED");
    expect(after.keys.policy.by).toBe("M. Okafor");
  });

  it("C (T1): blocked requests never reach PayPal", () => {
    const { engine } = setup();
    const r = run(engine, "c_blocked");
    expect(r.status).toBe("BLOCKED");
    expect(r.decision!.reason).toBe("Gift cards are a blocked category; over the $1,000 cap.");
    expect(r.evaluation!.risk.signals.map((s) => s.code)).toContain("prompt_injection");
    expect(() => engine.startCheckout(r.id, operator)).toThrow(/never reach PayPal/);
    expect(paypalEvents(engine, r.id)).toHaveLength(0);
    expect(r.next_actions).toEqual([]);
  });

  it("D1 (T2): a retry with the same key replays instead of creating a request", () => {
    const { engine } = setup();
    const a = run(engine, "a_low_risk");
    const res = engine.runScenario("d_retry");
    expect(res.replayed).toBe(true);
    expect(res.request.id).toBe(a.id);
    expect(Object.keys(engine.state.requests)).toHaveLength(1);
    expect(engine.listAudit({ type: ["idempotency.replayed"] }).data.length).toBeGreaterThanOrEqual(1);
  });

  it("D2 (T3): same purchase with a new key inside 10 minutes is blocked as a duplicate", () => {
    const { engine, advance } = setup();
    const a = run(engine, "a_low_risk");
    advance(2 * 60_000);
    const d = run(engine, "d_duplicate");
    expect(d.status).toBe("BLOCKED");
    expect(d.duplicate_of).toBe(a.id);
    expect(d.evaluation!.risk.status).toBe("skipped");
    expect(d.decision!.reason).toBe("Duplicate of a request made 2 minutes ago.");
  });

  it("D3 (T4): a second concurrent capture is refused", () => {
    const { engine } = setup();
    const r = run(engine, "a_low_risk");
    const { payment } = engine.startCheckout(r.id, operator);
    engine.payerApprove(payment.id);
    engine.beginCapture(payment.id, "none", operator);
    expect(() => engine.beginCapture(payment.id, "none", operator)).toThrow(/already in progress/);
  });

  it("E (T5): a declined capture is recoverable on the same order and never shown as paid", () => {
    const { engine } = setup();
    const r = run(engine, "e_capture_declined");
    expect(r.status).toBe("ALLOWED");
    const first = pay(engine, r.id, "instrument_declined");
    expect(first.purchase_request.status).toBe("PAYMENT_FAILED");
    expect(first.payment.failure?.retryable).toBe(true);
    expect(first.payment.paypal.capture_id).toBeNull();
    expect(first.purchase_request.next_actions).toContain("retry_payment");
    const orderId = first.payment.paypal.order_id;
    const second = pay(engine, r.id);
    expect(second.payment.paypal.order_id).toBe(orderId);
    expect(second.payment.attempts.map((a) => a.status)).toEqual(["declined", "completed"]);
    expect(second.purchase_request.status).toBe("PAID");
  });
});

describe("invariants", () => {
  const risk = (over: Partial<RiskAssessment>): RiskAssessment => ({
    status: "completed", score: 10, level: "low", recommendation: "none", signals: [], summary: null,
    model: "m", prompt_version: "r", latency_ms: 1, assessed_at: null, ...over,
  });

  it("T6: unavailable risk never auto-allows", () => {
    expect(combine(["pass"], risk({ status: "unavailable", score: null })).outcome).toBe("REVIEW");
  });

  it("T7: AI cannot relax a rule and cannot block on its own", () => {
    expect(combine(["review"], risk({ score: 5 })).outcome).toBe("REVIEW");
    expect(combine(["pass"], risk({ score: 95, level: "high" })).outcome).toBe("REVIEW");
    expect(combine(["block"], risk({ score: 0 })).outcome).toBe("BLOCK");
  });

  it("T8: a stale version is rejected", () => {
    const { engine } = setup();
    const r = run(engine, "b_needs_review");
    expect(() => engine.review(r.id, { action: "approve" }, r.version - 1, reviewer)).toThrow(/changed/);
  });

  it("T9: approval expires after 30 minutes", () => {
    const { engine, advance } = setup();
    const r = run(engine, "a_low_risk");
    advance(31 * 60_000);
    expect(() => engine.startCheckout(r.id, operator)).toThrow(/expired/);
    expect(engine.get(r.id, "operator").status).toBe("EXPIRED");
  });

  it("T10: the audit chain verifies, and detects tampering", () => {
    const { engine } = setup();
    engine.seedHistory();
    run(engine, "b_needs_review");
    expect(engine.verifyChain().ok).toBe(true);
    engine.tamper(3, "edited");
    expect(engine.verifyChain()).toMatchObject({ ok: false, broken_at_seq: 3 });
  });

  it("operators cannot review", () => {
    const { engine } = setup();
    const r = run(engine, "b_needs_review");
    expect(() => engine.review(r.id, { action: "approve" }, r.version, operator)).toThrow(/Only reviewers/);
  });

  it("every adapter output conforms to the contract", () => {
    const { engine } = setup();
    engine.seedHistory();
    for (const k of ["a_low_risk", "b_needs_review", "c_blocked", "e_capture_declined"] as const) run(engine, k);
    for (const r of engine.list({}, "reviewer").data) expect(() => PurchaseRequest.parse(r)).not.toThrow();
    for (const p of Object.values(engine.state.payments)) expect(() => Payment.parse(p)).not.toThrow();
    for (const e of engine.state.events) expect(() => AuditEvent.parse(e)).not.toThrow();
  });
});
