# Sandbox transaction evidence

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


Latest continuation: 2026-11-05 UTC / November 4, 2026 PST; baseline bb293fd.
**Fresh genuine order verified; stopped before manual buyer approval. NOT READY.**

## Expired first order: read-only reconciliation and normal expiry

At 2026-11-05T06:32:57.784Z, the actual owned Sandbox order 37130M was
PAYER_ACTION_REQUIRED with **zero provider captures**. The database still had
CHECKOUT_PENDING/AWAITING_PAYER because expiry is lazy. Its original approval
expired at 2026-11-05T06:13:16.207Z. No capture API was called.

An authorized normal request GET applied the existing expiry transition:
EXPIRED / local payment VOIDED. This does not claim that PayPal voided the order.
At 2026-11-05T06:34:35.104Z, database capture ID was null and
attempts were zero, original expiry unchanged, all original 34 audit hashes/head
preserved, one request.expired event appended and the 35-event chain verified.
The expired request will not be captured or revived. Financial records remain
in place. Only its ignored local evidence file was archived to
qa/paypal-live/transaction-expired-4XRWYS.json; no database reset or financial rewrite.

## Fresh genuine transaction

| Field | Real observed result |
|---|---|
| Request / payment | …P1013A / …JRCKPA |
| Actual Sandbox order | …12980C, created 2026-11-05T06:35:52.291Z |
| Amount | USD 18.00, matches trusted quote and provider order |
| Deterministic policy | All eight checks passed; internal ALLOW |
| Actual AI | Meta Standard muse-spark-1.3, score 8/low, 3593 ms, assessed 2026-11-05T06:35:51.068Z |
| Prompt | r-3-meta-1 |
| Ownership | Persisted recipient, order, reference/custom/invoice IDs and USD amount verified by actual PayPal GET |
| Approval expiry | **2026-11-05T07:05:51.083Z** / **November 4, 2026 at 11:05:51 PM PST** |
| Approval window | Existing 30-minute default from fresh authorization; no policy/config/expiry extension |
| Provider state | PAYER_ACTION_REQUIRED at 2026-11-05T06:35:52.786Z |
| Persisted state | CHECKOUT_PENDING / AWAITING_PAYER |
| Capture | No ID/status; 0 attempts; NOT verified completed |
| Replay / duplicate | Same request key returned same request; new-key duplicate BLOCKED; checkout replay same payment/order |
| Persistence | One payment for the fresh request; 47-event chain verified |

Two real orders now exist in this local acceptance history: the expired first
order and this fresh order. Neither has a verified capture. Model output is genuine
inference, not a fraud-detection accuracy claim. Fictional Larkspur Data is purchase
context; the receiver is the business owning the Sandbox REST credentials.

## Manual buyer action — current stopping point

Use only the fresh approval URL supplied in the conversation. Log in to the
**Sandbox Personal buyer** account, using its Sandbox email/password, verify
USD 18.00 and click the final **Pay Now** confirmation. The request uses PAY_NOW;
PayPal documents that button for this flow. Do not use a real PayPal login or
share the buyer password. [Official Pay Now semantics](https://developer.paypal.com/api/orders/v2/orders-create).

Finish before November 4, 2026 at 11:05:51 PM PST, then tell the verification lead approval completed.
No approval was simulated and no capture command was invoked for this fresh
order. The local app remains on loopback port 3100. Its existing authenticated
return handler may initiate the same guarded capture after real payer approval;
returning to login is not proof of failure or completion. Report what happened,
then independently verify the authoritative order and persisted state.

Only after owner confirmation: GET the actual owned order, revalidate live internal
approval/quote/state and use the protected application capture route if eligible.
If return handling already completed capture, verify and repeat the terminal
operation as a no-op. If expired, never capture or extend the expired request.
Unknown outcomes remain CAPTURING until reconciled, using the same attempt ID.

Commands executed:

```sh
pnpm typecheck
pnpm lint
APG_POSTGRES_TEST=true TEST_DATABASE_URL='<disposable-regression-DB>' pnpm test
pnpm build:webpack
PAYPAL_LIVE_VERIFY=true pnpm exec tsx --env-file=.env.local scripts/verify-live-paypal.ts create
```

Pending after actual buyer confirmation (NOT executed this continuation):

```sh
PAYPAL_LIVE_VERIFY=true pnpm exec tsx --env-file=.env.local scripts/verify-live-paypal.ts capture
pnpm sandbox:verify pay_<fresh_saved_payment_id>
```

Require provider capture COMPLETED, database PAID/COMPLETED, matching capture ID,
USD 18.00, order/request correlation and recipient, unchanged attempt/capture on
repeat, actual frontend Paid with both keys, and a valid audit chain. A created
order/internal ALLOW/buyer callback alone never establishes payment completion.

## Real versus simulated verification

Current run: **176 automated tests passed**, no failures/skips, 15 files including
six real PostgreSQL checks and 20 controlled Meta-provider regression tests.
Typecheck, lint and production Webpack build passed. These controlled payment/
provider tests cover expiry, authorization, binding, concurrency, duplicate capture
and unknown timeout replay; they are not real Sandbox captures or new live inference.
The fresh request above did execute genuine Meta and genuine Sandbox creation/GET.
Previous browser/accessibility results remain historical regression evidence.

This continuation also ran genuine desktop/mobile request-screen checks without
API interception: expired request shows Expired and no Continue to PayPal; fresh
request shows Waiting for payer and the genuine Muse Spark evaluation; neither
shows Paid. Four screenshots captured; representative desktop-fresh and
mobile-expired screenshots visually inspected. No runtime errors or overflow.

## Actual webhook readiness

At 2026-11-05T06:33:59.722Z, actual Sandbox GET /v1/notifications/webhooks returned
HTTP 200, **0 registered listeners** for this REST app.
PAYPAL_WEBHOOK_ID remains absent; APP_URL is loopback HTTP, no public HTTPS callback.
No registration, tunnel or deployment was performed; genuine signed delivery is
unverified. Minimum remaining setup: authorize a nonproduction reachable HTTPS
listener, register the same Sandbox REST app with the events below, privately set
its returned ID, then verify a real transaction event and genuine redelivery.

## Genuine webhook delivery procedure — not executed

1. Provide an externally reachable HTTPS verification origin/listener, without
   deploying to production. Set APP_URL to that exact origin. If a tunnel is used,
   point it to this app's local port; keep credentials private and do not expose
   another project. No tunnel or public deployment was started in this run.
2. On the **same Sandbox REST app** used to create the order, register
   `https://<verification-origin>/api/v1/webhooks/paypal`. Subscribe to
   CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED/PENDING/DENIED. Put the
   returned subscription ID in PAYPAL_WEBHOOK_ID and restart the app. Confirm
   the registered listener URL, environment and event selection match. Events
   created by another REST app do not validate this subscription.
   [PayPal webhook configuration](https://developer.paypal.com/api/rest/webhooks/).
3. Generate a genuine transaction using this app. Check the genuine event's
   delivery result in the Webhook Events dashboard and a 2xx listener response.
   Acceptance requires the app's PayPal signature postback to succeed; it passes
   the original event JSON and transmission headers with the configured ID to
   `/v1/notifications/verify-webhook-signature`. Then the app GETs its owned order;
   payload status alone cannot set Paid.
4. Match the event's related order to the stored payment/request and actual
   capture. Inspect `webhook.received`, payment evidence and chain verification.
   Save only a redacted event reference, UTC delivery time, verification outcome,
   correct payment mapping and event/attempt counts.
5. Resend the **same genuine event** from PayPal's Webhook Events dashboard.
   Require 2xx, one stored dedupe ID, unchanged capture ID/attempts, and no additional
   charge. Delivery may arrive after synchronous capture; terminal deduplication
   is expected, not another payment transition.

The public URL, subscription ID, signature postback and genuine event delivery
are all currently unverified. PayPal's simulator does not support postback
verification and cannot close this gate. The existing RSA/CRC32 tests are local
doubles only. [Official signature/simulator guidance](https://developer.paypal.com/api/rest/webhooks/rest/).
