import { audit } from "./audit/ledger";
import { config } from "./config";
import { PostgresStore } from "./db/postgres";
import { SandboxPayPal } from "./paypal/client";
import { GuardService } from "./service";
import { SafeRiskAssessor } from "./risk/assessor";
import { OpenAIRiskAssessor } from "./risk/openai";
import { GuardHttp } from "./http";
let instance: GuardHttp | undefined;
export function runtime() {
  if (!instance) {
    const cfg = config();
    const store = new PostgresStore(cfg.DATABASE_URL);
    const paypal = new SandboxPayPal(cfg, fetch, (event) =>
      store.tx((s) => {
        audit(
          s,
          "payment.retry_requested",
          s.requests[event.purchase_request_id] ?? null,
          undefined,
          { phase: "create_transport", ...event },
        );
      }),
    );
    instance = new GuardHttp(
      new GuardService(
        store,
        paypal,
        cfg.RISK_PROVIDER === "openai"
          ? new OpenAIRiskAssessor(cfg.OPENAI_API_KEY, cfg.OPENAI_RISK_MODEL)
          : new SafeRiskAssessor(cfg.RISK_PROVIDER),
        cfg.PAYPAL_MERCHANT_ID,
        cfg.DEMO_MODE === "true",
      ),
      cfg,
    );
  }
  return instance;
}
