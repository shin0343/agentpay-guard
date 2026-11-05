import { z } from "zod";
import type { RiskAssessor } from "./assessor";
import type { StoredRequest } from "../model";
import type { RiskContext } from "./context";
import {
  DEADLINE_MS,
  instructionSignals,
  protectAssessment,
  unavailable,
  validateAssessment,
  type RiskResult,
} from "./safety";

/** Last trust boundary: no provider may choose payment state or bypass validation/deadline. */
export async function assessSafely(
  provider: RiskAssessor,
  request: StoredRequest,
  context: RiskContext,
): Promise<RiskResult> {
  if (request.duplicate_of)
    return {
      ...unavailable(),
      status: "skipped",
      summary: "Duplicate; assessment skipped.",
      diagnostics: { provider: "none", attempts: 0, failure_code: null },
    };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result: RiskResult = await Promise.race([
      Promise.resolve().then(() =>
        provider.assess(structuredClone(request), structuredClone(context)),
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("TIMEOUT")),
          DEADLINE_MS + 20,
        );
      }),
    ]);
    const { diagnostics, ...value } = result;
    const metadata = z
      .strictObject({
        provider: z.enum([
          "openai",
          "meta",
          "fixture",
          "unavailable",
          "none",
          "unknown",
        ]),
        attempts: z.number().int().min(0).max(2),
        failure_code: z
          .string()
          .regex(/^[A-Z0-9_]{1,80}$/)
          .nullable(),
        response_id: z
          .string()
          .regex(/^resp_[A-Za-z0-9_-]{1,155}$/)
          .optional(),
        retry_events: z
          .array(
            z.strictObject({
              at: z.iso.datetime(),
              code: z.string().regex(/^HTTP_[0-9]{3}$/),
            }),
          )
          .max(1)
          .optional(),
      })
      .optional()
      .parse(diagnostics);
    const risk = validateAssessment(value, request);
    return {
      ...protectAssessment(risk, request),
      diagnostics: {
        provider:
          risk.model === "fixture"
            ? "fixture"
            : (metadata?.provider ?? "unavailable"),
        attempts: metadata?.attempts ?? 0,
        failure_code:
          metadata?.failure_code ??
          (risk.status === "unavailable" ? "PROVIDER_UNAVAILABLE" : null),
        ...(metadata?.response_id ? { response_id: metadata.response_id } : {}),
        ...(metadata?.retry_events
          ? { retry_events: metadata.retry_events }
          : {}),
        ...(risk.status === "completed"
          ? {
              provider_assessment: {
                score: risk.score,
                level: risk.level,
                recommendation: risk.recommendation,
                signals: risk.signals,
              },
            }
          : {}),
        deterministic_signals: instructionSignals(request).map((x) => x.code),
      },
    };
  } catch (error) {
    const timeout = error instanceof Error && error.message === "TIMEOUT";
    return {
      ...protectAssessment(
        unavailable(timeout ? "timeout" : "unavailable"),
        request,
      ),
      diagnostics: {
        provider: "unknown",
        attempts: 0,
        failure_code: timeout ? "TIMEOUT" : "INVALID_PROVIDER_OUTPUT",
        deterministic_signals: instructionSignals(request).map((x) => x.code),
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
