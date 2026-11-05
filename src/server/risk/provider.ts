import type { riskConfig } from "../config";
import { MetaRiskAssessor } from "./meta";
import { OpenAIRiskAssessor } from "./openai";
import { SafeRiskAssessor } from "./assessor";

export function createRiskAssessor(cfg: ReturnType<typeof riskConfig>) {
  if (cfg.RISK_PROVIDER === "meta")
    return new MetaRiskAssessor(cfg.MODEL_API_KEY, cfg.META_RISK_MODEL);
  if (cfg.RISK_PROVIDER === "openai")
    return new OpenAIRiskAssessor(cfg.OPENAI_API_KEY, cfg.OPENAI_RISK_MODEL);
  return new SafeRiskAssessor(cfg.RISK_PROVIDER);
}
