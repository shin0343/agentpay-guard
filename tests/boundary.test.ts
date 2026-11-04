import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpAdapter } from "@/lib/api/http/http-adapter";
import { ApiError } from "@/lib/api/types";
import { MockEngine, emptyState } from "@/lib/api/mock/engine";
import { canonicalJson, sha256Hex } from "@/lib/api/mock/sha256";
import { formatMoney, fromCents, shortId, toCents } from "@/lib/format";

describe("format", () => {
  it("handles money as decimal strings, never floats", () => {
    expect(toCents("640.00")).toBe(64_000);
    expect(toCents("0.07")).toBe(7);
    expect(fromCents(240_000)).toEqual({ currency_code: "USD", value: "2400.00" });
    expect(formatMoney({ currency_code: "USD", value: "2400.00" })).toBe("$2,400.00");
  });
  it("keeps the ID prefix and last 4 characters", () => {
    expect(shortId("preq_01JCB7Q2KESTREL0000000Q2")).toBe("preq_…00Q2");
  });
});

describe("sha256 (mock ledger hash chain)", () => {
  it("matches node:crypto", () => {
    for (const s of ["", "abc", "a".repeat(1000), "ünïcødé · $2,400.00", canonicalJson({ b: 1, a: [2, { d: null, c: "x" }] })]) {
      expect(sha256Hex(s)).toBe(createHash("sha256").update(s, "utf8").digest("hex"));
    }
  });
  it("canonical JSON sorts keys", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});

describe("http adapter — the live integration boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  // A contract-valid response produced by the mock engine (the same shape the backend must return).
  const engine = new MockEngine(() => Date.UTC(2026, 10, 10, 20), emptyState());
  const created = engine.runScenario("b_needs_review");
  engine.evaluate(created.request.id);
  const valid = engine.get(created.request.id, "reviewer");

  const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "X-Request-Id": "req_test", ...headers } }));

  it("parses a valid response through the shared Zod contract", async () => {
    vi.stubGlobal("fetch", respond(200, valid));
    const r = await createHttpAdapter().getPurchaseRequest(valid.id);
    expect(r.status).toBe("IN_REVIEW");
  });

  it("sends Idempotency-Key and If-Match on reviews", async () => {
    const f = respond(200, valid);
    vi.stubGlobal("fetch", f);
    await createHttpAdapter().submitReview(valid.id, { action: "approve" }, 3, { idempotencyKey: "k-1" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/v1/purchase-requests/${valid.id}/reviews`);
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("k-1");
    expect((init.headers as Record<string, string>)["If-Match"]).toBe('"3"');
  });

  it("maps the error envelope to ApiError", async () => {
    vi.stubGlobal("fetch", respond(409, { error: { code: "STATE_CONFLICT", message: "Already decided.", status: 409, request_id: "req_x", retryable: false, details: { current_status: "ALLOWED" } } }));
    const err = await createHttpAdapter().getPurchaseRequest("preq_x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("STATE_CONFLICT");
    expect(err.details.current_status).toBe("ALLOWED");
  });

  it("rejects responses that drift from the contract instead of rendering them", async () => {
    vi.stubGlobal("fetch", respond(200, { ...valid, amount: { currency_code: "USD", value: 640 } }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = await createHttpAdapter().getPurchaseRequest(valid.id).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toMatch(/did not match the API contract/);
  });
});
