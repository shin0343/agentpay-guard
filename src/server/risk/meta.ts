import { ResponsesRiskAssessor } from "./openai";
import { DEADLINE_MS } from "./safety";

export const META_MODEL = "muse-spark-1.3";

/** Standard mode only. The actual MODEL_API_KEY is passed explicitly, never inferred. */
export class MetaRiskAssessor extends ResponsesRiskAssessor {
  constructor(
    key: string | undefined,
    model = META_MODEL,
    transport: typeof fetch = fetch,
    timeoutMs = DEADLINE_MS,
  ) {
    if (model !== META_MODEL)
      throw new Error("Meta Standard muse-spark-1.3 is required");
    super(key, model, transport, timeoutMs, "meta");
  }
}
