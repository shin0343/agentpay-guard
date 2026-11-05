import { correlation, operation, checkpoint } from "./idempotency/context";
import {
  PurchaseRequest,
  Payment,
  type PurchaseRequestCreate,
} from "@/contract";
import type {
  Agent,
  Principal,
  Store,
  StoreState,
  StoredPayment,
  StoredRequest,
} from "./model";
import { audit } from "./audit/ledger";
import { transition, paymentTransition } from "./state/transitions";
import { id, now, Fault, requireState } from "./util";
import { riskContext } from "./risk/context";
import { assessSafely } from "./risk/evaluate";
import { unavailable, type RiskResult } from "./risk/safety";
import { sanitize } from "./privacy";
import { combine, evaluate, fingerprint, policyOutcome } from "./policy/engine";
import { activePolicy, trustedQuote } from "./policy/catalog";
import type { RiskAssessor } from "./risk/assessor";
import { operator } from "./auth/session";
import {
  PayPalError,
  verifyOrder,
  type PayPal,
  type Order,
} from "./paypal/client";
export class GuardService {
  constructor(
    readonly store: Store,
    readonly paypal: PayPal,
    private risk: RiskAssessor,
    readonly merchant: string,
    readonly demo: boolean,
  ) {}
  request(s: StoreState, rid: string, p: Principal): StoredRequest {
    const r = s.requests[rid];
    if (!r || (p.kind === "agent" && r.agent.id !== p.id))
      throw new Fault("NOT_FOUND", 404, "Purchase request not found.");
    return r;
  }
  payment(s: StoreState, pid: string, p: Principal): StoredPayment {
    operator(p);
    const pay = s.payments[pid];
    if (!pay) throw new Fault("NOT_FOUND", 404, "Payment not found.");
    return pay;
  }
  move(
    s: StoreState,
    r: StoredRequest,
    event: Parameters<typeof transition>[1],
    actor?: Principal,
  ) {
    const result = transition(r, event, now());
    s.requests[r.id] = result.next;
    for (const e of result.effects) audit(s, e, result.next, actor);
    return result.next;
  }
  project(s: StoreState, r: StoredRequest, p: Principal): PurchaseRequest {
    const payment = Object.values(s.payments)
      .filter((x) => x.purchase_request_id === r.id)
      .sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      )[0];
    const effective = (r.payment ? s.payments[r.payment.id] : payment) ?? null;
    const policyGranted = [
      "ALLOWED",
      "CHECKOUT_PENDING",
      "CAPTURING",
      "PAID",
      "PAYMENT_PENDING",
      "PAYMENT_FAILED",
    ].includes(r.status);
    const payerGranted =
      effective &&
      ["APPROVED", "CAPTURING", "COMPLETED", "PENDING"].includes(
        effective.status,
      );
    const denied = ["BLOCKED", "REJECTED", "EXPIRED", "CANCELLED"].includes(
      r.status,
    );
    const k = (
      state: "waiting" | "granted" | "denied" | "not_applicable",
      by: string | null,
      at: string | null,
      detail: string,
    ) => ({ state, by, at, detail });
    const next: PurchaseRequest["next_actions"] = [];
    if (
      r.status === "IN_REVIEW" &&
      p.kind === "reviewer" &&
      s.agents[r.agent.id]?.owner_user_id !== p.id
    )
      next.push("open_review");
    if (p.kind !== "agent") {
      if (r.status === "ALLOWED") next.push("start_checkout");
      if (r.status === "CHECKOUT_PENDING") next.push("resume_checkout");
      if (r.status === "PAYMENT_FAILED" && effective?.failure?.retryable)
        next.push("retry_payment");
    }
    if (
      ["IN_REVIEW", "ALLOWED", "CHECKOUT_PENDING", "PAYMENT_FAILED"].includes(
        r.status,
      ) &&
      !(effective?.status === "CREATING") &&
      (p.kind !== "agent" || ["IN_REVIEW", "ALLOWED"].includes(r.status))
    )
      next.push("cancel");
    return PurchaseRequest.parse({
      ...r,
      payment: effective
        ? {
            id: effective.id,
            status: effective.status,
            paypal_order_id: effective.paypal.order_id,
            paypal_capture_id: effective.paypal.capture_id,
          }
        : null,
      next_actions: next,
      keys: {
        policy: k(
          policyGranted ? "granted" : denied ? "denied" : "waiting",
          policyGranted ? (r.review?.reviewer.name ?? "policy") : null,
          policyGranted
            ? (r.review?.decided_at ?? r.decision?.decided_at ?? null)
            : null,
          policyGranted
            ? "rule set v3"
            : denied
              ? "Not permitted"
              : "Waiting for reviewer",
        ),
        payer: k(
          payerGranted
            ? "granted"
            : denied || r.status === "IN_REVIEW"
              ? "not_applicable"
              : effective?.failure && !effective.failure.retryable
                ? "denied"
                : "waiting",
          payerGranted ? "PayPal payer" : null,
          payerGranted ? effective.updated_at : null,
          payerGranted ? "Verified with PayPal" : "PayPal approval required",
        ),
      },
    });
  }
  sync(s: StoreState, r: StoredRequest, pay: StoredPayment) {
    s.payments[pay.id] = pay;
    r.payment = {
      id: pay.id,
      status: pay.status,
      paypal_order_id: pay.paypal.order_id,
      paypal_capture_id: pay.paypal.capture_id,
    };
    s.requests[r.id] = r;
  }
  expire(s: StoreState, r: StoredRequest): boolean {
    const p = r.payment ? s.payments[r.payment.id] : undefined;
    const expired =
      r.status === "IN_REVIEW"
        ? Date.parse(r.created_at) + 86400000 <= Date.now()
        : ["ALLOWED", "CHECKOUT_PENDING", "PAYMENT_FAILED"].includes(
            r.status,
          ) &&
          !!r.decision?.expires_at &&
          Date.parse(r.decision.expires_at) <= Date.now();
    if (
      r.status === "EVALUATING" &&
      r.evaluation &&
      (r.evaluation_claim_until ?? Infinity) <= Date.now()
    ) {
      this.finishEvaluation(s, r, {
        ...unavailable(),
        diagnostics: {
          provider: "none",
          attempts: 0,
          failure_code: "EVALUATION_INTERRUPTED",
        },
      });
      return false;
    }
    if (expired && p?.status !== "CREATING") {
      r = this.move(s, r, "expire");
      if (
        p &&
        ["AWAITING_PAYER", "APPROVED", "DECLINED", "FAILED"].includes(p.status)
      )
        this.sync(s, r, paymentTransition(p, "void", now()));
      return true;
    }
    return false;
  }
  async preflight(rid: string, actor: Principal) {
    const expired = await this.store.tx((s) => {
      const r = this.request(s, rid, actor);
      return this.expire(s, r) || r.status === "EXPIRED";
    });
    if (expired)
      throw new Fault(
        "POLICY_APPROVAL_EXPIRED",
        409,
        "Policy approval expired. Submit a new request.",
      );
  }
  async create(
    input: PurchaseRequestCreate,
    agentId: string,
  ): Promise<StoredRequest> {
    const trusted = trustedQuote(input);
    const inputFingerprint = fingerprint(agentId, input);
    input = sanitize(input);
    const prepared = await this.store.tx((s) => {
      const scope = operation.getStore();
      const resourceId = scope ? s.idempotency[scope]?.resource_id : undefined;
      if (resourceId && s.requests[resourceId]) {
        const existing = s.requests[resourceId]!;
        this.expire(s, existing);
        return { r: s.requests[resourceId]!, context: null };
      }
      const a = s.agents[agentId];
      if (!a) throw new Fault("UNAUTHENTICATED", 401, "Unknown agent.");
      for (const r of Object.values(s.requests)) this.expire(s, r);
      const at = now();
      let r: StoredRequest = {
        ...input,
        id: id("preq"),
        object: "purchase_request",
        status: "RECEIVED",
        version: 1,
        created_at: at,
        updated_at: at,
        agent: { id: a.id, name: a.name },
        agent_reference: input.agent_reference ?? null,
        metadata: input.metadata ?? null,
        fingerprint: inputFingerprint,
        duplicate_of: null,
        evaluation: null,
        decision: null,
        review: null,
        payment: null,
        next_actions: [],
        keys: {
          policy: { state: "waiting", by: null, at: null, detail: null },
          payer: { state: "not_applicable", by: null, at: null, detail: null },
        },
        trusted_catalog: trusted,
        correlation_id: correlation.getStore() ?? id("req"),
      };
      const actor: Principal = { kind: "agent", id: a.id, name: a.name };
      s.requests[r.id] = r;
      audit(s, "request.received", r, actor);
      r = this.move(s, r, "evaluate");
      const { rules, duplicate } = evaluate(s, r, a, at);
      r.duplicate_of = duplicate?.id ?? null;
      r.evaluation_claim_until = Date.now() + 10000;
      if (scope && s.idempotency[scope])
        s.idempotency[scope]!.resource_id = r.id;
      const risk = unavailable();
      r.evaluation = {
        policy_set: {
          id: activePolicy.id,
          name: activePolicy.name,
          version: activePolicy.version,
        },
        policy: rules,
        risk,
      };
      audit(s, "policy.evaluated", r, undefined, {
        policy: rules,
        policy_outcome: policyOutcome(rules),
      });
      if (duplicate)
        audit(s, "request.duplicate_detected", r, actor, {
          duplicate_of: duplicate.id,
        });
      return { r, context: riskContext(s, r, a, rules) };
    });
    if (!prepared.context) {
      return this.store.tx((s) => {
        const r = s.requests[prepared.r.id]!;
        requireState(r.status !== "EVALUATING", r.status, [
          "Completed evaluation",
        ]);
        checkpoint(s, this.project(s, r, { kind: "agent", ...r.agent }), 201);
        return r;
      });
    }
    const risk = await assessSafely(this.risk, prepared.r, prepared.context);
    return this.store.tx((s) => {
      const r = s.requests[prepared.r.id]!;
      // An expired lease may already have been settled on a concurrent read.
      if (r.status === "EVALUATING") this.finishEvaluation(s, r, risk);
      const result = s.requests[r.id]!;
      checkpoint(
        s,
        this.project(s, result, { kind: "agent", ...r.agent }),
        201,
      );
      return result;
    });
  }
  private finishEvaluation(
    s: StoreState,
    r: StoredRequest,
    result: RiskResult,
  ) {
    const { diagnostics, ...risk } = result;
    const rules = r.evaluation!.policy;
    r.evaluation!.risk = risk;
    r.evaluation_claim_until = 0;
    const outcome = combine(rules, risk);
    const policy = policyOutcome(rules);
    r.decision = {
      id: id("dec"),
      outcome,
      policy_outcome: policy,
      risk_escalated: policy === "ALLOW" && outcome === "REVIEW",
      reason_codes: [
        ...rules
          .filter((x) => x.outcome !== "pass")
          .map((x) => `${x.rule_id}:${x.outcome}`),
        ...risk.signals.map((x) => `risk:${x.code}`),
        ...(["unavailable", "timeout"].includes(risk.status)
          ? [`risk:${risk.status}`]
          : []),
      ],
      reason:
        outcome === "ALLOW"
          ? "Within limits; trusted merchant; low risk."
          : outcome === "BLOCK"
            ? "Blocked by deterministic spending policy."
            : "Human review required before payment.",
      decided_at: now(),
      expires_at:
        outcome === "ALLOW"
          ? new Date(Date.now() + 1800000).toISOString()
          : null,
    };
    audit(
      s,
      risk.status === "unavailable" || risk.status === "timeout"
        ? "risk.unavailable"
        : "risk.assessed",
      r,
      undefined,
      { risk, diagnostics },
    );
    this.move(
      s,
      r,
      outcome === "ALLOW" ? "allow" : outcome === "BLOCK" ? "block" : "review",
    );
  }
  async review(
    rid: string,
    body: { action: "approve" | "reject"; note?: string },
    expected: string | null,
    p: Principal,
  ) {
    operator(p);
    if (p.kind !== "reviewer")
      throw new Fault("FORBIDDEN", 403, "A reviewer is required.");
    await this.preflight(rid, p);
    return this.store.tx((s) => {
      let r = this.request(s, rid, p);
      if (
        r.status === "IN_REVIEW" &&
        Date.parse(r.created_at) + 86400000 <= Date.now()
      )
        throw new Fault(
          "POLICY_APPROVAL_EXPIRED",
          409,
          "Review approval window expired.",
        );
      if (s.agents[r.agent.id]?.owner_user_id === p.id)
        throw new Fault(
          "FORBIDDEN",
          403,
          "Self-owned requests require another reviewer.",
        );
      if (expected !== `"${r.version}"`)
        throw new Fault("VERSION_CONFLICT", 412, "Request version changed.", {
          current_version: r.version,
        });
      r.review = {
        id: id("rev"),
        action: body.action,
        reviewer: { id: p.id, name: p.name },
        note: body.note ? sanitize(body.note) : null,
        decided_at: now(),
      };
      if (body.action === "approve" && r.decision)
        r.decision.expires_at = new Date(Date.now() + 1800000).toISOString();
      r = this.move(s, r, body.action === "approve" ? "approve" : "reject", p);
      const output = this.project(s, r, p);
      checkpoint(s, output);
      return output;
    });
  }
  async cancel(rid: string, p: Principal) {
    await this.preflight(rid, p);
    return this.store.tx((s) => {
      let r = this.request(s, rid, p);
      if (p.kind === "agent")
        requireState(["IN_REVIEW", "ALLOWED"].includes(r.status), r.status, [
          "IN_REVIEW",
          "ALLOWED",
        ]);
      const pay = r.payment ? s.payments[r.payment.id] : undefined;
      requireState(pay?.status !== "CREATING", pay?.status ?? r.status, [
        "AWAITING_PAYER",
        "APPROVED",
      ]);
      r = this.move(s, r, "cancel", p);
      if (pay) this.sync(s, r, paymentTransition(pay, "void", now()));
      const output = this.project(s, r, p);
      checkpoint(s, output);
      return output;
    });
  }
  private bundle(
    s: StoreState,
    r: StoredRequest,
    pay: StoredPayment,
    p: Principal,
  ) {
    const output = {
      purchase_request: this.project(s, r, p),
      payment: Payment.parse(pay),
    };
    checkpoint(s, output);
    return output;
  }
  async checkout(rid: string, p: Principal) {
    operator(p);
    await this.preflight(rid, p);
    const claim = await this.store.tx((s) => {
      let r = this.request(s, rid, p);
      requireState(
        ["ALLOWED", "CHECKOUT_PENDING", "PAYMENT_FAILED"].includes(r.status),
        r.status,
        ["ALLOWED", "CHECKOUT_PENDING", "PAYMENT_FAILED"],
      );
      if (!r.trusted_catalog || !trustedQuote(r))
        throw new Fault(
          "VALIDATION_FAILED",
          422,
          "A trusted server catalog quote is required before checkout.",
        );
      let pay = r.payment ? s.payments[r.payment.id] : undefined;
      if (
        pay?.status !== "CREATING" &&
        (!r.decision?.expires_at ||
          Date.parse(r.decision.expires_at) <= Date.now())
      )
        throw new Fault(
          "POLICY_APPROVAL_EXPIRED",
          409,
          "Policy approval expired.",
        );
      if (pay && ["AWAITING_PAYER", "APPROVED"].includes(pay.status))
        return { done: this.bundle(s, r, pay, p) };
      if (r.status === "PAYMENT_FAILED" && pay?.status !== "CREATING") {
        requireState(!!pay?.failure?.retryable, r.status, [
          "Retryable payment failure",
        ]);
        if (pay!.attempts.length >= 3 && pay!.failure?.code !== "ORDER_EXPIRED")
          throw new Fault(
            "STATE_CONFLICT",
            409,
            "Maximum capture attempts reached.",
          );
        if (r.review && !r.retry_extended && r.decision?.expires_at) {
          r.decision.expires_at = new Date(
            Date.parse(r.decision.expires_at) + 900000,
          ).toISOString();
          r.retry_extended = true;
        }
        if (pay!.status === "DECLINED") {
          pay = paymentTransition(pay!, "retry", now());
          pay.failure = null;
          this.sync(s, r, pay);
          r = this.move(s, r, "checkout", p);
          this.sync(s, r, pay);
          return { done: this.bundle(s, r, pay, p) };
        }
        if (pay && pay.status !== "VOIDED") {
          pay = paymentTransition(pay, "void", now());
          this.sync(s, r, pay);
        }
      }
      if (!pay || pay.status !== "CREATING") {
        const at = now();
        pay = {
          id: id("pay"),
          object: "payment",
          purchase_request_id: r.id,
          status: "CREATING",
          version: 1,
          amount: r.amount,
          paypal: {
            environment: "sandbox",
            order_id: null,
            order_status: null,
            capture_id: null,
            capture_status: null,
            payer_action_url: null,
          },
          attempts: [],
          failure: null,
          created_at: at,
          updated_at: at,
        };
        this.sync(s, r, pay);
      }
      if ((pay.create_claim_until ?? 0) > Date.now())
        throw new Fault(
          "IDEMPOTENCY_IN_PROGRESS",
          409,
          "Order creation is in progress.",
          {},
          true,
        );
      if (Date.now() - Date.parse(pay.created_at) > 5 * 3600000)
        throw new Fault(
          "STATE_CONFLICT",
          409,
          "Ambiguous order creation requires manual investigation.",
        );
      if (pay.create_claim_until !== undefined)
        audit(s, "payment.retry_requested", r, p, {
          phase: "create",
          paypal_request_id: `ord_${pay.id}`,
        });
      pay.create_claim_until = Date.now() + 60000;
      return { r, pay };
    });
    if (claim.done) return claim.done;
    const { r, pay } = claim;
    try {
      const order = await this.paypal.create(r, pay);
      verifyOrder(order, r, pay, this.merchant);
      requireState(
        ["CREATED", "PAYER_ACTION_REQUIRED", "APPROVED"].includes(order.status),
        order.status,
        ["CREATED", "PAYER_ACTION_REQUIRED", "APPROVED"],
      );
      const link =
        order.links?.find((x) => x.rel === "payer-action") ??
        order.links?.find((x) => x.rel === "approve");
      if (
        !link ||
        (new URL(link.href).origin !== "https://www.sandbox.paypal.com" &&
          new URL(link.href).origin !== "https://sandbox.paypal.com")
      )
        throw new Fault(
          "PAYPAL_REJECTED",
          502,
          "PayPal sandbox approval link missing.",
        );
      return await this.store.tx((s) => {
        let current = s.requests[r.id]!;
        let payment = s.payments[pay.id]!;
        requireState(payment.status === "CREATING", payment.status, [
          "CREATING",
        ]);
        payment = paymentTransition(payment, "created", now());
        payment.paypal = {
          ...payment.paypal,
          order_id: order.id,
          order_status: order.status,
          payer_action_url: link.href,
        };
        payment.create_claim_until = 0;
        this.sync(s, current, payment);
        current = this.move(s, current, "checkout", p);
        this.sync(s, current, payment);
        return this.bundle(s, current, payment, p);
      });
    } catch (e) {
      await this.store.tx((s) => {
        const pay = s.payments[claim.pay.id]!;
        pay.create_claim_until = 0;
        audit(s, "checkout.failed", s.requests[pay.purchase_request_id]!, p, {
          phase: "create",
          failure_code:
            e instanceof PayPalError ? e.issue : "RESPONSE_UNVERIFIED",
          paypal_request_id: `ord_${pay.id}`,
          outcome: "unconfirmed",
        });
        if (e instanceof PayPalError && e.http >= 400 && e.http < 500) {
          pay.failure = {
            code: "PAYPAL_ERROR",
            paypal_issue: e.issue,
            message: "PayPal rejected order creation. No payment was taken.",
            retryable: false,
          };
          const next = paymentTransition(pay, "failed", now());
          this.sync(s, s.requests[pay.purchase_request_id]!, next);
          const r = this.move(
            s,
            s.requests[pay.purchase_request_id]!,
            "create_failed",
          );
          this.sync(s, r, next);
        }
      });
      if (e instanceof Fault) throw e;
      throw new Fault(
        e instanceof PayPalError && e.http >= 400 && e.http < 500
          ? "PAYPAL_REJECTED"
          : "PAYPAL_UNAVAILABLE",
        e instanceof PayPalError && e.http >= 400 && e.http < 500 ? 502 : 503,
        "PayPal order creation could not be confirmed. Retry the same checkout.",
        {},
        true,
      );
    }
  }
  private async readOwned(pid: string, p: Principal) {
    const { r, pay } = await this.store.tx((s) => {
      const pay = this.payment(s, pid, p);
      const r = this.request(s, pay.purchase_request_id, p);
      requireState(
        !["BLOCKED", "REJECTED", "CANCELLED", "EXPIRED"].includes(r.status),
        r.status,
        ["CHECKOUT_PENDING", "CAPTURING", "PAYMENT_PENDING"],
      );
      return { r, pay };
    });
    if (!pay.paypal.order_id)
      throw new Fault(
        "STATE_CONFLICT",
        409,
        "Order creation has not completed.",
      );
    let order: Order;
    try {
      order = await this.paypal.get(pay.paypal.order_id);
    } catch (e) {
      if (
        e instanceof PayPalError &&
        e.issue === "ORDER_EXPIRED" &&
        !["CAPTURING", "PENDING"].includes(pay.status)
      )
        return { r, pay, order: null };
      throw new Fault(
        "PAYPAL_UNAVAILABLE",
        503,
        "Unable to read PayPal order.",
        {},
        true,
      );
    }
    verifyOrder(order, r, pay, this.merchant);
    return { r, pay, order };
  }
  async capture(pid: string, p: Principal, simulate = false) {
    operator(p);
    const initial = await this.store.tx((s) => {
      const pay = this.payment(s, pid, p);
      return { pay, r: s.requests[pay.purchase_request_id]! };
    });
    if (initial.pay.status === "COMPLETED")
      return this.store.tx((s) =>
        this.bundle(s, s.requests[initial.r.id]!, s.payments[pid]!, p),
      );
    if (initial.pay.status === "CAPTURING")
      throw new Fault(
        "CAPTURE_IN_PROGRESS",
        409,
        "Capture is being confirmed.",
        {},
        true,
      );
    await this.preflight(initial.r.id, p);
    const owned = await this.readOwned(pid, p);
    if (!owned.order || owned.order.status === "VOIDED")
      return this.expiredOrder(pid, p);
    const { order } = owned;
    if (order.purchase_units[0]!.payments?.captures?.length)
      return this.settle(pid, order, p);
    if (order.status !== "APPROVED") {
      return this.store.tx((s) => {
        const pay = s.payments[pid]!;
        if (
          pay.version !== owned.pay.version ||
          !["AWAITING_PAYER", "APPROVED"].includes(pay.status)
        )
          return this.bundle(s, s.requests[pay.purchase_request_id]!, pay, p);
        pay.paypal.order_status = order.status;
        pay.failure = {
          code: "PAYER_ACTION_REQUIRED",
          paypal_issue: "ORDER_NOT_APPROVED",
          message:
            "PayPal payer approval is still required. No capture was requested.",
          retryable: true,
        };
        return this.bundle(s, s.requests[pay.purchase_request_id]!, pay, p);
      });
    }
    const claim = await this.store.tx((s) => {
      let pay = this.payment(s, pid, p);
      let r = this.request(s, pay.purchase_request_id, p);
      if (pay.status === "CAPTURING")
        throw new Fault(
          "CAPTURE_IN_PROGRESS",
          409,
          "Capture is in progress.",
          {},
          true,
        );
      requireState(r.status === "CHECKOUT_PENDING", r.status, [
        "CHECKOUT_PENDING",
      ]);
      if (
        !r.decision?.expires_at ||
        Date.parse(r.decision.expires_at) <= Date.now()
      )
        throw new Fault(
          "POLICY_APPROVAL_EXPIRED",
          409,
          "Policy approval expired.",
        );
      if (!r.trusted_catalog || !trustedQuote(r))
        throw new Fault("FORBIDDEN", 403, "Trusted pricing is required.");
      if (pay.attempts.length >= 3)
        throw new Fault(
          "STATE_CONFLICT",
          409,
          "Maximum capture attempts reached.",
        );
      const n = pay.attempts.length + 1;
      if (n > 1)
        audit(s, "payment.retry_requested", r, p, {
          phase: "capture",
          paypal_request_id: `cap_${pay.id}_${n}`,
        });
      pay = paymentTransition(pay, "capture", now());
      pay.paypal.order_status = order.status;
      pay.failure = null;
      pay.capture_claim_until = Date.now() + 60000;
      pay.attempts.push({
        n,
        status: "in_flight",
        paypal_request_id: `cap_${pay.id}_${n}`,
        paypal_debug_id: null,
        issue: null,
        at: now(),
      });
      this.sync(s, r, pay);
      audit(s, "payer.approved", r, p);
      r = this.move(s, r, "capture", p);
      this.sync(s, r, pay);
      return { r, pay };
    });
    return this.sendCapture(claim.pay, p, simulate && this.demo);
  }
  private async sendCapture(
    pay: StoredPayment,
    p: Principal,
    simulate: boolean,
  ) {
    const replayingUnknown = pay.attempts.at(-1)?.status === "unknown";
    try {
      const order = await this.paypal.capture(
        pay.paypal.order_id!,
        pay.attempts.at(-1)!.paypal_request_id,
        simulate,
      );
      return await this.settle(pay.id, order, p);
    } catch (e) {
      if (e instanceof PayPalError && e.issue === "ORDER_ALREADY_CAPTURED") {
        try {
          const owned = await this.readOwned(pay.id, p);
          if (owned.order) return await this.settle(pay.id, owned.order, p);
        } catch {
          /* unknown; retain capture claim below */
        }
      }
      return this.store.tx((s) => {
        let current = s.payments[pay.id]!;
        let r = s.requests[current.purchase_request_id]!;
        if (current.status !== "CAPTURING")
          return this.bundle(s, r, current, p);
        const attempt = current.attempts.at(-1)!;
        current.capture_claim_until = 0;
        if (
          replayingUnknown ||
          !(e instanceof PayPalError) ||
          e.http === 0 ||
          e.http >= 500 ||
          e.http === 401 ||
          e.http === 409 ||
          e.issue === "ORDER_ALREADY_CAPTURED"
        ) {
          if (replayingUnknown || (e instanceof PayPalError && e.http === 409))
            current.capture_claim_until = Date.now() + 60000;
          attempt.status = "unknown";
          attempt.issue =
            e instanceof PayPalError ? e.issue : "RESPONSE_UNVERIFIED";
          audit(s, "payment.outcome_unknown", r, p, {
            phase: "capture",
            failure_code: attempt.issue,
            paypal_request_id: attempt.paypal_request_id,
          });
          return this.bundle(s, r, current, p);
        }
        attempt.issue = e.issue;
        attempt.paypal_debug_id = e.debug;
        const decline = ["INSTRUMENT_DECLINED", "TRANSACTION_REFUSED"].includes(
          e.issue,
        );
        const payer = ["PAYER_ACTION_REQUIRED", "ORDER_NOT_APPROVED"].includes(
          e.issue,
        );
        const expired = e.issue === "ORDER_EXPIRED";
        attempt.status = decline ? "declined" : "failed";
        current = paymentTransition(
          current,
          decline
            ? "declined"
            : payer
              ? "payer_action"
              : expired
                ? "expire"
                : "failed",
          now(),
        );
        current.failure = {
          code: decline
            ? "PAYMENT_DECLINED"
            : payer
              ? "PAYER_ACTION_REQUIRED"
              : expired
                ? "ORDER_EXPIRED"
                : e.issue === "MAX_NUMBER_OF_PAYMENT_ATTEMPTS_EXCEEDED"
                  ? "ATTEMPTS_EXCEEDED"
                  : "PAYPAL_ERROR",
          paypal_issue: e.issue,
          message: decline
            ? "PayPal declined the funding source. No payment was taken."
            : payer
              ? "PayPal payer approval is required. No payment was taken."
              : "PayPal did not complete this payment.",
          retryable:
            (decline ||
              payer ||
              expired ||
              e.issue === "MAX_NUMBER_OF_PAYMENT_ATTEMPTS_EXCEEDED") &&
            current.attempts.length < 3,
        };
        this.sync(s, r, current);
        r = this.move(
          s,
          r,
          payer ? "payer_action" : decline ? "declined" : "failed",
          p,
        );
        this.sync(s, r, current);
        return this.bundle(s, r, current, p);
      });
    }
  }
  async settle(pid: string, order: Order, p: Principal) {
    return this.store.tx((s) => {
      let pay = s.payments[pid]!;
      let r = s.requests[pay.purchase_request_id]!;
      verifyOrder(order, r, pay, this.merchant);
      if (pay.status === "COMPLETED") return this.bundle(s, r, pay, p);
      requireState(
        !["BLOCKED", "REJECTED", "CANCELLED", "EXPIRED"].includes(r.status),
        r.status,
        ["CAPTURING", "PAYMENT_PENDING", "CHECKOUT_PENDING"],
      );
      pay.paypal.order_status = order.status;
      const cap = order.purchase_units[0]!.payments?.captures?.[0];
      if (!cap) {
        return this.bundle(s, r, pay, p);
      }
      if (!["COMPLETED", "PENDING", "DECLINED", "FAILED"].includes(cap.status))
        throw new Fault(
          "PAYPAL_REJECTED",
          502,
          "Unsupported capture settlement state.",
        );
      if (cap.status === "COMPLETED" && order.status !== "COMPLETED")
        throw new Fault(
          "PAYPAL_REJECTED",
          502,
          "Order and capture status disagree.",
        );
      if (
        r.status === "CHECKOUT_PENDING" &&
        ["AWAITING_PAYER", "APPROVED"].includes(pay.status)
      ) {
        pay = paymentTransition(pay, "capture", now());
        r = this.move(s, r, "capture", p);
      }
      if (pay.status === "PENDING" && cap.status === "PENDING")
        return this.bundle(s, r, pay, p);
      const event =
        cap.status === "COMPLETED"
          ? "completed"
          : cap.status === "PENDING"
            ? "pending"
            : cap.status === "DECLINED"
              ? "declined"
              : "failed";
      pay = paymentTransition(pay, event, now());
      pay.paypal.capture_id = cap.id;
      pay.paypal.capture_status = cap.status;
      pay.capture_claim_until = 0;
      const attempt = pay.attempts.at(-1);
      if (attempt) attempt.status = event;
      pay.failure =
        event === "declined" || event === "failed"
          ? {
              code: "PAYMENT_DECLINED",
              paypal_issue: null,
              message: "PayPal did not complete this payment.",
              retryable: pay.attempts.length < 3,
            }
          : null;
      this.sync(s, r, pay);
      r = this.move(s, r, event, p);
      this.sync(s, r, pay);
      return this.bundle(s, r, pay, p);
    });
  }
  private async expiredOrder(pid: string, p: Principal) {
    return this.store.tx((s) => {
      let pay = s.payments[pid]!;
      let r = s.requests[pay.purchase_request_id]!;
      const awaiting =
        pay.status === "AWAITING_PAYER" || pay.status === "APPROVED";
      pay = paymentTransition(pay, "expire", now());
      pay.failure = {
        code: "ORDER_EXPIRED",
        paypal_issue: "ORDER_EXPIRED",
        message: "The PayPal order expired. No payment was taken.",
        retryable: true,
      };
      this.sync(s, r, pay);
      r = this.move(s, r, awaiting ? "order_expired" : "failed", p);
      this.sync(s, r, pay);
      return this.bundle(s, r, pay, p);
    });
  }
  async reconcile(pid: string, p: Principal) {
    operator(p);
    const initial = await this.store.tx((s) => {
      const pay = this.payment(s, pid, p);
      return { pay, r: s.requests[pay.purchase_request_id]! };
    });
    if (initial.pay.status === "CREATING")
      return this.checkout(initial.r.id, p);
    if (
      ["COMPLETED", "FAILED", "DECLINED", "VOIDED", "EXPIRED"].includes(
        initial.pay.status,
      )
    )
      return this.store.tx((s) =>
        this.bundle(s, s.requests[initial.r.id]!, s.payments[pid]!, p),
      );
    const owned = await this.readOwned(pid, p);
    if (!owned.order || owned.order.status === "VOIDED")
      return this.expiredOrder(pid, p);
    if (owned.order.purchase_units[0]!.payments?.captures?.length) {
      const result = await this.settle(pid, owned.order, p);
      await this.store.tx((s) =>
        audit(s, "payment.reconciled", s.requests[initial.r.id]!, p),
      );
      return result;
    }
    // Recover a crashed/ambiguous capture using the original request ID only.
    if (owned.pay.status === "CAPTURING" && owned.order.status === "APPROVED") {
      const claimed = await this.store.tx((s) => {
        const pay = s.payments[pid]!;
        const r = s.requests[pay.purchase_request_id]!;
        const attempt = pay.attempts.at(-1);
        if (
          pay.status !== "CAPTURING" ||
          !attempt ||
          (pay.capture_claim_until ?? 0) > Date.now() ||
          Date.now() - Date.parse(attempt.at) > 5 * 3600000 ||
          !r.decision?.expires_at ||
          Date.parse(r.decision.expires_at) <= Date.now()
        )
          return null;
        pay.capture_claim_until = Date.now() + 60000;
        audit(s, "payment.retry_requested", r, p, {
          phase: "capture",
          paypal_request_id: attempt.paypal_request_id,
        });
        return pay;
      });
      if (claimed) return this.sendCapture(claimed, p, false);
    }
    return this.store.tx((s) => {
      let pay = s.payments[pid]!;
      const r = s.requests[pay.purchase_request_id]!;
      if (pay.version !== owned.pay.version) return this.bundle(s, r, pay, p);
      if (
        owned.order!.status === "APPROVED" &&
        pay.status === "AWAITING_PAYER"
      ) {
        pay = paymentTransition(pay, "approved", now());
        audit(s, "payer.approved", r, p);
      }
      pay.paypal.order_status = owned.order!.status;
      this.sync(s, r, pay);
      audit(s, "payment.reconciled", r, p);
      return this.bundle(s, r, pay, p);
    });
  }
}
export function seedAgents(s: StoreState, keyHash?: string) {
  const definitions: [string, string, Agent["allowed_categories"]][] = [
    [
      "agt_research01",
      "research-assistant",
      ["api_credits", "compute", "data", "software"],
    ],
    ["agt_opsbuyer01", "ops-buyer", ["office_supplies", "software"]],
    ["agt_growth01", "growth-agent", ["advertising", "software"]],
  ];
  for (const [id, name, allowed_categories] of definitions)
    if (!s.agents[id])
      s.agents[id] = {
        id,
        name,
        allowed_categories,
        owner_user_id: "usr_agent_owner",
        authorized_purpose: {
          agt_research01:
            "Research, document indexing and evaluation workloads",
          agt_opsbuyer01: "Office supplies and licensed team software",
          agt_growth01: "Marketing campaigns and growth software",
        }[id],
        key_hash:
          id === "agt_research01" ? (keyHash ?? "disabled") : `disabled:${id}`,
      };
}
