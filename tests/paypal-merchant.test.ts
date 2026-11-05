import { describe, it, expect } from "vitest";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import { GuardService } from "@/server/service";
import { SafeRiskAssessor } from "@/server/risk/assessor";
import { harness } from "./backend-helpers";
import { Order } from "@/server/paypal/client";
const operator = { kind: "operator", id: "op", name: "Operator" } as const;
async function prepare(merchant?: string) {
  const h = await harness();
  const service = new GuardService(
    h.store,
    h.paypal,
    new SafeRiskAssessor("fixture"),
    merchant,
    true,
  );
  const r = await service.create(SCENARIOS[0]!.payload, "agt_research01");
  return { ...h, service, r };
}
describe("single-merchant recipient binding", () => {
  it("persists the authenticated create recipient, hides it publicly, and completes one capture", async () => {
    const h = await prepare();
    const result = await h.service.checkout(h.r.id, operator);
    const p = await h.store.tx((s) => s.payments[result.payment.id]!);
    expect(p.paypal_merchant_id).toBe("MERCHANT");
    expect(result.payment).not.toHaveProperty("paypal_merchant_id");
    h.paypal.approve(p.paypal.order_id!);
    expect(
      (await h.service.capture(p.id, operator)).purchase_request.status,
    ).toBe("PAID");
    await h.service.capture(p.id, operator);
    expect(h.paypal.captures).toBe(1);
  });
  it("rejects substituted payee on later reads before any capture", async () => {
    const h = await prepare();
    const result = await h.service.checkout(h.r.id, operator);
    const order = h.paypal.orders.get(result.payment.paypal.order_id!)!;
    order.status = "APPROVED";
    order.purchase_units[0]!.payee.merchant_id = "ATTACKER";
    await expect(
      h.service.capture(result.payment.id, operator),
    ).rejects.toMatchObject({ code: "PAYPAL_REJECTED" });
    expect(h.paypal.captures).toBe(0);
  });
  it("rejects substituted payee in a capture response and leaves outcome unknown", async () => {
    const h = await prepare();
    const result = await h.service.checkout(h.r.id, operator);
    h.paypal.approve(result.payment.paypal.order_id!);
    const capture = h.paypal.capture.bind(h.paypal);
    h.paypal.capture = async (...args) => {
      const order = await capture(...args);
      order.purchase_units[0]!.payee.merchant_id = "ATTACKER";
      return order;
    };
    const unknown = await h.service.capture(result.payment.id, operator);
    expect(unknown.payment.status).toBe("CAPTURING");
    expect(unknown.payment.attempts[0]!.status).toBe("unknown");
    expect(unknown.purchase_request.status).toBe("CAPTURING");
  });
  it("still enforces an explicit configured merchant on creation", async () => {
    const h = await prepare("OTHER");
    await expect(h.service.checkout(h.r.id, operator)).rejects.toMatchObject({
      code: "PAYPAL_REJECTED",
    });
    expect(
      await h.store.tx((s) => Object.values(s.payments)[0]!.paypal_merchant_id),
    ).toBeUndefined();
    expect(h.paypal.captures).toBe(0);
  });
  it("fails closed for an unbound legacy payment without configured merchant", async () => {
    const h = await prepare();
    const result = await h.service.checkout(h.r.id, operator);
    await h.store.tx((s) => {
      delete s.payments[result.payment.id]!.paypal_merchant_id;
    });
    h.paypal.approve(result.payment.paypal.order_id!);
    await expect(
      h.service.capture(result.payment.id, operator),
    ).rejects.toMatchObject({ code: "PAYPAL_REJECTED" });
    expect(h.paypal.captures).toBe(0);
  });
  it("retains configured merchant verification for legacy records and rejects config drift", async () => {
    const h = await prepare("MERCHANT");
    const result = await h.service.checkout(h.r.id, operator);
    h.paypal.approve(result.payment.paypal.order_id!);
    const changed = new GuardService(
      h.store,
      h.paypal,
      new SafeRiskAssessor("fixture"),
      "OTHER",
      true,
    );
    await expect(
      changed.capture(result.payment.id, operator),
    ).rejects.toMatchObject({ code: "PAYPAL_REJECTED" });
    await h.store.tx((s) => {
      delete s.payments[result.payment.id]!.paypal_merchant_id;
    });
    expect(
      (await h.service.capture(result.payment.id, operator)).payment.status,
    ).toBe("COMPLETED");
  });
  it("rejects empty merchant IDs in provider responses", async () => {
    const h = await prepare();
    const result = await h.service.checkout(h.r.id, operator);
    const order = await h.paypal.get(result.payment.paypal.order_id!);
    order.purchase_units[0]!.payee.merchant_id = "";
    expect(Order.safeParse(order).success).toBe(false);
  });
});
