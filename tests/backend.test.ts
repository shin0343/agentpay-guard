import { describe, it, expect } from "vitest";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import {
  PurchaseRequest,
  RequestWithPayment,
  AuditEventList,
  PurchaseRequestList,
  ActivePolicy,
  Session,
  CheckoutConfig,
  Payment,
  ChainVerification,
  ScenarioRun,
  ErrorEnvelope,
} from "@/contract";
import { harness, MemoryStore } from "./backend-helpers";
import { transition, paymentTransition } from "@/server/state/transitions";
import { combine } from "@/server/policy/engine";
import { SafeRiskAssessor } from "@/server/risk/assessor";
import { PayPalError } from "@/server/paypal/client";
import { verify } from "@/server/audit/ledger";
const fixture = (key: string) => SCENARIOS.find((s) => s.key === key)!.payload;
const A = () => structuredClone(fixture("a_low_risk"));
const B = () => structuredClone(fixture("b_needs_review"));
async function prepare(key = "a_low_risk") {
  const h = await harness();
  const r = await h.call("purchase-requests", {
    method: "POST",
    role: "agent",
    body: fixture(key),
  });
  expect(r.status).toBe(201);
  const request = PurchaseRequest.parse(await r.json());
  if (request.status === "IN_REVIEW") {
    const res = await h.call(`purchase-requests/${request.id}/reviews`, {
      method: "POST",
      body: { action: "approve" },
      version: request.version,
    });
    expect(res.status).toBe(200);
  }
  const checkout = await h.call(`purchase-requests/${request.id}/checkout`, {
    method: "POST",
    body: {},
  });
  expect(checkout.status).toBe(200);
  const result = RequestWithPayment.parse(await checkout.json());
  return { ...h, request: result.purchase_request, payment: result.payment };
}
describe("backend policy and authorization", () => {
  it("A allowed, B review, C blocked; all eight rules and no PayPal calls", async () => {
    for (const [key, status] of [
      ["a_low_risk", "ALLOWED"],
      ["b_needs_review", "IN_REVIEW"],
      ["c_blocked", "BLOCKED"],
    ]) {
      const h = await harness();
      const def = SCENARIOS.find((s) => s.key === key)!;
      const r = await h.service.create(def.payload, def.agent_id);
      expect(r.status).toBe(status);
      expect(r.evaluation?.policy).toHaveLength(8);
      if (status === "BLOCKED") {
        const checkout = await h.call(`purchase-requests/${r.id}/checkout`, {
          method: "POST",
          body: {},
        });
        expect(checkout.status).toBe(409);
      }
      expect(h.paypal.creates + h.paypal.gets + h.paypal.captures).toBe(0);
    }
  });
  it("reviews approve/reject, require note and version, deny operator/agent/self-review", async () => {
    const h = await harness();
    const request = await h.service.create(B(), "agt_research01");
    const path = `purchase-requests/${request.id}/reviews`;
    for (const role of ["operator", "agent"] as const)
      expect(
        (
          await h.call(path, {
            role,
            method: "POST",
            body: { action: "approve" },
            version: request.version,
          })
        ).status,
      ).toBe(403);
    expect(
      (
        await h.call(path, {
          method: "POST",
          body: { action: "reject", note: " " },
          version: request.version,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await h.call(path, {
          method: "POST",
          body: { action: "approve" },
          version: 1,
        })
      ).status,
    ).toBe(412);
    await h.store.tx((s) => {
      s.agents.agt_research01!.owner_user_id = "usr_okafor";
    });
    expect(
      (
        await h.call(path, {
          method: "POST",
          body: { action: "approve" },
          version: request.version,
        })
      ).status,
    ).toBe(403);
    await h.store.tx((s) => {
      s.agents.agt_research01!.owner_user_id = "usr_other";
    });
    const rejected = await h.call(path, {
      method: "POST",
      body: { action: "reject", note: "Budget denied" },
      version: request.version,
    });
    expect(PurchaseRequest.parse(await rejected.json()).status).toBe(
      "REJECTED",
    );
    expect(
      (
        await h.call(path, {
          method: "POST",
          body: { action: "approve" },
          version: request.version + 1,
        })
      ).status,
    ).toBe(409);
  });
  it("prevents client-forged money, merchant identity, extra fields and currency", async () => {
    const h = await harness();
    const inputs: unknown[] = [
      { ...A(), status: "ALLOWED" },
      { ...A(), amount: { currency_code: "EUR", value: "18.00" } },
      { ...A(), amount: { currency_code: "USD", value: "19.00" } },
      { ...A(), merchant: { ...A().merchant, name: "Someone else" } },
      {
        ...A(),
        amount: { currency_code: "USD", value: "1.00" },
        items: [
          {
            ...A().items[0],
            unit_amount: { currency_code: "USD", value: "1.00" },
          },
        ],
      },
      {
        ...A(),
        metadata: Object.fromEntries(
          Array.from({ length: 11 }, (_, i) => [String(i), "x"]),
        ),
      },
    ];
    for (const body of inputs) {
      const res = await h.call("purchase-requests", {
        method: "POST",
        body,
        role: "agent",
      });
      expect(res.status).toBe(422);
      ErrorEnvelope.parse(await res.json());
    }
  });
  it("unavailable risk forces review and AI can never relax rules", async () => {
    const h = await harness();
    const unknown = { ...A(), justification: "A different untrusted request" };
    const r = await h.service.create(unknown, "agt_research01");
    expect(r.status).toBe("IN_REVIEW");
    const base = new SafeRiskAssessor("fixture").assess({
      ...r,
      justification: A().justification,
    });
    expect(
      combine(
        [
          {
            rule_id: "test",
            rule_key: "x",
            outcome: "review",
            observed: "",
            limit: null,
            message: "",
          },
        ],
        { ...base, status: "completed", score: 5 },
      ),
    ).toBe("REVIEW");
    expect(combine([], { ...base, status: "completed", score: 95 })).toBe(
      "REVIEW",
    );
    expect(combine([], { ...base, status: "unavailable" })).toBe("REVIEW");
  });
  it("agents cannot check out/capture or read other agents requests; CSRF is required", async () => {
    const h = await prepare();
    expect(
      (
        await h.call(`purchase-requests/${h.request.id}/checkout`, {
          role: "agent",
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await h.call(`payments/${h.payment.id}/capture`, {
          role: "agent",
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await h.call(`purchase-requests/${h.request.id}/cancel`, {
          method: "POST",
          body: {},
          csrf: false,
        })
      ).status,
    ).toBe(403);
    const other = await h.service.create(
      fixture("e_capture_declined"),
      "agt_opsbuyer01",
    );
    expect(
      (await h.call(`purchase-requests/${other.id}`, { role: "agent" })).status,
    ).toBe(404);
    expect(
      (await h.call("purchase-requests", { role: "anonymous" })).status,
    ).toBe(401);
  });
  it("unknown catalog proposals require review and cannot be paid after approval", async () => {
    const h = await harness();
    const body = A();
    body.items[0]!.name = "Unquoted service";
    const r = await h.service.create(body, "agt_research01");
    expect(r.status).toBe("IN_REVIEW");
    await h.call(`purchase-requests/${r.id}/reviews`, {
      method: "POST",
      body: { action: "approve" },
      version: r.version,
    });
    expect(
      (
        await h.call(`purchase-requests/${r.id}/checkout`, {
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(422);
    expect(h.paypal.creates).toBe(0);
  });
});
describe("durability, idempotency and concurrency", () => {
  it("same idempotency key replays identical 201; semantic duplicates are blocked", async () => {
    const h = await harness();
    const opts = {
      method: "POST",
      role: "agent" as const,
      key: "stable-key",
      body: A(),
    };
    const first = await h.call("purchase-requests", opts);
    const original = await first.json();
    const replay = await h.call("purchase-requests", opts);
    expect(replay.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await replay.json()).toEqual(original);
    expect(replay.status).toBe(201);
    expect(
      (
        await h.call("purchase-requests", {
          ...opts,
          body: { ...A(), justification: "changed" },
        })
      ).status,
    ).toBe(422);
    const duplicate = PurchaseRequest.parse(
      await (
        await h.call("purchase-requests", { ...opts, key: "different" })
      ).json(),
    );
    expect(duplicate.status).toBe("BLOCKED");
    expect(duplicate.duplicate_of).toBe(original.id);
    expect(await h.store.tx((s) => Object.keys(s.requests).length)).toBe(2);
  });
  it("simultaneous duplicate proposals and budget reservations are serialized", async () => {
    const h = await harness();
    const [a, b] = await Promise.all([
      h.service.create(A(), "agt_research01"),
      h.service.create(A(), "agt_research01"),
    ]);
    expect([a.status, b.status].sort()).toEqual(["ALLOWED", "BLOCKED"]);
    const large = B();
    large.items[0]!.quantity = 62;
    large.amount.value = "992.00";
    await h.service.create(large, "agt_research01");
    const next = await h.service.create(
      {
        ...large,
        agent_reference: "second",
        items: [{ ...large.items[0]!, quantity: 61 }],
        amount: { currency_code: "USD", value: "976.00" },
      },
      "agt_research01",
    );
    expect(next.evaluation!.policy[1]!.outcome).toBe("review");
  });
  it("two conflicting reviews: only one succeeds", async () => {
    const h = await harness();
    const r = await h.service.create(B(), "agt_research01");
    const responses = await Promise.all(
      ["approve", "reject"].map((action) =>
        h.call(`purchase-requests/${r.id}/reviews`, {
          method: "POST",
          body: { action, note: "Budget checked" },
          version: r.version,
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 412]);
  });
  it("duplicate capture and concurrent checkout invoke payment side effects once", async () => {
    const h = await prepare();
    h.paypal.approve(h.payment.paypal.order_id!);
    const checkouts = await Promise.all([
      h.call(`purchase-requests/${h.request.id}/checkout`, {
        method: "POST",
        body: {},
      }),
      h.call(`purchase-requests/${h.request.id}/checkout`, {
        method: "POST",
        body: {},
      }),
    ]);
    expect(checkouts.every((r) => r.status === 200)).toBe(true);
    expect(h.paypal.creates).toBe(1);
    let release!: () => void;
    h.paypal.delay = new Promise<void>((r) => (release = r));
    const one = h.call(`payments/${h.payment.id}/capture`, {
      method: "POST",
      body: {},
      key: "capture1",
    });
    for (let i = 0; i < 100 && h.paypal.captures === 0; i++)
      await new Promise((r) => setTimeout(r, 1));
    const two = await h.call(`payments/${h.payment.id}/capture`, {
      method: "POST",
      body: {},
      key: "capture2",
    });
    expect(two.status).toBe(409);
    release();
    const result = RequestWithPayment.parse(await (await one).json());
    expect(result.payment.status).toBe("COMPLETED");
    expect(result.purchase_request.status).toBe("PAID");
    const duplicate = await h.call(`payments/${h.payment.id}/capture`, {
      method: "POST",
      body: {},
    });
    expect(duplicate.status).toBe(200);
    expect(h.paypal.captures).toBe(1);
  });
  it("in-flight API key returns progress conflict", async () => {
    const h = await prepare();
    h.paypal.approve(h.payment.paypal.order_id!);
    let release!: () => void;
    h.paypal.delay = new Promise<void>((r) => (release = r));
    const opts = { method: "POST", body: {}, key: "same-capture" };
    const first = h.call(`payments/${h.payment.id}/capture`, opts);
    for (let i = 0; i < 100 && h.paypal.captures === 0; i++)
      await new Promise((r) => setTimeout(r, 1));
    const second = await h.call(`payments/${h.payment.id}/capture`, opts);
    expect((await second.json()).error.code).toBe("IDEMPOTENCY_IN_PROGRESS");
    release();
    await first;
  });
});
describe("PayPal lifecycle", () => {
  it("internal ALLOW does not grant payer approval or trigger capture", async () => {
    const h = await prepare();
    const result = RequestWithPayment.parse(
      await (
        await h.call(`payments/${h.payment.id}/capture`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    expect(result.payment.status).toBe("AWAITING_PAYER");
    expect(result.purchase_request.keys.payer.state).toBe("waiting");
    expect(h.paypal.captures).toBe(0);
  });
  it.each(["amount", "currency", "merchant", "request_id", "order_id"])(
    "rejects %s mismatch before capture",
    async (field) => {
      const h = await prepare();
      const o = h.paypal.orders.get(h.payment.paypal.order_id!)!;
      o.status = "APPROVED";
      if (field === "amount")
        o.purchase_units[0]!.amount = { currency_code: "USD", value: "19.00" };
      if (field === "currency")
        o.purchase_units[0]!.amount = { currency_code: "EUR", value: "18.00" };
      if (field === "merchant")
        o.purchase_units[0]!.payee.merchant_id = "OTHER";
      if (field === "request_id") o.purchase_units[0]!.custom_id = "preq_other";
      if (field === "order_id") o.id = "OTHER";
      expect(
        (
          await h.call(`payments/${h.payment.id}/capture`, {
            method: "POST",
            body: {},
          })
        ).status,
      ).toBe(502);
      expect(h.paypal.captures).toBe(0);
    },
  );
  it("decline → same-order retry → completed with two attempts", async () => {
    const h = await prepare("e_capture_declined");
    h.paypal.approve(h.payment.paypal.order_id!);
    const failed = RequestWithPayment.parse(
      await (
        await h.call(`payments/${h.payment.id}/capture`, {
          method: "POST",
          body: { simulate: "instrument_declined" },
        })
      ).json(),
    );
    expect(failed.payment.status).toBe("DECLINED");
    expect(failed.purchase_request.status).toBe("PAYMENT_FAILED");
    const retry = RequestWithPayment.parse(
      await (
        await h.call(`purchase-requests/${h.request.id}/checkout`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    expect(retry.payment.id).toBe(h.payment.id);
    expect(h.paypal.creates).toBe(1);
    h.paypal.approve(h.payment.paypal.order_id!);
    const paid = RequestWithPayment.parse(
      await (
        await h.call(`payments/${h.payment.id}/capture`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    expect(paid.purchase_request.status).toBe("PAID");
    expect(paid.payment.attempts.map((x) => x.status)).toEqual([
      "declined",
      "completed",
    ]);
  });
  it("timeout stays unknown, reconciliation settles real observed completion", async () => {
    const h = await prepare();
    h.paypal.approve(h.payment.paypal.order_id!);
    h.paypal.failCapture = new PayPalError(0, "NETWORK_UNKNOWN");
    const pending = RequestWithPayment.parse(
      await (
        await h.call(`payments/${h.payment.id}/capture`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    expect(pending.payment.status).toBe("CAPTURING");
    expect(pending.payment.attempts[0]?.status).toBe("unknown");
    const o = h.paypal.orders.get(h.payment.paypal.order_id!)!;
    o.status = "COMPLETED";
    o.purchase_units[0]!.payments = {
      captures: [
        { id: "RECOVERED", status: "COMPLETED", amount: h.request.amount },
      ],
    };
    const reconciled = RequestWithPayment.parse(
      await (
        await h.call(`payments/${h.payment.id}/reconcile`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    expect(reconciled.payment.status).toBe("COMPLETED");
    expect(h.paypal.captures).toBe(1);
  });
  it("interrupted capture retries original attempt ID, never increments attempts", async () => {
    const h = await prepare();
    h.paypal.approve(h.payment.paypal.order_id!);
    h.paypal.failCapture = new PayPalError(0, "NETWORK_UNKNOWN");
    await h.call(`payments/${h.payment.id}/capture`, {
      method: "POST",
      body: {},
    });
    h.paypal.failCapture = undefined;
    const result = RequestWithPayment.parse(
      await (
        await h.call(`payments/${h.payment.id}/reconcile`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    expect(result.payment.status).toBe("COMPLETED");
    expect(result.payment.attempts).toHaveLength(1);
    expect(result.payment.attempts[0]?.paypal_request_id).toBe(
      `cap_${h.payment.id}_1`,
    );
  });
  it("pending capture is never paid until reconciliation reports completion", async () => {
    const h = await prepare();
    h.paypal.approve(h.payment.paypal.order_id!);
    h.paypal.captureStatus = "PENDING";
    const result = RequestWithPayment.parse(
      await (
        await h.call(`payments/${h.payment.id}/capture`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    expect(result.purchase_request.status).toBe("PAYMENT_PENDING");
    h.paypal.orders.get(
      h.payment.paypal.order_id!,
    )!.purchase_units[0]!.payments!.captures![0]!.status = "COMPLETED";
    expect(
      RequestWithPayment.parse(
        await (
          await h.call(`payments/${h.payment.id}/reconcile`, {
            method: "POST",
            body: {},
          })
        ).json(),
      ).payment.status,
    ).toBe("COMPLETED");
  });
  it("create outage preserves CREATING; next request resumes same payment", async () => {
    const h = await harness();
    const r = await h.service.create(A(), "agt_research01");
    h.paypal.failCreate = new PayPalError(500, "INTERNAL_SERVER_ERROR");
    expect(
      (
        await h.call(`purchase-requests/${r.id}/checkout`, {
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(503);
    const pid = await h.store.tx((s) => Object.keys(s.payments)[0]);
    h.paypal.failCreate = undefined;
    const result = RequestWithPayment.parse(
      await (
        await h.call(`purchase-requests/${r.id}/checkout`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    expect(result.payment.id).toBe(pid);
  });
  it("expired approval/review fail closed; invalid transitions are rejected", async () => {
    const h = await prepare();
    h.paypal.approve(h.payment.paypal.order_id!);
    await h.store.tx((s) => {
      s.requests[h.request.id]!.decision!.expires_at = new Date(
        Date.now() - 1,
      ).toISOString();
    });
    const response = await h.call(`payments/${h.payment.id}/capture`, {
      method: "POST",
      body: {},
    });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("POLICY_APPROVAL_EXPIRED");
    expect(h.paypal.captures).toBe(0);
    expect(() =>
      transition(
        { ...h.request, status: "BLOCKED" },
        "checkout",
        new Date().toISOString(),
      ),
    ).toThrow();
    expect(() =>
      paymentTransition(
        { ...h.payment, status: "COMPLETED" },
        "capture",
        new Date().toISOString(),
      ),
    ).toThrow();
  });
});
describe("contract endpoints and audit", () => {
  it("all read endpoints parse shared schemas; sign-in/out and pagination work", async () => {
    const h = await prepare();
    for (const [path, schema] of [
      ["session", Session],
      ["checkout/config", CheckoutConfig],
      ["policies/active", ActivePolicy],
      ["purchase-requests", PurchaseRequestList],
      [`purchase-requests/${h.request.id}`, PurchaseRequest],
      [`payments/${h.payment.id}`, Payment],
      ["audit-events", AuditEventList],
      ["audit-events/verify", ChainVerification],
    ] as const) {
      const response = await h.call(path);
      expect(response.status, path).toBe(200);
      schema.parse(await response.json());
      expect(response.headers.get("X-Request-Id")).toMatch(/^req_/);
    }
    const signIn = await h.call("session", {
      role: "anonymous",
      method: "POST",
      body: { passcode: "reviewer" },
    });
    expect(signIn.status).toBe(200);
    expect(signIn.headers.get("set-cookie")).toContain("HttpOnly");
    Session.parse(await signIn.json());
    expect((await h.call("session", { method: "DELETE" })).status).toBe(204);
    const first = AuditEventList.parse(
      await (await h.call("audit-events?limit=2")).json(),
    );
    expect(first.data).toHaveLength(2);
    const next = AuditEventList.parse(
      await (
        await h.call(`audit-events?limit=2&cursor=${first.next_cursor}`)
      ).json(),
    );
    expect(next.data[0]?.seq).toBeLessThan(first.data[1]!.seq);
    expect(
      (await h.call("audit-events?format=csv")).headers.get("Content-Type"),
    ).toContain("text/csv");
    expect((await h.call("purchase-requests?limit=0")).status).toBe(422);
  });
  it("audit chain verifies then detects tampering", async () => {
    const h = await prepare();
    h.paypal.approve(h.payment.paypal.order_id!);
    await h.call(`payments/${h.payment.id}/capture`, {
      method: "POST",
      body: {},
    });
    const result = await h.store.tx((s) => verify(s.events));
    expect(result.ok).toBe(true);
    (h.store as MemoryStore).state.events[0]!.summary = "tampered";
    expect(await h.store.tx((s) => verify(s.events))).toMatchObject({
      ok: false,
      broken_at_seq: 1,
    });
  });
  it("verified webhook reconciles, deduplicates; forged signature changes nothing", async () => {
    const h = await prepare();
    h.paypal.approve(h.payment.paypal.order_id!);
    const body = {
      id: "WH-1",
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: h.payment.paypal.order_id },
    };
    h.paypal.verified = false;
    expect(
      (
        await h.call("webhooks/paypal", {
          method: "POST",
          role: "anonymous",
          body,
        })
      ).status,
    ).toBe(400);
    expect(h.paypal.gets).toBe(0);
    h.paypal.verified = true;
    expect(
      (
        await h.call("webhooks/paypal", {
          method: "POST",
          role: "anonymous",
          body,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await h.call("webhooks/paypal", {
          method: "POST",
          role: "anonymous",
          body,
        })
      ).status,
    ).toBe(200);
    expect(h.paypal.gets).toBe(1);
    expect(await h.store.tx((s) => s.payments[h.payment.id]!.status)).toBe(
      "APPROVED",
    );
  });
  it("demo scenarios share real request path; reset keeps financial history", async () => {
    const h = await harness();
    const response = await h.call("demo/scenarios/d_retry/run", {
      method: "POST",
      body: {},
    });
    const result = ScenarioRun.parse(await response.json());
    expect(result.replayed).toBe(true);
    expect(result.purchase_request.next_actions).toContain("start_checkout");
    const checkout = RequestWithPayment.parse(
      await (
        await h.call(
          `purchase-requests/${result.purchase_request.id}/checkout`,
          { method: "POST", body: {} },
        )
      ).json(),
    );
    expect(
      (await h.call("demo/reset", { method: "POST", body: {} })).status,
    ).toBe(200);
    expect((await h.call(`payments/${checkout.payment.id}`)).status).toBe(200);
  });
});

describe("recovery and failure boundaries", () => {
  it("persists the original API result atomically before a response interruption", async () => {
    class InterruptedStore extends MemoryStore {
      interrupt = true;
      override async tx<T>(fn: Parameters<MemoryStore["tx"]>[0]): Promise<T> {
        const result = await super.tx(fn);
        if (
          this.interrupt &&
          typeof result === "object" &&
          result &&
          "object" in result &&
          result.object === "purchase_request"
        ) {
          this.interrupt = false;
          throw new Error("response interrupted after commit");
        }
        return result as T;
      }
    }
    const store = new InterruptedStore();
    const h = await harness(store);
    const opts = {
      method: "POST",
      role: "agent" as const,
      key: "interrupted-create",
      body: A(),
    };
    expect((await h.call("purchase-requests", opts)).status).toBe(500);
    const retry = await h.call("purchase-requests", opts);
    expect(retry.status).toBe(201);
    expect(retry.headers.get("Idempotent-Replayed")).toBe("true");
    expect(PurchaseRequest.parse(await retry.json()).status).toBe("ALLOWED");
    expect(Object.keys(store.state.requests)).toHaveLength(1);
  });
  it("expired PayPal order creates a fresh payment and can recover a creation outage", async () => {
    const h = await prepare();
    const old = h.payment.id;
    h.paypal.orders.delete(h.payment.paypal.order_id!);
    h.paypal.get = async () => {
      throw new PayPalError(422, "ORDER_EXPIRED");
    };
    const expired = RequestWithPayment.parse(
      await (
        await h.call(`payments/${old}/capture`, { method: "POST", body: {} })
      ).json(),
    );
    expect(expired.payment.status).toBe("EXPIRED");
    expect(h.paypal.captures).toBe(0);
    h.paypal.failCreate = new PayPalError(500, "INTERNAL_SERVER_ERROR");
    expect(
      (
        await h.call(`purchase-requests/${h.request.id}/checkout`, {
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(503);
    const current = await h.store.tx(
      (s) => s.requests[h.request.id]!.payment!.id,
    );
    expect(current).not.toBe(old);
    h.paypal.failCreate = undefined;
    const recovered = RequestWithPayment.parse(
      await (
        await h.call(`purchase-requests/${h.request.id}/checkout`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    expect(recovered.payment.id).toBe(current);
    expect(recovered.purchase_request.status).toBe("CHECKOUT_PENDING");
  });
  it("an unknown capture followed by missing PayPal order stays unknown", async () => {
    const h = await prepare();
    h.paypal.approve(h.payment.paypal.order_id!);
    h.paypal.failCapture = new PayPalError(0, "NETWORK_UNKNOWN");
    await h.call(`payments/${h.payment.id}/capture`, {
      method: "POST",
      body: {},
    });
    h.paypal.orders.delete(h.payment.paypal.order_id!);
    expect(
      (
        await h.call(`payments/${h.payment.id}/reconcile`, {
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(503);
    expect(await h.store.tx((s) => s.payments[h.payment.id]!.status)).toBe(
      "CAPTURING",
    );
    expect(
      (
        await h.call(`purchase-requests/${h.request.id}/cancel`, {
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(409);
  });
  it("does not claim paid on a capture response amount mismatch", async () => {
    const h = await prepare();
    h.paypal.approve(h.payment.paypal.order_id!);
    const capture = h.paypal.capture.bind(h.paypal);
    h.paypal.capture = async (...args) => {
      const o = await capture(...args);
      o.purchase_units[0]!.payments!.captures![0]!.amount = {
        currency_code: "USD",
        value: "99.00",
      };
      return o;
    };
    const response = RequestWithPayment.parse(
      await (
        await h.call(`payments/${h.payment.id}/capture`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    expect(response.payment.status).toBe("CAPTURING");
    expect(response.payment.attempts[0]!.status).toBe("unknown");
  });
  it("three declines exhaust attempts; cancellation preserves financial history", async () => {
    const h = await prepare("e_capture_declined");
    for (let n = 0; n < 3; n++) {
      h.paypal.approve(h.payment.paypal.order_id!);
      const failed = RequestWithPayment.parse(
        await (
          await h.call(`payments/${h.payment.id}/capture`, {
            method: "POST",
            body: { simulate: "instrument_declined" },
          })
        ).json(),
      );
      expect(failed.payment.attempts).toHaveLength(n + 1);
      if (n < 2)
        expect(
          (
            await h.call(`purchase-requests/${h.request.id}/checkout`, {
              method: "POST",
              body: {},
            })
          ).status,
        ).toBe(200);
      else expect(failed.payment.failure!.retryable).toBe(false);
    }
    expect(
      (
        await h.call(`purchase-requests/${h.request.id}/checkout`, {
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(409);
    const cancelled = PurchaseRequest.parse(
      await (
        await h.call(`purchase-requests/${h.request.id}/cancel`, {
          method: "POST",
          body: {},
        })
      ).json(),
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.payment!.status).toBe("VOIDED");
    expect((await h.call(`payments/${h.payment.id}`)).status).toBe(200);
  });
  it("login and agent rate limits persist; malformed JSON and absent idempotency fail", async () => {
    const h = await harness();
    for (let n = 0; n < 5; n++)
      expect(
        (
          await h.call("session", {
            method: "POST",
            role: "anonymous",
            body: { passcode: "wrong" },
          })
        ).status,
      ).toBe(401);
    expect(
      (
        await h.call("session", {
          method: "POST",
          role: "anonymous",
          body: { passcode: "reviewer" },
        })
      ).status,
    ).toBe(429);
    await h.store.tx((s) => {
      s.limits["agent:agt_research01"] = {
        id: "agent:agt_research01",
        count: 60,
        until: Date.now() + 60000,
      };
    });
    expect(
      (
        await h.call("purchase-requests", {
          method: "POST",
          role: "agent",
          body: A(),
        })
      ).status,
    ).toBe(429);
    const h2 = await harness();
    expect(
      (
        await h2.call("purchase-requests", {
          method: "POST",
          role: "agent",
          body: A(),
          headers: { "Idempotency-Key": "" },
        })
      ).status,
    ).toBe(400);
    const malformed = new Request("http://localhost:3000/api/v1/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect((await h2.http.handle(malformed)).status).toBe(400);
  });
  it("payer cancellation only records abandonment and never grants the payer key", async () => {
    const h = await prepare();
    expect(
      (
        await h.call(`payments/${h.payment.id}/payer-cancel`, {
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(200);
    const r = PurchaseRequest.parse(
      await (await h.call(`purchase-requests/${h.request.id}`)).json(),
    );
    expect(r.status).toBe("CHECKOUT_PENDING");
    expect(r.keys.payer.state).toBe("waiting");
    expect(
      await h.store.tx((s) =>
        s.events.some((e) => e.type === "payer.cancelled"),
      ),
    ).toBe(true);
  });
});
