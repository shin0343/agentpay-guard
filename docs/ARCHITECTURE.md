# Architecture

AgentPay Guard is one Next.js 16 application: the App Router serves the operator UI, and a single
route handler (`src/app/api/v1/[[...path]]/route.ts`) serves the versioned API. PostgreSQL holds all
state. Payment uses PayPal Orders v2; advisory AI uses the explicitly selected Meta Model API or
optional OpenAI provider. Fixture/unavailable risk modes make no AI service call. Clean builds also
download Google Fonts; browser checkout loads the official PayPal SDK.

## Request lifecycle

```
Agent (Bearer agk_test_…, Idempotency-Key)
  │ POST /api/v1/purchase-requests
  ▼
validation.ts ── strict Zod contract, integer-cent totals, trusted catalog quote (policy/catalog.ts)
  ▼
service.ts ── short PostgreSQL advisory-locked transaction
  ├─ policy/engine.ts   8 deterministic rules → pass / review / block
  ├─ risk/*             Meta muse-spark-1.3 via Responses API, strict JSON schema, grounded evidence
  │                     advisory only: can raise ALLOW → REVIEW, never lower
  └─ state/transitions.ts   the only place request/payment status changes
  ▼
BLOCKED ──► stop. The PayPal client is never called.
IN_REVIEW ─► reviewer decision (If-Match version, not the agent's owner) ─► ALLOWED
ALLOWED ──► Key 1 granted (policy approval)
  ▼
paypal/client.ts (SandboxPayPal)
  create order  PayPal-Request-Id ord_<payment_id>, invoice = request ID, stored quote only
  payer approves inside PayPal ─► Key 2 (payer approval)
  GET order, check owner/amount/recipient ─► capture  PayPal-Request-Id cap_<payment_id>_<n>
  COMPLETED capture matching stored order ─► PAID
  ▼
Webhooks  POST /api/v1/webhooks/paypal
  raw body kept ─► PayPal verify-webhook-signature ─► SUCCESS only ─► event-ID dedupe
  ─► reconcile by reading the owned order from PayPal (event body is never trusted for amount/status)
  ▼
audit/ledger.ts  every transition appended, SHA-256 hash-chained, UPDATE/DELETE blocked by trigger
```

## Trust boundaries

| Input | Trusted? | Handling |
|---|---|---|
| Agent purchase text, justification | No | Shown as "Agent-supplied · untrusted"; passed to the model as data; cannot change policy |
| Agent prices and merchant identity | No | Replaced by the server catalog quote; unknown items cannot reach checkout |
| Model output | Advisory | Schema-validated, evidence must quote real fields; may only escalate |
| Browser return URL / token | No | Capture uses the stored payment ID and a fresh PayPal GET |
| Webhook payload | Only after PayPal verification | Identifies an order; state comes from PayPal reads |
| Operator / reviewer session | Yes, scoped | Signed cookie + CSRF token; reviewer approval needs `If-Match` |

## Idempotency and duplicate safety

- Every POST (except session and webhooks) requires `Idempotency-Key`. Results replay for 24 hours.
- Policy rule P-07 blocks the same agent buying the same items at the same amount within 10 minutes.
- Deterministic `PayPal-Request-Id` values plus database uniqueness on order and capture IDs mean a
  repeated capture returns the same capture. Unknown outcomes stay `CAPTURING` until a verified read.

## Frontend

- `src/lib/api` exposes `GuardApi` with a live HTTP adapter and an in-browser mock adapter.
  Components never call `fetch` directly.
- `src/lib/copy.ts` holds all vocabulary. `isVerifiedPaid` requires the request, payment and PayPal
  capture to agree before the UI says "Paid".
- Visual rules are in `docs/DESIGN_SYSTEM.md` ("Ledger Instrument").

## Source map

| Area | Path |
|---|---|
| Contract (Zod) | `src/contract` |
| HTTP routing, auth, CSRF | `src/server/http.ts`, `src/server/auth` |
| Business logic | `src/server/service.ts` |
| Policies and catalog | `src/server/policy` |
| AI risk | `src/server/risk` |
| PayPal adapter | `src/server/paypal/client.ts` |
| State transitions | `src/server/state/transitions.ts` |
| Audit ledger | `src/server/audit/ledger.ts` |
| Schema | `migrations/001_foundation.sql` |
| UI | `src/app`, `src/components` |
| Tests | `tests/` (Vitest, fake and stub providers, opt-in PostgreSQL suite) |
