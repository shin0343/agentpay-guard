# Devpost submission — AgentPay Guard

Copy-ready English text for https://paypalaihackathon.devpost.com. Fields marked **[YOU]** need your input.
Every claim below is backed by `docs/SANDBOX_TRANSACTION_EVIDENCE.md`, `docs/WEBHOOK_VERIFICATION.md`
or the code. Do not add accuracy, fraud-reduction or production claims.

---

## Project name

AgentPay Guard

## Elevator pitch (≤ 200 characters)

Payment guardrails for AI agents: rules decide, Meta AI advises, people approve, and PayPal captures only after the payer approves. Every step is on a tamper-evident ledger.

## Suggested prize categories

Best Use of Agentic Commerce · Best Use of PayPal + AI (plus the Grand Prizes, which every eligible submission enters)

---

## About the project (main description)

### Inspiration

AI agents can now browse, compare and buy. The missing piece is not another way to pay. It is a way to
say *no*, to ask a person, and to prove afterwards what happened. Today an agent with a card number has
either too much power or none. We wanted a middle ground that a finance team could actually accept.

### The problem

When an agent spends money, three questions have no good answer yet:

1. **Who set the limits, and were they enforced?** A model prompt is not a control.
2. **Who approved this purchase?** "The agent decided" is not an audit answer.
3. **Did money actually move, exactly once?** Retries, double clicks and lost responses are normal in agent loops.

### What it does

AgentPay Guard sits between an AI agent and PayPal.

- **The agent proposes.** It calls `POST /api/v1/purchase-requests` with its own API key and an idempotency key.
  Prices and merchant identity come from a trusted server catalog, not from the agent.
- **Rules decide.** Eight deterministic policies check the purchase limit, daily budget, category, merchant
  allowlist, currency, agent scope, duplicates and velocity. Same input, same answer.
- **AI advises.** Meta's `muse-spark-1.3` reads the untrusted request and returns a structured risk
  assessment with evidence quoted from the request. It can raise *Allowed* to *Needs review*. It can never
  lower a rule's result, and if it fails, the request goes to a person.
- **People approve.** Over-limit or new-merchant purchases wait for a named reviewer. The operator who runs
  the agent cannot approve it, and the approval is bound to the exact request version.
- **PayPal confirms.** Money moves only after a second, separate approval by the payer inside PayPal.
  *Paid* appears only when PayPal reports a completed capture that matches the stored order.
- **Everything is written down.** Each step lands in an append-only, SHA-256 hash-chained ledger, with
  verified PayPal webhook events linked to the payment they changed.

We call this the **two-key model**: Key 1 is policy approval (rules, or a reviewer). Key 2 is payer approval
(in PayPal). The UI always shows both, side by side, and never merges them into one "Approved".

### How it's different from a payment chatbot

A chatbot asks a model whether to pay. AgentPay Guard never lets the model decide. The model's output is
schema-validated advice. Deterministic code makes the decision, PayPal holds the second key, and the database
enforces uniqueness. In our demo a prompt-injected request tells "the reviewing system" to ignore spending
limits. The model flags the injection, the rules block the request, and the trace shows **PayPal calls: 0**.

### How we built it

- **Next.js 16 + TypeScript** for both the operator UI and the `/api/v1` backend, with a strict Zod contract
  shared by both.
- **PostgreSQL** for requests, payments, idempotency records, webhook dedupe and the audit ledger. Policy
  evaluation and capture claims run in short advisory-locked transactions. A trigger makes audit rows append-only.
- **PayPal Orders v2 (Sandbox)** with the official PayPal JS SDK button and a redirect fallback.
- **PayPal webhooks** verified through `verify-webhook-signature` using the original raw body.
- **Meta Model API** (`muse-spark-1.3`, Responses API, strict JSON schema, `store: false`).
- A small design system ("Ledger Instrument"): editorial serif verdicts, monospaced money and IDs, and color
  that appears only when a decision is made.

### PayPal integration

- Server creates the order from the stored, policy-approved quote with `intent: CAPTURE`, a deterministic
  `PayPal-Request-Id` (`ord_<payment_id>`) and the request ID as `invoice_id`, `custom_id` and `reference_id`.
- The payer approves in PayPal with the official JS SDK button (unmodified), or a redirect fallback.
- Before capture, the server GETs the order and checks owner, recipient, amount, currency and IDs. Only a real
  `APPROVED` status can start a capture. Return URLs and browser tokens are never trusted.
- Capture uses `cap_<payment_id>_<attempt>`. A repeated capture returns the same capture. Timeouts and
  ambiguous responses stay *Confirming*. They are never retried as a new payment and never shown as failed.
- Webhooks (`CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.*`) are verified with PayPal, deduplicated by event ID,
  and then reconciled by reading the order from PayPal. The event body cannot set an amount or status.

**Verified in Sandbox (2026-11-05):** order `2UE55412FX0764120`, capture `32E66103YN1557633`, USD 18.00
`COMPLETED`, approved by a separate Sandbox personal buyer. Both genuine webhook events were accepted, verified
by PayPal's postback, redelivered through PayPal's resend API and deduplicated. One capture, one attempt.

### Meta AI integration

- `RISK_PROVIDER=meta` calls `https://api.meta.ai/v1/responses` with `muse-spark-1.3` (Standard), minimal
  reasoning and an 8-second deadline.
- The purchase is passed as a bounded, redacted, clearly untrusted data block. The response must match a strict
  JSON schema. Every risk signal must quote a real field of the request, or it is rejected.
- The result is stored with model ID, prompt version and latency, and shown in the decision trace as
  "Advisory score, not a fraud probability."
- Real assessments recorded: the paid $18 request (score 5), a $640 review case, the $2,400 gift-card
  injection (score 95, injection quoted), and fresh runs during demo recording.

### Challenges we ran into

- **"Unknown" is a real payment state.** A capture can succeed at PayPal while our request times out. Our own
  security audit found that a failed replay could mark a captured payment as failed. We now keep every ambiguous
  attempt in *Confirming* until a verified read settles it, and we tested that across fresh database connections.
- **Webhook bytes matter.** Re-serializing JSON can change the signed payload. The handler keeps the original raw
  body for PayPal's verification call.
- **Grounding a model.** Muse Spark's first responses cited evidence paths with a wrapper prefix, which our
  validator rejected. We tightened the schema rather than loosening validation.
- **Sandbox realities.** A buyer account linked to the seller cannot pay. A separate Sandbox personal buyer and
  generated test card solved it.

### Accomplishments we're proud of

- A real end-to-end Sandbox payment: agent API → rules → Meta inference → payer approval → guarded capture →
  signed webhooks → ledger, with matching state in PayPal, PostgreSQL and the UI.
- Exactly one capture despite repeated capture requests and genuine webhook redeliveries.
- 193 automated tests, including concurrency and restart tests against real PostgreSQL.
- An interface where the most important states (Allowed, Needs review, Blocked, Paid, Not paid) read in one glance.

### What we learned

Agent payments are mostly an authorization and evidence problem. The model is useful for explaining risk in
plain language, but every decision that moves money has to be deterministic, attributable and replay-safe.

### What's next

- Per-user identities and revocable sessions instead of shared demo passcodes.
- Multi-tenant storage and load testing.
- Refunds and disputes through the same two-key model.
- PayPal agentic commerce and vaulted payment flows for payer-not-present purchases, with stricter policies.
- An evaluation set for the risk prompt before any accuracy claim.

### Limitations (honest scope)

Sandbox only, not deployed to production. One Sandbox business account receives all payments; merchants are
fictional labels. Demo sign-in uses shared passcodes. Natural funding declines, provider-held `PENDING` and
network ambiguity are covered by controlled tests, not by a live run. The AI score is advisory and its accuracy
is not measured.

---

## Built with

typescript · next.js · react · node.js · postgresql · paypal-orders-api · paypal-javascript-sdk · paypal-webhooks ·
meta-model-api · muse-spark · zod · tailwindcss · vitest · playwright

## "Try it out" links

- GitHub: **[YOU]** `https://github.com/<you>/agentpay-guard`
- Demo video: **[YOU]** YouTube URL (public)

## Testing instructions (for judges)

1. Fastest: offline mock mode, no accounts. `pnpm install`, then
   `NEXT_PUBLIC_API_MODE=mock pnpm build:webpack && NEXT_PUBLIC_API_MODE=mock pnpm start`.
   Open http://localhost:3000, sign in with `operator` or `reviewer`, use **Send test request** for scenarios A–E.
   Every result is labelled simulated.
2. Live Sandbox: follow "Option 2" in the README with your own free PayPal Sandbox app and a separate Sandbox
   personal buyer. `RISK_PROVIDER=fixture` needs no AI key; `RISK_PROVIDER=meta` uses your Meta Model API key.
3. Recorded evidence of our own Sandbox run is in `docs/SANDBOX_TRANSACTION_EVIDENCE.md`.

**[YOU]** Optional: if you want judges to test against *your* Sandbox app without setting one up, put a separate,
revocable Sandbox app's credentials in the Devpost private testing field (never in the repository), and rotate
them after judging.

## Project significantly updated during the submission period?

Created from scratch during the submission period. First commit: 2026-11-03.

## Demo video description (YouTube)

> AgentPay Guard is a payment control layer for AI agents, built for the PayPal AI Hackathon 2026.
> An agent proposes a purchase; deterministic policies decide; Meta's muse-spark-1.3 adds advisory risk
> analysis that can only add caution; a named reviewer approves when needed; and PayPal captures only after
> a separate payer approval. Everything shown is the real application. The payment is a genuine PayPal
> **Sandbox** transaction (USD 18.00, capture 32E66103YN1557633). No real money moved, and the product is
> not deployed to production. Merchants and agents are fictional.
>
> 0:00 Problem · 0:11 Product · 0:26 Low-risk request · 0:52 Human review · 1:27 Prompt-injection block ·
> 1:48 Verified Sandbox payment · 2:07 Retries, signed webhooks, ledger · 2:28 Close
>
> Code: <GitHub URL>

(Chapter times are from draft 1; update them if the video is re-cut.)

## GitHub repository

- **Description:** Payment control layer for AI agents: deterministic policies, advisory Meta AI risk analysis, human review and PayPal Sandbox checkout with a hash-chained audit ledger.
- **Topics:** `paypal` `ai-agents` `agentic-commerce` `payments` `nextjs` `typescript` `postgresql` `meta-ai` `hackathon`
- **License:** MIT (in `LICENSE`, shown in the About panel)
