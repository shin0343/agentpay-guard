import { z } from "zod";
const riskSettings = z.object({
  RISK_PROVIDER: z
    .enum(["meta", "openai", "fixture", "unavailable"])
    .default("unavailable"),
  MODEL_API_KEY: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  META_RISK_MODEL: z.literal("muse-spark-1.3").optional(),
  OPENAI_API_KEY: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  OPENAI_RISK_MODEL: z
    .string()
    .regex(/^[A-Za-z0-9._:-]{1,120}$/)
    .default("gpt-4o-mini-2024-07-18"),
});

/** Provider-only tools need no payment credentials; application startup remains strict. */
export function riskConfig(
  env: Record<string, string | undefined> = process.env,
) {
  return riskSettings.parse(env);
}

export function config(env: Record<string, string | undefined> = process.env) {
  const cfg = z
    .object({
      DATABASE_URL: z.string().min(1),
      APP_URL: z.url(),
      SESSION_SECRET: z.string().min(32),
      PAYPAL_API_BASE: z
        .literal("https://api-m.sandbox.paypal.com")
        .default("https://api-m.sandbox.paypal.com"),
      PAYPAL_CLIENT_ID: z.string().min(1),
      PAYPAL_CLIENT_SECRET: z.string().min(1),
      PAYPAL_MERCHANT_ID: z.preprocess(
        (v) => (v === "" ? undefined : v),
        z
          .string()
          .regex(/^[A-Z0-9]{1,36}$/)
          .optional(),
      ),
      PAYPAL_WEBHOOK_ID: z.string().optional(),
      DEMO_MODE: z.enum(["true", "false"]).default("false"),
      DEMO_PASSCODES: z.string().default(""),
      DEMO_AGENT_KEY: z.string().optional(),
      ...riskSettings.shape,
      TRUST_PROXY: z.enum(["true", "false"]).default("false"),
    })
    .parse(env);
  if (cfg.RISK_PROVIDER === "fixture" && cfg.DEMO_MODE !== "true")
    throw new Error("Fixture risk requires DEMO_MODE=true");
  const url = new URL(cfg.APP_URL);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    )
  )
    throw new Error("APP_URL must be an HTTPS origin (HTTP localhost allowed)");
  return cfg;
}
export type Config = ReturnType<typeof config>;
