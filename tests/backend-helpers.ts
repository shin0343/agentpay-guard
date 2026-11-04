import type { Store, StoreState } from "@/server/model";
import { emptyState } from "@/server/model";
import type { PayPal, Order } from "@/server/paypal/client";
import { PayPalError } from "@/server/paypal/client";
import type { StoredRequest, StoredPayment } from "@/server/model";
import { seedAgents, GuardService } from "@/server/service";
import type { RiskAssessor } from "@/server/risk/assessor";
import { SafeRiskAssessor } from "@/server/risk/assessor";
import { GuardHttp } from "@/server/http";
import type { Config } from "@/server/config";
import { hash } from "@/server/util";
export class MemoryStore implements Store {
  state = emptyState();
  private tail = Promise.resolve();
  async tx<T>(fn: (s: StoreState) => T | Promise<T>): Promise<T> {
    const prev = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((r) => (release = r));
    await prev;
    try {
      const copy = structuredClone(this.state);
      const result = await fn(copy);
      this.state = copy;
      return structuredClone(result);
    } finally {
      release();
    }
  }
}
export class FakePayPal implements PayPal {
  orders = new Map<string, Order>();
  creates = 0;
  gets = 0;
  captures = 0;
  verifications = 0;
  verified = true;
  failCreate: PayPalError | undefined;
  failCapture: PayPalError | undefined;
  captureStatus: "COMPLETED" | "PENDING" = "COMPLETED";
  delay: Promise<void> | undefined;
  async create(r: StoredRequest, p: StoredPayment) {
    this.creates++;
    if (this.failCreate) throw this.failCreate;
    const existing = [...this.orders.values()].find(
      (o) => o.purchase_units[0]!.reference_id === r.id,
    );
    if (existing) return structuredClone(existing);
    const order: Order = {
      id: `ORDER${this.creates}`,
      intent: "CAPTURE",
      status: "CREATED",
      purchase_units: [
        {
          reference_id: r.id,
          custom_id: r.id,
          invoice_id: r.id,
          payee: { merchant_id: "MERCHANT" },
          amount: r.amount,
        },
      ],
      links: [
        {
          rel: "approve",
          href: `https://www.sandbox.paypal.com/checkoutnow?token=${p.id}`,
        },
      ],
    };
    this.orders.set(order.id, order);
    return structuredClone(order);
  }
  approve(order: string) {
    this.orders.get(order)!.status = "APPROVED";
  }
  async get(order: string) {
    this.gets++;
    const o = this.orders.get(order);
    if (!o) throw new PayPalError(404, "RESOURCE_NOT_FOUND");
    return structuredClone(o);
  }
  async capture(order: string, _key: string, simulate: boolean) {
    this.captures++;
    if (this.delay) await this.delay;
    if (this.failCapture) throw this.failCapture;
    if (simulate)
      throw new PayPalError(422, "INSTRUMENT_DECLINED", "debug-test");
    const o = this.orders.get(order)!;
    const u = o.purchase_units[0]!;
    if (o.status !== "APPROVED")
      throw new PayPalError(422, "ORDER_NOT_APPROVED");
    o.status = "COMPLETED";
    u.payments = {
      captures: [
        {
          id: `CAPTURE${this.captures}`,
          status: this.captureStatus,
          amount: u.amount,
          final_capture: true,
        },
      ],
    };
    return structuredClone(o);
  }
  async verify() {
    this.verifications++;
    return this.verified;
  }
}
export const agentKey = "agk_test_" + "a".repeat(32);
export const cfg: Config = {
  DATABASE_URL: "unused",
  APP_URL: "http://localhost:3000",
  SESSION_SECRET: "test-session-secret-of-at-least-32-characters",
  PAYPAL_API_BASE: "https://api-m.sandbox.paypal.com",
  PAYPAL_CLIENT_ID: "sandbox-client-test",
  PAYPAL_CLIENT_SECRET: "test-secret",
  PAYPAL_MERCHANT_ID: "MERCHANT",
  DEMO_MODE: "true",
  DEMO_PASSCODES: "reviewer:reviewer,operator:operator",
  RISK_PROVIDER: "fixture",
  OPENAI_RISK_MODEL: "gpt-4o-mini-2024-07-18",
  DEMO_AGENT_KEY: agentKey,
  TRUST_PROXY: "false",
};
export async function harness(
  store: Store = new MemoryStore(),
  risk: RiskAssessor = new SafeRiskAssessor("fixture"),
) {
  await store.tx((s) => seedAgents(s, hash(agentKey)));
  const paypal = new FakePayPal();
  const service = new GuardService(store, paypal, risk, "MERCHANT", true);
  const http = new GuardHttp(service, cfg);
  const reviewer = http.auth.issue({
    id: "usr_okafor",
    name: "M. Okafor",
    role: "reviewer",
  });
  const operator = http.auth.issue({
    id: "usr_lindqvist",
    name: "S. Lindqvist",
    role: "operator",
  });
  let sequence = 0;
  const call = (
    path: string,
    options: {
      method?: string;
      body?: unknown;
      role?: "reviewer" | "operator" | "agent" | "anonymous";
      key?: string;
      version?: number;
      csrf?: boolean;
      headers?: Record<string, string>;
    } = {},
  ) => {
    const method = options.method ?? "GET";
    const role = options.role ?? "reviewer";
    const cookies = role === "reviewer" ? reviewer : operator;
    const csrf = cookies[1]!.split(";")[0]!.split("=")[1]!;
    return http.handle(
      new Request(`http://localhost:3000/api/v1/${path}`, {
        method,
        headers: {
          ...(role === "agent"
            ? { Authorization: `Bearer ${agentKey}` }
            : role === "anonymous"
              ? {}
              : {
                  Cookie: cookies.map((c) => c.split(";")[0]).join("; "),
                  ...(options.csrf !== false ? { "X-CSRF-Token": csrf } : {}),
                }),
          ...(method === "POST"
            ? {
                "Content-Type": "application/json",
                "Idempotency-Key": options.key ?? `test-${++sequence}`,
              }
            : {}),
          ...(options.version !== undefined
            ? { "If-Match": `"${options.version}"` }
            : {}),
          ...options.headers,
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      }),
    );
  };
  return { store, paypal, service, http, call };
}
