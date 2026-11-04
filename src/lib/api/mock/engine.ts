/**
 * MockEngine — a synchronous, in-memory simulation of the documented backend.
 *
 * It implements the real rules from docs/PAYMENT_STATE_MACHINE.md (policy P-01…P-08, the one-way
 * AI valve, both state machines, idempotency, duplicate guard, hash-chained ledger) so the UI is
 * exercised against realistic behavior. It never calls PayPal or an AI model. Everything it
 * produces is labelled as simulated (environment "mock", MOCK- ids, model "mock-fixture").
 */
import {
  type AuditEvent, type AuditEventType, type ChainVerification, type Decision, type DecisionOutcome,
  type Evaluation, type KeyState, type NextAction, type Payment, type PolicyResult, type PurchaseRequest,
  type PurchaseRequestList, type RequestStatus, type ReviewCreate, type RiskAssessment, type RiskSignal,
  type Role, type RuleOutcome, type ScenarioKey, type Session, type ActivePolicy, type AuditEventList,
  PurchaseRequestCreate,
} from "@/contract";
import { dayKey, formatMoney, fromCents, shortId, toCents } from "@/lib/format";
import { ApiError, type ListAuditParams, type ListRequestsParams } from "../types";
import {
  AGENTS, CATEGORY_LABEL, HISTORY, MERCHANT_ALLOWLIST, MOCK_MODEL, MOCK_PASSCODES, PEOPLE, POLICY,
  PROMPT_VERSION, RISK_FIXTURES, scenarioByKey,
} from "./seed";
import { canonicalJson, sha256Hex } from "./sha256";

// ── Types ────────────────────────────────────────────────────────────────────

interface StoredRequest {
  id: string;
  status: RequestStatus;
  version: number;
  created_at: string;
  updated_at: string;
  agent_id: string;
  agent_reference: string | null;
  merchant: PurchaseRequest["merchant"];
  items: PurchaseRequest["items"];
  amount: PurchaseRequest["amount"];
  justification: string;
  metadata: Record<string, string> | null;
  fingerprint: string;
  duplicate_of: string | null;
  evaluation: Evaluation | null;
  decision: Decision | null;
  review: PurchaseRequest["review"];
  payment_ids: string[];
  review_expires_at: string | null;
  approval_extended: boolean;
  scenario: ScenarioKey | null;
}

export interface EngineState {
  v: 1;
  requests: Record<string, StoredRequest>;
  payments: Record<string, Payment>;
  pending_simulate: Record<string, "none" | "instrument_declined">;
  events: AuditEvent[];
  idem: Record<string, { body_hash: string; request_id: string; snapshot: PurchaseRequest }>;
  session: Session | null;
}

export type User = Session["user"];
type Actor = AuditEvent["actor"];

const RESERVED: RequestStatus[] = ["IN_REVIEW", "ALLOWED", "CHECKOUT_PENDING", "CAPTURING", "PAYMENT_PENDING", "PAID"];
const DENIED_TERMINAL: RequestStatus[] = ["BLOCKED", "REJECTED", "CANCELLED", "EXPIRED"];
const OPEN_PAYMENT: Payment["status"][] = ["CREATING", "AWAITING_PAYER", "APPROVED", "CAPTURING", "PENDING"];

const SYSTEM: Actor = { kind: "system", id: null, name: "AgentPay Guard" };
const AI: Actor = { kind: "ai", id: null, name: MOCK_MODEL };
const PAYPAL: Actor = { kind: "paypal", id: null, name: "PayPal (simulated)" };

// ── Helpers ──────────────────────────────────────────────────────────────────

const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulid(t: number): string {
  let time = "";
  let n = t;
  for (let i = 0; i < 10; i++) {
    time = B32[n % 32] + time;
    n = Math.floor(n / 32);
  }
  let rand = "";
  for (let i = 0; i < 16; i++) rand += B32[Math.floor(Math.random() * 32)];
  return time + rand;
}
const upperRand = (len: number) => Array.from({ length: len }, () => B32[Math.floor(Math.random() * 32)]).join("");
const iso = (t: number) => new Date(t).toISOString();
const fail = (code: ApiError["code"], status: number, message: string, details: Record<string, unknown> = {}, retryable = false) =>
  new ApiError(code, message, status, retryable, `req_mock_${upperRand(8)}`, details);

export function fingerprintOf(agentId: string, body: PurchaseRequestCreate): string {
  const items = body.items.map((i) => `${i.name.toLowerCase()}×${i.quantity}`).sort().join(",");
  return sha256Hex([agentId, body.merchant.name.trim().toLowerCase(), body.amount.value, body.amount.currency_code, items].join("|"));
}

/** The one-way valve (PAYMENT_STATE_MACHINE.md §4.2). AI can escalate ALLOW → REVIEW, nothing else. */
export function combine(policy: RuleOutcome[], risk: RiskAssessment): { outcome: DecisionOutcome; policyOutcome: DecisionOutcome } {
  const policyOutcome: DecisionOutcome = policy.includes("block") ? "BLOCK" : policy.includes("review") ? "REVIEW" : "ALLOW";
  if (policyOutcome !== "ALLOW") return { outcome: policyOutcome, policyOutcome };
  if (risk.status !== "completed") return { outcome: "REVIEW", policyOutcome };
  if (risk.recommendation === "escalate_to_review") return { outcome: "REVIEW", policyOutcome };
  if ((risk.score ?? 100) >= 35) return { outcome: "REVIEW", policyOutcome };
  return { outcome: "ALLOW", policyOutcome };
}

const isAre = (label: string) => (/s$/.test(label) ? "are" : "is");
const levelOf = (score: number): "low" | "medium" | "high" => (score >= 70 ? "high" : score >= 35 ? "medium" : "low");

export function emptyState(): EngineState {
  return { v: 1, requests: {}, payments: {}, pending_simulate: {}, events: [], idem: {}, session: { user: { ...PEOPLE.reviewer } } };
}

// ── Engine ───────────────────────────────────────────────────────────────────

export class MockEngine {
  state: EngineState;
  private override: number | null = null;

  constructor(private readonly clock: () => number = Date.now, state?: EngineState) {
    this.state = state ?? emptyState();
  }

  now(): number {
    return this.override ?? this.clock();
  }

  /** Run `fn` as if it happened at time `t` (used for seeding history). */
  at<T>(t: number, fn: () => T): T {
    const prev = this.override;
    this.override = t;
    try {
      return fn();
    } finally {
      this.override = prev;
    }
  }

  // ── Session ────────────────────────────────────────────────────────────────

  session(): Session | null {
    return this.state.session;
  }

  signIn(passcode: string): Session {
    const who = MOCK_PASSCODES[passcode.trim().toLowerCase()];
    if (!who) throw fail("UNAUTHENTICATED", 401, "That passcode is not recognised.");
    this.state.session = { user: { ...PEOPLE[who] } };
    return this.state.session;
  }

  signOut(): void {
    this.state.session = null;
  }

  requireUser(): User {
    const s = this.state.session;
    if (!s) throw fail("UNAUTHENTICATED", 401, "Sign in to continue.");
    return s.user;
  }

  // ── Agent API: create (§2.1) ───────────────────────────────────────────────

  agentCreate(agentId: string, raw: unknown, idempotencyKey: string, scenario: ScenarioKey | null = null): { request: PurchaseRequest; replayed: boolean } {
    const agent = AGENTS[agentId];
    if (!agent) throw fail("UNAUTHENTICATED", 401, "Unknown agent key.");
    if (!idempotencyKey) throw fail("IDEMPOTENCY_KEY_REQUIRED", 400, "Idempotency-Key header is required.");

    const parsed = PurchaseRequestCreate.safeParse(raw);
    if (!parsed.success) {
      throw fail("VALIDATION_FAILED", 422, "The purchase request is invalid.", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const body = parsed.data;
    const itemSum = body.items.reduce((s, i) => s + toCents(i.unit_amount.value) * i.quantity, 0);
    if (itemSum !== toCents(body.amount.value)) {
      throw fail("AMOUNT_MISMATCH", 422, "Amount does not equal the sum of items.", { items_total: fromCents(itemSum) });
    }

    const scope = `${agentId}:POST:/purchase-requests:${idempotencyKey}`;
    const bodyHash = sha256Hex(canonicalJson(body));
    const prior = this.state.idem[scope];
    if (prior) {
      if (prior.body_hash !== bodyHash) throw fail("IDEMPOTENCY_KEY_REUSED", 422, "This Idempotency-Key was used with a different body.");
      const r = this.req(prior.request_id);
      this.emit("idempotency.replayed", {
        request: r,
        actor: { kind: "agent", id: agent.id, name: agent.name },
        summary: "Retry replayed. No new request created.",
        data: { idempotency_key: idempotencyKey },
      });
      return { request: prior.snapshot, replayed: true };
    }

    const t = iso(this.now());
    const r: StoredRequest = {
      id: `preq_${ulid(this.now())}`,
      status: "RECEIVED",
      version: 1,
      created_at: t,
      updated_at: t,
      agent_id: agentId,
      agent_reference: body.agent_reference ?? null,
      merchant: body.merchant,
      items: body.items,
      amount: body.amount,
      justification: body.justification,
      metadata: body.metadata ?? null,
      fingerprint: fingerprintOf(agentId, body),
      duplicate_of: null,
      evaluation: null,
      decision: null,
      review: null,
      payment_ids: [],
      review_expires_at: null,
      approval_extended: false,
      scenario,
    };
    this.state.requests[r.id] = r;
    this.emit("request.received", {
      request: r,
      actor: { kind: "agent", id: agent.id, name: agent.name },
      summary: `${body.items[0]!.name} · ${body.merchant.name}`,
      data: { idempotency_key: idempotencyKey, agent_reference: r.agent_reference },
    });
    this.setStatus(r, "EVALUATING");
    const snapshot = this.view(r, "operator");
    this.state.idem[scope] = { body_hash: bodyHash, request_id: r.id, snapshot };
    return { request: snapshot, replayed: false };
  }

  // ── Evaluation ─────────────────────────────────────────────────────────────

  evaluate(id: string): void {
    const r = this.req(id);
    if (r.status !== "EVALUATING") return;

    const policy = this.runPolicy(r);
    const counts = { pass: 0, review: 0, block: 0, skipped: 0 };
    policy.forEach((p) => counts[p.outcome]++);
    this.emit("policy.evaluated", {
      request: r, actor: SYSTEM,
      summary: `${counts.pass} pass · ${counts.review} review · ${counts.block} block`,
      data: { policy_set: `${POLICY.name} v${POLICY.version}`, results: policy.map((p) => `${p.rule_id}:${p.outcome}`) },
    });

    const duplicateOf = policy.find((p) => p.rule_key === "duplicate_guard" && p.outcome === "block") ? r.duplicate_of : null;
    const risk = duplicateOf ? this.skippedRisk() : this.runRisk(r);
    if (risk.status === "completed") {
      this.emit("risk.assessed", {
        request: r, actor: AI,
        summary: `Risk ${risk.score}/100 · ${risk.level}${risk.signals.length ? ` · ${risk.signals.length} signal${risk.signals.length > 1 ? "s" : ""}` : ""}`,
        data: { model: risk.model, prompt_version: risk.prompt_version, signals: risk.signals.map((s) => s.code) },
      });
    } else if (risk.status !== "skipped") {
      this.emit("risk.unavailable", { request: r, actor: AI, summary: "Risk could not be assessed.", data: {} });
    }

    const { outcome, policyOutcome } = combine(policy.map((p) => p.outcome), risk);
    const t = this.now();
    const decision: Decision = {
      id: `dec_${ulid(t)}`,
      outcome,
      policy_outcome: policyOutcome,
      risk_escalated: policyOutcome === "ALLOW" && outcome === "REVIEW",
      reason_codes: [
        ...policy.filter((p) => p.outcome === "review" || p.outcome === "block").map((p) => `${p.rule_id}:${p.outcome}`),
        ...risk.signals.filter((s) => s.severity !== "info").map((s) => `risk:${s.code}`),
      ],
      reason: this.reasonFor(r, policy, risk, outcome, policyOutcome),
      decided_at: iso(t),
      expires_at: outcome === "ALLOW" ? iso(t + POLICY.approval_ttl_ms) : null,
    };
    r.evaluation = { policy_set: { id: POLICY.id, name: POLICY.name, version: POLICY.version }, policy, risk };
    r.decision = decision;
    if (outcome === "REVIEW") r.review_expires_at = iso(t + POLICY.review_ttl_ms);

    this.setStatus(r, outcome === "ALLOW" ? "ALLOWED" : outcome === "REVIEW" ? "IN_REVIEW" : "BLOCKED");
    if (duplicateOf) {
      this.emit("request.duplicate_detected", { request: r, actor: SYSTEM, summary: `Duplicate of ${shortId(duplicateOf)}.`, data: { duplicate_of: duplicateOf } });
    }
    this.emit("decision.made", { request: r, actor: SYSTEM, summary: decision.reason, data: { outcome, policy_outcome: policyOutcome, risk_escalated: decision.risk_escalated } });
  }

  private runPolicy(r: StoredRequest): PolicyResult[] {
    const agent = AGENTS[r.agent_id]!;
    const cents = toCents(r.amount.value);
    const created = new Date(r.created_at).getTime();
    const others = Object.values(this.state.requests).filter((x) => x.agent_id === r.agent_id && x.id !== r.id);
    const cat = CATEGORY_LABEL[r.merchant.category];

    const p01: PolicyResult = {
      rule_id: "P-01", rule_key: "amount_auto_limit",
      outcome: cents <= POLICY.auto_limit_cents ? "pass" : cents <= POLICY.hard_cap_cents ? "review" : "block",
      observed: formatMoney(r.amount),
      limit: `≤ ${formatMoney(POLICY.auto_limit_cents)} auto · ≤ ${formatMoney(POLICY.hard_cap_cents)} review`,
      message: cents <= POLICY.auto_limit_cents ? "Within the $250 auto-approve limit."
        : cents <= POLICY.hard_cap_cents ? "Over the $250 auto-approve limit." : "Over the $1,000 hard cap.",
    };

    const today = dayKey(r.created_at);
    const spent = others.filter((x) => RESERVED.includes(x.status) && dayKey(x.created_at) === today).reduce((s, x) => s + toCents(x.amount.value), 0);
    const total = spent + cents;
    const p02: PolicyResult = {
      rule_id: "P-02", rule_key: "daily_budget",
      outcome: total <= POLICY.daily_budget_cents ? "pass" : "review",
      observed: `${formatMoney(total)} today`,
      limit: `≤ ${formatMoney(POLICY.daily_budget_cents)}`,
      message: total <= POLICY.daily_budget_cents ? "Fits today's $1,500 agent budget." : "Would exceed today's $1,500 agent budget.",
    };

    const blocked = POLICY.blocked_categories.includes(r.merchant.category);
    const p03: PolicyResult = {
      rule_id: "P-03", rule_key: "blocked_category",
      outcome: blocked ? "block" : "pass",
      observed: cat,
      limit: `${POLICY.blocked_categories.length} blocked categories`,
      message: blocked ? `${cat} ${isAre(cat)} a blocked category.` : `${cat} ${isAre(cat)} a permitted category.`,
    };

    const allowlisted = MERCHANT_ALLOWLIST.includes(r.merchant.name);
    const p04: PolicyResult = {
      rule_id: "P-04", rule_key: "merchant_allowlist",
      outcome: allowlisted ? "pass" : "review",
      observed: r.merchant.name,
      limit: `allowlist (${MERCHANT_ALLOWLIST.length})`,
      message: allowlisted ? `${r.merchant.name} is on the allowlist.` : `${r.merchant.name} is not on the merchant allowlist.`,
    };

    const p05: PolicyResult = {
      rule_id: "P-05", rule_key: "currency",
      outcome: r.amount.currency_code === "USD" ? "pass" : "block",
      observed: r.amount.currency_code, limit: "USD only", message: "Currency is USD.",
    };

    const inScope = agent.allowed_categories.includes(r.merchant.category);
    const p06: PolicyResult = {
      rule_id: "P-06", rule_key: "agent_scope",
      outcome: inScope ? "pass" : "review",
      observed: cat,
      limit: `${agent.allowed_categories.length} categories`,
      message: inScope ? `${cat} is within ${agent.name}'s scope.` : `${cat} is outside ${agent.name}'s scope.`,
    };

    const dup = others
      .filter((x) => x.fingerprint === r.fingerprint && !DENIED_TERMINAL.includes(x.status))
      .filter((x) => {
        const dt = created - new Date(x.created_at).getTime();
        return dt >= 0 && dt <= POLICY.duplicate_window_ms;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (dup) r.duplicate_of = dup.id;
    const dupMin = dup ? Math.max(1, Math.round((created - new Date(dup.created_at).getTime()) / 60_000)) : 0;
    const p07: PolicyResult = {
      rule_id: "P-07", rule_key: "duplicate_guard",
      outcome: dup ? "block" : "pass",
      observed: dup ? `matches ${shortId(dup.id)}` : "no match",
      limit: "10 min window",
      message: dup ? `Same purchase as ${shortId(dup.id)}, ${dupMin} min ago.` : "No matching request in the last 10 minutes.",
    };

    const recent = others.filter((x) => {
      const dt = created - new Date(x.created_at).getTime();
      return dt >= 0 && dt <= POLICY.velocity_window_ms;
    }).length + 1;
    const p08: PolicyResult = {
      rule_id: "P-08", rule_key: "velocity",
      outcome: recent > POLICY.velocity_max ? "review" : "pass",
      observed: `${recent} in 10 min`,
      limit: `≤ ${POLICY.velocity_max}`,
      message: recent > POLICY.velocity_max ? "More than 5 requests in 10 minutes." : `${recent} request${recent > 1 ? "s" : ""} in the last 10 minutes.`,
    };

    return [p01, p02, p03, p04, p05, p06, p07, p08];
  }

  private skippedRisk(): RiskAssessment {
    return { status: "skipped", score: null, level: null, recommendation: null, signals: [], summary: "Skipped: duplicate requests are blocked by rule.", model: null, prompt_version: PROMPT_VERSION, latency_ms: null, assessed_at: null };
  }

  private runRisk(r: StoredRequest): RiskAssessment {
    const base = { model: MOCK_MODEL, prompt_version: PROMPT_VERSION, assessed_at: iso(this.now()) };
    const fixture = r.scenario ? RISK_FIXTURES[r.scenario] : undefined;
    if (fixture) return { status: "completed", ...fixture, ...base };

    // Heuristic stand-in for the AI model when no fixture applies.
    const agent = AGENTS[r.agent_id]!;
    const signals: RiskSignal[] = [];
    let score = 6;
    if (!MERCHANT_ALLOWLIST.includes(r.merchant.name)) {
      signals.push({ code: "new_merchant", label: `First purchase from ${r.merchant.name}`, severity: "warn", evidence: null, source_field: "merchant.name" });
      score += 18;
    }
    const ratio = toCents(r.amount.value) / agent.median_cents;
    if (ratio >= 2) {
      signals.push({ code: "amount_above_typical", label: `${ratio.toFixed(1)}× this agent's median purchase`, severity: "warn", evidence: null, source_field: "amount" });
      score += 14;
    }
    const urgency = r.justification.match(/\b(urgent|asap|immediately|in the next \d+ minutes)\b/i);
    if (urgency) {
      signals.push({ code: "urgency_pressure", label: "Artificial time pressure", severity: "high", evidence: urgency[0], source_field: "justification" });
      score += 20;
    }
    const injection = r.justification.match(/(ignore (all|previous|any|spending)[^.;]{0,40}|pre-approved|mark it low risk)/i);
    if (injection) {
      signals.push({ code: "prompt_injection", label: "Instructions aimed at the reviewer", severity: "high", evidence: injection[0].slice(0, 200), source_field: "justification" });
      score += 38;
    }
    if (POLICY.blocked_categories.includes(r.merchant.category)) {
      const cat = CATEGORY_LABEL[r.merchant.category];
      signals.push({ code: "stored_value_instrument", label: `${cat} ${isAre(cat)} hard to recover`, severity: "warn", evidence: null, source_field: "merchant.category" });
      score += 22;
    }
    score = Math.min(100, score + Math.round(Math.min(ratio, 4) * 3));
    const level = levelOf(score);
    return {
      status: "completed", score, level,
      recommendation: score >= 35 ? "escalate_to_review" : "none",
      signals: signals.slice(0, 8),
      summary: signals.length ? "Heuristic review flagged the signals below." : "Nothing unusual for this agent and merchant.",
      latency_ms: 900,
      ...base,
    };
  }

  private reasonFor(r: StoredRequest, policy: PolicyResult[], risk: RiskAssessment, outcome: DecisionOutcome, policyOutcome: DecisionOutcome): string {
    const byKey = (k: string) => policy.find((p) => p.rule_key === k)!;
    if (outcome === "BLOCK") {
      const parts: string[] = [];
      const dup = byKey("duplicate_guard");
      if (dup.outcome === "block" && r.duplicate_of) {
        const dupReq = this.state.requests[r.duplicate_of];
        const mins = dupReq ? Math.max(1, Math.round((new Date(r.created_at).getTime() - new Date(dupReq.created_at).getTime()) / 60_000)) : 1;
        return `Duplicate of a request made ${mins} minute${mins > 1 ? "s" : ""} ago.`;
      }
      if (byKey("blocked_category").outcome === "block") {
        const cat = CATEGORY_LABEL[r.merchant.category];
        parts.push(`${cat} ${isAre(cat)} a blocked category`);
      }
      if (byKey("amount_auto_limit").outcome === "block") parts.push(parts.length ? "over the $1,000 cap" : "Over the $1,000 hard cap");
      if (byKey("currency").outcome === "block") parts.push("unsupported currency");
      return `${parts.join("; ")}.`;
    }
    if (outcome === "REVIEW" && policyOutcome === "REVIEW") {
      const phrases: Record<string, string> = {
        amount_auto_limit: "over the $250 auto limit",
        daily_budget: "today's budget would be exceeded",
        merchant_allowlist: "merchant is new",
        agent_scope: "outside this agent's scope",
        velocity: "unusual request velocity",
      };
      const parts = policy.filter((p) => p.outcome === "review").map((p) => phrases[p.rule_key]).filter(Boolean).slice(0, 2) as string[];
      const s = parts.join("; ");
      return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
    }
    if (outcome === "REVIEW") {
      if (risk.status !== "completed") return "Rules pass, but risk could not be assessed.";
      return `Rules pass, but AI risk is ${risk.level} (${risk.score}/100).`;
    }
    return MERCHANT_ALLOWLIST.includes(r.merchant.name) ? "Within limits; allowlisted merchant; low risk." : "Within limits; low risk.";
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  get(id: string, role: Role): PurchaseRequest {
    this.tick();
    return this.view(this.req(id), role);
  }

  list(params: ListRequestsParams, role: Role): PurchaseRequestList {
    this.tick();
    const q = params.q?.trim().toLowerCase();
    let rows = Object.values(this.state.requests);
    if (params.status?.length) rows = rows.filter((r) => params.status!.includes(r.status));
    if (params.agent_id) rows = rows.filter((r) => r.agent_id === params.agent_id);
    if (params.updated_after) rows = rows.filter((r) => r.updated_at > params.updated_after!);
    if (q) {
      rows = rows.filter((r) => {
        const pays = r.payment_ids.map((p) => this.state.payments[p]);
        const hay = [
          r.id, r.merchant.name, AGENTS[r.agent_id]?.name, r.agent_reference, ...r.items.map((i) => i.name),
          ...pays.flatMap((p) => [p?.id, p?.paypal.order_id, p?.paypal.capture_id]),
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const limit = params.limit ?? 50;
    const start = params.cursor ? Number(params.cursor) : 0;
    const page = rows.slice(start, start + limit);

    const today = dayKey(this.now());
    const all = Object.values(this.state.requests);
    const allowedToday = all
      .filter((r) => r.decision && ["ALLOWED", "CHECKOUT_PENDING", "CAPTURING", "PAID", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(r.status))
      .filter((r) => dayKey(r.created_at) === today)
      .reduce((s, r) => s + toCents(r.amount.value), 0);

    return {
      object: "list",
      data: page.map((r) => this.view(r, role)),
      next_cursor: start + limit < rows.length ? String(start + limit) : null,
      summary: { needs_review: all.filter((r) => r.status === "IN_REVIEW").length, allowed_today: fromCents(allowedToday) },
    };
  }

  getPayment(id: string): Payment {
    this.tick();
    return this.pay(id);
  }

  // ── Review (§2.4) ──────────────────────────────────────────────────────────

  review(id: string, body: ReviewCreate, expectedVersion: number, user: User): PurchaseRequest {
    this.tick();
    const r = this.req(id);
    if (user.role !== "reviewer") throw fail("FORBIDDEN", 403, "Only reviewers can decide on a request.");
    if (r.status !== "IN_REVIEW") {
      const who = r.review ? ` by ${r.review.reviewer.name}` : "";
      throw fail("STATE_CONFLICT", 409, `This request was already decided${who}.`, { current_status: r.status, allowed_from: ["IN_REVIEW"] });
    }
    if (expectedVersion !== r.version) throw fail("VERSION_CONFLICT", 412, "This request changed while you were reviewing it.", { current_version: r.version });
    const note = body.note?.trim() || null;
    if (body.action === "reject" && (!note || note.length < 3)) {
      throw fail("VALIDATION_FAILED", 422, "A note is required to reject.", { issues: [{ path: "note", message: "Required to reject" }] });
    }
    const t = this.now();
    r.review = { id: `rev_${ulid(t)}`, action: body.action, reviewer: { id: user.id, name: user.name }, note, decided_at: iso(t) };
    const actor: Actor = { kind: "reviewer", id: user.id, name: user.name };
    if (body.action === "approve") {
      r.decision = { ...r.decision!, expires_at: iso(t + POLICY.approval_ttl_ms) };
      this.setStatus(r, "ALLOWED");
      this.emit("review.approved", { request: r, actor, summary: `Allowed by ${user.name}.`, data: { note } });
    } else {
      this.setStatus(r, "REJECTED");
      this.emit("review.rejected", { request: r, actor, summary: `Rejected by ${user.name}.`, data: { note } });
    }
    return this.view(r, user.role);
  }

  // ── Checkout (§2.5) ────────────────────────────────────────────────────────

  startCheckout(id: string, user: User): { purchase_request: PurchaseRequest; payment: Payment } {
    const before = this.req(id).status;
    this.tick();
    const r = this.req(id);
    if (r.status === "EXPIRED" && before !== "EXPIRED") {
      throw fail("POLICY_APPROVAL_EXPIRED", 409, "Policy approval expired before checkout.", { current_status: r.status });
    }
    const latest = this.latestPayment(r);
    const actor: Actor = { kind: "operator", id: user.id, name: user.name };

    if (r.status === "CHECKOUT_PENDING" && latest && ["CREATING", "AWAITING_PAYER", "APPROVED"].includes(latest.status)) {
      return { purchase_request: this.view(r, user.role), payment: latest };
    }

    if (r.status === "PAYMENT_FAILED") {
      if (!latest?.failure?.retryable) {
        throw fail("STATE_CONFLICT", 409, "This payment cannot be retried.", { current_status: r.status, allowed_from: ["ALLOWED", "CHECKOUT_PENDING"] });
      }
      if (!r.approval_extended && r.decision?.expires_at) {
        r.decision = { ...r.decision, expires_at: iso(Math.max(new Date(r.decision.expires_at).getTime(), this.now()) + POLICY.approval_retry_extension_ms) };
        r.approval_extended = true;
      }
      if (latest.status === "DECLINED") {
        this.updatePayment(latest, { status: "AWAITING_PAYER", failure: null, paypal: { ...latest.paypal, order_status: "PAYER_ACTION_REQUIRED" } });
        this.setStatus(r, "CHECKOUT_PENDING");
        this.emit("checkout.created", { request: r, payment: latest, actor, summary: `Payer approval reopened on ${latest.paypal.order_id}.`, data: { order_id: latest.paypal.order_id, resumed: true } });
        return { purchase_request: this.view(r, user.role), payment: latest };
      }
    } else if (r.status !== "ALLOWED") {
      throw fail("STATE_CONFLICT", 409, this.conflictMessage(r.status), {
        current_status: r.status, allowed_from: ["ALLOWED", "CHECKOUT_PENDING", "PAYMENT_FAILED"],
      });
    }

    const t = this.now();
    const payment: Payment = {
      id: `pay_${ulid(t)}`,
      object: "payment",
      purchase_request_id: r.id,
      status: "AWAITING_PAYER",
      version: 1,
      amount: r.amount,
      paypal: {
        environment: "mock",
        order_id: `MOCK-${upperRand(12)}`,
        order_status: "PAYER_ACTION_REQUIRED",
        capture_id: null,
        capture_status: null,
        payer_action_url: null,
      },
      attempts: [],
      failure: null,
      created_at: iso(t),
      updated_at: iso(t),
    };
    this.state.payments[payment.id] = payment;
    r.payment_ids.push(payment.id);
    this.setStatus(r, "CHECKOUT_PENDING");
    this.emit("checkout.created", {
      request: r, payment, actor,
      summary: `Order ${payment.paypal.order_id} created (simulated).`,
      data: { order_id: payment.paypal.order_id, paypal_request_id: `ord_${payment.id}` },
    });
    return { purchase_request: this.view(r, user.role), payment };
  }

  // ── Mock payer (simulates the PayPal approval window) ──────────────────────

  payerApprove(paymentId: string): Payment {
    const p = this.pay(paymentId);
    if (p.status !== "AWAITING_PAYER") return p;
    this.updatePayment(p, { status: "APPROVED", paypal: { ...p.paypal, order_status: "APPROVED" } });
    const r = this.req(p.purchase_request_id);
    this.touch(r);
    this.emit("payer.approved", { request: r, payment: p, actor: PAYPAL, summary: "Payer approved in PayPal (simulated).", data: { order_id: p.paypal.order_id } });
    return p;
  }

  payerClose(paymentId: string): Payment {
    const p = this.pay(paymentId);
    const r = this.req(p.purchase_request_id);
    this.emit("payer.cancelled", { request: r, payment: p, actor: PAYPAL, summary: "Payer closed PayPal. Nothing was charged.", data: { order_id: p.paypal.order_id } });
    return p;
  }

  // ── Capture (§2.8) ─────────────────────────────────────────────────────────

  beginCapture(paymentId: string, simulate: "none" | "instrument_declined", user: User): { purchase_request: PurchaseRequest; payment: Payment } {
    this.tick();
    const p = this.pay(paymentId);
    const r = this.req(p.purchase_request_id);
    if (p.status === "COMPLETED") return { purchase_request: this.view(r, user.role), payment: p };
    if (p.status === "CAPTURING") throw fail("CAPTURE_IN_PROGRESS", 409, "A capture is already in progress.", {}, true);
    if (r.status === "EXPIRED") throw fail("POLICY_APPROVAL_EXPIRED", 409, "Policy approval expired before capture.", { current_status: r.status });
    if (r.status !== "CHECKOUT_PENDING") {
      throw fail("STATE_CONFLICT", 409, this.conflictMessage(r.status), { current_status: r.status, allowed_from: ["CHECKOUT_PENDING"] });
    }
    if (p.status !== "APPROVED") {
      throw fail("STATE_CONFLICT", 409, "The payer has not approved this payment yet.", { current_status: p.status, allowed_from: ["APPROVED"] });
    }
    const n = p.attempts.length + 1;
    this.updatePayment(p, {
      status: "CAPTURING",
      attempts: [...p.attempts, { n, status: "in_flight", paypal_request_id: `cap_${p.id}_${n}`, paypal_debug_id: null, issue: null, at: iso(this.now()) }],
    });
    this.state.pending_simulate[p.id] = simulate;
    this.setStatus(r, "CAPTURING");
    this.emit("payment.capture_requested", {
      request: r, payment: p, actor: { kind: "operator", id: user.id, name: user.name },
      summary: `Capture attempt ${n} requested.`, data: { paypal_request_id: `cap_${p.id}_${n}` },
    });
    return { purchase_request: this.view(r, user.role), payment: p };
  }

  settleCapture(paymentId: string, role: Role): { purchase_request: PurchaseRequest; payment: Payment } {
    const p = this.pay(paymentId);
    const r = this.req(p.purchase_request_id);
    if (p.status !== "CAPTURING") return { purchase_request: this.view(r, role), payment: p };
    const simulate = this.state.pending_simulate[p.id] ?? "none";
    delete this.state.pending_simulate[p.id];
    const attempts = [...p.attempts];
    const last = attempts[attempts.length - 1]!;

    if (simulate === "instrument_declined") {
      attempts[attempts.length - 1] = { ...last, status: "declined", issue: "INSTRUMENT_DECLINED", paypal_debug_id: `mock-${upperRand(10).toLowerCase()}` };
      this.updatePayment(p, {
        status: "DECLINED",
        attempts,
        failure: {
          code: "PAYMENT_DECLINED",
          paypal_issue: "INSTRUMENT_DECLINED",
          message: "PayPal declined the funding source. No payment was taken.",
          retryable: attempts.length < POLICY.max_capture_attempts,
        },
      });
      this.setStatus(r, "PAYMENT_FAILED");
      this.emit("payment.declined", { request: r, payment: p, actor: PAYPAL, summary: "Funding source declined (simulated). No payment taken.", data: { issue: "INSTRUMENT_DECLINED", attempt: last.n } });
    } else {
      const captureId = `MOCK-CAP-${upperRand(10)}`;
      attempts[attempts.length - 1] = { ...last, status: "completed" };
      this.updatePayment(p, {
        status: "COMPLETED",
        attempts,
        failure: null,
        paypal: { ...p.paypal, order_status: "COMPLETED", capture_id: captureId, capture_status: "COMPLETED" },
      });
      this.setStatus(r, "PAID");
      this.emit("payment.completed", { request: r, payment: p, actor: PAYPAL, summary: `${formatMoney(p.amount)} captured (simulated).`, data: { capture_id: captureId, attempt: last.n } });
    }
    return { purchase_request: this.view(r, role), payment: p };
  }

  reconcile(paymentId: string, role: Role): { purchase_request: PurchaseRequest; payment: Payment } {
    const p = this.pay(paymentId);
    if (p.status === "CAPTURING") {
      const res = this.settleCapture(paymentId, role);
      this.emit("payment.reconciled", { request: this.req(p.purchase_request_id), payment: p, actor: SYSTEM, summary: "Payment state confirmed.", data: {} });
      return res;
    }
    return { purchase_request: this.view(this.req(p.purchase_request_id), role), payment: p };
  }

  // ── Cancel (§2.6) ──────────────────────────────────────────────────────────

  cancel(id: string, user: User): PurchaseRequest {
    this.tick();
    const r = this.req(id);
    const allowed: RequestStatus[] = ["IN_REVIEW", "ALLOWED", "CHECKOUT_PENDING", "PAYMENT_FAILED"];
    if (!allowed.includes(r.status)) {
      throw fail("STATE_CONFLICT", 409, this.conflictMessage(r.status), { current_status: r.status, allowed_from: allowed });
    }
    const open = this.latestPayment(r);
    if (open && (OPEN_PAYMENT.includes(open.status) || open.status === "DECLINED")) {
      this.updatePayment(open, { status: "VOIDED", paypal: { ...open.paypal, order_status: "VOIDED" } });
    }
    this.setStatus(r, "CANCELLED");
    this.emit("request.cancelled", { request: r, actor: { kind: "operator", id: user.id, name: user.name }, summary: `Cancelled by ${user.name}.`, data: {} });
    return this.view(r, user.role);
  }

  // ── Ledger (§2.10–2.11) ────────────────────────────────────────────────────

  listAudit(params: ListAuditParams): AuditEventList {
    const q = params.q?.trim().toLowerCase();
    let rows = [...this.state.events].reverse();
    if (params.purchase_request_id) rows = rows.filter((e) => e.purchase_request_id === params.purchase_request_id);
    if (params.type?.length) rows = rows.filter((e) => params.type!.includes(e.type));
    if (params.state?.length) rows = rows.filter((e) => e.state_after && params.state!.includes(e.state_after));
    if (q) {
      rows = rows.filter((e) => {
        const r = e.purchase_request_id ? this.state.requests[e.purchase_request_id] : undefined;
        const hay = [
          e.id, e.type, e.summary, e.actor.name, e.purchase_request_id, e.payment_id,
          r?.merchant.name, r?.items[0]?.name, r && AGENTS[r.agent_id]?.name,
          ...Object.values(e.data).filter((v) => typeof v === "string"),
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    const limit = params.limit ?? 100;
    const start = params.cursor ? Number(params.cursor) : 0;
    return { object: "list", data: rows.slice(start, start + limit), next_cursor: start + limit < rows.length ? String(start + limit) : null };
  }

  verifyChain(): ChainVerification {
    let prev = "0".repeat(64);
    for (const e of this.state.events) {
      const { hash, ...rest } = e;
      if (rest.prev_hash !== prev || sha256Hex(rest.prev_hash + canonicalJson(rest)) !== hash) {
        return { ok: false, broken_at_seq: e.seq, event_id: e.id };
      }
      prev = hash;
    }
    return { ok: true, events: this.state.events.length, head_hash: prev };
  }

  activePolicy(): ActivePolicy {
    return {
      id: POLICY.id, name: POLICY.name, version: POLICY.version,
      ai_policy: "AI risk may escalate ALLOW → REVIEW. It cannot allow or block.",
      rules: [
        { rule_id: "P-01", rule_key: "amount_auto_limit", description: "Up to $250 is automatic, up to $1,000 needs review, and anything above is blocked.", params: { auto: "250.00", cap: "1000.00" } },
        { rule_id: "P-02", rule_key: "daily_budget", description: "An agent's paid and reserved spend today stays within $1,500, or it goes to review.", params: { daily: "1500.00" } },
        { rule_id: "P-03", rule_key: "blocked_category", description: "Gift cards, crypto, money transfer and gambling are always blocked.", params: { categories: POLICY.blocked_categories } },
        { rule_id: "P-04", rule_key: "merchant_allowlist", description: "Merchants outside the allowlist go to review.", params: { allowlist: MERCHANT_ALLOWLIST } },
        { rule_id: "P-05", rule_key: "currency", description: "Only USD is accepted.", params: { currency: "USD" } },
        { rule_id: "P-06", rule_key: "agent_scope", description: "Categories outside an agent's scope go to review.", params: {} },
        { rule_id: "P-07", rule_key: "duplicate_guard", description: "The same purchase within 10 minutes is blocked as a duplicate.", params: { window_minutes: 10 } },
        { rule_id: "P-08", rule_key: "velocity", description: "More than 5 requests in 10 minutes from one agent goes to review.", params: { max: 5, window_minutes: 10 } },
      ],
    };
  }

  // ── Demo (§2.15) ───────────────────────────────────────────────────────────

  runScenario(key: ScenarioKey): { request: PurchaseRequest; replayed: boolean; created: string | null } {
    const def = scenarioByKey(key);
    const idem = def.idempotency_key ?? `demo-${key}-${upperRand(8)}`;
    const fixtureKey: ScenarioKey = key === "d_retry" ? "a_low_risk" : key;
    let res = this.agentCreate(def.agent_id, def.payload, idem, fixtureKey);
    const created = res.replayed ? null : res.request.id;
    if (def.send_twice) res = this.agentCreate(def.agent_id, def.payload, idem, fixtureKey);
    return { ...res, created };
  }

  seedHistory(): void {
    const reviewer = { ...PEOPLE.reviewer };
    const operator = { ...PEOPLE.operator };
    for (const h of HISTORY) {
      let t = this.now() - h.hoursAgo * 3_600_000;
      const step = (ms: number) => (t += ms);
      const { request } = this.at(t, () => this.agentCreate(h.agent_id, h.payload, `seed-${h.payload.agent_reference}`));
      const id = request.id;
      this.at(step(1_800), () => this.evaluate(id));
      if (h.outcome === "rejected") {
        const v = this.req(id).version;
        this.at(step(11 * 60_000), () => this.review(id, { action: "reject", note: h.note }, v, reviewer));
        continue;
      }
      if (this.req(id).status === "IN_REVIEW") {
        const v = this.req(id).version;
        this.at(step(4 * 60_000), () => this.review(id, { action: "approve", note: h.note }, v, reviewer));
      }
      const { payment } = this.at(step(60_000), () => this.startCheckout(id, operator));
      this.at(step(40_000), () => this.payerApprove(payment.id));
      this.at(step(4_000), () => this.beginCapture(payment.id, "none", operator));
      this.at(step(1_600), () => this.settleCapture(payment.id, "operator"));
    }
  }

  /** Remove events matching a predicate — test helper to prove tamper evidence. */
  tamper(seq: number, summary: string): void {
    const e = this.state.events.find((x) => x.seq === seq);
    if (e) e.summary = summary;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private req(id: string): StoredRequest {
    const r = this.state.requests[id];
    if (!r) throw fail("NOT_FOUND", 404, "No purchase request with that ID.");
    return r;
  }

  private pay(id: string): Payment {
    const p = this.state.payments[id];
    if (!p) throw fail("NOT_FOUND", 404, "No payment with that ID.");
    return p;
  }

  private latestPayment(r: StoredRequest): Payment | null {
    const id = r.payment_ids[r.payment_ids.length - 1];
    return id ? (this.state.payments[id] ?? null) : null;
  }

  private touch(r: StoredRequest) {
    r.version += 1;
    r.updated_at = iso(this.now());
  }

  private setStatus(r: StoredRequest, status: RequestStatus) {
    r.status = status;
    this.touch(r);
  }

  private updatePayment(p: Payment, patch: Partial<Payment>) {
    Object.assign(p, patch, { version: p.version + 1, updated_at: iso(this.now()) });
  }

  private conflictMessage(status: RequestStatus): string {
    const m: Partial<Record<RequestStatus, string>> = {
      BLOCKED: "Blocked requests can never reach PayPal.",
      REJECTED: "This request was rejected by a reviewer.",
      IN_REVIEW: "This request is waiting for a reviewer.",
      PAID: "This request is already paid.",
      CANCELLED: "This request was cancelled.",
      EXPIRED: "This request expired.",
      EVALUATING: "This request is still being evaluated.",
    };
    return m[status] ?? `Not allowed while ${status}.`;
  }

  /** Lazy expiry (PAYMENT_STATE_MACHINE.md §1.2). */
  tick(): void {
    const t = this.now();
    for (const r of Object.values(this.state.requests)) {
      if ((r.status === "ALLOWED" || r.status === "CHECKOUT_PENDING") && r.decision?.expires_at && new Date(r.decision.expires_at).getTime() <= t) {
        const p = this.latestPayment(r);
        if (p && OPEN_PAYMENT.includes(p.status)) this.updatePayment(p, { status: "VOIDED", paypal: { ...p.paypal, order_status: "VOIDED" } });
        this.setStatus(r, "EXPIRED");
        this.emit("request.expired", { request: r, actor: SYSTEM, summary: "Policy approval expired.", data: {} });
      } else if (r.status === "IN_REVIEW" && r.review_expires_at && new Date(r.review_expires_at).getTime() <= t) {
        this.setStatus(r, "EXPIRED");
        this.emit("request.expired", { request: r, actor: SYSTEM, summary: "Review window expired.", data: {} });
      }
    }
  }

  private emit(type: AuditEventType, o: { request?: StoredRequest; payment?: Payment; actor: Actor; summary: string; data?: Record<string, unknown> }) {
    const prev = this.state.events[this.state.events.length - 1];
    const t = this.now();
    const base: Omit<AuditEvent, "hash"> = {
      id: `evt_${ulid(t)}`,
      object: "audit_event",
      seq: (prev?.seq ?? 0) + 1,
      type,
      occurred_at: iso(t),
      purchase_request_id: o.request?.id ?? null,
      payment_id: o.payment?.id ?? null,
      actor: o.actor,
      amount: o.request?.amount ?? null,
      state_after: o.request?.status ?? null,
      summary: o.summary.slice(0, 120),
      data: o.data ?? {},
      prev_hash: prev?.hash ?? "0".repeat(64),
    };
    this.state.events.push({ ...base, hash: sha256Hex(base.prev_hash + canonicalJson(base)) });
  }

  // ── Projection: StoredRequest → contract PurchaseRequest ───────────────────

  private view(r: StoredRequest, role: Role): PurchaseRequest {
    const agent = AGENTS[r.agent_id]!;
    const p = this.latestPayment(r);
    return {
      id: r.id,
      object: "purchase_request",
      status: r.status,
      version: r.version,
      created_at: r.created_at,
      updated_at: r.updated_at,
      agent: { id: agent.id, name: agent.name },
      agent_reference: r.agent_reference,
      merchant: r.merchant,
      items: r.items,
      amount: r.amount,
      justification: r.justification,
      metadata: r.metadata,
      fingerprint: r.fingerprint,
      duplicate_of: r.duplicate_of,
      evaluation: r.evaluation,
      decision: r.decision,
      review: r.review,
      keys: { policy: this.policyKey(r), payer: this.payerKey(r, p) },
      payment: p ? { id: p.id, status: p.status, paypal_order_id: p.paypal.order_id, paypal_capture_id: p.paypal.capture_id } : null,
      next_actions: this.nextActions(r, p, role),
    };
  }

  private policyKey(r: StoredRequest): KeyState {
    const k = (state: KeyState["state"], by: string | null, at: string | null, detail: string | null): KeyState => ({ state, by, at, detail });
    const rv = r.review;
    switch (r.status) {
      case "RECEIVED":
      case "EVALUATING":
        return k("waiting", null, null, "Evaluating");
      case "IN_REVIEW":
        return k("waiting", null, null, "Waiting for reviewer");
      case "BLOCKED":
        return k("denied", "policy", r.decision?.decided_at ?? null, `Blocked by rule set v${POLICY.version}`);
      case "REJECTED":
        return k("denied", rv?.reviewer.name ?? null, rv?.decided_at ?? null, `Rejected by ${rv?.reviewer.name}`);
      case "EXPIRED":
        return k("denied", "policy", r.updated_at, r.decision?.outcome === "REVIEW" && !rv ? "Review window expired" : "Approval expired");
      case "CANCELLED":
        return k("not_applicable", null, r.updated_at, "Request cancelled");
      default:
        return rv?.action === "approve"
          ? k("granted", rv.reviewer.name, rv.decided_at, `by ${rv.reviewer.name}`)
          : k("granted", "policy", r.decision?.decided_at ?? null, `rule set v${POLICY.version} (auto)`);
    }
  }

  private payerKey(r: StoredRequest, p: Payment | null): KeyState {
    const k = (state: KeyState["state"], detail: string, at: string | null = null, by: string | null = null): KeyState => ({ state, by, at, detail });
    const payer = "PayPal payer (simulated)";
    switch (r.status) {
      case "ALLOWED":
        return k("waiting", "Not started");
      case "CHECKOUT_PENDING":
        return p?.status === "APPROVED" ? k("granted", "Approved in PayPal", p.updated_at, payer) : k("waiting", "Your turn · in PayPal");
      case "CAPTURING":
        return k("granted", "Approved · confirming", p?.updated_at ?? null, payer);
      case "PAID":
        return k("granted", "Approved · paid", p?.updated_at ?? null, payer);
      case "PAYMENT_PENDING":
        return k("granted", "Approved · held by PayPal", p?.updated_at ?? null, payer);
      case "PAYMENT_FAILED":
        return p?.failure?.retryable ? k("waiting", "Needs approval again") : k("denied", "Payment not completed");
      case "BLOCKED":
      case "REJECTED":
        return k("not_applicable", "Never requested");
      default:
        return k("not_applicable", "Not started");
    }
  }

  private nextActions(r: StoredRequest, p: Payment | null, role: Role): NextAction[] {
    switch (r.status) {
      case "IN_REVIEW":
        return role === "reviewer" ? ["open_review", "cancel"] : ["cancel"];
      case "ALLOWED":
        return ["start_checkout", "cancel"];
      case "CHECKOUT_PENDING":
        return ["resume_checkout", "cancel"];
      case "PAYMENT_FAILED":
        return p?.failure?.retryable ? ["retry_payment", "cancel"] : ["cancel"];
      default:
        return [];
    }
  }
}
