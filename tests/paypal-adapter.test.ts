import { describe, it, expect, vi } from "vitest";
import { SandboxPayPal, PayPalError, Order } from "@/server/paypal/client";
import { config } from "@/server/config";
import { cfg, harness } from "./backend-helpers";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import type { StoredPayment } from "@/server/model";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "paypal-debug-id": "debug" },
  });
describe("real Sandbox adapter HTTP boundary (stub transport)", () => {
  it("hard rejects production hosts and insecure application origins", () => {
    expect(() =>
      config({ ...cfg, PAYPAL_API_BASE: "https://api-m.paypal.com" }),
    ).toThrow();
    expect(() =>
      config({ ...cfg, APP_URL: "http://public.example" }),
    ).toThrow();
    expect(
      () =>
        new SandboxPayPal({
          ...cfg,
          PAYPAL_API_BASE: "https://api-m.paypal.com",
        } as never),
    ).toThrow();
  });
  it("uses OAuth, persisted quote, fixed payee, deterministic IDs and negative-testing headers", async () => {
    const h = await harness();
    const r = await h.service.create(SCENARIOS[0]!.payload, "agt_research01");
    await h.service.checkout(r.id, {
      kind: "operator",
      id: "x",
      name: "Operator",
    });
    const p = (await h.store.tx(
      (s) => Object.values(s.payments)[0]!,
    )) as StoredPayment;
    const o = await h.paypal.get(p.paypal.order_id!);
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ access_token: "private-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(json(o, 201))
      .mockResolvedValueOnce(json({ ...o, status: "APPROVED" }))
      .mockResolvedValueOnce(json({ ...o, status: "COMPLETED" }));
    const adapter = new SandboxPayPal(cfg, transport);
    await adapter.create(r, p);
    await adapter.get(o.id);
    await adapter.capture(o.id, `cap_${p.id}_1`, true);
    expect(transport).toHaveBeenCalledTimes(4);
    const create = transport.mock.calls[1]!;
    expect(create[0]).toBe(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders",
    );
    const init = create[1]!;
    const body = JSON.parse(String(init.body));
    expect(body.purchase_units[0].amount.value).toBe("18.00");
    expect(body.purchase_units[0].payee.merchant_id).toBe("MERCHANT");
    expect(body.purchase_units[0].custom_id).toBe(r.id);
    expect((init.headers as Record<string, string>)["PayPal-Request-Id"]).toBe(
      `ord_${p.id}`,
    );
    expect((init.headers as Record<string, string>).Prefer).toBe(
      "return=representation",
    );
    expect(
      (transport.mock.calls[3]![1]!.headers as Record<string, string>)[
        "PayPal-Mock-Response"
      ],
    ).toContain("INSTRUMENT_DECLINED");
    expect(
      transport.mock.calls.every((c) =>
        String(c[0]).startsWith("https://api-m.sandbox.paypal.com/"),
      ),
    ).toBe(true);
    Order.parse(o);
  });
  it("transient order-create retries reuse the same PayPal ID and report safe retry events", async () => {
    const h = await harness();
    const r = await h.service.create(SCENARIOS[0]!.payload, "agt_research01");
    const checkout = await h.service.checkout(r.id, {
      kind: "operator",
      id: "op",
      name: "Operator",
    });
    const stored = await h.store.tx((s) => s.payments[checkout.payment.id]!);
    const order = await h.paypal.get(checkout.payment.paypal.order_id!);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ access_token: "private-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(json({ name: "INTERNAL_SERVER_ERROR" }, 503))
      .mockResolvedValueOnce(json(order, 201));
    const retry = vi.fn().mockResolvedValue(undefined);
    const adapter = new SandboxPayPal(cfg, fetcher, retry);
    expect((await adapter.create(r, stored)).id).toBe(order.id);
    const requests = fetcher.mock.calls
      .slice(1)
      .map(
        (x) => (x[1]!.headers as Record<string, string>)["PayPal-Request-Id"],
      );
    expect(requests).toEqual([`ord_${stored.id}`, `ord_${stored.id}`]);
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_id: stored.id,
        attempt: 2,
        failure_code: "INTERNAL_SERVER_ERROR",
      }),
    );
    expect(JSON.stringify(retry.mock.calls)).not.toContain("private-token");
  });
  it("maps PayPal issue and debug ID without exposing upstream payload", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ access_token: "private-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        json(
          {
            name: "UNPROCESSABLE_ENTITY",
            details: [{ issue: "INSTRUMENT_DECLINED" }],
            secret: "never log",
          },
          422,
        ),
      );
    const adapter = new SandboxPayPal(cfg, transport);
    const e = await adapter
      .capture("ORDER", "capture-key", false)
      .catch((e) => e);
    expect(e).toBeInstanceOf(PayPalError);
    expect(e.issue).toBe("INSTRUMENT_DECLINED");
    expect(e.debug).toBe("debug");
    expect(JSON.stringify(e)).not.toContain("never log");
  });
  it("upstream error metadata cannot persist raw payloads or credential-shaped values", () => {
    const error = new PayPalError(
      502,
      "token=private-upstream-value",
      "sk-privatecredential",
    );
    expect(error.issue).toBe("PAYPAL_ERROR");
    expect(error.debug).toBeNull();
    expect(JSON.stringify(error)).not.toMatch(
      /private-upstream-value|privatecredential/,
    );
  });
  it("verifies webhook via official endpoint and rejects untrusted certificate hosts", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ access_token: "token", expires_in: 3600 }))
      .mockResolvedValueOnce(json({ verification_status: "SUCCESS" }));
    const adapter = new SandboxPayPal(
      { ...cfg, PAYPAL_WEBHOOK_ID: "WH-CONFIG" },
      transport,
    );
    expect(
      await adapter.verify(
        new Headers({ "paypal-cert-url": "http://127.0.0.1/private" }),
        {},
      ),
    ).toBe(false);
    expect(transport).not.toHaveBeenCalled();
    const headers = new Headers({
      "paypal-cert-url":
        "https://api.sandbox.paypal.com/v1/notifications/certs/CERT",
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-transmission-id": "id",
      "paypal-transmission-sig": "sig",
      "paypal-transmission-time": "time",
    });
    expect(await adapter.verify(headers, { id: "evt" })).toBe(true);
    expect(transport.mock.calls[1]![0]).toBe(
      "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
    );
  });
});
