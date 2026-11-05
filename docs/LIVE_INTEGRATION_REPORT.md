# Live integration verification report

## Latest test-card-ready buyer handoff — 2026-11-05T17:06:25.464Z

Owner reports the separate Sandbox buyer now has a test card. Previous order
…681133 was independently PAYER_ACTION_REQUIRED/zero captures at 2026-11-05T17:06:10.505Z;
DB payment attempts/capture IDs absent. Normal expiry retained its original time
and audit prefix (EXPIRED/local VOIDED); no old approval extended or captured.
The existing public webhook callback was rechecked (app 400 unsigned), same-app
registration verified and actual event history empty.

One fresh real USD 18.00 order …764120, request …7W5CQ8,
payment …WZBPZA: actual muse-spark-1.3 score 5, 2803 ms,
eight policy checks passed. Provider GET verifies recipient/IDs/amount/currency.
Create/checkout replays same resources, separate duplicate blocked, one payment,
99-event chain valid. Current PAYER_ACTION_REQUIRED / AWAITING_PAYER,
zero capture attempts. Deadline **2026-11-05T17:36:24.208Z** (Nov 5, 09:36:24.208 PST),
unchanged 30-minute policy. Paused for owner to open the fresh approval URL in
the tested buyer session and click Pay Now using the Sandbox test funding source.
After confirmation: revalidate, protected capture, independent provider/DB/audit/
frontend and terminal repeat, then genuine signed event/resend verification.
NOT READY pending those actual results. Prior 193-test run remains historical;
no source change or new regression run in this handoff. No push/deployment.

## Earlier handoffs — superseded approval deadlines


## Current buyer-ready handoff — 2026-11-05T16:29:53.071Z

Owner confirmed standalone Sandbox login now works. No credentials were requested.
At 2026-11-05T16:29:38.982Z, existing public webhook POST reached the app (400 unsigned), same-app
registration 12968018AN5251707 still matched https://magnificent-sword-adjustable-exchanges.trycloudflare.com/api/v1/webhooks/paypal. Four old stored
payments had no capture IDs/attempts and current app event history was empty. Last
old order GET returned 404 RESOURCE_NOT_FOUND; do not claim this as new capture
absence evidence from PayPal itself. Its known last state was unapproved, internal
approval had expired, and normal app GET applied EXPIRED/local VOIDED with original
expiry retained. Historical records were not reset. Only ignored evidence archived.

Created exactly one newly authorized actual USD 18.00 order …681133, request
…KJ0N52, payment …SNQGZK. Real Meta muse-spark-1.3, score 5,
2433 ms, all eight policy checks pass. Real owned provider GET verifies quote,
USD amount, recipient and order/request references. Request/checkout key replays
return the same resources; duplicate proposal BLOCKED; one fresh payment,
86-event chain verified. Current PAYER_ACTION_REQUIRED / AWAITING_PAYER,
zero capture attempts/IDs. Approval deadline **2026-11-05T16:59:52.140Z**
(November 5, 2026 at 8:59:52 AM PST), unchanged 30-minute policy. Buyer receives the fresh URL and is
asked to open it in the browser where Sandbox login just succeeded, then click
Pay Now for USD 18.00 and confirm. No capture executed before that confirmation.

Callback remains active for genuine delivery. After approval, independently GET
provider and internal authorization, capture only while permitted through the
existing backend (or verify already-captured return flow), then verify PayPal,
DB/audit/frontend and terminal repeat. Inspect original signed receipt and genuine
webhook event/resend/dedupe. No new automated suite was run in this docs-only
handoff; prior 193 passing checks remain historical. **NOT READY until genuine
capture/signed event are verified.** No source/design change, push or deployment.

## Previous runs — superseded approval deadlines


## Latest autonomous setup and buyer handoff — 2026-11-05 UTC

**NOT READY; real HTTPS listener working, paused only for Sandbox buyer approval.**
Baseline 3c33648. This is the local macOS ARM64 workspace with Homebrew, existing
Next app on 127.0.0.1:3100 and actual local PostgreSQL, not a Linux container.
Installed ngrok 3.39.13 and cloudflared 2026.10.7 through Homebrew. No ngrok auth
configuration/environment token existed; actual ngrok start failed ERR_NGROK_4018.
Resolved the HTTPS requirement autonomously with Cloudflare Quick Tunnel, which
requires no account/domain. No ngrok credentials or account login were requested.

Actual callback: **https://magnificent-sword-adjustable-exchanges.trycloudflare.com/api/v1/webhooks/paypal**
Existing Sandbox Webhook ID: **12968018AN5251707**. PATCH and independent GET both
HTTP 200 at 2026-11-05T08:52:35.553Z; previous example hostname replaced, ID and [*] subscriptions
preserved. Today's actual event history query returned 200/zero events before the
fresh transaction, so there was nothing genuine to resend.

Public ingress goes only to scripts/webhook-tunnel-proxy.ts on loopback 3102,
which forwards exact bounded raw bytes and PayPal headers to the existing handler.
Public POST webhook → actual app 400 invalid signature with X-Request-Id; public
GET webhook, /login, /requests and POST /api/v1/session → 404. Console/cookie/agent
credentials are never forwarded. The actual signature check remains enabled.
Successful signed receipts will be retained privately (mode 0600) under ignored
qa/tunnel-live/receipts, with original bytes/base64, hash, signature headers and
app trace. No genuine signed receipt has yet been observed. Stop temporary tunnel
and proxy after capture/webhook verification; keep them during this manual handoff.
Quick Tunnel URL is temporary and changes on restart; never blindly reuse it.

Read-only actual PayPal/DB reconciliation at 08:49:32Z again found the three prior
orders unapproved/uncaptured. All original approvals elapsed. Normal authenticated
GET expired the last old request (EXPIRED/local VOIDED); original expiry, zero
attempts and the audit prefix were preserved. Only local evidence was archived.
No historical financial record was reset, extended or falsely marked paid.

Fresh request …RPXM8V / payment …DB5VNR created actual USD 18.00
Sandbox order …28461L at 2026-11-05T08:54:31.816Z. Actual Meta Standard
muse-spark-1.3 completed score 5, 5094 ms at 2026-11-05T08:54:30.656Z; all eight
policy checks passed. Provider GET verified merchant binding, request correlation,
order, USD and amount. Request/checkout replays retained IDs; duplicate proposal
BLOCKED; exactly one payment for the fresh request; 73-event chain valid.
Current PayPal PAYER_ACTION_REQUIRED, app CHECKOUT_PENDING/AWAITING_PAYER, zero
capture attempts/IDs. Internal approval deadline: **2026-11-05T09:24:30.669Z**
(**November 5, 2026 at 1:24:30 AM PST**), existing unmodified 30-minute policy.

Owner's only required action: open the fresh approval URL supplied in the current
conversation, preferably a private window to avoid the earlier seller session,
log in as a Sandbox Personal buyer, verify USD 18.00 and click final Pay Now.
Then confirm. Do not use a real PayPal account or share a password. No approval
was simulated and no capture was initiated for this fresh request.

After confirmation: independently GET provider/order and internal expiry/state;
use guarded capture only if valid, or verify an already-completed return-handler
capture. Run sandbox:verify, compare DB/audit/frontend, repeat the terminal capture
as a no-op, then prove genuine signed delivery/correlation/acknowledgement and
supported resend/dedupe. No success may be inferred from the public unsigned probe.

Current checks: **193 passed**, no failures/skips, 17 files, six actual PostgreSQL
checks; typecheck/lint/Webpack production build pass. Four new real-socket proxy
checks prove raw bytes/headers, credential stripping, path/method restriction,
64KiB bound and failure non-acknowledgement. Existing desktop/mobile E2E passed
(37 screenshots), explicit fixture AI/intercepted payments. These controlled
results do not establish a genuine capture or signed event. No frontend/payment
logic change, provider replacement, production deployment, push or submission.

## Historical verification — previous tunnel blockers superseded by this setup


## Latest webhook integration review — 2026-11-05 UTC, baseline cbf3642

**Verdict: NOT READY.** Actual capture and genuine signed delivery remain unverified.
Read-only PayPal Orders checks at 07:54:31Z found all three known USD 18.00 orders
PAYER_ACTION_REQUIRED with zero captures. The local DB has no capture IDs or
attempts and a valid 60-event chain; all internal approval deadlines elapsed.
No expired payment was captured, extended, replaced or marked paid. An owner
report of completion is not substituted for provider evidence; another completed
transaction needs its order/capture ID for correlation.

Actual Sandbox Webhooks Management API verified ID **12968018AN5251707** with
these same REST credentials. One registration, subscriptions **[*]**, zero genuine
events for today's queried period. Configured PAYPAL_WEBHOOK_ID privately in
ignored .env.local and restarted the app. Corrected only the missing callback
path on that existing registration: **https://agentpay-guard-example.ngrok-free.app/api/v1/webhooks/paypal**, PATCH 200 + GET 200 at
2026-11-05T08:02:18.720Z, ID/host/subscriptions unchanged. No duplicate registration.

POST reachability returned **404 / ERR_NGROK_3200**, not an application response.
No local ngrok process, executable/config or token was found in the checked paths;
no active tunnel hostname is established. No event ID exists to resend. No genuine
signature success, event-to-payment mapping, HTTP acknowledgement or duplicate
redelivery acceptance can be claimed. The owner was asked for the actual tunnel
address and completed transaction ID; no secrets/passwords were requested.

Targeted P2 correction: missing signature headers/malformed certificate URL could
be misreported as transient verification outage (503). Five new cases failed on
the prior code. They now reject locally with 400/no provider I/O/no state changes.
Six ingress regression cases and seven new controlled reliability cases cover
signed raw-byte preservation, payload distrust, duplicates/replays, out-of-order
terminal protection, unknown transactions, review/block guards and outage retry.
Two old timeout-test transport fixtures gained complete synthetic headers; the
original timeout/unknown-capture protections remain intact.

Final validation: **189 passed**, 16 files, no failures/skips, including six actual
PostgreSQL checks, 20 Meta provider tests and all payment/state/webhook cases.
Typecheck, lint, Webpack production build and existing desktop/mobile E2E passed
(37 screenshots; fixture AI and intercepted payment/SDK boundaries). Live local
unsigned/malformed ingress probes returned 400. No controlled test is counted as
genuine signed Sandbox delivery or capture. No UI redesign/dependency/state-machine
rewrite, push, public deployment or new payment.

See [webhook verification](WEBHOOK_VERIFICATION.md) for exact real evidence,
reproduction, signature/delivery gates and the remaining minimal setup;
[Step 7 handoff](STEP7_HANDOFF.md) is prepared but **does not recommend starting
Step 7 as integration-complete**. Ignored qa/webhook-live retains sanitized logs.

## Historical earlier verification — superseded by the current review above


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


## Current handoff — 2026-11-05T07:07Z continuation from 2e6e420

**NOT READY: genuine new order verified; stopped before manual buyer interaction.**
At 2026-11-05T07:07:07.683Z, actual Sandbox GET for prior order …12980C reported
PAYER_ACTION_REQUIRED, zero captures. Database capture ID was absent and attempts zero;
internal approval expired at 2026-11-05T07:05:51.083Z. It was not payer-approved at this
read. Normal authenticated request GET applied EXPIRED / local VOIDED without any
capture or arbitrary expiry extension. The original 47-event prefix/head remains
intact; one expiry event was appended. Local VOIDED does not claim PayPal voided it.
Its financial/audit records remain in the database; only the ignored evidence
pointer was archived as transaction-expired-RCKPA.json.

Fresh request …TK4JHA / payment …32CEQG
created actual Sandbox order …24282M at 2026-11-05T07:07:54.006Z for USD 18.00.
Real Standard muse-spark-1.3 inference completed 2026-11-05T07:07:52.943Z, score
5/low, 2179 ms, prompt r-3-meta-1; all eight deterministic
policy checks passed. Authenticated provider GET verified stored order/recipient,
reference/custom/invoice IDs, amount and currency. Current state is
PAYER_ACTION_REQUIRED / CHECKOUT_PENDING / AWAITING_PAYER, no capture ID or attempts.
Same-key request/checkout replays returned the same resources; new-key duplicate
was BLOCKED; one payment exists for this fresh request. 60-event audit chain valid.

**Fresh deadline: 2026-11-05T07:37:52.958Z (November 4, 2026 at 11:37:52 PM PST).** The existing 30-minute policy is
unchanged. Use only the new URL supplied in this conversation, log in as a Sandbox
Personal buyer, verify USD 18.00 and click final Pay Now. No approval was simulated
and no fresh capture command was run. Owner confirmation is required before the
agent resumes capture verification. The existing authenticated return handler may
perform its normal guarded capture after genuine payer approval; it is unchanged.

After owner confirmation, independently GET the stored order and revalidate live
internal authorization/expiry/state/quote. Capture through the protected backend
only if eligible. If already captured by the return handler, verify rather than
creating a replacement; terminal repeat must preserve the same capture ID/attempt.
Verify provider COMPLETED + persisted PAID/COMPLETED, USD amount/currency/recipient,
audit chain and actual frontend before claiming payment success. Unknown capture
outcomes retain the original attempt ID for reconciliation; never bypass expiry.

Current regression rerun: **176 passed**, no failures/skips, six actual PostgreSQL
checks; typecheck and lint passed. Payment/provider regression doubles are separate
from actual Meta inference and actual Sandbox creation/GET. Capture, signed webhooks
and frontend paid-state verification remain pending. No UI, backend authorization,
policy, expiry, idempotency or configuration changes. No public exposure/push/deploy.
Ignored qa/paypal-live retains current transaction, prior reconciliation proof and
handoff3-tests.log. Exact executed application command:

```sh
PAYPAL_LIVE_VERIFY=true pnpm exec tsx --env-file=.env.local scripts/verify-live-paypal.ts create
```

## Historical earlier handoffs — superseded deadlines; do not reuse old approval links


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
