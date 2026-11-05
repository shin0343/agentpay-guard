import { afterEach, describe, expect, it, vi } from "vitest";
import { MetaRiskAssessor } from "@/server/risk/meta";
import { createRiskAssessor } from "@/server/risk/provider";
import { config, riskConfig } from "@/server/config";
import { verify } from "@/server/audit/ledger";
import { cfg, harness, MemoryStore } from "./backend-helpers";
import {
  lowModelOutput,
  modelEnvelope,
  riskScenarios,
} from "./fixtures/risk-scenarios";

const envelope = (output: unknown = lowModelOutput) => ({
  ...modelEnvelope(output),
  model: "muse-spark-1.3",
});
const transport = () =>
  vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json(envelope()));
const provider = (f = transport(), timeout = 8000) =>
  new MetaRiskAssessor("model-api-test-credential", undefined, f, timeout);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Meta Responses provider boundary", () => {
  it("explicitly selects the Meta key, Standard model and pinned host through the runtime factory", async () => {
    const f = transport();
    vi.stubGlobal("fetch", f);
    const settings = riskConfig({
      RISK_PROVIDER: "meta",
      MODEL_API_KEY: "model-api-test-credential",
      OPENAI_API_KEY: "different-openai-test-key",
      META_API_BASE: "https://untrusted.example",
    });
    const h = await harness(new MemoryStore(), createRiskAssessor(settings));
    const r = await h.service.create(riskScenarios.low(), "agt_research01");
    expect(r.status).toBe("ALLOWED");
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://api.meta.ai/v1/responses");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer model-api-test-credential",
    );
    expect(init?.redirect).toBe("error");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "muse-spark-1.3",
      store: false,
      reasoning: { effort: "minimal" },
      text: {
        format: {
          type: "json_schema",
          strict: true,
          schema: { additionalProperties: false },
        },
      },
    });
    expect(body.tools).toBeUndefined();
    const branches = body.text.format.schema.properties.signals.items.anyOf;
    expect(branches[0].properties.source_field.enum).toContain("merchant.name");
    expect(branches[0].properties.source_field.enum).toContain("items[0].name");
    expect(branches[0].properties.source_field.enum).not.toContain(
      "untrusted_purchase.merchant.name",
    );
    expect(branches[0].properties.source_field.enum).not.toContain(
      "amount.value",
    );
    expect(branches[1].properties.source_field.type).toBe("null");
    expect(branches[1].properties.evidence.type).toBe("null");
    expect(JSON.stringify(body)).not.toMatch(
      /model-api-test-credential|different-openai-test-key|PAYPAL_CLIENT_SECRET|key_hash|owner_user_id/,
    );
    const events = await h.store.tx((s) => s.events);
    expect(
      events.find((e) => e.type === "risk.assessed")?.data.diagnostics,
    ).toMatchObject({
      provider: "meta",
      attempts: 1,
      response_id: "resp_test001",
    });
    expect(r.evaluation?.risk.model).toBe("muse-spark-1.3");
    expect(r.evaluation?.risk.prompt_version).toBe("r-3-meta-1");
    expect(verify(events).ok).toBe(true);
  });

  it.each([
    [riskScenarios.spendingReview, "IN_REVIEW"],
    [riskScenarios.blocked, "BLOCKED"],
  ] as const)(
    "a low Meta score cannot relax deterministic policy: %s → %s",
    async (input, expected) => {
      const h = await harness(new MemoryStore(), provider());
      const r = await h.service.create(input(), "agt_research01");
      expect(r.status).toBe(expected);
      expect(r.evaluation?.risk.status).toBe("completed");
      expect(h.paypal.creates + h.paypal.gets + h.paypal.captures).toBe(0);
    },
  );

  it("description injection survives low model output while preserving original model evidence", async () => {
    const h = await harness(new MemoryStore(), provider());
    const r = await h.service.create(
      riskScenarios.injection(),
      "agt_research01",
    );
    expect(r).toMatchObject({
      status: "IN_REVIEW",
      evaluation: {
        risk: {
          model: "muse-spark-1.3",
          score: 70,
          recommendation: "escalate_to_review",
          signals: [
            expect.objectContaining({
              code: "prompt_injection",
              source_field: "items[0].description",
            }),
          ],
        },
      },
    });
    const event = await h.store.tx((s) =>
      s.events.find((e) => e.type === "risk.assessed"),
    );
    expect(event?.data.diagnostics).toMatchObject({
      provider: "meta",
      provider_assessment: { score: 12 },
      deterministic_signals: ["prompt_injection"],
    });
  });

  it.each([
    envelope({ ...lowModelOutput, authorize: true }),
    envelope({ ...lowModelOutput, score: "0" }),
    envelope({ ...lowModelOutput, score: 99 }),
    envelope("not JSON"),
    envelope({
      ...lowModelOutput,
      score: 45,
      recommendation: "escalate_to_review",
      signals: [
        {
          code: "new_merchant",
          label: "New merchant",
          severity: "warn",
          source_field: "untrusted_purchase.merchant.name",
          evidence: "Larkspur Data",
        },
      ],
    }),
    envelope({
      ...lowModelOutput,
      score: 45,
      recommendation: "escalate_to_review",
      signals: [
        {
          code: "other",
          label: "Context concern",
          severity: "warn",
          source_field: null,
          evidence: "18.00",
        },
      ],
    }),
    { ...envelope(), status: "incomplete", output: [] },
    {
      ...envelope(),
      output: [{ type: "function_call", name: "capture_payment" }],
    },
    { ...envelope(), model: "muse-spark-1.3-contributor" },
    {
      ...envelope(),
      output: [
        { type: "message", content: [{ type: "refusal", refusal: "no" }] },
      ],
    },
  ])(
    "invalid/untrusted Meta response requires review: %#",
    async (response) => {
      const f = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(response));
      const h = await harness(new MemoryStore(), provider(f));
      const r = await h.service.create(riskScenarios.low(), "agt_research01");
      expect(r.status).toBe("IN_REVIEW");
      expect(r.evaluation?.risk).toMatchObject({
        status: "unavailable",
        score: null,
      });
      expect(f).toHaveBeenCalledOnce();
      expect(h.paypal.creates + h.paypal.captures).toBe(0);
    },
  );

  it("missing Meta key never falls back to fixtures or another provider", async () => {
    const f = transport();
    const h = await harness(
      new MemoryStore(),
      new MetaRiskAssessor(undefined, undefined, f),
    );
    const r = await h.service.create(riskScenarios.low(), "agt_research01");
    expect(r.status).toBe("IN_REVIEW");
    expect(f).not.toHaveBeenCalled();
    expect(
      await h.store.tx(
        (s) =>
          s.events.find((e) => e.type === "risk.unavailable")?.data.diagnostics,
      ),
    ).toMatchObject({
      provider: "meta",
      attempts: 0,
      failure_code: "MISSING_CREDENTIAL",
    });
  });

  it("auth rejection is not retried and upstream secrets/body never enter the ledger", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: { message: "Bearer upstream-secret-must-not-persist" } },
          { status: 401 },
        ),
      );
    const h = await harness(new MemoryStore(), provider(f));
    const r = await h.service.create(riskScenarios.low(), "agt_research01");
    expect(r.status).toBe("IN_REVIEW");
    expect(f).toHaveBeenCalledOnce();
    const state = await h.store.tx((s) => s);
    expect(
      state.events.find((e) => e.type === "risk.unavailable")?.data.diagnostics,
    ).toMatchObject({ provider: "meta", failure_code: "HTTP_401" });
    expect(JSON.stringify(state)).not.toContain("upstream-secret");
  });

  it("a transient failure retries within the same budget and records Meta retry evidence", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, { status: 503 }))
      .mockResolvedValueOnce(Response.json(envelope()));
    const h = await harness(new MemoryStore(), provider(f));
    const r = await h.service.create(riskScenarios.low(), "agt_research01");
    expect(r.status).toBe("ALLOWED");
    expect(f).toHaveBeenCalledTimes(2);
    expect(
      await h.store.tx(
        (s) =>
          s.events.find((e) => e.type === "risk.assessed")?.data.diagnostics,
      ),
    ).toMatchObject({
      provider: "meta",
      attempts: 2,
      retry_events: [{ code: "HTTP_503" }],
    });
  });

  it("an interrupted response body is aborted at the original deadline and cannot authorize", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const f = vi.fn<typeof fetch>().mockImplementation(
      async (_url, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init!.signal!.addEventListener("abort", () => {
                aborted = true;
                controller.error(new Error("Aborted"));
              });
            },
          }),
        ),
    );
    const h = await harness(new MemoryStore(), provider(f));
    const pending = h.service.create(riskScenarios.low(), "agt_research01");
    await vi.advanceTimersByTimeAsync(8001);
    const r = await pending;
    expect(aborted).toBe(true);
    expect(r).toMatchObject({
      status: "IN_REVIEW",
      evaluation: { risk: { status: "timeout", score: null } },
    });
    expect(h.paypal.creates + h.paypal.captures).toBe(0);
  });

  it("network exceptions fail closed without a blind retry", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("network interrupted"));
    const h = await harness(new MemoryStore(), provider(f));
    expect(
      (await h.service.create(riskScenarios.low(), "agt_research01")).status,
    ).toBe("IN_REVIEW");
    expect(f).toHaveBeenCalledOnce();
  });

  it("rejects Contributor/alternate models and keeps application payment configuration mandatory", () => {
    expect(() =>
      riskConfig({
        RISK_PROVIDER: "meta",
        META_RISK_MODEL: "muse-spark-1.3-contributor",
      }),
    ).toThrow();
    expect(
      () => new MetaRiskAssessor("test-only", "muse-spark-1.3-contributor"),
    ).toThrow();
    expect(() =>
      riskConfig({ RISK_PROVIDER: "meta", MODEL_API_KEY: "test-only" }),
    ).not.toThrow();
    expect(() =>
      config({
        ...cfg,
        RISK_PROVIDER: "meta",
        MODEL_API_KEY: "test-only",
        PAYPAL_CLIENT_SECRET: "",
      }),
    ).toThrow();
  });
});
