import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import { createWebhookProxy } from "../scripts/webhook-tunnel-proxy";
const servers: ReturnType<typeof createWebhookProxy>[] = [];
afterEach(async () => {
  await Promise.all(
    servers.map(
      (s) =>
        new Promise<void>((r) => {
          s.closeAllConnections();
          s.close(() => r());
        }),
    ),
  );
  servers.length = 0;
});
async function start(transport: typeof fetch) {
  const server = createWebhookProxy({ transport });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
describe("temporary webhook-only public ingress", () => {
  it("forwards exact bytes/signature headers but strips credentials and proxy identity", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{"received":true}', {
          headers: { "x-request-id": "req_test" },
        }),
      );
    const base = await start(transport);
    const raw = '{ "id": "WH-TEST", "value": "\\u0061" }';
    const result = await fetch(base + "/api/v1/webhooks/paypal", {
      method: "POST",
      body: raw,
      headers: {
        "content-type": "application/json",
        "paypal-transmission-id": "original",
        cookie: "private",
        authorization: "Bearer private",
        "x-forwarded-for": "untrusted",
      },
    });
    expect(result.status).toBe(200);
    expect(result.headers.get("x-request-id")).toBe("req_test");
    const [url, init] = transport.mock.calls[0]!;
    expect(url).toBe("http://127.0.0.1:3100/api/v1/webhooks/paypal");
    expect(Buffer.from(init!.body as Buffer).toString()).toBe(raw);
    const headers = new Headers(init!.headers);
    expect(headers.get("paypal-transmission-id")).toBe("original");
    for (const name of ["cookie", "authorization", "x-forwarded-for"])
      expect(headers.has(name)).toBe(false);
  });
  it("never exposes admin/session routes, alternate methods or query variants", async () => {
    const transport = vi.fn<typeof fetch>();
    const base = await start(transport);
    for (const [method, path] of [
      ["GET", "/"],
      ["POST", "/api/v1/session"],
      ["GET", "/api/v1/webhooks/paypal"],
      ["POST", "/api/v1/webhooks/paypal?extra=1"],
    ])
      expect((await fetch(base + path, { method })).status).toBe(404);
    expect(transport).not.toHaveBeenCalled();
  });
  it("rejects oversized bodies before forwarding", async () => {
    const transport = vi.fn<typeof fetch>();
    const base = await start(transport);
    expect(
      (
        await fetch(base + "/api/v1/webhooks/paypal", {
          method: "POST",
          body: "x".repeat(65537),
        })
      ).status,
    ).toBe(413);
    expect(transport).not.toHaveBeenCalled();
  });
  it("does not acknowledge delivery when the local backend is unavailable", async () => {
    const base = await start(
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
    );
    expect(
      (
        await fetch(base + "/api/v1/webhooks/paypal", {
          method: "POST",
          body: "{}",
        })
      ).status,
    ).toBe(503);
  });
});
