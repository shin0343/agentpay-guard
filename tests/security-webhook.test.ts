import { generateKeyPairSync, sign, verify } from "node:crypto";
import { crc32 } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { GuardHttp } from "@/server/http";
import { SandboxPayPal } from "@/server/paypal/client";
import { SafeRiskAssessor } from "@/server/risk/assessor";
import { GuardService } from "@/server/service";
import { cfg, harness } from "./backend-helpers";

const event = {
  id: "WH-LOCAL-TEST",
  event_type: "PAYMENT.CAPTURE.COMPLETED",
  summary: "Paid for onboarding docs and API credits.",
  resource: {
    id: "CAPTURELOCAL",
    supplementary_data: { related_ids: { order_id: "ORDERLOCAL" } },
  },
};
const compact = JSON.stringify(event);

/**
 * A local verification transport following PayPal's documented signature input:
 * transmissionId|timestamp|webhookId|crc32(originalRawBody).
 * This proves preservation behavior without claiming a live PayPal response.
 */
async function receive(rawBody: string, signedBody = rawBody) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const webhookId = "WH-CONFIG-LOCAL";
  const transmissionId = "transmission-local";
  const time = "2026-11-04T00:00:00Z";
  const signedMessage = `${transmissionId}|${time}|${webhookId}|${crc32(Buffer.from(signedBody))}`;
  const signature = sign("sha256", Buffer.from(signedMessage), privateKey);
  let postedEvent: string | undefined;
  const transport = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url, init) => {
      if (String(url).endsWith("/v1/oauth2/token"))
        return Response.json({
          access_token: "synthetic-token",
          expires_in: 3600,
        });
      expect(String(url)).toBe(
        "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
      );
      const body = String(init?.body);
      const fields = JSON.parse(body);
      // webhook_event is the final member in this adapter's verification payload.
      const marker = '"webhook_event":';
      expect(body).toContain(marker);
      postedEvent = body.slice(body.indexOf(marker) + marker.length, -1);
      const postedMessage = `${fields.transmission_id}|${fields.transmission_time}|${fields.webhook_id}|${crc32(Buffer.from(postedEvent))}`;
      const valid = verify(
        "sha256",
        Buffer.from(postedMessage),
        publicKey,
        Buffer.from(fields.transmission_sig, "base64"),
      );
      return Response.json({
        verification_status: valid ? "SUCCESS" : "FAILURE",
      });
    });
  const h = await harness();
  const adapter = new SandboxPayPal(
    { ...cfg, PAYPAL_WEBHOOK_ID: webhookId },
    transport,
  );
  const service = new GuardService(
    h.store,
    adapter,
    new SafeRiskAssessor("fixture"),
    "MERCHANT",
    true,
  );
  const http = new GuardHttp(service, cfg);
  const before = await h.store.tx((s) => s);
  const response = await http.handle(
    new Request("http://localhost:3000/api/v1/webhooks/paypal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "paypal-cert-url":
          "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-LOCAL",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-transmission-id": transmissionId,
        "paypal-transmission-time": time,
        "paypal-transmission-sig": signature.toString("base64"),
      },
      body: rawBody,
    }),
  );
  return {
    response,
    before,
    after: await h.store.tx((s) => s),
    postedEvent,
    transport,
  };
}

describe("security verification: webhook raw-body preservation", () => {
  it("a compact webhook retains its bytes and passes the local signature verifier", async () => {
    const result = await receive(compact);
    expect(result.postedEvent).toBe(compact);
    expect(result.response.status).toBe(200);
    expect(result.after.webhooks[event.id]).toEqual({ id: event.id });
    expect(result.transport).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["whitespace", JSON.stringify(event, null, 2)],
    ["Unicode escape", compact.replace("onboarding", "\\u006fnboarding")],
  ])(
    "preserves a validly signed body's %s through postback",
    async (_, raw) => {
      const result = await receive(raw);
      expect(JSON.parse(raw)).toEqual(event);
      expect(result.postedEvent).toBe(raw);
      expect(result.response.status).toBe(200);
      expect(result.after.webhooks[event.id]).toEqual({ id: event.id });
    },
  );

  it("changing a signed order ID does not bypass verification", async () => {
    const changed = compact.replace("ORDERLOCAL", "ORDERATTACKER");
    const result = await receive(changed, compact);
    expect(result.response.status).toBe(400);
    expect(result.after).toEqual(result.before);
  });
});
