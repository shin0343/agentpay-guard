# API Contract — v1

Status: **frozen for v1** (amended 2026-11-03, see §8). Additive changes (new optional fields, new enum values that clients may treat as unknown) are allowed. Breaking changes need a new version prefix and an update to this file *first*.
Owner of implementation: backend agent (Codex). Owner of contract: product/frontend. Companion: `PAYMENT_STATE_MACHINE.md`.

---

## 0. Conventions

Implementation clarification (2026-11-03): risk evaluation uses OpenAI Responses structured outputs,
with local strict validation and an eight-second deadline. Existing RiskAssessment fields remain
unchanged. Audit `data` includes correlation IDs, policy/request versions, redacted risk details,
evaluation provenance and safe failure codes. New additive event types are `checkout.failed`,
`payment.outcome_unknown`, and `payment.retry_requested`; these do not imply settlement.
Purchase free text and reviewer notes are redacted before persistence; raw provider payloads,
credentials and payer PII are excluded. No AI result authorizes checkout or capture.

| Topic | Rule |
|---|---|
| Base path | `/api/v1` (Next.js App Router route handlers under `app/api/v1/**/route.ts`) |
| Format | JSON, UTF-8. `Content-Type: application/json` |
| Field casing | `snake_case` everywhere (matches PayPal and avoids translation at the boundary) |
| IDs | Prefixed ULIDs: `agt_` agent, `preq_` purchase request, `dec_` decision, `rev_` review, `pay_` payment, `evt_` audit event, `pol_` policy set, `req_` API request (trace) |
| Timestamps | RFC 3339 UTC with milliseconds: `2026-11-10T22:02:11.482Z` |
| Money | `{ "currency_code": "USD", "value": "640.00" }`, where `value` matches `^\d{1,7}\.\d{2}$`. Never floats. v1 accepts **USD only**. Server computes in integer cents. |
| Pagination | Cursor-based: `?limit=1..100` (default 25) and `&cursor=<opaque>`. Response `{ "object": "list", "data": [...], "next_cursor": string \| null }` |
| Tracing | Every response carries `X-Request-Id: req_…`. Errors repeat it in the body. |
| Versioning | Resources carry an integer `version`. Mutating endpoints that depend on state accept `If-Match: "<version>"`. |
| Shared schemas | Zod schemas in `src/contract/*.ts` are the **single source of truth** for both route handlers and UI. Types come from `z.infer`. |

### 0.1 Business outcomes vs errors

A **blocked** request, a **declined** capture and a **rejected** review are *successful API calls* with a resource in a terminal or failed state, so they return **2xx**. The error envelope is reserved for calls the server could not process (bad input, auth, conflicts, upstream outages).

### 0.2 Idempotency

- Header: `Idempotency-Key: <1–255 visible ASCII chars>`. **Required** on every `POST` except `/session` and `/webhooks/*`.
- Scope: (principal, method, route template). Retention: **24 hours**.
- Same key + same body hash → replay the stored status code and body, plus the header `Idempotent-Replayed: true`. No side effects run again.
- Same key + different body → `422 IDEMPOTENCY_KEY_REUSED`.
- Same key while the first call is still running → `409 IDEMPOTENCY_IN_PROGRESS` with `Retry-After: 1`.
- Missing key → `400 IDEMPOTENCY_KEY_REQUIRED`.

### 0.3 Authentication and authorization

| Principal | Credential | Can |
|---|---|---|
| **Agent** | `Authorization: Bearer agk_test_<32 chars>` (hashed at rest; each key maps to one `agent_id`) | Create purchase requests. Read **its own** purchase requests. Cancel its own while in `IN_REVIEW` or `ALLOWED`. |
| **Operator** | HTTP-only, `SameSite=Lax`, signed cookie `apg_session` (from `POST /session`) | Read everything. Start checkout. Capture. Cancel. Read the ledger and policies. Run demo scenarios. |
| **Reviewer** | Same cookie, role `reviewer` (a superset of operator) | Everything an operator can, plus submit reviews. |
| **PayPal** | Webhook signature verified via PayPal `POST /v1/notifications/verify-webhook-signature` | Deliver webhook events only. |

- Cookie-authenticated mutating requests must send `X-CSRF-Token` equal to the `apg_csrf` cookie (double-submit).
- Agents can **never** start checkout, capture or review. That would let an agent hold both keys.
- A reviewer cannot review a request whose `agent.owner_user_id` equals their user ID (separation of duties; in the demo the seed data never triggers this).

---

## 1. Shared schemas (Zod, normative)

```ts
// src/contract/common.ts
export const Money = z.object({
  currency_code: z.literal("USD"),
  value: z.string().regex(/^\d{1,7}\.\d{2}$/),
});

export const MerchantCategory = z.enum([
  "software", "api_credits", "compute", "data", "office_supplies",
  "travel", "advertising", "gift_cards", "crypto", "money_transfer",
  "gambling", "other",
]);

export const RequestStatus = z.enum([
  "RECEIVED", "EVALUATING", "IN_REVIEW", "ALLOWED", "BLOCKED", "REJECTED",
  "CHECKOUT_PENDING", "CAPTURING", "PAID", "PAYMENT_PENDING", "PAYMENT_FAILED",
  "EXPIRED", "CANCELLED",
]);

export const PaymentStatus = z.enum([
  "CREATING", "AWAITING_PAYER", "APPROVED", "CAPTURING",
  "COMPLETED", "PENDING", "DECLINED", "FAILED", "VOIDED", "EXPIRED",
]);

export const DecisionOutcome = z.enum(["ALLOW", "REVIEW", "BLOCK"]);
export const RuleOutcome = z.enum(["pass", "review", "block", "skipped"]);
```

```ts
// src/contract/purchase-request.ts
export const PurchaseItem = z.object({
  name: z.string().min(1).max(127),
  quantity: z.number().int().min(1).max(10_000),
  unit_amount: Money,
  sku: z.string().max(64).optional(),
  description: z.string().max(280).optional(),
});

export const PurchaseRequestCreate = z.object({
  agent_reference: z.string().max(64).optional(),        // agent's own correlation id
  merchant: z.object({
    name: z.string().min(1).max(80),
    domain: z.string().max(253).optional(),
    category: MerchantCategory,
  }),
  items: z.array(PurchaseItem).min(1).max(20),
  amount: Money,                                         // MUST equal Σ quantity × unit_amount
  justification: z.string().min(1).max(1000),            // untrusted free text
  metadata: z.record(z.string().max(40), z.string().max(200)).optional(), // ≤ 10 keys
});

export const PolicyResult = z.object({
  rule_id: z.string(),              // "P-01"
  rule_key: z.string(),             // "amount_auto_limit"
  outcome: RuleOutcome,
  observed: z.string(),             // human-readable, e.g. "$640.00"
  limit: z.string().nullable(),     // e.g. "≤ $250.00 auto · ≤ $1,000.00 review"
  message: z.string().max(120),     // ≤ 16 words, UI-ready
});

export const RiskSignal = z.object({
  code: z.enum([
    "new_merchant", "amount_above_typical", "justification_mismatch",
    "urgency_pressure", "prompt_injection", "stored_value_instrument",
    "suspicious_merchant_domain", "velocity", "other",
  ]),
  label: z.string().max(80),        // "First purchase from Kestrel Compute"
  severity: z.enum(["info", "warn", "high"]),
  evidence: z.string().max(200).nullable(), // short verbatim quote from the request
  source_field: z.string().nullable(),      // "justification", "items[0].name"
});

export const RiskAssessment = z.object({
  status: z.enum(["completed", "unavailable", "timeout", "skipped"]),
  score: z.number().int().min(0).max(100).nullable(),
  level: z.enum(["low", "medium", "high"]).nullable(),  // low <35, medium 35–69, high ≥70
  recommendation: z.enum(["none", "escalate_to_review"]).nullable(),
  signals: z.array(RiskSignal).max(8),
  summary: z.string().max(280).nullable(),
  model: z.string().nullable(),            // e.g. "claude-sonnet-5-5"
  prompt_version: z.string(),              // e.g. "r-2"
  latency_ms: z.number().int().nullable(),
  assessed_at: z.string().nullable(),
});

export const Decision = z.object({
  id: z.string(),                          // dec_…
  outcome: DecisionOutcome,
  policy_outcome: DecisionOutcome,         // what rules alone said
  risk_escalated: z.boolean(),             // true iff AI moved ALLOW → REVIEW
  reason_codes: z.array(z.string()),       // ["P-01:review", "P-04:review", "risk:new_merchant"]
  reason: z.string().max(120),             // one line, ≤ 16 words
  decided_at: z.string(),
  expires_at: z.string().nullable(),       // policy approval TTL (ALLOW only; 30 min)
});

export const Review = z.object({
  id: z.string(),                          // rev_…
  action: z.enum(["approve", "reject"]),
  reviewer: z.object({ id: z.string(), name: z.string() }),
  note: z.string().max(500).nullable(),
  decided_at: z.string(),
});

export const KeyState = z.object({
  state: z.enum(["granted", "waiting", "denied", "not_applicable"]),
  by: z.string().nullable(),               // "policy", "m.okafor", "PayPal payer"
  at: z.string().nullable(),
  detail: z.string().max(80).nullable(),   // "rule set v3 (auto)"
});

export const NextAction = z.enum([
  "open_review", "start_checkout", "resume_checkout", "retry_payment", "cancel",
]);

export const PaymentSummary = z.object({
  id: z.string(), status: PaymentStatus,
  paypal_order_id: z.string().nullable(),
  paypal_capture_id: z.string().nullable(),
});

export const PurchaseRequest = z.object({
  id: z.string(), object: z.literal("purchase_request"),
  status: RequestStatus, version: z.number().int(),
  created_at: z.string(), updated_at: z.string(),
  agent: z.object({ id: z.string(), name: z.string() }),
  agent_reference: z.string().nullable(),
  merchant: PurchaseRequestCreate.shape.merchant,
  items: z.array(PurchaseItem),
  amount: Money,
  justification: z.string(),
  metadata: z.record(z.string()).nullable(),
  fingerprint: z.string(),                 // sha256 hex, see §5
  duplicate_of: z.string().nullable(),     // preq_… when P-07 blocked it
  evaluation: z.object({
    policy_set: z.object({ id: z.string(), name: z.string(), version: z.number().int() }),
    policy: z.array(PolicyResult),         // always all rules, in rule order
    risk: RiskAssessment,
  }).nullable(),                           // null while RECEIVED
  decision: Decision.nullable(),
  review: Review.nullable(),
  keys: z.object({ policy: KeyState, payer: KeyState }),
  payment: PaymentSummary.nullable(),      // latest payment, if any
  next_actions: z.array(NextAction),       // computed for the *caller's* role
});
```

```ts
// src/contract/payment.ts
export const CaptureAttempt = z.object({
  n: z.number().int().min(1),
  status: z.enum(["in_flight", "completed", "pending", "declined", "failed", "unknown"]),
  paypal_request_id: z.string(),           // PayPal-Request-Id sent
  paypal_debug_id: z.string().nullable(),
  issue: z.string().nullable(),            // PayPal issue, e.g. "INSTRUMENT_DECLINED"
  at: z.string(),
});

export const Payment = z.object({
  id: z.string(), object: z.literal("payment"),
  purchase_request_id: z.string(),
  status: PaymentStatus, version: z.number().int(),
  amount: Money,
  paypal: z.object({
    environment: z.literal("sandbox"),
    order_id: z.string().nullable(),
    order_status: z.enum(["CREATED","SAVED","APPROVED","VOIDED","COMPLETED","PAYER_ACTION_REQUIRED"]).nullable(),
    capture_id: z.string().nullable(),
    capture_status: z.enum(["COMPLETED","DECLINED","PARTIALLY_REFUNDED","PENDING","REFUNDED","FAILED"]).nullable(),
    payer_action_url: z.string().url().nullable(), // rel "payer-action" (or "approve")
  }),
  attempts: z.array(CaptureAttempt),
  failure: z.object({
    code: z.enum(["PAYMENT_DECLINED", "PAYER_ACTION_REQUIRED", "ORDER_EXPIRED",
                  "ATTEMPTS_EXCEEDED", "PAYPAL_ERROR", "POLICY_APPROVAL_EXPIRED"]),
    paypal_issue: z.string().nullable(),
    message: z.string().max(120),          // UI-ready, states what is true about money
    retryable: z.boolean(),
  }).nullable(),
  created_at: z.string(), updated_at: z.string(),
});
```

```ts
// src/contract/audit.ts
export const AuditEventType = z.enum([
  "checkout.failed", "payment.outcome_unknown", "payment.retry_requested",
  "request.received", "request.duplicate_detected", "idempotency.replayed",
  "policy.evaluated", "risk.assessed", "risk.unavailable", "decision.made",
  "review.approved", "review.rejected",
  "checkout.created", "payer.approved", "payer.cancelled",
  "payment.capture_requested", "payment.completed", "payment.pending",
  "payment.declined", "payment.failed", "payment.reconciled",
  "request.expired", "request.cancelled", "webhook.received",
]);

export const AuditEvent = z.object({
  id: z.string(), object: z.literal("audit_event"),
  seq: z.number().int(),                    // global, gap-free
  type: AuditEventType,
  occurred_at: z.string(),
  purchase_request_id: z.string().nullable(),
  payment_id: z.string().nullable(),
  actor: z.object({
    kind: z.enum(["agent", "system", "ai", "reviewer", "operator", "paypal"]),
    id: z.string().nullable(), name: z.string(),
  }),
  amount: Money.nullable(),
  state_after: RequestStatus.nullable(),
  summary: z.string().max(120),
  data: z.record(z.unknown()),              // event-specific; never contains secrets
  prev_hash: z.string(),                    // hex sha256; "0"*64 for seq 1
  hash: z.string(),                         // sha256(prev_hash + canonical_json(event without hash))
});
```

### 1.1 Error envelope

```json
{
  "error": {
    "code": "STATE_CONFLICT",
    "message": "This request is already ALLOWED.",
    "status": 409,
    "request_id": "req_01JCB7…",
    "retryable": false,
    "details": { "current_status": "ALLOWED", "allowed_from": ["IN_REVIEW"] }
  }
}
```

| `code` | HTTP | `retryable` | When |
|---|---|---|---|
| `VALIDATION_FAILED` | 422 | no | Zod failure. `details.issues[]` = `{ path, message }` |
| `AMOUNT_MISMATCH` | 422 | no | `amount` ≠ Σ items |
| `UNSUPPORTED_CURRENCY` | 422 | no | Not USD |
| `MALFORMED_JSON` | 400 | no | Body is not parseable |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | no | Missing header |
| `IDEMPOTENCY_KEY_REUSED` | 422 | no | Same key, different body |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | yes | Original call still running |
| `UNAUTHENTICATED` | 401 | no | Missing or invalid key or cookie |
| `FORBIDDEN` | 403 | no | Role or ownership check failed |
| `CSRF_FAILED` | 403 | no | Token missing or mismatched |
| `NOT_FOUND` | 404 | no | Unknown ID or not visible to the caller |
| `STATE_CONFLICT` | 409 | no | Transition not allowed from current status. `details.current_status`, `details.allowed_from` |
| `VERSION_CONFLICT` | 412 | no | `If-Match` does not match current `version`. `details.current_version` |
| `POLICY_APPROVAL_EXPIRED` | 409 | no | ALLOW TTL elapsed before checkout or capture |
| `CAPTURE_IN_PROGRESS` | 409 | yes | Another capture for this payment is in flight |
| `PAYPAL_UNAVAILABLE` | 503 | yes | PayPal 5xx or timeout when the outcome is known to be *not* applied |
| `PAYPAL_REJECTED` | 502 | no | PayPal 4xx we did not map. `details.paypal_issue`, `details.paypal_debug_id` |
| `RATE_LIMITED` | 429 | yes | `Retry-After` set. 60 req/min per agent key |
| `DEMO_DISABLED` | 404 | no | Demo endpoints when `DEMO_MODE` is off |
| `INTERNAL` | 500 | yes | Unexpected. Never leaks a stack trace |

---

## 2. Endpoints

Legend: **A** = agent key, **O** = operator cookie, **R** = reviewer cookie, **P** = PayPal webhook, **—** = public.

| # | Method & path | Auth | Idem. | Purpose |
|---|---|---|---|---|
| 1 | `POST /purchase-requests` | A | ✔ | Agent proposes a purchase |
| 2 | `GET /purchase-requests/{id}` | A (own) / O | | Read one |
| 3 | `GET /purchase-requests` | O | | List / search / filter |
| 4 | `POST /purchase-requests/{id}/reviews` | R | ✔ | Approve or reject (`If-Match`) |
| 5 | `POST /purchase-requests/{id}/checkout` | O | ✔ | Create (or resume) a PayPal order |
| 6 | `POST /purchase-requests/{id}/cancel` | A (own) / O | ✔ | Withdraw before payment |
| 7 | `GET /payments/{id}` | O | | Read payment |
| 8 | `POST /payments/{id}/capture` | O | ✔ | Capture after payer approval |
| 9 | `POST /payments/{id}/reconcile` | O | ✔ | Re-read PayPal order and settle state |
| 10 | `GET /audit-events` | O | | Ledger search |
| 11 | `GET /audit-events/verify` | O | | Verify the hash chain |
| 12 | `GET /policies/active` | O | | Read-only active policy set |
| 13 | `POST /session` · `GET /session` · `DELETE /session` | — / O | | Demo sign-in |
| 14 | `POST /webhooks/paypal` | P | (event-id dedupe) | PayPal events |
| 15 | `POST /demo/scenarios/{key}/run` | O | ✔ | Fire scenario A–E as the demo agent |
| 16 | `POST /demo/reset` | O | ✔ | Wipe and reseed demo data |
| 17 | `GET /checkout/config` | O | | `{ paypal_client_id, currency: "USD", intent: "capture" }` for the JS SDK |

### 2.1 `POST /purchase-requests`

Headers: `Authorization: Bearer agk_test_…`, `Idempotency-Key`, optional `Prefer: wait=<1..10>` (seconds to wait for a decision).

Request:
```json
{
  "agent_reference": "run-4471/step-12",
  "merchant": { "name": "Kestrel Compute", "domain": "kestrel-compute.example", "category": "compute" },
  "items": [
    { "name": "GPU hours · H-class", "quantity": 40, "unit_amount": { "currency_code": "USD", "value": "16.00" } }
  ],
  "amount": { "currency_code": "USD", "value": "640.00" },
  "justification": "Fine-tuning run for the Q4 evaluation set needs 40 GPU hours before Friday's review."
}
```

Responses:
- `201 Created`: a decision was reached within the wait window. Body is a `PurchaseRequest` with `status ∈ {ALLOWED, IN_REVIEW, BLOCKED}`.
- `202 Accepted`: still evaluating. Body is a `PurchaseRequest` with `status: "EVALUATING"` and header `Location: /api/v1/purchase-requests/{id}`.
- Replays return the original status code plus `Idempotent-Replayed: true`.

Server behavior (normative):
1. Validate (Zod), check that amount equals the item sum, and resolve the agent from the key.
2. Compute `fingerprint` (§5). Persist with `RECEIVED`. Emit `request.received`.
3. → `EVALUATING`. Run **policy** (deterministic; all rules, see `PAYMENT_STATE_MACHINE.md §4`). Emit `policy.evaluated`.
4. Run **risk** for every request, including policy-blocked ones, where it is informational only and cannot change the outcome. The one exception is a P-07 duplicate block, where `risk.status = "skipped"` to avoid a pointless model call. Timeout is 8s, which yields `timeout`. Emit `risk.assessed` or `risk.unavailable`.
5. Combine (§4 of the state machine doc). Persist the `decision`. Transition. Emit `decision.made`.
6. A blocked request **must not** call any PayPal endpoint, now or later.

### 2.2 `GET /purchase-requests/{id}`

`200` → `PurchaseRequest`. Agents get `404` for requests that aren't theirs (no existence leak).

### 2.3 `GET /purchase-requests`

Query: `status` (comma list of `RequestStatus`), `q` (matches id, merchant name, item name, agent name, agent_reference, PayPal order/capture id), `agent_id`, `updated_after` (RFC 3339; used for polling), `limit`, `cursor`. Sort: `created_at desc`.

`200` → `{ object: "list", data: PurchaseRequest[], next_cursor, summary: { needs_review: number, allowed_today: Money } }`

`summary` feeds the one-sentence header ("3 need review · $1,024.00 allowed today"). It is **not** a set of KPI tiles.

### 2.4 `POST /purchase-requests/{id}/reviews`

Headers: cookie, `X-CSRF-Token`, `Idempotency-Key`, `If-Match: "<version>"`.

```json
{ "action": "approve", "note": "Q4 eval budget confirmed with finance." }
```
- `note` is required (min 3 chars) when `action = "reject"`.
- Allowed only from `IN_REVIEW`. Otherwise `409 STATE_CONFLICT`.
- `200` → `PurchaseRequest`. Approve → `ALLOWED` (`keys.policy.state = granted`, `by = reviewer name`, new `decision.expires_at = now + 30m`). Reject → `REJECTED`.

### 2.5 `POST /purchase-requests/{id}/checkout`

Headers: cookie, CSRF, `Idempotency-Key`. Body: `{}` (amount and items are **always** taken from the stored request, never from the client).

- Allowed from `ALLOWED`, `CHECKOUT_PENDING` (resume), and `PAYMENT_FAILED` when `failure.retryable`.
- `ALLOWED` and `expires_at` passed → `409 POLICY_APPROVAL_EXPIRED` (the request becomes `EXPIRED`).
- If an open payment exists in `AWAITING_PAYER`/`APPROVED`, return it (**no new PayPal order**).
- Else create a `Payment` (`CREATING`) and call PayPal `POST /v2/checkout/orders` with `PayPal-Request-Id: ord_<payment_id>` (body in §6). Store `order_id` and `payer_action_url`, then move to `AWAITING_PAYER`. The request moves to `CHECKOUT_PENDING`.
- `200` → `{ "purchase_request": PurchaseRequest, "payment": Payment }`

### 2.6 `POST /purchase-requests/{id}/cancel`

Allowed from `IN_REVIEW`, `ALLOWED`, `CHECKOUT_PENDING`, `PAYMENT_FAILED`. If a PayPal order is open, it is abandoned (status `VOIDED` locally; we never capture it again). `200` → `PurchaseRequest` (`CANCELLED`).

### 2.7 `GET /payments/{id}` → `200 Payment`

### 2.8 `POST /payments/{id}/capture`

Headers: cookie, CSRF, `Idempotency-Key`. Body:
```json
{ "simulate": "none" }
```
`simulate ∈ {"none", "instrument_declined"}`. Anything but `none` is honored **only** when `DEMO_MODE=true` and env is sandbox. The server then adds `PayPal-Mock-Response: {"mock_application_codes":"INSTRUMENT_DECLINED"}` to the PayPal capture call.

Behavior:
1. Re-check the request: it must be `CHECKOUT_PENDING`, and policy approval must not have expired. Otherwise return `409`.
2. Atomic guard: `UPDATE payments SET status='CAPTURING', version=version+1 WHERE id=? AND status IN ('AWAITING_PAYER','APPROVED')`. Zero rows affected and status `CAPTURING` → `409 CAPTURE_IN_PROGRESS`. Status `COMPLETED` → `200` with the current payment (a no-op).
3. Call PayPal `POST /v2/checkout/orders/{order_id}/capture` with `PayPal-Request-Id: cap_<payment_id>_<attempt_n>`.
4. Map the result (`PAYMENT_STATE_MACHINE.md §3.3`).

`200` → `{ "purchase_request": PurchaseRequest, "payment": Payment }` for **all** business outcomes (completed, pending, declined, failed).
`503 PAYPAL_UNAVAILABLE` only when we know no capture happened. On timeout or unknown outcome, the attempt becomes `unknown`, payment stays `CAPTURING`, and the response is `200` with that state. The UI then calls `/reconcile`.

### 2.9 `POST /payments/{id}/reconcile`

Calls PayPal `GET /v2/checkout/orders/{order_id}` and settles `CAPTURING` / `unknown` attempts (`ORDER_ALREADY_CAPTURED` is treated as success after reading the capture). Emits `payment.reconciled`. `200 → { purchase_request, payment }`.

### 2.10 `GET /audit-events`

Query: `q` (ids, merchant, agent, PayPal ids, summary text), `purchase_request_id`, `type` (comma list), `state`, `actor_kind`, `from`, `to`, `limit`, `cursor`, `format=csv` (returns `text/csv`). Sort: `seq desc`. `200 → list of AuditEvent`.

### 2.11 `GET /audit-events/verify`

`200 → { "ok": true, "events": 214, "head_hash": "9c1e…a07" }` or `{ "ok": false, "broken_at_seq": 88, "event_id": "evt_…" }`.

### 2.12 `GET /policies/active`

`200 → { id, name: "Default", version: 3, rules: [{ rule_id, rule_key, description, params }], ai_policy: "AI risk may escalate ALLOW → REVIEW. It cannot allow or block." }`

### 2.13 Session (demo)

`POST /session { "passcode": "…" }` → `200 { user: { id, name, role } }`, then sets `apg_session` + `apg_csrf`. Passcodes come from env `DEMO_PASSCODES` (e.g. `operator:xxxx,reviewer:yyyy`). Wrong passcode → `401`, rate-limited to 5/min per IP.

### 2.14 `POST /webhooks/paypal`

1. Verify the signature with PayPal `POST /v1/notifications/verify-webhook-signature` (`auth_algo`, `cert_url`, `transmission_id`, `transmission_sig`, `transmission_time` from the `PAYPAL-*` headers, plus `webhook_id` from env and `webhook_event`). Failure → `400` and no state change.
2. Dedupe on the PayPal event `id` (stored).
3. Handle `CHECKOUT.ORDER.APPROVED` (→ `APPROVED`), `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED` / `DECLINED`. Map these via the same transition function as capture. Out-of-order or invalid transitions are logged and ignored, never thrown.
4. Always `200` after verification so PayPal stops retrying.

Webhooks are a *reconciliation path*. The demo must work without them (local dev has no public URL).

### 2.15 Demo endpoints (`DEMO_MODE=true` only)

`POST /demo/scenarios/{key}/run`, where `key ∈ {a_low_risk, b_needs_review, c_blocked, d_retry, d_duplicate, e_capture_declined}`. The server sends the fixture payload **through the same code path as endpoint 1**, using the demo agent key. `d_retry` sends the A payload twice with the *same* `Idempotency-Key`. `d_duplicate` sends it again with a *new* key. Response: `{ "purchase_request": PurchaseRequest, "replayed": boolean }`.

---

## 3. Representative responses

`201` for scenario B (trimmed):
```json
{
  "id": "preq_01JCB7Q2KESTREL0000000Q2",
  "object": "purchase_request",
  "status": "IN_REVIEW",
  "version": 3,
  "agent": { "id": "agt_research01", "name": "research-assistant" },
  "amount": { "currency_code": "USD", "value": "640.00" },
  "evaluation": {
    "policy_set": { "id": "pol_default", "name": "Default", "version": 3 },
    "policy": [
      { "rule_id": "P-01", "rule_key": "amount_auto_limit", "outcome": "review",
        "observed": "$640.00", "limit": "≤ $250.00 auto · ≤ $1,000.00 review",
        "message": "Over the $250 auto-approve limit." },
      { "rule_id": "P-04", "rule_key": "merchant_allowlist", "outcome": "review",
        "observed": "Kestrel Compute", "limit": "allowlist (6)",
        "message": "Kestrel Compute is not on the merchant allowlist." }
    ],
    "risk": {
      "status": "completed", "score": 48, "level": "medium",
      "recommendation": "escalate_to_review",
      "signals": [
        { "code": "new_merchant", "label": "First purchase from Kestrel Compute",
          "severity": "warn", "evidence": null, "source_field": "merchant.name" },
        { "code": "amount_above_typical", "label": "3.2× this agent's median purchase",
          "severity": "warn", "evidence": null, "source_field": "amount" }
      ],
      "summary": "Plausible compute purchase; new merchant and above-typical amount.",
      "model": "claude-sonnet-5-5", "prompt_version": "r-2", "latency_ms": 1410
    }
  },
  "decision": {
    "id": "dec_01JCB7…", "outcome": "REVIEW", "policy_outcome": "REVIEW",
    "risk_escalated": false,
    "reason_codes": ["P-01:review", "P-04:review", "risk:new_merchant"],
    "reason": "Over the $250 auto limit; merchant is new.",
    "expires_at": null
  },
  "keys": {
    "policy": { "state": "waiting", "by": null, "at": null, "detail": "Waiting for reviewer" },
    "payer":  { "state": "not_applicable", "by": null, "at": null, "detail": "Not started" }
  },
  "payment": null,
  "next_actions": ["open_review", "cancel"]
}
```

---

## 4. AI risk component interface (backend-internal, normative)

```ts
interface RiskAssessor {
  assess(input: RiskInput, opts: { timeoutMs: 8000 }): Promise<RiskAssessment>;
}
type RiskInput = {
  request: Pick<PurchaseRequest, "merchant" | "items" | "amount" | "justification" | "metadata">;
  agent_profile: { name: string; allowed_categories: string[]; median_amount: Money; requests_last_24h: number };
  merchant_history: { first_seen: boolean; prior_paid_count: number };
  policy_results: PolicyResult[];   // context only
};
```
- The model gets agent-supplied text **inside a delimited data block**, with an instruction to treat it as untrusted. It must flag instructions inside that text as `prompt_injection`.
- Output is constrained to the `RiskAssessment` JSON schema (structured output or tool use). Invalid output → `status: "unavailable"`.
- The model has **no tools** and no network or payment capability.
- `model` and `prompt_version` are recorded on every assessment.
- Provider is configurable (`RISK_PROVIDER`, `RISK_MODEL`). Default: Anthropic `claude-sonnet-5-5`. A deterministic `FixtureRiskAssessor` must exist for tests and offline demos (`RISK_PROVIDER=fixture`).

## 5. Fingerprint (duplicate detection)

`fingerprint = sha256( agent_id | lower(trim(merchant.name)) | canonical_decimal(amount_in_cents) | currency_code | sort(aggregate_by_lowercase_item_name(items).map(i => i.name + "×" + i.total_quantity)).join(",") )`

Security audit amendment (2026-11-04): leading-zero amount spellings and splitting
an identical item across rows are the same proposed purchase. Normalize money
through integer cents and sum quantities by normalized item name before hashing.
Evaluate historical rows with the same canonical function as well as their stored
hash; never rewrite the append-only ledger or past fingerprints. This closes a
P-07 representation bypass without changing the ten-minute window or payment keys.

The P-07 `duplicate_guard` blocks if a request with the same fingerprint was created in the last **10 minutes** and is not in `{BLOCKED, REJECTED, CANCELLED, EXPIRED}`. It sets `duplicate_of`.

## 6. PayPal Orders v2 usage (Sandbox, `https://api-m.sandbox.paypal.com`)

Facts verified on 2026-11-03 against PayPal's published Orders v2 OpenAPI spec: order status enum `CREATED, SAVED, APPROVED, VOIDED, COMPLETED, PAYER_ACTION_REQUIRED`; capture status enum `COMPLETED, DECLINED, PARTIALLY_REFUNDED, PENDING, REFUNDED, FAILED`; link rels include `approve` and `payer-action`; `experience_context` fields include `return_url`, `cancel_url`, `user_action (CONTINUE|PAY_NOW)`, `shipping_preference`; header `PayPal-Request-Id` for idempotency. Error names `ORDER_NOT_APPROVED`, `ORDER_ALREADY_CAPTURED`, `INSTRUMENT_DECLINED`, `TRANSACTION_REFUSED`, `DUPLICATE_INVOICE_ID`, `MAX_NUMBER_OF_PAYMENT_ATTEMPTS_EXCEEDED`, `ORDER_EXPIRED`, `PAYER_CANNOT_PAY` appear in the Orders v2 error reference. The negative-testing header format is `PayPal-Mock-Response: {"mock_application_codes": "<ERROR_NAME>"}`.

Auth: `POST /v1/oauth2/token` (`grant_type=client_credentials`, Basic `client_id:secret`). Cache the token until `expires_in − 60s`.

Create order:
```http
POST /v2/checkout/orders
PayPal-Request-Id: ord_pay_01JCB8…
Content-Type: application/json

{
  "intent": "CAPTURE",
  "purchase_units": [{
    "reference_id": "preq_01JCB7…",
    "custom_id": "preq_01JCB7…",
    "invoice_id": "preq_01JCB7…",
    "description": "GPU hours · H-class ×40 — via AgentPay Guard",
    "amount": { "currency_code": "USD", "value": "640.00",
      "breakdown": { "item_total": { "currency_code": "USD", "value": "640.00" } } },
    "items": [{ "name": "GPU hours · H-class", "quantity": "40",
      "unit_amount": { "currency_code": "USD", "value": "16.00" }, "category": "DIGITAL_GOODS" }]
  }],
  "payment_source": { "paypal": { "experience_context": {
    "brand_name": "AgentPay Guard (Sandbox)",
    "shipping_preference": "NO_SHIPPING",
    "user_action": "PAY_NOW",
    "return_url": "<APP_URL>/checkout/return?payment=pay_01JCB8…",
    "cancel_url": "<APP_URL>/checkout/cancel?payment=pay_01JCB8…"
  } } }
}
```
`invoice_id = purchase_request_id` is deliberate. It gives defense in depth, because PayPal itself rejects a second payment for the same request (`DUPLICATE_INVOICE_ID`).

Capture: `POST /v2/checkout/orders/{id}/capture` with `PayPal-Request-Id: cap_<payment_id>_<n>` and an empty body.

## 7. Environment variables (backend)

`APP_URL`, `DATABASE_URL`, `SESSION_SECRET`, `DEMO_MODE`, `DEMO_PASSCODES`, `DEMO_AGENT_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`, `RISK_PROVIDER=anthropic|fixture`, `RISK_MODEL=claude-sonnet-5-5`, `ANTHROPIC_API_KEY`.
`PAYPAL_CLIENT_ID` is the only one exposed to the browser (via endpoint 17).


## 8. Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-11-03 | `Payment.paypal.environment` enum is `"sandbox" \| "mock"`. The backend **always** returns `"sandbox"`. `"mock"` is produced only by the frontend mock adapter. | Lets the UI label simulated results honestly without a separate type |
| 2026-11-03 | Zod 4 syntax in `src/contract`: `z.record(key, value)` (two arguments) and `z.url()`. Shapes are unchanged. | Zod 4.6 is the installed version |
| 2026-11-03 | Shared fixtures: scenario payloads live in `src/contract/fixtures/scenarios.ts`. The backend's `/demo/scenarios/{key}/run` must send the same payloads. | Single source for demo data |
| 2026-11-03 | Frontend boundary documented in `docs/FRONTEND_HANDOFF.md` §4 (method → endpoint map). | Backend handoff |

### 8.1 Backend security clarifications (2026-11-03, before implementation)

Frontend integration clarification (2026-11-04): the existing optional
`POST /payments/{id}/payer-cancel` endpoint accepts `{}`, requires operator cookie,
CSRF and Idempotency-Key, and returns `{ "ok": true }`. It records popup/redirect
closure in the ledger; it does not cancel the purchase or prove a payment outcome.

No response shapes or existing UI calls change. POST schemas now reject unknown fields, including nested money/merchant/items; metadata is limited to ten keys. Reject notes need three non-whitespace characters. Before deployment run the SQL migrations.

- Server catalog `src/server/policy/catalog.ts` resolves known fixture item names (or SKUs), canonical merchant identity/category/domain and unit prices. Forged known catalog prices/merchants are rejected with `VALIDATION_FAILED`. Unknown proposals remain persistable and require review; checkout fails closed until a trusted server catalog entry exists. Human review cannot validate an arbitrary client price. Catalog edits are deployment-controlled.
- PostgreSQL (`pg`, numbered SQL migrations) replaces the earlier planned SQLite/Prisma option at the user's request. Short database transactions serialize policy reservations, payment claims and audit appends. No network call runs under the database lock.
- `PAYPAL_MERCHANT_ID` is optional for this single-merchant integration: OAuth uses only client ID/secret and Orders v2 permits omitting payee. When configured it remains an enforced recipient constraint. Otherwise creation omits payee and binds the nonempty merchant ID from the authenticated create response into the internal payment record. Every later order read/capture/settlement compares that persisted recipient, along with order/custom/reference/invoice IDs and amount. A legacy payment without a binding requires the configured merchant ID; it cannot learn a recipient from a later GET. Production hosts remain rejected. This amendment removes an unnecessary setup requirement without removing merchant ownership verification (2026-11-05 UTC).
- Capture GETs the owned order first; a client callback/token is not evidence of payer approval. Only PayPal `APPROVED` permits a new capture. Unknown capture outcomes stay `CAPTURING`; reconciliation may only re-send the *same* attempt within five hours (inside the documented default six-hour create idempotency retention). Older ambiguous operations require manual investigation and cannot silently create a new order/attempt.
- Idempotency includes the concrete resource path and `If-Match` in the body hash, in addition to principal/method/route. This prevents replay across different resources. A crashed operation lease can be reclaimed after 60 seconds, but persisted payment claims still prevent duplicate capture. Session DELETE uses CSRF and expires both cookies. Session POST is demo-only. The login limiter uses the socket-independent deployment-provided IP only when `TRUST_PROXY=true`; otherwise a conservative shared bucket is used.
- `RISK_PROVIDER=fixture` is explicit and labelled `fixture`; other/unconfigured providers return unavailable and force human review. No real AI assessment is claimed. This foundation does not implement an Anthropic adapter.
- Live demo reset clears only requests that have never had a payment. Financial records, webhooks and audit history are retained. Cached demo responses referencing removed never-paid requests are cleared so the fixed scenario retry key can be used after reset. Live seed data never fabricates past paid transactions.
- `POST /payments/{id}/payer-cancel` is additive (operator, CSRF, idempotency, `{}`): records popup/redirect abandonment, preserving the order for later approval. The existing UI may continue without this optional signal.

### Security audit protocol clarifications (2026-11-04)

Webhook ingress clarification (2026-11-05): missing/blank/oversized signature
headers and malformed certificate URLs are invalid input (400), rejected before
provider I/O. They must not be misreported as temporary PayPal outages (503).
Raw signed bytes, genuine postback verification and all payment guards stay intact.

Webhook postback verification preserves the bounded original UTF-8 JSON event as
the nested `webhook_event` JSON value; application processing parses a separate
copy. Capture identifiers must be nonempty, bounded canonical provider IDs before
recording settlement. Contradictory voided/captured provider responses remain
unconfirmed rather than becoming a new retryable unpaid payment.

### Meta provider extension (2026-11-05 UTC, before implementation)

Add explicit `RISK_PROVIDER=meta`, server-only `MODEL_API_KEY` and
`META_RISK_MODEL=muse-spark-1.3` (Standard only). The shared Responses wire client
may call the fixed Meta endpoint `https://api.meta.ai/v1/responses`; no purchase
input selects a host, key, model or provider. Audit diagnostics accept provider
`meta` and record the returned model/validated response ID. Public schemas,
deterministic policy combination, eight-second evaluation budget, review authority
and all payment transitions remain unchanged. Provider failures never select fixtures.
Meta's strict wire schema enumerates the canonical text evidence paths accepted
by the unchanged service validator, with paired null evidence/source for context
facts. Meta prompt version `r-3-meta-1` clarifies those paths; OpenAI retains `r-3`.
