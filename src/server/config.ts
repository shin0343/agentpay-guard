import { z } from "zod";
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
      PAYPAL_MERCHANT_ID: z.string().min(1),
      PAYPAL_WEBHOOK_ID: z.string().optional(),
      DEMO_MODE: z.enum(["true", "false"]).default("false"),
      DEMO_PASSCODES: z.string().default(""),
      DEMO_AGENT_KEY: z.string().optional(),
      RISK_PROVIDER: z.string().default("unavailable"),
      TRUST_PROXY: z.enum(["true", "false"]).default("false"),
    })
    .parse(env);
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
