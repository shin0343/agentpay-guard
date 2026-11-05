import { z } from "zod";
import type { StoredPayment, StoredRequest } from "../model";
import type { Config } from "../config";
import { redact } from "../privacy";
import { Fault } from "../util";
const ProviderId = z.string().regex(/^[A-Z0-9]{1,36}$/);
export const Order = z.object({
  id: ProviderId,
  intent: z.literal("CAPTURE"),
  status: z.enum([
    "CREATED",
    "SAVED",
    "APPROVED",
    "VOIDED",
    "COMPLETED",
    "PAYER_ACTION_REQUIRED",
  ]),
  purchase_units: z
    .array(
      z.object({
        reference_id: z.string(),
        custom_id: z.string(),
        invoice_id: z.string(),
        payee: z.object({ merchant_id: z.string() }),
        amount: z.object({ currency_code: z.string(), value: z.string() }),
        payments: z
          .object({
            captures: z
              .array(
                z.object({
                  id: ProviderId,
                  status: z.enum([
                    "COMPLETED",
                    "DECLINED",
                    "PARTIALLY_REFUNDED",
                    "PENDING",
                    "REFUNDED",
                    "FAILED",
                  ]),
                  amount: z.object({
                    currency_code: z.string(),
                    value: z.string(),
                  }),
                  final_capture: z.boolean().optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .length(1),
  links: z.array(z.object({ href: z.url(), rel: z.string() })).optional(),
});
export type Order = z.infer<typeof Order>;
export class PayPalError extends Error {
  readonly issue: string;
  readonly debug: string | null;
  constructor(
    public http: number,
    issue: string,
    debug: string | null = null,
  ) {
    super("PayPal request failed");
    this.issue =
      typeof issue === "string" && /^[A-Z0-9_]{1,80}$/.test(issue)
        ? issue
        : "PAYPAL_ERROR";
    this.debug =
      typeof debug === "string" &&
      /^[A-Za-z0-9_-]{1,128}$/.test(debug) &&
      redact(debug) === debug
        ? debug
        : null;
  }
}
export interface PayPal {
  create(r: StoredRequest, p: StoredPayment): Promise<Order>;
  get(order: string): Promise<Order>;
  capture(order: string, key: string, simulate: boolean): Promise<Order>;
  verify(headers: Headers, event: unknown, rawEvent?: string): Promise<boolean>;
}
export type PayPalRetry = {
  purchase_request_id: string;
  payment_id: string;
  paypal_request_id: string;
  attempt: number;
  failure_code: string;
  at: string;
};
export class SandboxPayPal implements PayPal {
  private token: { value: string; expires: number } | undefined;
  constructor(
    private cfg: Pick<
      Config,
      | "PAYPAL_API_BASE"
      | "PAYPAL_CLIENT_ID"
      | "PAYPAL_CLIENT_SECRET"
      | "PAYPAL_MERCHANT_ID"
      | "PAYPAL_WEBHOOK_ID"
      | "APP_URL"
      | "DEMO_MODE"
    >,
    private transport: typeof fetch = fetch,
    private onRetry?: (event: PayPalRetry) => Promise<void>,
  ) {
    if (cfg.PAYPAL_API_BASE !== "https://api-m.sandbox.paypal.com")
      throw new Error("Sandbox endpoint required");
  }
  private async accessToken() {
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    const r = await this.transport(
      `${this.cfg.PAYPAL_API_BASE}/v1/oauth2/token`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.cfg.PAYPAL_CLIENT_ID}:${this.cfg.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      },
    );
    if (!r.ok) throw new PayPalError(r.status, "OAUTH_FAILED");
    const t = z
      .object({ access_token: z.string(), expires_in: z.number().positive() })
      .parse(await r.json());
    this.token = {
      value: t.access_token,
      expires: Date.now() + Math.max(0, t.expires_in - 60) * 1000,
    };
    return t.access_token;
  }
  private async call(
    path: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
    rawBody?: string,
  ) {
    let res: Response;
    try {
      res = await this.transport(`${this.cfg.PAYPAL_API_BASE}${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${await this.accessToken()}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
          ...headers,
        },
        body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
      });
    } catch (e) {
      if (e instanceof PayPalError) throw e;
      throw new PayPalError(0, "NETWORK_UNKNOWN");
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401) this.token = undefined;
      throw new PayPalError(
        res.status,
        data?.details?.[0]?.issue ?? data?.name ?? "PAYPAL_ERROR",
        res.headers.get("paypal-debug-id"),
      );
    }
    return data;
  }
  async create(r: StoredRequest, p: StoredPayment) {
    const body = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: r.id,
          custom_id: r.id,
          invoice_id: r.id,
          payee: { merchant_id: this.cfg.PAYPAL_MERCHANT_ID },
          description: `${r.merchant.name} via AgentPay Guard`.slice(0, 127),
          amount: { ...r.amount, breakdown: { item_total: r.amount } },
          items: r.items.map((i) => ({
            name: i.name,
            quantity: String(i.quantity),
            unit_amount: i.unit_amount,
            category:
              r.merchant.category === "office_supplies"
                ? "PHYSICAL_GOODS"
                : "DIGITAL_GOODS",
          })),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "AgentPay Guard (Sandbox)",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${this.cfg.APP_URL.replace(/\/$/, "")}/checkout/return?payment=${p.id}`,
            cancel_url: `${this.cfg.APP_URL.replace(/\/$/, "")}/checkout/cancel?payment=${p.id}`,
          },
        },
      },
    };
    for (let n = 0; ; n++) {
      try {
        return Order.parse(
          await this.call("/v2/checkout/orders", "POST", body, {
            "PayPal-Request-Id": `ord_${p.id}`,
          }),
        );
      } catch (e) {
        if (
          !(e instanceof PayPalError) ||
          (e.http > 0 && e.http < 500) ||
          n >= 2
        )
          throw e;
        await this.onRetry?.({
          purchase_request_id: r.id,
          payment_id: p.id,
          paypal_request_id: `ord_${p.id}`,
          attempt: n + 2,
          failure_code: e.issue,
          at: new Date().toISOString(),
        });
        await new Promise((resolve) => setTimeout(resolve, [300, 900][n]));
      }
    }
  }
  async get(order: string) {
    return Order.parse(
      await this.call(`/v2/checkout/orders/${encodeURIComponent(order)}`),
    );
  }
  async capture(order: string, key: string, simulate: boolean) {
    return Order.parse(
      await this.call(
        `/v2/checkout/orders/${encodeURIComponent(order)}/capture`,
        "POST",
        {},
        {
          "PayPal-Request-Id": key,
          ...(simulate && this.cfg.DEMO_MODE === "true"
            ? {
                "PayPal-Mock-Response":
                  '{"mock_application_codes":"INSTRUMENT_DECLINED"}',
              }
            : {}),
        },
      ),
    );
  }
  async verify(headers: Headers, event: unknown, rawEvent?: string) {
    if (!this.cfg.PAYPAL_WEBHOOK_ID) return false;
    const cert = headers.get("paypal-cert-url");
    if (!cert) return false;
    const url = new URL(cert);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "api.sandbox.paypal.com" ||
      !url.pathname.startsWith("/v1/notifications/certs/")
    )
      return false;
    const envelope = {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: cert,
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: this.cfg.PAYPAL_WEBHOOK_ID,
    };
    // Event formatting is part of PayPal's signature input. Embed validated raw JSON,
    // rather than encoding it as a JSON string or reserializing the parsed object.
    const verificationBody = `${JSON.stringify(envelope).slice(0, -1)},"webhook_event":${rawEvent ?? JSON.stringify(event)}}`;
    const result = await this.call(
      "/v1/notifications/verify-webhook-signature",
      "POST",
      undefined,
      {},
      verificationBody,
    );
    return result?.verification_status === "SUCCESS";
  }
}
export function verifyOrder(
  order: Order,
  r: StoredRequest,
  p: StoredPayment,
  merchant: string,
) {
  const u = order.purchase_units[0]!;
  if (
    (order.id !== p.paypal.order_id && p.paypal.order_id !== null) ||
    order.intent !== "CAPTURE" ||
    u.reference_id !== r.id ||
    u.custom_id !== r.id ||
    u.invoice_id !== r.id ||
    u.payee.merchant_id !== merchant ||
    u.amount.currency_code !== r.amount.currency_code ||
    u.amount.value !== r.amount.value ||
    p.amount.value !== r.amount.value ||
    p.amount.currency_code !== r.amount.currency_code
  )
    throw new Fault(
      "PAYPAL_REJECTED",
      502,
      "PayPal order verification failed. Capture is blocked.",
    );
  const captures = u.payments?.captures ?? [];
  if (
    captures.length > 1 ||
    captures.some(
      (c) =>
        !ProviderId.safeParse(c.id).success ||
        c.amount.value !== r.amount.value ||
        c.amount.currency_code !== r.amount.currency_code ||
        order.status === "VOIDED" ||
        (c.status === "COMPLETED" && order.status !== "COMPLETED"),
    )
  )
    throw new Fault(
      "PAYPAL_REJECTED",
      502,
      "PayPal capture amount verification failed.",
    );
}
