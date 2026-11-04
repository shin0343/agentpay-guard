import { operation } from "./idempotency/context";
import { z } from "zod";
import {
  AuditEventType,
  RequestStatus,
  ScenarioKey,
  Session,
} from "@/contract";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import type { Principal } from "./model";
import { Auth, limit, operator, people } from "./auth/session";
import { verify, audit } from "./audit/ledger";
import type { Config } from "./config";
import { GuardService, seedAgents } from "./service";
import { canonical, Fault, hash, id, money } from "./util";
import { activePolicy } from "./policy/catalog";
import { localDay, reserved } from "./policy/engine";
import {
  validate,
  proposal,
  emptySchema,
  reviewSchema,
  captureSchema,
} from "./validation";

export class GuardHttp {
  readonly auth: Auth;
  constructor(
    readonly service: GuardService,
    readonly cfg: Config,
  ) {
    this.auth = new Auth(
      cfg.SESSION_SECRET,
      new URL(cfg.APP_URL).protocol === "https:",
    );
  }
  async handle(req: Request): Promise<Response> {
    const trace = id("req");
    try {
      const response = await this.route(req);
      response.headers.set("X-Request-Id", trace);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (e) {
      const fault =
        e instanceof Fault
          ? e
          : new Fault(
              "INTERNAL",
              500,
              "The request could not be processed.",
              {},
              true,
            );
      return Response.json(
        {
          error: {
            code: fault.code,
            message: fault.message,
            status: fault.status,
            request_id: trace,
            retryable: fault.retryable,
            details: fault.details,
          },
        },
        {
          status: fault.status,
          headers: {
            "X-Request-Id": trace,
            "Cache-Control": "no-store",
            ...([
              "RATE_LIMITED",
              "IDEMPOTENCY_IN_PROGRESS",
              "CAPTURE_IN_PROGRESS",
            ].includes(fault.code)
              ? { "Retry-After": "1" }
              : {}),
          },
        },
      );
    }
  }
  private async body(req: Request): Promise<unknown> {
    if (
      !req.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      throw new Fault("MALFORMED_JSON", 400, "Expected application/json.");
    const reader = req.body?.getReader();
    if (!reader)
      throw new Fault("MALFORMED_JSON", 400, "Expected a JSON body.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new Fault("VALIDATION_FAILED", 422, "Request body is too large.");
      }
      chunks.push(value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new Fault("MALFORMED_JSON", 400, "Malformed JSON.");
    }
  }
  private async principal(req: Request) {
    const { p, allowed } = await this.service.store.tx((s) => {
      seedAgents(
        s,
        this.cfg.DEMO_AGENT_KEY ? hash(this.cfg.DEMO_AGENT_KEY) : undefined,
      );
      const p = this.auth.authenticate(req, s);
      return {
        p,
        allowed: p.kind !== "agent" || limit(s, `agent:${p.id}`, 60),
      };
    });
    if (!allowed)
      throw new Fault(
        "RATE_LIMITED",
        429,
        "Agent request rate exceeded.",
        {},
        true,
      );
    return p;
  }
  private async idem(
    req: Request,
    p: Principal,
    body: unknown,
    fn: () => Promise<{ body: unknown; status?: number }>,
  ): Promise<Response> {
    const key = req.headers.get("idempotency-key");
    if (!key || !/^[\x21-\x7e]{1,255}$/.test(key))
      throw new Fault(
        "IDEMPOTENCY_KEY_REQUIRED",
        400,
        "A visible ASCII Idempotency-Key is required.",
      );
    const scope = hash(
      `${p.kind}:${p.id}:${req.method}:${new URL(req.url).pathname}:${key}`,
    );
    const digest = hash(
      canonical({ body, if_match: req.headers.get("if-match") }),
    );
    const replay = await this.service.store.tx((s) => {
      const existing = s.idempotency[scope];
      if (existing && existing.expires > Date.now()) {
        if (existing.hash !== digest)
          throw new Fault(
            "IDEMPOTENCY_KEY_REUSED",
            422,
            "Idempotency key was used for different input.",
          );
        if (existing.state === "done") {
          audit(s, "idempotency.replayed", null, p);
          return existing;
        }
        if (existing.lease > Date.now())
          throw new Fault(
            "IDEMPOTENCY_IN_PROGRESS",
            409,
            "The original request is still processing.",
            {},
            true,
          );
      }
      s.idempotency[scope] = {
        id: scope,
        hash: digest,
        state: "processing",
        expires: Date.now() + 86400000,
        lease: Date.now() + 60000,
      };
      return null;
    });
    if (replay)
      return Response.json(replay.body, {
        status: replay.status,
        headers: { "Idempotent-Replayed": "true" },
      });
    try {
      const result = await operation.run(scope, fn);
      const saved = await this.service.store.tx((s) => {
        const row = s.idempotency[scope]!;
        if (row.state !== "done") {
          row.state = "done";
          row.status = result.status ?? 200;
          row.body = result.body;
        }
        return row;
      });
      return Response.json(saved.body, { status: saved.status });
    } catch (e) {
      // Failures do not cache a stale resource; safe retries use persisted business-operation claims.
      await this.service.store.tx((s) => {
        s.idempotency[scope]!.lease = 0;
      });
      throw e;
    }
  }
  private pagination<T>(
    rows: T[],
    q: URLSearchParams,
    getId: (x: T) => string,
  ) {
    const n = q.get("limit") ?? "25";
    if (!/^\d+$/.test(n) || +n < 1 || +n > 100)
      throw new Fault("VALIDATION_FAILED", 422, "limit must be 1–100.");
    const cursor = q.get("cursor");
    let start = 0;
    if (cursor) {
      let decoded: string;
      try {
        decoded = Buffer.from(cursor, "base64url").toString();
      } catch {
        throw new Fault("VALIDATION_FAILED", 422, "Invalid cursor.");
      }
      const found = rows.findIndex((x) => getId(x) === decoded);
      if (found < 0)
        throw new Fault("VALIDATION_FAILED", 422, "Invalid cursor.");
      start = found + 1;
    }
    const data = rows.slice(start, start + +n);
    return {
      object: "list" as const,
      data,
      next_cursor:
        start + +n < rows.length
          ? Buffer.from(getId(data.at(-1)!)).toString("base64url")
          : null,
    };
  }
  private dates(q: URLSearchParams) {
    for (const key of ["updated_after", "from", "to"]) {
      const value = q.get(key);
      if (value && !z.iso.datetime({ offset: true }).safeParse(value).success)
        throw new Fault("VALIDATION_FAILED", 422, `Invalid ${key} timestamp.`);
    }
  }
  private async route(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname
      .replace(/^\/api\/v1\/?/, "")
      .split("/")
      .filter(Boolean);
    const route = path.join("/");
    const method = req.method;
    this.dates(url.searchParams);
    if (route === "webhooks/paypal" && method === "POST")
      return this.webhook(req);
    if (route === "session" && method === "POST") {
      if (this.cfg.DEMO_MODE !== "true")
        throw new Fault("DEMO_DISABLED", 404, "Demo sign-in is disabled.");
      const ip =
        this.cfg.TRUST_PROXY === "true"
          ? (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "shared")
          : "shared";
      const allowed = await this.service.store.tx((s) =>
        limit(s, `login:${hash(ip)}`, 5),
      );
      if (!allowed)
        throw new Fault(
          "RATE_LIMITED",
          429,
          "Too many sign-in attempts.",
          {},
          true,
        );
      const body = validate(
        z.object({ passcode: z.string().min(1).max(255) }).strict(),
        await this.body(req),
      );
      const entries = this.cfg.DEMO_PASSCODES.split(",").map((v) => {
        const i = v.indexOf(":");
        return [v.slice(0, i), v.slice(i + 1)];
      });
      const role = entries.find(
        ([r, code]) => people[r!] && code && hash(code) === hash(body.passcode),
      )?.[0];
      if (!role) throw new Fault("UNAUTHENTICATED", 401, "Invalid passcode.");
      const response = Response.json(Session.parse({ user: people[role] }));
      for (const c of this.auth.issue(people[role]!))
        response.headers.append("Set-Cookie", c);
      return response;
    }
    const p = await this.principal(req);
    if (route === "session") {
      operator(p);
      if (method === "GET")
        return Response.json(
          Session.parse({ user: { id: p.id, name: p.name, role: p.kind } }),
        );
      if (method === "DELETE") {
        const r = new Response(null, { status: 204 });
        const secure =
          new URL(this.cfg.APP_URL).protocol === "https:" ? "; Secure" : "";
        for (const c of ["apg_session", "apg_csrf"])
          r.headers.append(
            "Set-Cookie",
            `${c}=; Path=/; SameSite=Lax; Max-Age=0${c === "apg_session" ? "; HttpOnly" : ""}${secure}`,
          );
        return r;
      }
    }
    if (method === "GET") {
      if (route === "checkout/config") {
        operator(p);
        return Response.json({
          paypal_client_id: this.cfg.PAYPAL_CLIENT_ID,
          currency: "USD",
          intent: "capture",
        });
      }
      if (route === "policies/active") {
        operator(p);
        return Response.json(activePolicy);
      }
      if (route === "audit-events/verify") {
        operator(p);
        return Response.json(
          await this.service.store.tx((s) => verify(s.events)),
        );
      }
      if (path[0] === "purchase-requests" && path.length === 2)
        return Response.json(
          await this.service.store.tx((s) => {
            let r = this.service.request(s, path[1]!, p);
            this.service.expire(s, r);
            r = s.requests[r.id]!;
            return this.service.project(s, r, p);
          }),
        );
      if (path[0] === "payments" && path.length === 2)
        return Response.json(
          await this.service.store.tx((s) => {
            const pay = this.service.payment(s, path[1]!, p);
            const r = s.requests[pay.purchase_request_id]!;
            this.service.expire(s, r);
            return PaymentOutput(s.payments[pay.id]!);
          }),
        );
      if (route === "purchase-requests") {
        operator(p);
        return Response.json(
          await this.service.store.tx((s) => {
            for (const r of Object.values(s.requests))
              this.service.expire(s, r);
            const q = url.searchParams;
            const statuses = q.get("status")?.split(",");
            if (statuses) for (const x of statuses) validate(RequestStatus, x);
            const search = q.get("q")?.toLowerCase();
            const all = Object.values(s.requests);
            const filtered = all
              .filter(
                (r) =>
                  (!statuses || statuses.includes(r.status)) &&
                  (!q.get("agent_id") || q.get("agent_id") === r.agent.id) &&
                  (!q.get("updated_after") ||
                    r.updated_at > q.get("updated_after")!) &&
                  (!search || canonical(r).toLowerCase().includes(search)),
              )
              .sort(
                (a, b) =>
                  b.created_at.localeCompare(a.created_at) ||
                  b.id.localeCompare(a.id),
              );
            return {
              ...this.pagination(
                filtered.map((r) => this.service.project(s, r, p)),
                q,
                (r) => r.id,
              ),
              summary: {
                needs_review: all.filter((r) => r.status === "IN_REVIEW")
                  .length,
                allowed_today: money(
                  all
                    .filter(
                      (r) =>
                        reserved.includes(r.status) &&
                        r.status !== "IN_REVIEW" &&
                        localDay(r.created_at) ===
                          localDay(new Date().toISOString()),
                    )
                    .reduce(
                      (n, r) => n + Number(r.amount.value.replace(".", "")),
                      0,
                    ),
                ),
              },
            };
          }),
        );
      }
      if (route === "audit-events") {
        operator(p);
        const q = url.searchParams;
        if (q.get("type"))
          for (const type of q.get("type")!.split(","))
            validate(AuditEventType, type);
        if (q.get("state")) validate(RequestStatus, q.get("state"));
        const rows = await this.service.store.tx((s) =>
          s.events
            .filter(
              (e) =>
                (!q.get("q") ||
                  canonical({
                    ...e,
                    request: e.purchase_request_id
                      ? s.requests[e.purchase_request_id]
                      : null,
                  })
                    .toLowerCase()
                    .includes(q.get("q")!.toLowerCase())) &&
                (!q.get("purchase_request_id") ||
                  e.purchase_request_id === q.get("purchase_request_id")) &&
                (!q.get("type") ||
                  q.get("type")!.split(",").includes(e.type)) &&
                (!q.get("state") || e.state_after === q.get("state")) &&
                (!q.get("actor_kind") ||
                  e.actor.kind === q.get("actor_kind")) &&
                (!q.get("from") || e.occurred_at >= q.get("from")!) &&
                (!q.get("to") || e.occurred_at <= q.get("to")!),
            )
            .reverse(),
        );
        if (q.get("format") === "csv") {
          const cell = (v: unknown) =>
            `"${String(v ?? "")
              .replace(/^[=+@\-\t\r]/, "'" + "$&")
              .replaceAll('"', '""')}"`;
          const csv = [
            "seq,type,occurred_at,purchase_request_id,payment_id,summary",
            ...rows.map((e) =>
              [
                e.seq,
                e.type,
                e.occurred_at,
                e.purchase_request_id,
                e.payment_id,
                e.summary,
              ]
                .map(cell)
                .join(","),
            ),
          ].join("\r\n");
          return new Response(csv, {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": 'attachment; filename="audit-events.csv"',
            },
          });
        }
        return Response.json(this.pagination(rows, q, (e) => e.id));
      }
    }
    if (method === "POST") {
      const body = await this.body(req);
      return this.idem(req, p, body, async () => {
        if (route === "purchase-requests") {
          if (p.kind !== "agent")
            throw new Fault(
              "FORBIDDEN",
              403,
              "An agent key is required to propose a purchase.",
            );
          const r = await this.service.create(proposal(body), p.id);
          return {
            status: 201,
            body: await this.service.store.tx((s) =>
              this.service.project(s, s.requests[r.id]!, p),
            ),
          };
        }
        if (path[0] === "purchase-requests" && path.length === 3) {
          const rid = path[1]!;
          if (path[2] === "reviews")
            return {
              body: await this.service.review(
                rid,
                validate(reviewSchema, body),
                req.headers.get("if-match"),
                p,
              ),
            };
          if (path[2] === "checkout") {
            validate(emptySchema, body);
            return { body: await this.service.checkout(rid, p) };
          }
          if (path[2] === "cancel") {
            validate(emptySchema, body);
            return { body: await this.service.cancel(rid, p) };
          }
        }
        if (path[0] === "payments" && path.length === 3) {
          operator(p);
          const pid = path[1]!;
          if (path[2] === "capture") {
            const b = validate(captureSchema, body);
            if (b.simulate !== "none" && !this.service.demo)
              throw new Fault(
                "FORBIDDEN",
                403,
                "Negative testing is disabled.",
              );
            return {
              body: await this.service.capture(
                pid,
                p,
                b.simulate === "instrument_declined",
              ),
            };
          }
          if (path[2] === "reconcile") {
            validate(emptySchema, body);
            return { body: await this.service.reconcile(pid, p) };
          }
          if (path[2] === "payer-cancel") {
            validate(emptySchema, body);
            await this.service.store.tx((s) => {
              const pay = this.service.payment(s, pid, p);
              const r = s.requests[pay.purchase_request_id]!;
              requireOpen(pay.status);
              audit(s, "payer.cancelled", r, p);
            });
            return { body: { ok: true } };
          }
        }
        if (path[0] === "demo") {
          operator(p);
          if (this.cfg.DEMO_MODE !== "true")
            throw new Fault(
              "DEMO_DISABLED",
              404,
              "Demo endpoints are disabled.",
            );
          validate(emptySchema, body);
          if (route === "demo/reset") {
            await this.service.store.tx((s) => {
              for (const [rid, r] of Object.entries(s.requests))
                if (
                  !Object.values(s.payments).some(
                    (pay) => pay.purchase_request_id === rid,
                  ) &&
                  !["CAPTURING", "PAYMENT_PENDING", "PAID"].includes(r.status)
                ) {
                  delete s.requests[rid];
                  for (const [key, row] of Object.entries(s.idempotency))
                    if (row.body && canonical(row.body).includes(rid))
                      delete s.idempotency[key];
                }
            });
            return { body: { ok: true } };
          }
          if (
            path[1] === "scenarios" &&
            path[3] === "run" &&
            path.length === 4
          ) {
            const scenario = SCENARIOS.find(
              (x) => x.key === validate(ScenarioKey, path[2]),
            );
            if (!scenario)
              throw new Fault("NOT_FOUND", 404, "Scenario not found.");
            const agent: Principal = {
              kind: "agent",
              id: scenario.agent_id,
              name: "demo-agent",
            };
            const key =
              scenario.idempotency_key ?? req.headers.get("idempotency-key")!;
            const synthetic = new Request(
              `${url.origin}/api/v1/purchase-requests`,
              { method: "POST", headers: { "Idempotency-Key": key } },
            );
            const run = () =>
              this.idem(synthetic, agent, scenario.payload, async () => {
                const r = await this.service.create(
                  proposal(scenario.payload),
                  scenario.agent_id,
                );
                return {
                  status: 201,
                  body: await this.service.store.tx((s) =>
                    this.service.project(s, s.requests[r.id]!, p),
                  ),
                };
              });
            let res = await run();
            if (scenario.send_twice) res = await run();
            const created = await res.json();
            const view = await this.service.store.tx((s) =>
              this.service.project(
                s,
                this.service.request(s, created.id, p),
                p,
              ),
            );
            return {
              body: {
                purchase_request: view,
                replayed: res.headers.get("Idempotent-Replayed") === "true",
              },
            };
          }
        }
        throw new Fault("NOT_FOUND", 404, "Endpoint not found.");
      });
    }
    throw new Fault("NOT_FOUND", 404, "Endpoint not found.");
  }
  private async webhook(req: Request) {
    const raw = await this.body(req);
    let verified = false;
    try {
      verified = await this.service.paypal.verify(req.headers, raw);
    } catch {
      throw new Fault(
        "PAYPAL_UNAVAILABLE",
        503,
        "Webhook verification is unavailable.",
        {},
        true,
      );
    }
    if (!verified)
      throw new Fault(
        "VALIDATION_FAILED",
        400,
        "Invalid PayPal webhook signature.",
      );
    const event = validate(
      z.object({
        id: z.string().min(1).max(255),
        event_type: z.string(),
        resource: z
          .object({
            id: z.string().optional(),
            supplementary_data: z
              .object({
                related_ids: z
                  .object({ order_id: z.string().optional() })
                  .optional(),
              })
              .optional(),
          })
          .passthrough(),
      }),
      raw,
    );
    const admin: Principal = {
      kind: "operator",
      id: "paypal",
      name: "PayPal reconciliation",
    };
    const pid = await this.service.store.tx((s) => {
      if (s.webhooks[event.id]) return null;
      const orderId = event.event_type.startsWith("CHECKOUT.ORDER.")
        ? event.resource.id
        : event.resource.supplementary_data?.related_ids?.order_id;
      const pay = Object.values(s.payments).find(
        (p) => p.paypal.order_id === orderId,
      );
      if (!pay) {
        s.webhooks[event.id] = { id: event.id };
        return null;
      }
      const r = s.requests[pay.purchase_request_id]!;
      if (["BLOCKED", "REJECTED", "CANCELLED", "EXPIRED"].includes(r.status)) {
        s.webhooks[event.id] = { id: event.id };
        return null;
      }
      return pay.id;
    });
    if (pid) {
      // Never trust resource amounts/status: reconcile the owned order from PayPal itself.
      if (
        [
          "CHECKOUT.ORDER.APPROVED",
          "PAYMENT.CAPTURE.COMPLETED",
          "PAYMENT.CAPTURE.PENDING",
          "PAYMENT.CAPTURE.DENIED",
          "PAYMENT.CAPTURE.DECLINED",
        ].includes(event.event_type)
      ) {
        try {
          await this.service.reconcile(pid, admin);
        } catch (e) {
          if (
            !(e instanceof Fault) ||
            !["STATE_CONFLICT", "PAYPAL_REJECTED"].includes(e.code)
          )
            throw e;
        }
      }
      await this.service.store.tx((s) => {
        if (s.webhooks[event.id]) return;
        s.webhooks[event.id] = { id: event.id };
        const pay = s.payments[pid]!;
        audit(
          s,
          "webhook.received",
          s.requests[pay.purchase_request_id]!,
          undefined,
          { event_id: event.id, event_type: event.event_type },
        );
      });
    }
    return Response.json({ received: true });
  }
}
import { Payment } from "@/contract";
const PaymentOutput = (p: unknown) => Payment.parse(p);
function requireOpen(status: string) {
  if (!["AWAITING_PAYER", "APPROVED"].includes(status))
    throw new Fault(
      "STATE_CONFLICT",
      409,
      "The order is no longer awaiting payer action.",
    );
}
