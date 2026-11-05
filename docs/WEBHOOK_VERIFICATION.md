# PayPal Sandbox webhook verification

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


Run: 2026-11-05 UTC, baseline cbf3642. **NOT READY: genuine signed delivery unverified.**

## Genuine Sandbox evidence

- OAuth succeeded against the pinned Sandbox endpoint. GET `/v1/notifications/webhooks/12968018AN5251707` returned HTTP 200 at 07:54:57Z using the same configured REST credentials that read the stored orders. This establishes app-scoped access to that registration; no client secret or access token was printed.
- Registered ID: **12968018AN5251707**. Initial callback: **https://agentpay-guard-example.ngrok-free.app**. One registration exists; subscriptions are `*`, covering every supported handler event. No duplicate registration or subscription removal was performed.
- Actual handler: **POST /api/v1/webhooks/paypal**, local **127.0.0.1:3100**. The initial root URL did not target that handler. At 2026-11-05T08:02:18.720Z, PATCH /url returned HTTP 200 and an independent GET returned 200 confirming **https://agentpay-guard-example.ngrok-free.app/api/v1/webhooks/paypal**. ID, hostname and wildcard subscriptions were preserved. No new registration was created. The hostname remains offline.
- POST to the registered hostname with the handler path returned **HTTP 404 / ERR_NGROK_3200** at 07:55:53Z; no application X-Request-Id was returned. This is an unsigned connectivity probe, not a PayPal delivery.
- No running ngrok process or inspector on port 4040; no executable/config found in PATH, standard Homebrew/local/config paths, Downloads or project. No NGROK_AUTHTOKEN/NGROK_DOMAIN available. A current HTTPS tunnel hostname cannot be established from this environment. No unrelated deployment/tunnel was created.
- Configured **PAYPAL_WEBHOOK_ID=12968018AN5251707** privately in ignored `.env.local`, preserved all other settings, retained mode 0600 and restarted the local app. APP_URL remains loopback; there is no invented public origin.
- GET `/v1/notifications/webhooks-events?page_size=100&start_time=2026-11-05T00:00:00Z` returned HTTP 200 with **zero events**. No genuine event ID, delivery status, signature success or resend result exists to report. No simulator request was sent. There was no event to resend.

## Capture premise independently checked

At 07:54:31Z, actual Orders GET and stored recipient/request/order/amount checks found:

| Order suffix | Provider state | Captures | Internal state | Capture attempts |
|---|---|---|---|---|
| 37130M | PAYER_ACTION_REQUIRED | 0 | EXPIRED / local VOIDED | 0 |
| 12980C | PAYER_ACTION_REQUIRED | 0 | EXPIRED / local VOIDED | 0 |
| 24282M | PAYER_ACTION_REQUIRED | 0 | CHECKOUT_PENDING / AWAITING_PAYER; approval expired 07:37:52.958Z | 0 |

All are USD 18.00. DB capture IDs are null; 60-event audit chain valid at that baseline, with no payment/webhook settlement events. **A completed real capture is not established in this environment**, despite the owner's report. A completed transaction on another environment/app needs its order or capture ID for read-only verification. No expired order was captured, extended, replaced or marked paid. No new transaction was created while callback/capture evidence is unresolved.

## Implemented verification and targeted correction

The handler preserves the bounded original UTF-8 JSON body and transmission headers. SandboxPayPal embeds the original body as `webhook_event` in the official verify-webhook-signature postback using the configured ID. Only SUCCESS permits processing; certificate host/path is restricted to Sandbox. Event bodies cannot set financial amount/status: the handler correlates the stored order and reconciles authoritative PayPal state through existing transitions. Event IDs dedupe; no new capture is allocated by an approval event. Unknown capture recovery can resend only its already-authorized original attempt under existing time/policy/lease guards.

Confirmed P2 robustness issue: missing signature headers or malformed certificate URLs could return 503 as if PayPal were unavailable, instead of rejecting invalid input before I/O. Reproduction: remove a required header from a valid-shaped request or set cert URL to `not a URL`; five new negative cases failed before correction. Remediation: require nonblank bounded signature headers and catch invalid URL parsing locally. Result: 400, no provider I/O, no state changes. Six negative regression cases pass after correction; two old transport fixtures now supply complete synthetic headers. No authorization, policy, amount, idempotency or capture transition changed.

## Executed controlled security tests

These results **are not genuine signed Sandbox delivery**:

- Local RSA/SHA256 + CRC32 postback double validates compact, whitespace and Unicode-escape original bytes; tampering is rejected.
- Missing cert/algo/transmission ID/time/signature and malformed cert URL rejected locally; real running local handler probes for missing headers and malformed cert returned 400.
- Validated-event doubles: authoritative order wins over forged payload status/money; pending capture settles once; duplicate/replay is a no-op; out-of-order pending/denied cannot downgrade completed; unknown transaction is deduped without provider/order side effects; review/blocked proposals cannot be paid through a webhook.
- Transient order read failure returns 503 without storing dedupe success; retry can settle. Existing capture-timeout/concurrency tests preserve unknown outcomes and original IDs; no fresh charge attempt from ambiguous replay.
- Known limitation: ignored unknown/denied-terminal events store dedupe IDs without a separate webhook audit entry. Matched actionable events append webhook.received; genuine event/audit mapping is still unverified.

## Remaining minimum actions and reproduction

The owner was asked for the actual running tunnel HTTPS address and completed transaction ID, not passwords/tokens. Once available, the agent can finish autonomously:

1. Establish the existing authorized development tunnel to this app, restricting public ingress to the webhook path; keep administrative/session routes private. Confirm no redirect and that an unsigned probe reaches the app and returns 400.
2. PATCH **the existing ID** `/v1/notifications/webhooks/12968018AN5251707`, replacing `/url` with `https://<actual-tunnel>/api/v1/webhooks/paypal`; preserve the existing event subscriptions and other registrations. If the active hostname differs from the currently configured host, replace only that URL after validating reachability. The missing handler path on the existing hostname was already corrected; no new hostname was invented. Current `*` covers CHECKOUT.ORDER.APPROVED and PAYMENT.CAPTURE.COMPLETED/PENDING/DENIED; no new reversal handler is implemented.
3. Re-read the actual completed order/capture and DB. Query genuine event history; reuse a suitable event with POST `/v1/notifications/webhooks-events/<event_id>/resend` and body `{"webhook_ids":["12968018AN5251707"]}`. A 202 resend acceptance alone does not prove delivery. Pending notifications may not resend.
4. Require genuine POST receipt, original signed bytes/headers, successful PayPal postback, correct stored order/capture mapping, HTTP 2xx, dedupe row and audit evidence. Redeliver the same genuine event; capture ID/attempts/money stay unchanged. Independently GET-verify financial state.
5. Only if no suitable genuine event exists and the listener works, create a fresh authorized test request. Stop for the unavoidable Sandbox Personal buyer approval; after confirmation capture through the protected backend only while approval is valid. Never treat a simulator event as this proof.

Executed commands: `pnpm typecheck`, `pnpm lint`, `APG_POSTGRES_TEST=true TEST_DATABASE_URL='<disposable-regression-DB>' pnpm test`, `pnpm build:webpack`; existing `scripts/frontend-qa.cjs` on isolated port 3101 with fixture AI/intercepted payment boundaries. Final counts/results are in RELEASE_READINESS_UPDATE.md. Ignored qa/webhook-live holds sanitized local evidence/logs; raw management JSON may contain event data and is never committed.

Official references: [raw-body and postback verification](https://developer.paypal.com/api/rest/webhooks/rest/), [event history](https://developer.paypal.com/api/webhooks/v1/webhooks-events-list), [resend](https://developer.paypal.com/api/webhooks/v1/webhooks-events-resend), [update registration](https://developer.paypal.com/api/webhooks/v1/webhooks-update). Checked 2026-11-05 UTC.
