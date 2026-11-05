import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import { verify } from "@/server/audit/ledger";
import { PayPalError } from "@/server/paypal/client";
import { harness } from "./backend-helpers";
const actor = { kind: "operator", id: "op", name: "Operator" } as const;
async function pending() {
  const h = await harness();
  const r = await h.service.create(SCENARIOS[0]!.payload, "agt_research01");
  const result = await h.service.checkout(r.id, actor);
  h.paypal.approve(result.payment.paypal.order_id!);
  h.paypal.captureStatus = "PENDING";
  await h.service.capture(result.payment.id, actor);
  const order = h.paypal.orders.get(result.payment.paypal.order_id!)!;
  const event = {
    id: "WH-RELIABILITY",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: "UNTRUSTED",
      status: "COMPLETED",
      amount: { value: "0.01", currency_code: "EUR" },
      supplementary_data: { related_ids: { order_id: order.id } },
    },
  };
  const send = (body = event) =>
    h.call("webhooks/paypal", { method: "POST", role: "anonymous", body });
  return { ...h, result, order, event, send };
}
describe("webhook reliability with explicitly controlled PayPal/signature doubles", () => {
  it("ignores payload settlement claims and uses authoritative order state", async () => {
    const h = await pending();
    expect((await h.send()).status).toBe(200);
    expect(
      await h.store.tx((s) => s.payments[h.result.payment.id]!.status),
    ).toBe("PENDING");
    expect(h.paypal.captures).toBe(1);
  });
  it("settles actual completed capture once, deduplicates replay and retains audit integrity", async () => {
    const h = await pending();
    h.order.purchase_units[0]!.payments!.captures![0]!.status = "COMPLETED";
    expect((await h.send()).status).toBe(200);
    const before = await h.store.tx((s) => s.payments[h.result.payment.id]);
    const gets = h.paypal.gets;
    expect((await h.send()).status).toBe(200);
    expect(h.paypal.gets).toBe(gets);
    expect(await h.store.tx((s) => s.payments[h.result.payment.id])).toEqual(
      before,
    );
    expect(before!.status).toBe("COMPLETED");
    expect(h.paypal.captures).toBe(1);
    expect(
      await h.store.tx((s) =>
        s.events.filter((e) => e.type === "webhook.received"),
      ),
    ).toHaveLength(1);
    expect(await h.store.tx((s) => verify(s.events))).toMatchObject({
      ok: true,
    });
  });
  it("does not acknowledge/deduplicate a transient order outage before successful retry", async () => {
    const h = await pending();
    const get = h.paypal.get.bind(h.paypal);
    h.paypal.get = async () => {
      throw new PayPalError(503, "INTERNAL_SERVER_ERROR");
    };
    expect((await h.send()).status).toBe(503);
    expect(await h.store.tx((s) => s.webhooks[h.event.id])).toBeUndefined();
    h.paypal.get = get;
    h.order.purchase_units[0]!.payments!.captures![0]!.status = "COMPLETED";
    expect((await h.send()).status).toBe(200);
    expect(
      await h.store.tx((s) => s.payments[h.result.payment.id]!.status),
    ).toBe("COMPLETED");
    expect(h.paypal.captures).toBe(1);
  });
  it("out-of-order pending/denied events cannot downgrade a completed payment", async () => {
    const h = await pending();
    h.order.purchase_units[0]!.payments!.captures![0]!.status = "COMPLETED";
    await h.send();
    const before = await h.store.tx((s) => s.payments[h.result.payment.id]);
    for (const event_type of [
      "PAYMENT.CAPTURE.PENDING",
      "PAYMENT.CAPTURE.DENIED",
    ]) {
      expect(
        (await h.send({ ...h.event, id: event_type, event_type })).status,
      ).toBe(200);
      expect(await h.store.tx((s) => s.payments[h.result.payment.id])).toEqual(
        before,
      );
    }
    expect(h.paypal.captures).toBe(1);
  });
  it("unknown transaction events are acknowledged idempotently without provider/order side effects", async () => {
    const h = await harness();
    const body = {
      id: "WH-UNKNOWN",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        supplementary_data: { related_ids: { order_id: "UNKNOWN" } },
      },
    };
    for (let i = 0; i < 2; i++)
      expect(
        (
          await h.call("webhooks/paypal", {
            method: "POST",
            role: "anonymous",
            body,
          })
        ).status,
      ).toBe(200);
    expect(h.paypal.gets + h.paypal.creates + h.paypal.captures).toBe(0);
    expect(await h.store.tx((s) => Object.keys(s.webhooks))).toEqual([body.id]);
  });
  it.each(["b_needs_review", "c_blocked"])(
    "cannot authorize or capture an unevaluated-for-payment %s purchase",
    async (key) => {
      const h = await harness();
      const r = await h.service.create(
        SCENARIOS.find((s) => s.key === key)!.payload,
        "agt_research01",
      );
      const before = r.status;
      const body = {
        id: "WH-BYPASS",
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: { id: r.id },
      };
      expect(
        (
          await h.call("webhooks/paypal", {
            method: "POST",
            role: "anonymous",
            body,
          })
        ).status,
      ).toBe(200);
      expect(await h.store.tx((s) => s.requests[r.id]!.status)).toBe(before);
      expect(h.paypal.gets + h.paypal.creates + h.paypal.captures).toBe(0);
    },
  );
});
