# Sandbox transaction evidence

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
