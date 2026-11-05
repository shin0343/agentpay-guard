# Live integration verification report

## Latest: expired-order reconciliation and fresh manual-approval handoff

2026-11-05 UTC, continuation from bb293fd. **NOT READY; stopped for buyer approval.**
Actual old-order GET at 2026-11-05T06:32:57.784Z verified PAYER_ACTION_REQUIRED and zero
captures. Its unchanged 06:13:16.207Z expiry was applied through the existing
normal GET path: request EXPIRED, local payment VOIDED. Original 34-event prefix
and head are intact, one expiry event appended; no capture or expiry extension.

Fresh actual Meta muse-spark-1.3 completed at 2026-11-05T06:35:51.068Z, score
8, 3593 ms; all eight rules passed. Real protected checkout created USD 18.00
order …12980C at 2026-11-05T06:35:52.291Z. Provider GET verified recipient,
amount/currency and request/order IDs. Request …P1013A and
payment …JRCKPA are CHECKOUT_PENDING/AWAITING_PAYER, zero captures or
attempts. Duplicate and request/checkout replay checks passed, one fresh payment,
47-event chain valid. Existing 30-minute policy deadline: **2026-11-05T07:05:51.083Z**,
November 4, 2026 at 11:05:51 PM PST. The buyer receives the fresh URL and instructions to use Sandbox
Personal credentials and click Pay Now; capture verification is deferred until
owner confirmation. Existing authenticated return handling remains unchanged.

Current repeated regression: 176/176 tests, six real PG checks, typecheck/lint and
Webpack build passed. Controlled payment/provider tests are separate from genuine
Meta + Sandbox creation/GET. No application source/config/policy/UI change needed.
Actual desktop/mobile old/fresh request checks passed without interception: expired
has no checkout action, fresh shows real model/risk and waiting, neither claims Paid.
Four screenshots captured; desktop-fresh/mobile-expired visually inspected, with
no runtime errors or horizontal overflow.
Actual webhook-list GET HTTP 200 at 2026-11-05T06:33:59.722Z: zero registrations, missing
WEBHOOK_ID and public HTTPS listener. No public exposure, push or deployment.
See current [transaction evidence](SANDBOX_TRANSACTION_EVIDENCE.md) and
[readiness](RELEASE_READINESS_UPDATE.md). Prior results below are historical.

## Historical bb293fd verification — superseded handoff/deadline

Latest verification: 2026-11-05 UTC / 2026-11-04 America/Los_Angeles.
Continuation baseline: cf1adb2269239e90c029b0d33bf351be1db65b21.

**Verdict: NOT READY — real order exists; payer approval/capture pending.**
Corrected credentials obtained genuine Sandbox OAuth HTTP 200 at 05:37:21.034Z.
A genuine USD 18.00 order was created through the application's authenticated
HTTP route at 05:43:17Z, with actual Meta inference and PostgreSQL persistence.
No capture or signed webhook is claimed.

## Merchant configuration correction

Official OAuth client-credentials authentication needs client ID and secret.
Orders v2 create accepts optional payee. PAYPAL_MERCHANT_ID was an application
setup requirement, not a requirement of these single-merchant API operations.
[OAuth](https://developer.paypal.com/reference/get-an-access-token/),
[Orders v2 create](https://developer.paypal.com/api/orders/v2/orders-create).

Configuration now accepts an absent/blank merchant ID. If supplied, it remains
an enforced recipient constraint and explicit payee. If absent, the create body
omits payee and the authenticated response's nonempty merchant ID is durably bound
to the payment. Every later GET, capture result and settlement must match that
binding. Missing legacy bindings require the configured merchant; a later GET
cannot establish a new recipient. Configured recipient drift fails closed.
The internal JSONB field needs no migration and is excluded from public schemas.
API/state-machine docs were amended before code. Authorization, policy, capture
transitions, unknown-timeout handling and idempotency IDs remain unchanged.

## Genuine current flow

Request suffix STDSJ2 / payment suffix 4XRWYS / order suffix 37130M.
The actual provider reported muse-spark-1.3, score 5, low risk, latency 1,918 ms
at 05:43:16.194Z. All eight deterministic checks passed. Request creation replay
returned the same ID; a new-key semantic duplicate was BLOCKED. Checkout replay
returned the same payment. Exactly one payment exists for this request.

Independent authenticated order GET matched the persisted recipient, request
reference/custom/invoice IDs, amount and USD currency. Current provider state:
PAYER_ACTION_REQUIRED; app CHECKOUT_PENDING / AWAITING_PAYER, zero captures or
attempts. Initial verification found a valid 34-event chain. Internal approval
expires at 06:13:16.207Z (22:13 PST on Nov 4). The owner was given the actual
approval URL for a separate Sandbox Personal buyer; no password was requested.
See [transaction evidence](SANDBOX_TRANSACTION_EVIDENCE.md) for the pending action.

Actual configured-app denial checks passed: IN_REVIEW/BLOCKED checkout HTTP 409,
agent capture and missing-CSRF capture HTTP 403, client-selected order HTTP 422.
They produced zero capture attempts. Actual desktop/mobile request and payment
screens used real GET responses with no interception: correct waiting/not-paid
state, separate approval keys, genuine model explanation, no runtime errors or
horizontal overflow. Four screenshots were captured and inspected locally.
The pre-approval capture tool refused without sending capture; the independent
sandbox:verify exited 1 because completion is unverified. No capture success is
claimed. Twelve existing accessibility scans also passed with zero WCAG A/AA
violations on the separate regression instance.

## Regression verification

Typecheck, lint, production Webpack build and **176 tests** passed, zero failed or
skipped, 15 files, including 20 Meta tests and six real PostgreSQL checks. Ten added
checks cover optional configuration/body, persisted recipient binding and
substitution/config-drift/legacy/malformed-recipient rejection. A changed Meta test
now correctly requires the client secret rather than the optional merchant field.
Initial test-driver failures were corrected: attempt field is status, changed
quotes need authorized review, and new PG lifecycle has its own schema to avoid
collisions between fake order IDs. A scratch browser driver was moved outside the
repo after it was included in lint; final lint passed. None of these harness
failures were counted as passing evidence.

Existing desktop/mobile E2E passed on the separate disposable database/port 3101:
real local app/DB, explicitly fixture AI and intercepted payment/SDK boundaries,
37 screenshots. These are regression tests, not genuine payment acceptance.
The actual acceptance instance remains on loopback port 3100 for payer return.
No UI source, authorization, policy, transitions, migrations or dependencies changed.

Commands executed (private connection value replaced):

```sh
pnpm typecheck
pnpm lint
APG_POSTGRES_TEST=true TEST_DATABASE_URL='<disposable-regression-DB>' pnpm test
pnpm build:webpack
PAYPAL_LIVE_VERIFY=true pnpm exec tsx --env-file=.env.local scripts/verify-live-paypal.ts create
PAYPAL_LIVE_VERIFY=true pnpm exec tsx --env-file=.env.local scripts/verify-live-paypal.ts inspect
```

The opt-in acceptance script uses protected HTTP routes, stable operation IDs,
real provider GET and persisted state; it refuses a second create when its local
evidence already exists. capture mode refuses unapproved orders. All acceptance
artifacts are under ignored qa/paypal-live; .env.local stays ignored/owner-readable,
with no secrets or OAuth tokens in committed evidence. Nothing was pushed/deployed.

## Retained Meta acceptance

The preceding cf1adb2 run genuinely completed four final Meta scenarios through
policy/service/PostgreSQL: normal 5/ALLOW, unusual 65/REVIEW, policy-blocked 95/BLOCK
and description injection 82/REVIEW. Real timeouts and invalid evidence failed
conservatively. Its 166-test baseline and recorded-data display checks remain
historical, superseded by the current 176-test run and actual runtime display.
The earlier 04:39:56Z OAuth 401 invalid_client is superseded by the owner's secret
correction and current successful authentication/order creation. It is not a
remaining blocker. Missing PAYPAL_MERCHANT_ID is also no longer a blocker.

PAYPAL_WEBHOOK_ID/public HTTPS listener remain absent; no genuine signature/event
delivery was tested and no service was exposed. Prior scoped historical assessment
found no relevant failed-after-ambiguous records locally; external deployments
still require inventory if they exist. See [readiness](RELEASE_READINESS_UPDATE.md).

## Historical Step 6.5 record (03:41–04:02 UTC)

The following is the earlier `a4311c9` → `19cd3a7` verification, retained for history.
Its missing-key/zero-inference observations are superseded by the Meta evidence above.

### Environment diagnosis

Initial check: `2026-11-05T03:41:33Z`. The working tree was clean at `a4311c9`.
Read the security audit, threat model, test evidence, release blockers, PayPal,
AI and state-machine documentation and inspected runtime, configuration, adapter,
capture/reconciliation, shared schemas and verification scripts before any build.

| Requirement | Observed availability | Smallest remaining action |
|---|---|---|
| Sandbox client ID | Missing from process/project configuration | Set PAYPAL_CLIENT_ID privately |
| Sandbox client secret | Missing | Set PAYPAL_CLIENT_SECRET privately |
| Sandbox business merchant | PAYPAL_MERCHANT_ID missing; account access not supplied | Use a business account and its Sandbox REST app; configure its merchant ID |
| Personal Sandbox payer | No authenticated payer access supplied or verified | Account owner signs in to checkout as a separate personal buyer |
| Webhook | No WEBHOOK_ID, public HTTPS APP_URL or registered listener available | Register the same app's HTTPS listener, set PAYPAL_WEBHOOK_ID and verify genuine delivery |
| AI provider | OPENAI_API_KEY and RISK_PROVIDER missing | Configure RISK_PROVIDER=openai and an account-authorized key/model |
| Database | No supplied DATABASE_URL; existing local PostgreSQL accepts connections | Local isolated verification DB created/migrated successfully; configure the acceptance DB separately |
| Running app | No AgentPay Guard listener initially; port 3000 belonged to another project | Ran this app on loopback port 3100 using the existing build first; unrelated app left untouched |

Only `.env.example` existed, including at the final `04:01:55Z` recheck. No private
configuration values were printed. The account owner was asked to configure
gitignored `.env.local` and perform the payer login; no configuration was available
during the recorded verification. Do not send API secrets or passwords in chat.

Unauthenticated official endpoint probes at `03:44:38Z` returned HTTP 401 from
Sandbox OAuth and OpenAI `/v1/models`. They establish TLS/HTTP reachability only;
no credentials, payment operation or inference were sent. No attempt was made to
extract credentials from unrelated projects, browser profiles or a keychain.

### Executed verification

Created a separate disposable local database, applied the existing migration and
used generated local-only session/agent credentials in ignored files. PayPal
configuration was explicitly nonfunctional; it was never acceptance credentials.
First ran `RISK_PROVIDER=openai` without a key, then explicitly labelled fixture
mode for the existing browser regression suite. No payment was initiated at PayPal.

| Check | Result / evidence boundary |
|---|---|
| Typecheck and lint, final source | Passed |
| Full unit/integration suite | 146 passed, zero failed/skipped, 13 files; five actual PostgreSQL checks |
| Payment state-machine/recovery checks | Passed within that suite, including real 15-second adapter timers with controlled transport and fresh-client PostgreSQL recovery |
| Webpack production builds | Passed for live and explicit mock modes; final build restored live mode |
| Actual Next/PostgreSQL desktop/mobile E2E | Passed; fixture AI and explicitly intercepted payment/SDK boundaries; 37 screenshots |
| Required mock visual A–E walkthrough | Passed, `errors: none`; 24 desktop and 23 mobile screenshots |
| Final accessibility checks | Passed; 12 desktop/mobile axe scans, zero reported WCAG A/AA violations |
| Missing-key application/browser checks | Policy passes → IN_REVIEW; pre-review checkout 409; missing CSRF/agent checkout 403; blocked/semantic duplicate denied; zero public payment rows |
| Human approval separation | After actual reviewer route approval, ALLOWED with no payment; UI explicitly Not paid and payer key waiting |
| Genuine PayPal order / capture / signed delivery | **Not executed** |
| Genuine OpenAI inference | **Not executed**; missing-key diagnostics recorded attempts=0 |

Final unit/integration run began at `2026-11-05T03:53:03.955Z`. Commands executed:

```sh
pnpm typecheck
pnpm lint
APG_POSTGRES_TEST=true TEST_DATABASE_URL='<isolated-local-DB>' \
  pnpm exec vitest run --reporter=json --outputFile=qa/live-integration/regression-tests.json
NEXT_PUBLIC_API_MODE=mock pnpm build:webpack
NEXT_PUBLIC_API_MODE=live pnpm build:webpack
```

The connection value above is redacted; the actual run used the newly migrated
local verification DB. Private runtime settings are deliberately omitted.

`scripts/frontend-qa.cjs`, `scripts/visual-qa.cjs` in both desktop/mobile modes,
and `scripts/frontend-accessibility.cjs` ran with scratch Playwright/axe modules,
loopback BASE and private generated passcodes. The separate `/tmp` browser driver
checked the actual missing-key path; its final evidence timestamp is
`2026-11-05T03:58:40.112Z`. No test dependency was added to the project.

The initial temporary browser driver confused scenario A's fixed-key replay with
a new-key semantic duplicate. It was corrected to use `d_duplicate`; application
policy was unchanged. A temporary CJS driver inside ignored `qa/` also caused one
lint failure; it was moved to `/tmp`, after which final lint and tests passed.
These harness failures are not provider or application success results.

Turbopack's established worker/port restriction was not retried in this step;
the requested acceptable Webpack build path was used. No dependencies were added.
Local artifacts live under ignored `qa/live-integration/`: final test JSON, build
logs, browser results/screenshots, read-only history summaries and reachability
results. They are not guaranteed to exist in a fresh clone.
The verification server was stopped after checks, and generated local-only
credentials were removed. Existing PostgreSQL and the unrelated application were
left running. No supplied project configuration was overwritten.

### Targeted correction

Observed a P2 explanation error: an unavailable assessment correctly required
review, but the trace and focused review said the AI had raised a concern. Both
now say **“Rules passed. AI analysis is unavailable, so a person decides.”** for
noncompleted assessments. Completed assessments retain the existing concern copy.
Strings and the shared selector live in `src/lib/copy.ts`. No layout, styling,
decision computation, authorization or server/payment state transition changed.

The final missing-key browser check asserts this explanation on request/review
screens, checks mobile overflow, and confirms human approval still cannot imply
Paid. Representative screenshots are linked in
[AI verification](AI_INFERENCE_VERIFICATION.md). The entire `src/server/`,
`migrations/`, dependency graph and automated test source remain identical to
`a4311c9`, including the ambiguous-capture correction.

### Historical-state investigation

At `03:43:14Z`, before new tests, inspected the four known project-local databases
in explicit read-only transactions. Provenance was cross-checked at `03:44Z`.

| Database | Schemas inspected | Public payment rows | Test payment rows | FAILED/EXPIRED | CAPTURING/PENDING |
|---|---:|---:|---:|---:|---:|
| apg_frontend_qa | 3 | 0 | 4 | 0 | 0 |
| apg_guard_smoke | 1 | 0 | 0 | 0 | 0 |
| apg_guard_test | 11 | 0 | 20 | 0 | 0 |
| apg_security_audit_20261104 | 6 | 0 | 8 | 0 | 0 |

All 32 payment rows were in generated test schemas and matched `ORDER<n>`,
`CAPTURE<n>`, `DIFFERENTORDER` or `PGRECOVEREDCAPTURE` from the existing tests.
Seventeen were simulated COMPLETED records. There were zero terminal-after-unknown
candidates or malformed completed references. Ten events labelled provider=openai
all used the stub response ID `resp_test001`; they are not live inference evidence.

**Historical P1: NOT APPLICABLE to the inspected local data.** No relevant real
financial history was found. Git had zero remotes and no tracked deployment/CI/IaC
or project deployment metadata was present. That does not prove no deployment
exists elsewhere: no external deployment inventory or financial DB was supplied.
If an earlier deployment is later identified, its history remains unassessed.

For that case: obtain a read-only DB snapshot; select terminal failures/expiries
following unknown attempts/events and malformed completed references; group by
stored order/request/attempt ID; GET each order using its original Sandbox app;
compare merchant, amount, currency and captures; then propose an auditable,
case-specific repair for review. Do not clear claims, resubmit purchases or run
capture automatically. `POST /reconcile` is **not** a read-only historical probe:
it may resend an eligible original capture. No historical states were rewritten.

Next steps and exact acceptance criteria:
[Sandbox evidence/runbook](SANDBOX_TRANSACTION_EVIDENCE.md),
[AI verification/runbook](AI_INFERENCE_VERIFICATION.md),
[readiness update](RELEASE_READINESS_UPDATE.md).
