import { z } from "zod";
import {
  RiskAssessment,
  RiskSignal,
  type RiskSignal as Signal,
} from "@/contract";
import type { StoredRequest } from "../model";
import { sanitize } from "../privacy";
export const PROMPT_VERSION = "r-3";
export const DEADLINE_MS = 8000;
export const band = (score: number) =>
  score < 35 ? "low" : score < 70 ? "medium" : "high";
export type Diagnostics = {
  provider: string;
  attempts: number;
  failure_code: string | null;
  response_id?: string;
  retry_events?: { at: string; code: string }[];
  deterministic_signals?: string[];
  provider_assessment?: Pick<
    RiskAssessment,
    "score" | "level" | "recommendation" | "signals"
  >;
};
export type RiskResult = RiskAssessment & { diagnostics?: Diagnostics };
export function unavailable(
  status: "unavailable" | "timeout" = "unavailable",
  model: string | null = null,
): RiskAssessment {
  return {
    status,
    score: null,
    level: null,
    recommendation: null,
    signals: [],
    summary: "Risk evaluation unavailable; human review required.",
    model,
    prompt_version: PROMPT_VERSION,
    latency_ms: 0,
    assessed_at: new Date().toISOString(),
  };
}
export function fields(r: StoredRequest): Record<string, string> {
  return Object.fromEntries([
    ["justification", r.justification],
    ["agent_reference", r.agent_reference ?? ""],
    ["merchant.name", r.merchant.name],
    ["merchant.domain", r.merchant.domain ?? ""],
    ...r.items.flatMap((x, i) => [
      [`items[${i}].name`, x.name],
      [`items[${i}].description`, x.description ?? ""],
      [`items[${i}].sku`, x.sku ?? ""],
    ]),
    ...Object.entries(r.metadata ?? {}).map(([k, v]) => [
      `metadata.${k}`,
      `${k}: ${v}`,
    ]),
  ]);
}
/** Conservative instruction-pattern screen; not fraud detection and not exhaustive. */
export function instructionSignals(r: StoredRequest): Signal[] {
  const pattern =
    /(?:ignore|bypass|override|disable)\b.{0,60}\b(?:instructions?|policy|policies|limits?|review|rules?|system)|\b(?:mark|set)\b.{0,30}\b(?:low.risk|score.{0,8}0)|\b(?:system|developer)\s*(?:message|prompt|:)|<\|(?:im_start|system)|\b(?:capture|authorize)\b.{0,30}\bpayment\b/isu;
  const found = Object.entries(fields(r)).find(([, value]) =>
    pattern.test(value.normalize("NFKC").replace(/[\u200b-\u200d\ufeff]/g, "")),
  );
  return found
    ? [
        {
          code: "prompt_injection",
          label: "Instruction pattern in untrusted purchase text",
          severity: "high",
          evidence: found[1].slice(0, 200),
          source_field: found[0],
        },
      ]
    : [];
}
/** Validate every provider, including injected/custom implementations, at the service boundary. */
export function validateAssessment(
  value: unknown,
  r: StoredRequest,
): RiskAssessment {
  const parsed = RiskAssessment.extend({
    signals: RiskSignal.extend({ label: z.string().min(1).max(80) })
      .strict()
      .array()
      .max(8),
  })
    .strict()
    .parse(value);
  if (parsed.status === "completed") {
    if (
      !parsed.model ||
      !/^[A-Za-z0-9._:-]{1,120}$/.test(parsed.model) ||
      !z.iso.datetime().safeParse(parsed.assessed_at).success ||
      parsed.latency_ms === null ||
      parsed.latency_ms < 0
    )
      throw new Error("INVALID_METADATA");
    if (
      parsed.score === null ||
      parsed.level !== band(parsed.score) ||
      parsed.recommendation === null ||
      !parsed.summary?.trim()
    )
      throw new Error("INCONSISTENT_OUTPUT");
    if (
      (parsed.score >= 35 ||
        parsed.signals.some((x) => x.severity !== "info")) &&
      parsed.recommendation !== "escalate_to_review"
    )
      throw new Error("INCONSISTENT_OUTPUT");
    for (const signal of parsed.signals) {
      if (signal.source_field !== null && !(signal.source_field in fields(r)))
        throw new Error("INVALID_EVIDENCE");
      if (
        signal.evidence !== null &&
        (!signal.source_field ||
          !fields(r)[signal.source_field]!.includes(signal.evidence))
      )
        throw new Error("INVALID_EVIDENCE");
    }
    if (
      /(?:<script|javascript:|\b(?:bypass|disable)\s+(?:the\s+)?(?:reviewer|policy)|\b(?:payment|capture)\s+(?:is\s+)?(?:authorized|approved)|\b(?:proven|validated)\s+(?:fraud|probability))/i.test(
        parsed.summary + parsed.signals.map((x) => x.label).join(" "),
      )
    )
      throw new Error("UNSAFE_OUTPUT");
  } else if (
    parsed.score !== null ||
    parsed.level !== null ||
    parsed.recommendation !== null
  )
    throw new Error("INCONSISTENT_OUTPUT");
  return sanitize(parsed);
}
/** One supplemental deterministic concern survives even a model's low-risk answer. */
export function protectAssessment(
  risk: RiskAssessment,
  r: StoredRequest,
): RiskAssessment {
  const screen = instructionSignals(r);
  if (
    (!screen.length &&
      !risk.signals.some((x) => x.code === "prompt_injection")) ||
    risk.status === "skipped"
  )
    return risk;
  return {
    ...risk,
    ...(risk.status === "completed"
      ? {
          score: Math.max(70, risk.score ?? 70),
          level: "high" as const,
          recommendation: "escalate_to_review" as const,
        }
      : {}),
    signals: [
      ...screen,
      ...risk.signals.filter(
        (x) => !screen.length || x.code !== "prompt_injection",
      ),
    ].slice(0, 8),
  };
}
