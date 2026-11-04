# Backend test report — 2026-11-04 (America/Los_Angeles)

Latest extension: real OpenAI risk service, structured validation, adversarial/failure coverage, evaluation recovery and enriched persistent audit. See `DEMO_VERIFICATION.md` for explicit evidence categories.

## Verified

| Check | Result | Evidence / scope |
|---|---|---|
| `pnpm typecheck` | PASS | Strict TypeScript, server, tests and existing frontend |
| `pnpm lint` | PASS | ESLint, no warnings |
| `pnpm test` | PASS | 100 tests; 4 opt-in PostgreSQL tests skipped in the default run |
| `APG_POSTGRES_TEST=true TEST_DATABASE_URL=… pnpm test` | PASS | **104 / 104 tests**, six files; includes real PostgreSQL 15.19 on localhost |
| `pnpm db:migrate` | PASS | 001 applied to a fresh disposable PostgreSQL database; schema tracking recorded |
| `pnpm check` / `pnpm build` | ENVIRONMENT BLOCKED | Turbopack's CSS worker cannot bind a local port (`Operation not permitted`); repeated under the available elevated execution profile with the same restriction |
| `pnpm build:webpack` | PASS | Full production build, TypeScript, static generation and dynamic API bundle; existing fonts preserved |
| Actual Next production HTTP + PostgreSQL smoke | PASS | Sign-in 200; A ALLOWED; B IN_REVIEW → reviewer ALLOWED with payer waiting; C BLOCKED; blocked checkout 409; 3 stored requests; 13 audit events with verified chain; CSV 200; **zero PayPal calls** |
| `git diff --check` | PASS | No whitespace errors |

The default `pnpm check` still invokes the original Turbopack build. Use the explicit `build:webpack` fallback in environments with this restriction. The build and frontend design were not changed to hide the environment failure.

## AI extension coverage

- Genuine provider adapter code with simulated Responses API output: strict JSON Schema, server-side model metadata, amount/agent/merchant/history context and no tool/credential exposure.
- Conservative review for missing credentials, model network/HTTP errors, timeouts, stalled response bodies, invalid/refused/truncated/oversized/adversarial output, invented evidence and schema-forged financial commands.
- Prompt instructions across six untrusted field types, model-only injection detection and separately attributed deterministic concern floors.
- Duplicate inference suppression, API response replay, external I/O outside DB locks, in-flight budget reservations, abandoned evaluation recovery and late-answer suppression.
- Persisted redacted signals, policy/decision/reviewer details, correlation IDs, verified PayPal settlement snapshots and safe retry/unknown events.
- Real PostgreSQL persistence of AI metadata across fresh connections. PayPal transport retry reuse/observability and same-order decline/unknown recovery remain simulated payment operations.

## Automated coverage

The existing frontend/mock and HTTP-boundary tests remain in place. New backend tests cover:

- Allowed, review and blocked proposals; all eight rules; blocked requests make zero order/capture calls.
- Strict schemas, amount sums, USD-only validation, metadata limits, unknown fields, forged prices and merchant identity, unknown quote fail-closed checkout.
- Fixture risk, unavailable-provider escalation, and the one-way rule preventing AI from relaxing policy.
- Reviewer approval/rejection, rejection notes, stale versions, conflicting reviews, denied operator/agent approval, self-review prevention, agent ownership isolation and CSRF.
- Same-key exact response replay; different-body key reuse; semantic duplicates; simultaneous requests; paid/reserved budgets; in-flight API key conflicts.
- State/result atomic persistence across an injected post-commit response interruption.
- Duplicate checkout and competing captures; one external capture under concurrent requests; repeated completed capture is a no-op.
- Payer approval checked against the actual fake-provider order; amount, currency, request correlation, order ID and payee mismatch rejected before capture.
- Funding decline and same-order recovery; three-attempt limit; PENDING vs completed; network-unknown results; owned-order reconciliation; original-attempt recovery; missing orders after ambiguous capture never become “not paid”.
- Expired approvals, invalid state transitions, expired orders, replacement-order creation interruption, cancellation and preserved financial history.
- PayPal capture-response mismatch stays unknown; create failures remain resumable; negative-testing request headers.
- All read response contracts, trace headers, CSV, pagination, demo scenario boundaries, session issue/logout, malformed JSON, missing keys and login/agent rate limiting.
- Audit hash verification and mutation detection; verified/deduped webhooks; bad signatures have no business side effects.
- Real adapter HTTP boundary with stub transport: OAuth and caching, fixed Sandbox endpoint/payee, persisted prices, deterministic PayPal IDs, representation preference, safe error extraction and official webhook verification.
- Actual PostgreSQL: separate connections preserve idempotent responses; concurrent duplicates/reviews/capture claims serialize; fresh connections observe completed state; partial unique index rejects a second open payment; append-only trigger rejects ledger updates.

## Explicitly untested / not claimed

- **No real PayPal Sandbox payment was completed or verified.** No Sandbox app credentials or completed payer session were supplied. Real OAuth/order creation/payer popup/redirect/capture, negative-testing recovery and webhook delivery were not exercised against PayPal. Adapter HTTP tests use stubs; lifecycle tests use FakePayPal. See the separate manual acceptance and `sandbox:verify` procedure in `PAYPAL_INTEGRATION.md`.
- No real AI provider was called. The OpenAI Responses adapter is implemented and tested through stub HTTP. Fixture assessments identify themselves as `fixture`; provider failures require human review.
- Desktop/mobile `scripts/visual-qa.cjs` walkthroughs passed (`errors: none`); representative screenshots were visually inspected. They demonstrate labelled mock flows only. Three new audit event labels were added; components, layout, fonts, CSS and GuardApi are unchanged. Existing narrow mobile ledger text wrapping remains.
- No production endpoint, production credentials, third-party payouts, partner onboarding, refunds, disputes, external fulfillment or unattended agent payment capabilities are implemented.
- No load test, multi-region/multi-tenant test, public HTTPS deployment or public ingress/header configuration validation was performed. The short global advisory lock and in-memory document working set are intentionally a single-organization foundation.
- Very old unknown capture results require manual investigation. They do not allocate new attempts after the conservative replay window or expired policy approval.
- Popup close audit is an optional additive API signal; the existing frontend does not send it. Its current local cancel interaction remains unchanged.

## Reproduce

```bash
pnpm typecheck
pnpm lint
pnpm test
# Set to an existing dedicated disposable PostgreSQL DB; suite creates a unique schema.
APG_POSTGRES_TEST=true TEST_DATABASE_URL=postgresql://localhost/apg_test pnpm test
pnpm build:webpack
# After manually completing a real Sandbox payment with the live frontend:
pnpm sandbox:verify pay_<stored-payment-id>
```

No secrets, access tokens, session cookies, or real payer PII are stored in this report.
