import { config } from "./config";
import { PostgresStore } from "./db/postgres";
import { SandboxPayPal } from "./paypal/client";
import { GuardService } from "./service";
import { SafeRiskAssessor } from "./risk/assessor";
import { GuardHttp } from "./http";
let instance: GuardHttp | undefined;
export function runtime() {
  if (!instance) {
    const cfg = config();
    instance = new GuardHttp(
      new GuardService(
        new PostgresStore(cfg.DATABASE_URL),
        new SandboxPayPal(cfg),
        new SafeRiskAssessor(cfg.RISK_PROVIDER),
        cfg.PAYPAL_MERCHANT_ID,
        cfg.DEMO_MODE === "true",
      ),
      cfg,
    );
  }
  return instance;
}
