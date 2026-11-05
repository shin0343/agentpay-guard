# Demo verification

> Historical stage snapshot. For the current publication verdict and measured results, see
> [Step 8 final release report](FINAL_RELEASE_REPORT.md). Earlier counts/verdicts below describe their original run.

## What is implemented versus verified

| Layer | Implementation | Evidence in this task |
|---|---|---|
| Deterministic policy | P-01…P-08 and one-way risk escalation | Real code, automated tests |
| AI provider | OpenAI Responses HTTP service, strict schema and local validation | Actual adapter exercised with stub transport; no live credential supplied |
| Fixture risk | Exact fictional scenario matching, labelled `fixture` | Deterministic simulation; requires explicit demo mode |
| PostgreSQL | Persistent requests/payments/evaluations and append-only audit | Real PostgreSQL integration tests, fresh connections and concurrency |
| PayPal | Sandbox Orders v2 adapter and verified reconciliation | FakePayPal lifecycle tests and stub HTTP adapter tests; no genuine Sandbox transaction completed here |
| Frontend | Real GuardApi HTTP integration, recovery and refined Ledger Instrument UI | Real Next/PostgreSQL decision flows plus explicitly intercepted payment boundaries and labelled mock walkthroughs; see `FRONTEND_QA.md` |

The app contains real AI integration code. This session does **not** claim a completed
live inference or genuine PayPal Sandbox payment. No API credential or signed-in payer
was available. Browser screenshots demonstrate simulated flows only. Switching to mock
or fixture mode changes the evidence category; it never establishes a real payment.

## Automated reproduction

```bash
pnpm typecheck
pnpm lint
pnpm test
# An existing dedicated disposable PostgreSQL DB; tests create a unique schema.
APG_POSTGRES_TEST=true TEST_DATABASE_URL=postgresql://localhost:55439/apg_guard_test pnpm test
pnpm build:webpack
# The standard aggregate command also attempts Turbopack:
APG_POSTGRES_TEST=true TEST_DATABASE_URL=postgresql://localhost:55439/apg_guard_test pnpm check
```

Final full-suite result: **104 / 104 tests passed**, including four real PostgreSQL integration tests (2026-11-04).

Final evidence is recorded in [TEST_REPORT.md](TEST_REPORT.md). In this execution
environment Turbopack's CSS worker cannot bind its local port, including under elevated
execution. The standard `pnpm check` reaches the build step after passing typecheck,
lint and all tests, then fails with `Operation not permitted`. The explicit Webpack build
passes without changing the UI, fonts or default build command.

## Required scenarios

Inputs are repeatable fictional fixtures in `tests/fixtures/risk-scenarios.ts`, based on
`src/contract/fixtures/scenarios.ts` and `DEMO_SCENARIOS.md`. Expected AI responses in
unit tests are simulated model responses, not predictions about a live API.

| # | Input / procedure | Required invariant | Automated proof |
|---|---|---|---|
| 1 | $18 allowlisted embedding credits, in-scope agent, validated low model output | ALLOWED, policy key only; no automatic PayPal action | `ai-risk.test.ts` scenario 1/2/3 |
| 2 | $640 GPU purchase, model says low risk | IN_REVIEW because deterministic limits/merchant require review | Same scenario matrix; reviewer authorization tests |
| 3 | $2,400 gift cards | BLOCKED regardless of model result; zero PayPal calls | Matrix and existing blocked endpoint tests |
| 4 | Otherwise permitted request with instruction inside item description | Review; injection signal survives a low model answer | Six untrusted-field attack cases and model-only encoded-instruction case |
| 5 | Same key/body replay; then new key/same purchase | Exact replay; second semantic request blocked; no extra inference | AI duplicate/replay test and concurrent evaluation test |
| 6 | Missing key, timeout, stalled body, 503, refused/truncated/invalid/adversarial output | REVIEW for policy ALLOW; no checkout/capture authority | Provider failure table, schema/adversarial cases, timeout tests |
| 7 | Funding decline, recover checkout, reapprove payer, recapture | Never PAID on error; same order, separate safe attempt; verified final IDs | PayPal recovery test, unknown-result reconcile test, adapter retry test |

Additional cases verify invented evidence rejection, extra financial properties, unknown
tool output, oversized responses, raw payload exclusion, privacy redaction, proper model
metadata, expired evaluation recovery, preserved idempotency resource identity and late
response suppression. Existing tests retain role/CSRF guards, review races, expired policy
approval, forged quotes/payees/amounts, webhook signature checks and payment-attempt limits.

For repeatable fixture demos set `DEMO_MODE=true`, `RISK_PROVIDER=fixture` and keep labels
visible. Real AI can conservatively escalate scenario A; do not tune or replace its answer
just to guarantee an on-stage ALLOW. Scenario B/C/D policy outcomes are independent of AI.

## Genuine AI verification

1. Configure `.env.local` using `.env.example`, with real server-only OpenAI API credentials,
   `RISK_PROVIDER=openai` and a supported model available to the account. Configure the live
   backend/DB separately from the browser's mock mode.
2. Run migrations and create a nonduplicate purchase through the authenticated live API.
3. Confirm `evaluation.risk.status=completed`, a non-fixture model and prompt `r-3`.
   Inspect the ledger's `risk.assessed` event for response ID, attempt count, provider result,
   supplemental deterministic signals and matching correlation/policy version.
4. To probe the provider again without changing a decision or initiating payment:

   ```bash
   pnpm risk:verify preq_<stored-nonduplicate-request-id>
   ```

   Record the sanitized output, timestamp, response ID, model and prompt version. A
   nonzero exit or `inference_not_verified` is failure evidence, never success. This probe
   incurs a real model call; it does not record a new decision or rewrite the ledger.
5. Send an instruction-bearing purchase and verify review/block plus cited signals. Stop
   provider access and verify unavailable risk requires a reviewer. Never publish secrets
   or raw purchase text as evidence.

The live model's semantic correctness, latency distribution, false-positive rate and
injection coverage require a separate evaluation dataset/run. Automated stub results do
not establish any of these properties.

## Genuine PayPal Sandbox acceptance

Follow [PAYPAL_INTEGRATION.md](PAYPAL_INTEGRATION.md) for Sandbox account setup. Use the
actual live backend (`NEXT_PUBLIC_API_MODE=live`), configured Sandbox business merchant,
and a separate Sandbox personal payer. All fictional merchant labels still pay the
configured demo business account.

1. Create A with a fresh idempotency key. If AI requests review, approve as an independent
   reviewer; confirm only the policy key is granted.
2. Start checkout as operator/reviewer and record the real Sandbox order ID. Approve in
   the official PayPal payer experience, then invoke the existing capture flow.
3. Accept PAID only after a verified COMPLETED capture with matching amount/currency,
   payee and request ownership; preserve real order/capture IDs and audit correlation.
4. Exercise the explicit negative-testing decline. Record the result as PayPal Sandbox
   **simulated decline**, then complete recovery without the mock header. Do not call the
   negative response proof of a genuine issuer decline.
5. Verify against PayPal with the existing read-only probe:

   ```bash
   pnpm sandbox:verify pay_<stored-payment-id>
   ```

6. Send B/C/D and confirm review/block invariants. A blocked request must have no checkout
   or capture events. Verify the ledger chain after all operations. If a result is unknown,
   reconcile the same payment; do not manually allocate another capture.

No money movement, payer approval or genuine Sandbox transaction is inferred from a UI
screenshot, fixture capture ID, model recommendation, or mocked HTTP response.

## Visual regression and scope

`scripts/visual-qa.cjs` ran against the production Webpack build in mock mode at desktop
1440×900 and mobile 390×844; both runs reported `errors: none`. Screenshots under
`qa/ai-risk/` are local, ignored artifacts. Expanded ledger, blocked trace and decline
screens were visually inspected. Existing mobile ledger event text wraps narrowly; this
pre-existing layout was retained. The only frontend code addition is vocabulary for the
three new audit events. No components, layout, fonts, colors or payment controls changed.
