import { describe, expect, it } from "vitest";
import { PurchaseRequest, RequestWithPayment } from "@/contract";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import { cfg, harness } from "./backend-helpers";
import { config } from "@/server/config";
import { GuardHttp } from "@/server/http";

const scenario = (key: string) =>
  structuredClone(SCENARIOS.find((item) => item.key === key)!.payload);
async function prepare() {
  const h = await harness();
  const request = await h.service.create(
    scenario("a_low_risk"),
    "agt_research01",
  );
  const checkout = await h.call(`purchase-requests/${request.id}/checkout`, {
    method: "POST",
    body: {},
  });
  return { ...h, ...RequestWithPayment.parse(await checkout.json()) };
}

describe("adversarial authorization and immutable purchase boundaries", () => {
  it("every payment-changing route denies anonymous and agent callers and missing CSRF", async () => {
    const h = await prepare();
    for (const path of [
      `purchase-requests/${h.purchase_request.id}/checkout`,
      `payments/${h.payment.id}/capture`,
      `payments/${h.payment.id}/reconcile`,
      `payments/${h.payment.id}/payer-cancel`,
    ]) {
      for (const role of ["anonymous", "agent"] as const) {
        const response = await h.call(path, { method: "POST", role, body: {} });
        expect(response.status, `${role}: ${path}`).toBe(
          role === "anonymous" ? 401 : 403,
        );
      }
      expect(
        (await h.call(path, { method: "POST", body: {}, csrf: false })).status,
      ).toBe(403);
    }
    expect(h.paypal.captures + h.paypal.gets).toBe(0);
    expect(h.paypal.creates).toBe(1);
  });

  it("cannot capture a blocked/review request, approve a rejected request, or mutate money after evaluation", async () => {
    const h = await harness();
    for (const [key, agent, status] of [
      ["c_blocked", "agt_growth01", "BLOCKED"],
      ["b_needs_review", "agt_research01", "IN_REVIEW"],
    ] as const) {
      const request = await h.service.create(scenario(key), agent);
      expect(request.status).toBe(status);
      expect(
        (
          await h.call(`purchase-requests/${request.id}/checkout`, {
            method: "POST",
            body: {},
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await h.call(`payments/${request.id}/capture`, {
            method: "POST",
            body: {},
          })
        ).status,
      ).toBe(404);
      if (status === "IN_REVIEW") {
        const rejected = PurchaseRequest.parse(
          await (
            await h.call(`purchase-requests/${request.id}/reviews`, {
              method: "POST",
              version: request.version,
              body: { action: "reject", note: "Outside budget." },
            })
          ).json(),
        );
        expect(
          (
            await h.call(`purchase-requests/${request.id}/reviews`, {
              method: "POST",
              version: rejected.version,
              body: { action: "approve" },
            })
          ).status,
        ).toBe(409);
        expect(
          PurchaseRequest.parse(
            await (await h.call(`purchase-requests/${request.id}`)).json(),
          ).review?.action,
        ).toBe("reject");
      }
    }
    expect(h.paypal.creates + h.paypal.captures + h.paypal.gets).toBe(0);
    const allowed = await h.service.create(
      scenario("a_low_risk"),
      "agt_research01",
    );
    const forged = { amount: { currency_code: "USD", value: "0.01" } };
    expect(
      (
        await h.call(`purchase-requests/${allowed.id}/checkout`, {
          method: "POST",
          body: forged,
        })
      ).status,
    ).toBe(422);
    expect(
      PurchaseRequest.parse(
        await (await h.call(`purchase-requests/${allowed.id}`)).json(),
      ).amount.value,
    ).toBe("18.00");
    expect(h.paypal.creates).toBe(0);
  });

  it("foreign orders and client-supplied payment/resource identifiers cannot cross request ownership", async () => {
    const h = await prepare();
    const other = await h.service.create(
      scenario("e_capture_declined"),
      "agt_opsbuyer01",
    );
    const otherCheckout = RequestWithPayment.parse(
      await (
        await h.call(`purchase-requests/${other.id}/checkout`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    const own = h.paypal.orders.get(h.payment.paypal.order_id!)!;
    const foreign = h.paypal.orders.get(
      otherCheckout.payment.paypal.order_id!,
    )!;
    h.paypal.get = async () =>
      structuredClone({ ...foreign, id: own.id, status: "APPROVED" });
    expect(
      (
        await h.call(`payments/${h.payment.id}/capture`, {
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(502);
    for (const path of [
      `payments/${h.payment.id}/capture`,
      `payments/${h.payment.id}/reconcile`,
      `payments/${h.payment.id}/payer-cancel`,
    ]) {
      expect(
        (
          await h.call(path, {
            method: "POST",
            body: {
              purchase_request_id: other.id,
              paypal_order_id: foreign.id,
              amount: { currency_code: "USD", value: "96.00" },
            },
          })
        ).status,
      ).toBe(422);
    }
    expect(h.paypal.captures).toBe(0);
  });

  it("verified webhook payload claims cannot settle an uncaptured order; replay is harmless", async () => {
    const h = await prepare();
    const body = {
      id: "WH-FORGED-STATE",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "FAKECAPTURE",
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "9999.00" },
        supplementary_data: {
          related_ids: { order_id: h.payment.paypal.order_id },
        },
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
    const result = await h.store.tx((state) => ({
      request: state.requests[h.purchase_request.id]!,
      payment: state.payments[h.payment.id]!,
    }));
    expect(result.request.status).toBe("CHECKOUT_PENDING");
    expect(result.payment.status).toBe("AWAITING_PAYER");
    expect(result.payment.paypal.capture_id).toBeNull();
    expect(h.paypal.gets).toBe(1);
    expect(h.paypal.captures).toBe(0);
  });

  it("replaying an old approval returns its snapshot but cannot reauthorize a cancelled purchase", async () => {
    const h = await harness();
    const request = await h.service.create(
      scenario("b_needs_review"),
      "agt_research01",
    );
    const path = `purchase-requests/${request.id}/reviews`;
    const approval = {
      method: "POST",
      key: "approval-replay",
      version: request.version,
      body: { action: "approve" },
    };
    expect((await h.call(path, approval)).status).toBe(200);
    expect(
      (
        await h.call(`purchase-requests/${request.id}/cancel`, {
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(200);
    const replay = await h.call(path, approval);
    expect(replay.headers.get("Idempotent-Replayed")).toBe("true");
    expect(PurchaseRequest.parse(await replay.json()).status).toBe("ALLOWED");
    const latest = PurchaseRequest.parse(
      await (await h.call(`purchase-requests/${request.id}`)).json(),
    );
    expect(latest.status).toBe("CANCELLED");
    expect(
      (
        await h.call(`purchase-requests/${request.id}/checkout`, {
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(409);
    expect(
      await h.store.tx((state) =>
        state.events.filter((event) => event.type === "review.approved"),
      ),
    ).toHaveLength(1);
    expect(h.paypal.creates + h.paypal.captures).toBe(0);
  });

  it("malformed money/nested properties never create a request or invoke PayPal", async () => {
    const h = await harness();
    for (const value of [
      "1e3",
      "NaN",
      "Infinity",
      "-18.00",
      "18",
      "18.000",
      "18.00\n",
      18,
      null,
    ]) {
      const input = scenario("a_low_risk");
      const response = await h.call("purchase-requests", {
        method: "POST",
        role: "agent",
        body: { ...input, amount: { currency_code: "USD", value } },
      });
      expect(response.status).toBe(422);
    }
    const input = scenario("a_low_risk");
    expect(
      (
        await h.call("purchase-requests", {
          method: "POST",
          role: "agent",
          body: {
            ...input,
            items: [
              {
                ...input.items[0],
                unit_amount: {
                  ...input.items[0]!.unit_amount,
                  authorized: true,
                },
              },
            ],
          },
        })
      ).status,
    ).toBe(422);
    expect(
      await h.store.tx((state) => Object.keys(state.requests)),
    ).toHaveLength(0);
    expect(h.paypal.creates + h.paypal.captures).toBe(0);
  });

  it("demo endpoints fail closed when disabled, live PayPal and fixture AI misconfiguration are rejected", async () => {
    const h = await harness();
    const http = new GuardHttp(h.service, { ...cfg, DEMO_MODE: "false" });
    const response = await http.handle(
      new Request("http://localhost:3000/api/v1/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: "reviewer" }),
      }),
    );
    expect(response.status).toBe(404);
    expect(() =>
      config({ ...cfg, PAYPAL_API_BASE: "https://api-m.paypal.com" }),
    ).toThrow();
    expect(() =>
      config({ ...cfg, RISK_PROVIDER: "fixture", DEMO_MODE: "false" }),
    ).toThrow();
  });
});
