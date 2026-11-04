/**
 * Live adapter: talks to the real backend at /api/v1 per docs/API_CONTRACT.md.
 * Every response is parsed with the shared Zod contract, so a backend drift fails loudly here
 * instead of rendering wrong numbers.
 */
import type { z } from "zod";
import {
  ActivePolicy, AuditEventList, ChainVerification, CheckoutConfig, ErrorEnvelope, Payment,
  PurchaseRequest, PurchaseRequestList, RequestWithPayment, ScenarioRun, Session,
} from "@/contract";
import { ApiError, type GuardApi, type ListAuditParams, type ListRequestsParams, type MutationOptions } from "../types";

const BASE = "/api/v1";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

const newKey = () => crypto.randomUUID();

function query(params: Record<string, string | number | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    sp.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

interface CallInit {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  ifMatch?: number;
}

async function call<T extends z.ZodTypeAny>(path: string, schema: T, init: CallInit = {}): Promise<z.infer<T>> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const csrf = readCookie("apg_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  if (init.ifMatch !== undefined) headers["If-Match"] = `"${init.ifMatch}"`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("INTERNAL", "Network unavailable.", 0, true, "req_offline");
  }

  const requestId = res.headers.get("X-Request-Id") ?? "req_unknown";
  const text = await res.text();
  const json: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const env = ErrorEnvelope.safeParse(json);
    if (env.success) {
      const e = env.data.error;
      throw new ApiError(e.code, e.message, e.status, e.retryable, e.request_id, e.details ?? {});
    }
    throw new ApiError("INTERNAL", `Unexpected ${res.status} response.`, res.status, res.status >= 500, requestId);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.error("[agentpay-guard] contract violation", path, parsed.error.issues);
    throw new ApiError("INTERNAL", "The server response did not match the API contract.", 500, false, requestId, {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const NullSchema = { safeParse: () => ({ success: true as const, data: undefined }) } as unknown as z.ZodType<void>;

export function createHttpAdapter(): GuardApi {
  return {
    mode: "live",

    async getSession() {
      try {
        return await call("/session", Session);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    signIn: (passcode) => call("/session", Session, { method: "POST", body: { passcode } }),
    signOut: () => call("/session", NullSchema, { method: "DELETE" }),

    listPurchaseRequests: (p: ListRequestsParams = {}) =>
      call(
        `/purchase-requests${query({ status: p.status, q: p.q, agent_id: p.agent_id, updated_after: p.updated_after, limit: p.limit, cursor: p.cursor })}`,
        PurchaseRequestList,
      ),
    getPurchaseRequest: (id) => call(`/purchase-requests/${encodeURIComponent(id)}`, PurchaseRequest),
    submitReview: (id, body, expectedVersion, o: MutationOptions = {}) =>
      call(`/purchase-requests/${encodeURIComponent(id)}/reviews`, PurchaseRequest, {
        method: "POST", body, ifMatch: expectedVersion, idempotencyKey: o.idempotencyKey ?? newKey(),
      }),
    startCheckout: (id, o = {}) =>
      call(`/purchase-requests/${encodeURIComponent(id)}/checkout`, RequestWithPayment, {
        method: "POST", body: {}, idempotencyKey: o.idempotencyKey ?? newKey(),
      }),
    cancelPurchaseRequest: (id, o = {}) =>
      call(`/purchase-requests/${encodeURIComponent(id)}/cancel`, PurchaseRequest, {
        method: "POST", body: {}, idempotencyKey: o.idempotencyKey ?? newKey(),
      }),

    getPayment: (id) => call(`/payments/${encodeURIComponent(id)}`, Payment),
    capturePayment: (id, simulate, o = {}) =>
      call(`/payments/${encodeURIComponent(id)}/capture`, RequestWithPayment, {
        method: "POST", body: { simulate }, idempotencyKey: o.idempotencyKey ?? newKey(),
      }),
    reconcilePayment: (id, o = {}) =>
      call(`/payments/${encodeURIComponent(id)}/reconcile`, RequestWithPayment, {
        method: "POST", body: {}, idempotencyKey: o.idempotencyKey ?? newKey(),
      }),
    getCheckoutConfig: () => call("/checkout/config", CheckoutConfig),

    listAuditEvents: (p: ListAuditParams = {}) =>
      call(
        `/audit-events${query({ q: p.q, purchase_request_id: p.purchase_request_id, type: p.type, state: p.state, limit: p.limit, cursor: p.cursor })}`,
        AuditEventList,
      ),
    verifyAuditChain: () => call("/audit-events/verify", ChainVerification),
    auditCsvUrl: (p: ListAuditParams = {}) =>
      `${BASE}/audit-events${query({ q: p.q, type: p.type, state: p.state, format: "csv" })}`,
    getActivePolicy: () => call("/policies/active", ActivePolicy),

    runScenario: (key, o = {}) =>
      call(`/demo/scenarios/${key}/run`, ScenarioRun, { method: "POST", body: {}, idempotencyKey: o.idempotencyKey ?? newKey() }),
    resetDemo: () => call("/demo/reset", NullSchema, { method: "POST", body: {}, idempotencyKey: newKey() }),

    subscribe: () => () => {},
  };
}
