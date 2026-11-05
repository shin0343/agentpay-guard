# Test evidence

## Latest buyer-confirmation verification — 2026-11-05T07:15:52.185Z

**NOT READY — PayPal has not confirmed buyer approval; no capture executed.**
After owner reported approval, actual owned-order GET still returned
PAYER_ACTION_REQUIRED. An additional read-only check of all three persisted
Sandbox orders at 07:14:50.945Z found all three PAYER_ACTION_REQUIRED with zero
captures; the two older requests remain EXPIRED/local VOIDED. No different approved
order was found. Final current-order GET at 2026-11-05T07:15:52.185Z confirmed the same.
This records provider observations without claiming why the buyer session failed.

Current order …24282M / payment …32CEQG: USD 18.00,
request CHECKOUT_PENDING, payment AWAITING_PAYER, no capture ID/status/attempts.
At 2026-11-05T07:14:15.274Z, internal ALLOW was valid until 2026-11-05T07:37:52.958Z, trusted quote and
persisted merchant binding verified. Provider order/recipient/correlation/money
checks passed, but the payer-approval prerequisite did not. No capture endpoint,
new attempt, replacement purchase, expiry extension or simulated approval was used.

Independent command executed against actual Sandbox and persisted data:

```sh
pnpm sandbox:verify pay_<current_saved_payment_id>
```

It exited **1**, reporting “Sandbox payment is NOT verified completed.” This is an
expected unpaid-state rejection, not passing capture acceptance. The 60-event
ledger chain remains valid and its head unchanged; no payment events were invented.
Actual desktop/mobile browser checks used real GET responses, no interception:
Waiting for payer, genuine Muse Spark score 5, no Paid, no runtime errors/overflow.
Two screenshots captured; mobile screenshot visually inspected.

Current targeted regression: **54 passed**, three files (backend, security-settlement,
paypal-merchant), including expiry/authorization, concurrent/repeated capture and
unknown timeout protections with controlled payment doubles. No real capture or
real repeated-capture acceptance is claimed. Earlier 176-test/real-PG results are
historical and were not rerun in this docs-only continuation.

Capture/amount/currency persistence as a completed transaction, genuine duplicate-
capture prevention and paid-state UI acceptance remain blocked on actual PayPal
APPROVED with valid internal authorization. After that condition is observed,
use the existing guarded capture route, independent verifier and terminal repeat.
Existing signed webhook acceptance remains unverified; no public deployment,
source/UI/authorization changes, push or secrets committed.

## Earlier handoff history — superseded by the current verification above


2026-11-04 · Baseline `5838bd1` plus the fixes accompanying this report.
Node `v22.15.1`, pnpm `10.32.1`, macOS; local PostgreSQL at `127.0.0.1:55439`.
No genuine PayPal Sandbox transaction or OpenAI inference was executed.

## Executed commands and results

| Check | Observed result |
|---|---|
| Initial `pnpm test` | 105 passed, four opt-in PostgreSQL tests skipped |
| Initial and final `pnpm typecheck` | Exit 0 |
| Initial and final `pnpm lint` | Exit 0; no lint errors/warnings |
| `DATABASE_URL=postgresql://127.0.0.1:55439/apg_security_audit_20261104 pnpm db:migrate` | Exit 0; dedicated disposable audit database migrated |
| Final full Vitest command below | Exit 0; 13 files, 146 passed, zero failed/skipped; five actual PostgreSQL tests |
| `pnpm build` | Failed: Turbopack CSS worker attempted process/port operations prohibited by this environment |
| Escalated `pnpm build` retry | Failed with the same environment restriction; standard build is not recorded as passing |
| Escalated `pnpm build:webpack` | Exit 0; optimized Next 16.4.5 build, all 10 static pages generated and API/dynamic routes built |
| `scripts/frontend-qa.cjs` against production Next/PostgreSQL | Exit 0; real decision flows on desktop/mobile, intercepted payment/SDK boundaries; 37 screenshots |
| `scripts/frontend-accessibility.cjs` | Exit 0; 12 page/viewport WCAG A/AA axe scans, zero reported violations |
| `pnpm audit --prod --json` | Exit 0; zero reported vulnerabilities, 108 dependencies |
| `pnpm audit --json` | Exit 1; one moderate minimatch development-tool advisory; zero high/critical |
| `pnpm why minimatch --prod` / `pnpm why minimatch` | No production path / ESLint and related development graph |
| Redacted history scan | 177 unique tracked text blobs; zero candidates for the tested token/private-key patterns |
| `git diff --check` | Exit 0 |

The first full-test attempt used `pnpm test -- --reporter=json ...`; Vitest ran
successfully but that invocation did not produce the requested JSON artifact.
The final invocation used `pnpm exec vitest` directly, and the resulting JSON was
inspected: `success=true`, 146 passed, zero failed, zero pending, 13 file results.
No missing reporter artifact is claimed as evidence.

```sh
APG_POSTGRES_TEST=true \
TEST_DATABASE_URL=postgresql://127.0.0.1:55439/apg_security_audit_20261104 \
pnpm exec vitest run --reporter=json --outputFile=qa/security/tests.json
```

Actual PostgreSQL tests cover durable records/idempotency/audit immutability,
separate-client duplicate/reservation/review/capture serialization, stored AI
metadata, the second-open-payment database constraint, and unknown-capture
recovery after opening a fresh client. Their PayPal/AI responses remain doubles.
Test schemas are isolated inside the disposable database; no deployed financial
data was modified.

## Required adversarial cases

All entries below passed after corrections. A pass means the named invariant held
under the executed controlled case, not proof of genuine PayPal behavior.

| Attempt | Executed evidence and result |
|---|---|
| Capture a blocked request | Existing backend + security authorization tests: checkout/capture unavailable; no provider creation/capture |
| Capture an unreviewed request | IN_REVIEW checkout blocked; no payment resource can be used to bypass review |
| Self-approve or approve as operator/agent | Reviewer-role, owner and CSRF tests reject; proper reviewer path passes |
| Approve a rejected request | Fresh-version approve after reject fails state check; review remains rejected |
| Change amount after evaluation | No update route; extra money/order fields on strict mutations rejected; stored quote unchanged |
| Reuse another request's order | Injected foreign provider order/request/custom/invoice bindings rejected; arbitrary client identifiers rejected |
| Capture twice | Existing backend integration: terminal repeat returns stored result; one provider side effect |
| Simultaneous captures/checkouts/reviews | In-memory gates and actual PostgreSQL clients serialize claims; one side effect/winning review |
| Replay old approval | Original idempotency snapshot may replay, but cannot change the now-cancelled resource or allow checkout |
| Replay/forge webhook | Invalid signature rejected, signed-ID tampering rejected locally, durable event replay harmless; payload COMPLETED cannot settle a GET-unapproved/uncaptured order |
| Malformed policy inputs | Negative/zero/non-string/exponent money, invalid currency/totals, quantities and nested/extra approval properties fail before PayPal |
| Semantic duplicate evasion | Leading-zero money and split identical rows now block, including a legacy fingerprint |
| Ask model to ignore policy | Injection fixtures across purchase text/metadata and malicious low-risk outputs cannot relax deterministic rules; no payment tools exposed |
| Missing/stale AI output | Missing/invalid results and late completions require review; client assessment/response-ID metadata cannot supply a provider result |
| False success on PayPal failure | Decline, timeout, pending, malformed capture, amount mismatch and contradictory status cases never become Paid |
| Unknown replay rejected | Real 15-second adapter timeout plus generic 409 retains unknown/original ID; 400/403/422/429 failed replays also do not terminalize the earlier capture |
| Lost response followed by provider completion | GET recovery and verified-webhook double recover original capture; replayed webhook causes no new capture/read; fresh PostgreSQL client recovery passes |
| Provider amount/currency/payee/order tampering | Existing parameterized binding tests reject all five classes; settlement does not trust browser/webhook payload claims |
| Demo/environment abuse | Disabled demo routes fail closed; live/non-Sandbox API base and fixture AI outside demo rejected; login and agent limits exercised |
| Audit tampering | Hash verification detects edited event; actual DB update/delete trigger and immutable financial history tests pass |

Test locations: `tests/backend.test.ts`, `tests/paypal-adapter.test.ts`,
`tests/postgres.test.ts`, `tests/ai-risk.test.ts`,
`tests/frontend-integration.test.ts`, `tests/boundary.test.ts`, and six new
`tests/security-*.test.ts` files. The new files add 37 cases to the previous
109-test PostgreSQL-enabled suite.

The stale-assessment hypothesis required replacing a trusted server assessor or
replaying the trusted HTTPS provider transport. It was not demonstrated through
an agent-accessible input. It is documented as a trust/acceptance limit, not a
confirmed remote stale-output vulnerability. Genuine semantic prompt-injection
resilience was not tested against a live model.

## Provider evidence boundaries

| Layer | What actually ran | What it establishes |
|---|---|---|
| Policy/auth/state | Actual GuardHttp, GuardService, schemas and transitions | Enforcement under adversarial inputs |
| Database | Actual local PostgreSQL, migration, multiple clients and constraints | Persistence and tested concurrency/restart behavior |
| PayPal service lifecycle | FakePayPal / controlled provider orders | Business invariants under chosen outcomes |
| Real PayPal adapter | Actual SandboxPayPal with injected HTTP transport, OAuth envelopes, actual 15-second abort timer | Request-ID reuse, timeout handling, response parsing and error classification |
| Webhook cryptography | Locally generated RSA signatures and CRC32 over original JSON; controlled verification endpoint | Raw-event preservation and signed tampering rejection in the local model |
| Browser decision flows | Actual production Next routes, session/CSRF and PostgreSQL; fixture AI | Integrated request/review/block/cancel/audit UX |
| Browser payments/SDK | Explicit API/SDK interception with labelled screenshots | Frontend state/failure/recovery logic only |
| Genuine PayPal Sandbox | **None** | No real order, payer approval, capture, delivery or provider verification established |
| Genuine OpenAI | **None** | No live model quality, account/model availability or provider accuracy established |

The timeout test leaves the controlled original provider work in progress after
the client aborts, returns APPROVED to GET, and rejects the same-ID replay. It
uses no fake timer, persisted-state edit or forced lease expiry. After asserting
unknown/backoff, it changes only the controlled provider observation to a genuine
completion within that model. The test demonstrates recovery correctness, not
that PayPal guarantees any exact race timing or issue string.

## Browser execution and screenshots

The production app ran at `http://127.0.0.1:3100` with the dedicated audit
database, local test-only session secret/private passcodes, `DEMO_MODE=true`,
`RISK_PROVIDER=fixture` and nonfunctional PayPal placeholders. No supplied
credential was changed. The placeholder setup was used only for decision routes;
payment browser tests intercepted the API and SDK deliberately.

```sh
NODE_PATH=<scratch-playwright-node_modules> \
BASE=http://127.0.0.1:3100 QA_PASSCODE=<private-audit-reviewer-passcode> \
node scripts/frontend-qa.cjs qa/security/browser-live

NODE_PATH=<scratch-playwright-node_modules> \
BASE=http://127.0.0.1:3100 QA_PASSCODE=<private-audit-reviewer-passcode> \
QA_AXE_MODULE=<scratch-axe-playwright-module> \
node scripts/frontend-accessibility.cjs qa/security/accessibility
```

Desktop 1440×900 and mobile 390×844 exercised sign-in, proposal, allow/review,
human approve/reject, blocked checkout, replay, duplicate, cancellation/reload,
ledger verification/pagination/filter/CSV, policies and missing-resource recovery.
Blocked ledger checks found zero checkout/payer/payment events. Script assertions
found no unexpected runtime errors or horizontal page overflow.

Intercepted payment cases covered awaiting/approved/unknown/pending/declined/paid,
matching capture evidence, stable SDK lifecycle, same-order funding retry,
SDK unavailable/reload, expiry, resource loading, stale reads, return/cancel
recovery, 375/768/1280 layouts, dark mode and reduced motion. They are not actual
SDK funding or payment acceptance results.

Opened and visually inspected the new mobile real-backend review screenshot and
desktop unknown-capture fixture screenshot. The latter says Confirming, shows no
capture reference and offers status refresh. The existing visual system was
preserved. Representative evidence is committed under
[screenshots](screenshots/README.md); all 37 generated images remain local.

Local ignored artifacts: `qa/security/tests.json`, `build-webpack.log`,
`dependency-audit.json`, `secrets-scan.json`, `browser-live/` (including script
results and screenshots) and `accessibility/axe-results.json`. These paths are
execution artifacts, not files guaranteed to exist in a fresh checkout.

## Exact external verification blockers

Only the repository's `.env.example` was available. No `PAYPAL_CLIENT_ID`,
`PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID`, `PAYPAL_WEBHOOK_ID` or
`OPENAI_API_KEY` was available in the process environment or project-local
configuration. No authenticated Sandbox business/payer account, subscribed
webhook or public HTTPS listener was provided. No genuine order/capture ID exists
for `pnpm sandbox:verify pay_<id>` to inspect. That verification command and
`pnpm risk:verify preq_<id>` were not run against dummy credentials to imply real
acceptance. Secrets outside the project were not searched.

The normal Turbopack target remains unverified in a compatible environment. The
Webpack target did complete. No deployed E2E/CI pipeline exists in the tracked
repository; the available browser scripts above were executed locally.
