# Genuine PayPal Sandbox webhook verification

2026-11-05 UTC. **Original signed delivery and genuine supported redelivery VERIFIED.**
No simulator events were used for this acceptance.

## Registration and secure transport

Webhook ID **12968018AN5251707** was GET-verified using the same Sandbox REST
credentials that own the order. Existing registration was PATCHed, never duplicated;
subscriptions **[*]** preserved. Last verified callback:
**https://magnificent-sword-adjustable-exchanges.trycloudflare.com/api/v1/webhooks/paypal**.

ngrok 3.39.13 was installed but requires absent account authentication
(ERR_NGROK_4018). cloudflared 2026.10.7 provided a real account-free development
Quick Tunnel. It forwarded only to scripts/webhook-tunnel-proxy.ts on loopback
3102, then the existing app on 3100. Public POST exact webhook path reached the
signature gate (400 unsigned); GET webhook, /login, /requests and POST /session
were 404. Cookies/Authorization/proxy identity are stripped. Raw bounded body and
all required PayPal signature headers are forwarded unchanged. Admin routes were
never exposed. PAYPAL_WEBHOOK_ID was configured privately, ignored mode 0600.

Tunnel and proxy were deliberately stopped at **2026-11-05T17:13:14.404Z** after acceptance.
The recorded URL is historical and will be offline; it is not a production endpoint.

## Genuine event and transmission evidence

| Type | Genuine event ID | Original accepted | Supported resend accepted |
|---|---|---|---|
| CHECKOUT.ORDER.APPROVED | WH-3L457725DB258725S-9D926970GM508220C | 17:07:29.208Z | 17:10:48.948Z |
| PAYMENT.CAPTURE.COMPLETED | WH-4FB93280BR311460T-8A339730AG632664K | 17:08:13.194Z | 17:09:49.213Z |

Both relate to order **2UE55412FX0764120**; completion identifies capture
**32E66103YN1557633**, USD 18.00. Original completion was generated at
17:07:55.590Z. Individual event details GET returned 200 with matching type; the
supported resend API returned 202 for each original event and actual re-delivery
was then observed. A 202 alone was not counted as proof of delivery.

All **four receipts** have original body hash match, required transmission headers,
app HTTP **200** and **independent real PayPal postback SUCCESS** using the correct
registered ID and original bytes. Distinct original/resend transmission IDs were
retained privately. First delivery traces:

- Approval: req_01M6PAW1T5FWX4GYFQ50VF0DAK.
- Completion: req_01M6PAXCTN45Q9V2J3EDVDJYVS.

Each first trace matches its webhook.received audit correlation ID and correct
payment. Both event IDs have one durable dedupe row and one audit event. Replayed
completion/older approval produced no new event audit entry, capture, attempt or
downgrade. Final 106-event chain verified and payment record remained unchanged.

## Authenticity and negative checks

The existing handler preserves original bounded UTF-8 JSON; SandboxPayPal embeds
that original value in the documented verify-webhook-signature postback. It passes
transmission ID/time/signature, auth algorithm, restricted Sandbox certificate URL
and configured webhook ID. Only SUCCESS permits processing. Event status/amount
are untrusted; known owned-order reconciliation uses PayPal and central transitions.
Approval event itself never starts a fresh capture. Existing unknown-attempt recovery
retains the original authorized request ID and policy/lease guards.

Against the real public ingress and real PayPal verifier, independently modifying
(1) signature or (2) signed event ID returned **400 VALIDATION_FAILED**; missing
headers also returned 400. No events or payment mutations resulted. These are
controlled negatives using a genuine receipt, not simulated positive acceptance.
The original two valid events and two real PayPal resends are the positive proof.

Controlled automated coverage additionally tests valid raw compact/whitespace/
Unicode byte preservation, unknown transaction safety, policy block/review guards,
out-of-order distinct pending/denied events, transient failure without premature
dedupe, concurrent capture/reconcile and conservative unknown-timeout replay.
Those cases were not all induced as natural PayPal failures. Genuine older approval
redelivery after completion specifically proved duplicate/out-of-order replay safety.

## Reproduction without secrets

1. Start local app with ignored Sandbox/Meta/DB/private operator configuration and
   PAYPAL_WEBHOOK_ID=12968018AN5251707. Keep APP_URL at the actual app origin.
2. Start restricted ingress and temporary tunnel (no background login service):

```sh
pnpm exec tsx scripts/webhook-tunnel-proxy.ts
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3102 --protocol http2
```

3. Use the **actual printed URL** plus /api/v1/webhooks/paypal; confirm public
   unsigned POST returns application 400 and administrative paths return 404.
   PATCH /v1/notifications/webhooks/12968018AN5251707 replacing only /url;
   preserve subscriptions, then independent GET. Do not reuse the stopped URL.
4. Prefer existing genuine events: GET /v1/notifications/webhooks-events/<id> and
   POST /v1/notifications/webhooks-events/<id>/resend with
   {"webhook_ids":["12968018AN5251707"]}. Reusing these completed-payment events
   cannot create a fresh purchase/capture; terminal handling dedupes.
5. Inspect protected ignored receipts, re-run SandboxPayPal.verify on exact bytes/
   headers, compare dedupe/audit/order/capture and independent provider state.
   Verify genuine second transmission and unchanged payment/attempt count.
6. Stop only the temporary tunnel/proxy afterward. Never expose session/admin
   paths, publish passcodes, bypass verification or write raw receipts to Git.

Final regression: **193 pass**, six actual PG checks; typecheck/lint/Webpack build
pass. Four actual Paid desktop/mobile checks pass. Earlier full same-code browser
E2E is fixture-labelled. No payment/state-machine or frontend change was needed
for this successful acceptance.

Limitations: ephemeral tunnel is not managed deployment; no provider-held PENDING,
real funding decline or induced network ambiguity tested in this transaction.
Unknown/denied-terminal events retain dedupe IDs without a separate ignore-audit
entry. No general fraud accuracy, production IAM, scale or production-payments
readiness claim. See RELEASE_READINESS_UPDATE.md.

Official references checked: [raw body/postback](https://developer.paypal.com/api/rest/webhooks/rest/),
[event details](https://developer.paypal.com/api/webhooks/v1/),
[resend](https://developer.paypal.com/api/webhooks/v1/webhooks-events-resend),
[registration update](https://developer.paypal.com/api/webhooks/v1/webhooks-update).
