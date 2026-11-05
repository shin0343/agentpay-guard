import { riskConfig } from "../src/server/config";
import { PostgresStore } from "../src/server/db/postgres";
import { createRiskAssessor } from "../src/server/risk/provider";
import { riskContext } from "../src/server/risk/context";
import { assessSafely } from "../src/server/risk/evaluate";

/** Opt-in live inference probe. Reads a stored request; never creates orders or captures. */
async function main() {
  const cfg = riskConfig();
  if (!(
    (cfg.RISK_PROVIDER === "meta" && cfg.MODEL_API_KEY) ||
    (cfg.RISK_PROVIDER === "openai" && cfg.OPENAI_API_KEY)
  ))
    throw new Error(
      "Configure a real risk provider and its server-only API key.",
    );
  const rid = process.argv[2];
  if (!rid?.startsWith("preq_"))
    throw new Error("Usage: pnpm risk:verify preq_<id>");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const store = new PostgresStore(process.env.DATABASE_URL);
  try {
    const { request, context } = await store.tx((s) => {
      const request = s.requests[rid];
      if (!request?.evaluation || request.duplicate_of)
        throw new Error(
          "An evaluated, nonduplicate stored request is required.",
        );
      return {
        request,
        context: riskContext(
          s,
          request,
          s.agents[request.agent.id]!,
          request.evaluation.policy,
        ),
      };
    });
    const result = await assessSafely(
      createRiskAssessor(cfg),
      request,
      context,
    );
    console.log(
      JSON.stringify(
        {
          purchase_request_id: rid,
          persisted_decision_unchanged: true,
          verification_kind:
            result.status === "completed"
              ? "genuine_ai_inference"
              : "inference_not_verified",
          ...result,
        },
        null,
        2,
      ),
    );
    if (result.status !== "completed") process.exitCode = 1;
  } finally {
    await store.pool.end();
  }
}
main().catch(() => {
  console.error(
    "AI verification failed. Check server credentials, request ID and connectivity; no payment was initiated.",
  );
  process.exitCode = 1;
});
