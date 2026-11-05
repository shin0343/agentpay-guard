import { describe, expect, it } from "vitest";
import { PurchaseRequest, RequestWithPayment } from "@/contract";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import { Order, PayPalError, SandboxPayPal } from "@/server/paypal/client";
import { GuardService } from "@/server/service";
import { GuardHttp } from "@/server/http";
import { SafeRiskAssessor } from "@/server/risk/assessor";
import { isVerifiedPaid, paymentOutcome } from "@/lib/copy";
import { cfg, harness } from "./backend-helpers";

async function prepared() {
  const h = await harness();
  const created = await h.call("purchase-requests", {
    method: "POST",
    role: "agent",
    body: SCENARIOS.find((s) => s.key === "a_low_risk")!.payload,
  });
  const request = PurchaseRequest.parse(await created.json());
  const checked = await h.call(`purchase-requests/${request.id}/checkout`, {
    method: "POST",
    body: {},
  });
  const result = RequestWithPayment.parse(await checked.json());
  return { ...h, ...result };
}

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const post = { method: "POST", body: {} };

describe("independent settlement security verification", () => {
  it("concurrent capture and reconcile preserve one side effect and final Paid", async () => {
    const h = await prepared();
    h.paypal.approve(h.payment.paypal.order_id!);
    const started = gate();
    const release = gate();
    const capture = h.paypal.capture.bind(h.paypal);
    h.paypal.capture = async (...args) => {
      started.resolve();
      await release.promise;
      return capture(...args);
    };
    const original = h.call(`payments/${h.payment.id}/capture`, post);
    await started.promise;
    const concurrent = await h.call(`payments/${h.payment.id}/reconcile`, post);
    expect(
      RequestWithPayment.parse(await concurrent.json()).payment.status,
    ).toBe("CAPTURING");
    release.resolve();
    const result = RequestWithPayment.parse(await (await original).json());
    expect(result.purchase_request.status).toBe("PAID");
    expect(result.payment.status).toBe("COMPLETED");
    expect(h.paypal.captures).toBe(1);
    expect(result.payment.attempts).toHaveLength(1);
  });

  it("malformed returned capture remains unknown and a later verified read recovers it", async () => {
    const h = await prepared();
    h.paypal.approve(h.payment.paypal.order_id!);
    const capture = h.paypal.capture.bind(h.paypal);
    h.paypal.capture = async (...args) => {
      const order = await capture(...args);
      order.purchase_units[0]!.payments!.captures![0]!.amount.value = "0.01";
      return order;
    };
    const original = RequestWithPayment.parse(
      await (await h.call(`payments/${h.payment.id}/capture`, post)).json(),
    );
    expect(original.payment.status).toBe("CAPTURING");
    expect(original.payment.attempts[0]!.status).toBe("unknown");
    const result = RequestWithPayment.parse(
      await (await h.call(`payments/${h.payment.id}/reconcile`, post)).json(),
    );
    expect(result.payment.status).toBe("COMPLETED");
    expect(result.purchase_request.status).toBe("PAID");
    expect(h.paypal.captures).toBe(1);
  });

  it("recovery of an unknown capture always reuses the original provider id", async () => {
    const h = await prepared();
    h.paypal.approve(h.payment.paypal.order_id!);
    h.paypal.failCapture = new PayPalError(0, "NETWORK_UNKNOWN");
    const keys: string[] = [];
    const capture = h.paypal.capture.bind(h.paypal);
    h.paypal.capture = async (...args) => {
      keys.push(args[1]);
      return capture(...args);
    };
    await h.call(`payments/${h.payment.id}/capture`, post);
    h.paypal.failCapture = undefined;
    const result = RequestWithPayment.parse(
      await (await h.call(`payments/${h.payment.id}/reconcile`, post)).json(),
    );
    expect(result.payment.status).toBe("COMPLETED");
    expect(keys).toEqual([`cap_${h.payment.id}_1`, `cap_${h.payment.id}_1`]);
    expect(result.payment.attempts).toHaveLength(1);
  });

  it("a stale unapproved GET cannot corrupt completed payment metadata", async () => {
    const h = await prepared();
    const started = gate();
    const release = gate();
    const get = h.paypal.get.bind(h.paypal);
    let first = true;
    h.paypal.get = async (...args) => {
      const result = await get(...args);
      if (first) {
        first = false;
        started.resolve();
        await release.promise;
      }
      return result;
    };
    const stale = h.call(`payments/${h.payment.id}/capture`, post);
    await started.promise;
    h.paypal.approve(h.payment.paypal.order_id!);
    const captured = RequestWithPayment.parse(
      await (await h.call(`payments/${h.payment.id}/capture`, post)).json(),
    );
    expect(captured.purchase_request.status).toBe("PAID");
    release.resolve();
    const result = RequestWithPayment.parse(await (await stale).json());
    expect(result.purchase_request.status).toBe("PAID");
    expect(result.payment.status).toBe("COMPLETED");
    expect(result.payment.failure).toBeNull();
    expect(result.payment.paypal.order_status).toBe("COMPLETED");
    expect(result.payment.paypal.capture_status).toBe("COMPLETED");
    expect(h.paypal.captures).toBe(1);
  });

  it("contradictory VOIDED/COMPLETED response stays unknown", async () => {
    const h = await prepared();
    h.paypal.approve(h.payment.paypal.order_id!);
    h.paypal.failCapture = new PayPalError(0, "NETWORK_UNKNOWN");
    await h.call(`payments/${h.payment.id}/capture`, post);
    const order = h.paypal.orders.get(h.payment.paypal.order_id!)!;
    order.status = "VOIDED";
    order.purchase_units[0]!.payments = {
      captures: [
        {
          id: "CAPTUREPROOF",
          status: "COMPLETED",
          amount: h.payment.amount,
          final_capture: true,
        },
      ],
    };
    expect(Order.safeParse(order).success).toBe(true);
    const response = await h.call(`payments/${h.payment.id}/reconcile`, post);
    expect(response.status).toBe(502);
    const payment = await h.store.tx((state) => state.payments[h.payment.id]!);
    expect(payment.status).toBe("CAPTURING");
    expect(payment.failure).toBeNull();
  });

  it.each(["", " "])(
    "a malformed capture id %j stays unknown until a verified read recovers it",
    async (captureId) => {
      const h = await prepared();
      h.paypal.approve(h.payment.paypal.order_id!);
      const capture = h.paypal.capture.bind(h.paypal);
      h.paypal.capture = async (...args) => {
        const order = await capture(...args);
        order.purchase_units[0]!.payments!.captures![0]!.id = captureId;
        expect(Order.safeParse(order).success).toBe(false);
        return order;
      };
      const response = await h.call(`payments/${h.payment.id}/capture`, post);
      expect(response.status).toBe(200);
      const result = RequestWithPayment.parse(await response.json());
      expect(result.purchase_request.status).toBe("CAPTURING");
      expect(result.payment.status).toBe("CAPTURING");
      expect(result.payment.paypal.capture_id).toBeNull();
      expect(isVerifiedPaid(result.payment, result.purchase_request)).toBe(
        false,
      );
      expect(paymentOutcome(result.payment, result.purchase_request).word).toBe(
        "Confirming.",
      );
      const getsBefore = h.paypal.gets;
      const reconciled = RequestWithPayment.parse(
        await (await h.call(`payments/${h.payment.id}/reconcile`, post)).json(),
      );
      expect(h.paypal.gets).toBe(getsBefore + 1);
      expect(reconciled.purchase_request.status).toBe("PAID");
      expect(reconciled.payment.paypal.capture_id).toBeTruthy();
      // The fake provider has the real capture id; only the transient response was malformed.
      expect(
        h.paypal.orders.get(h.payment.paypal.order_id!)!.purchase_units[0]!
          .payments!.captures![0]!.id,
      ).not.toBe("");
    },
  );

  it.each([400, 403, 422, 429])(
    "HTTP %i on replay cannot prove failure of an earlier unknown capture",
    async (status) => {
      const h = await prepared();
      h.paypal.approve(h.payment.paypal.order_id!);
      h.paypal.failCapture = new PayPalError(0, "NETWORK_UNKNOWN");
      await h.call(`payments/${h.payment.id}/capture`, post);
      h.paypal.failCapture = new PayPalError(status, "REPLAY_REJECTED");
      const result = RequestWithPayment.parse(
        await (await h.call(`payments/${h.payment.id}/reconcile`, post)).json(),
      );
      expect(result.payment.status).toBe("CAPTURING");
      expect(result.purchase_request.status).toBe("CAPTURING");
      expect(result.payment.failure).toBeNull();
      expect(result.payment.attempts).toHaveLength(1);
      expect(result.payment.attempts[0]!.status).toBe("unknown");
      expect(
        (
          await h.call(
            `purchase-requests/${h.purchase_request.id}/cancel`,
            post,
          )
        ).status,
      ).toBe(409);
    },
  );

  it.each([undefined, "PREVIOUS_REQUEST_IN_PROGRESS"])(
    "real client timeout followed by HTTP 409 (%j) stays recoverable",
    async (issue) => {
      const h = await prepared();
      h.paypal.approve(h.payment.paypal.order_id!);
      const providerOrder = structuredClone(
        h.paypal.orders.get(h.payment.paypal.order_id!)!,
      );
      const captureKeys: string[] = [];
      let reads = 0;
      let originalStillProcessing = false;
      let clientAborted = false;
      const json = (value: unknown, status = 200) =>
        new Response(JSON.stringify(value), {
          status,
          headers: { "content-type": "application/json" },
        });
      const transport: typeof fetch = async (url, init) => {
        const path = new URL(String(url)).pathname;
        if (path === "/v1/oauth2/token")
          return json({ access_token: "stub-token", expires_in: 3600 });
        if (path === "/v1/notifications/verify-webhook-signature")
          return json({ verification_status: "SUCCESS" });
        if (path === `/v2/checkout/orders/${providerOrder.id}`) {
          reads++;
          return json(providerOrder);
        }
        if (path === `/v2/checkout/orders/${providerOrder.id}/capture`) {
          captureKeys.push(
            new Headers(init?.headers).get("PayPal-Request-Id")!,
          );
          if (captureKeys.length === 1) {
            // PayPal accepted the work. Aborting the HTTP client does not cancel it.
            originalStillProcessing = true;
            return new Promise<Response>((_resolve, reject) => {
              init!.signal!.addEventListener(
                "abort",
                () => {
                  clientAborted = true;
                  reject(init!.signal!.reason);
                },
                { once: true },
              );
            });
          }
          expect(originalStillProcessing).toBe(true);
          return json(
            {
              name: "RESOURCE_CONFLICT",
              ...(issue ? { details: [{ issue }] } : {}),
            },
            409,
          );
        }
        throw new Error(`Unexpected transport path: ${path}`);
      };
      const settings = { ...cfg, PAYPAL_WEBHOOK_ID: "WH-STUB" };
      const adapter = new SandboxPayPal(settings, transport);
      const service = new GuardService(
        h.store,
        adapter,
        new SafeRiskAssessor("fixture"),
        "MERCHANT",
        true,
      );
      const actor = {
        kind: "operator",
        id: "operator",
        name: "Operator",
      } as const;

      // This uses SandboxPayPal's real AbortSignal.timeout(15000), without fake timers.
      const timedOut = await service.capture(h.payment.id, actor);
      expect(clientAborted).toBe(true);
      expect(originalStillProcessing).toBe(true);
      expect(timedOut.payment.status).toBe("CAPTURING");
      expect(timedOut.payment.attempts[0]!.status).toBe("unknown");
      expect(
        await h.store.tx((s) => s.payments[h.payment.id]!.capture_claim_until),
      ).toBe(0);

      // Recovery GET sees APPROVED because the original capture has not finished yet.
      const failed = await service.reconcile(h.payment.id, actor);
      expect(captureKeys).toEqual([
        `cap_${h.payment.id}_1`,
        `cap_${h.payment.id}_1`,
      ]);
      expect(failed.payment.attempts).toHaveLength(1);
      expect(failed.payment.attempts[0]!.status).toBe("unknown");
      expect(failed.payment.status).toBe("CAPTURING");
      expect(failed.purchase_request.status).toBe("CAPTURING");
      expect(failed.payment.failure).toBeNull();
      const lease = await h.store.tx(
        (state) => state.payments[h.payment.id]!.capture_claim_until,
      );
      expect(lease).toBeGreaterThan(Date.now());
      await service.reconcile(h.payment.id, actor);
      expect(captureKeys).toHaveLength(2);
      expect(paymentOutcome(failed.payment, failed.purchase_request).word).toBe(
        "Confirming.",
      );

      // The original accepted operation now really completes at the provider.
      originalStillProcessing = false;
      providerOrder.status = "COMPLETED";
      providerOrder.purchase_units[0]!.payments = {
        captures: [
          {
            id: "CAPTUREORIGINAL",
            status: "COMPLETED",
            amount: h.payment.amount,
            final_capture: true,
          },
        ],
      };
      const readsBefore = reads;
      if (!issue) {
        const afterCompletion = await service.reconcile(h.payment.id, actor);
        expect(reads).toBe(readsBefore + 1);
        expect(afterCompletion.payment.status).toBe("COMPLETED");
        expect(afterCompletion.payment.paypal.capture_id).toBe(
          "CAPTUREORIGINAL",
        );
      }

      // The other variant recovers directly through a verified completion webhook.
      // Replaying that event must never produce another capture or provider read.
      const http = new GuardHttp(service, settings);
      const webhookRequest = () =>
        new Request("http://localhost:3000/api/v1/webhooks/paypal", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "paypal-cert-url":
              "https://api.sandbox.paypal.com/v1/notifications/certs/STUB",
          },
          body: JSON.stringify({
            id: "WH-CAPTURE-ORIGINAL",
            event_type: "PAYMENT.CAPTURE.COMPLETED",
            resource: {
              id: "CAPTUREORIGINAL",
              supplementary_data: {
                related_ids: { order_id: providerOrder.id },
              },
            },
          }),
        });
      const webhook = await http.handle(webhookRequest());
      expect(webhook.status).toBe(200);
      expect(reads).toBe(readsBefore + 1);
      expect((await http.handle(webhookRequest())).status).toBe(200);
      expect(reads).toBe(readsBefore + 1);
      const saved = await h.store.tx((s) => ({
        payment: s.payments[h.payment.id]!,
        request: s.requests[h.purchase_request.id]!,
        webhook: s.webhooks["WH-CAPTURE-ORIGINAL"],
      }));
      expect(saved.webhook).toBeDefined();
      expect(saved.payment.status).toBe("COMPLETED");
      expect(saved.payment.paypal.capture_id).toBe("CAPTUREORIGINAL");
      expect(saved.request.status).toBe("PAID");
      expect(captureKeys).toHaveLength(2);
    },
    20000,
  );
});
