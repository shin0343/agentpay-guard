# Live integration report

2026-11-05 UTC. **READY WITH DISCLOSED LIMITATIONS** for the controlled local
Sandbox/hackathon workflow. Genuine Meta, completed capture, signed original
webhooks and supported redeliveries are now verified. Prior NOT READY statements
were correct for their times and are superseded, not retroactively converted to
passes. Product code verified: 9ddace48c0b055934426063c86b75dc3cc5602ef; current continuation baseline a7386da.

Actual path: real Meta muse-spark-1.3 score 5 → eight policy passes → internal
ALLOW → actual Sandbox order → separate Personal buyer/test-card approval →
PayPal APPROVED → normal operator/CSRF-protected backend capture before expiry →
provider capture COMPLETED → persisted PAID/COMPLETED → actual Paid UI.
Order 2UE55412FX0764120, capture 32E66103YN1557633, USD 18.00.
Read-only sandbox:verify exited 0 at 17:08:04.345Z. Repeated capture kept same ID,
one attempt and one provider capture; no new charge or transaction.

Actual HTTPS callback https://magnificent-sword-adjustable-exchanges.trycloudflare.com/api/v1/webhooks/paypal used a webhook-only loopback proxy, not public
console access. Existing registration 12968018AN5251707 was verified and updated,
wildcard subscriptions preserved. Actual approved/completed events were received,
HTTP 200, raw bodies/headers preserved privately. Four original/resend receipts
independently returned real PayPal signature postback SUCCESS. Each original
ID maps to one DB dedupe/audit entry, correct order/capture and trace. Official
resend returned 202 then genuine second delivery was confirmed. Tampered signature,
tampered event ID and missing headers returned 400 without state change.

Final audit chain: 106 events, valid; payment unchanged after redelivery,
one payment.completed event, two distinct webhook.received events. Actual desktop/
mobile request/payment views show Paid, capture reference, both keys granted,
no interception/runtime error/overflow. Four screenshots retained; two inspected.

Final commands: pnpm typecheck; pnpm lint; APG_POSTGRES_TEST=true with the separate
disposable TEST_DATABASE_URL pnpm test; pnpm build:webpack. **193 passed**, zero
failed/skipped, 17 files, six actual PostgreSQL checks. Earlier full same-code
E2E passed 37 screenshots using explicit fixture AI/intercepted payments; actual
Paid checks now close real display acceptance. Controlled failure tests remain
separate from genuine transaction evidence. No source/UI/payment redesign needed
in this completion run. No push, production deployment, publish or submission.

Temporary tunnel/proxy stopped at 2026-11-05T17:13:14.404Z; local app/DB remain. Next demo
must start a new restricted tunnel and update the same registration to its actual
URL. ngrok is installed but lacks its account token; Cloudflare's account-free
Quick Tunnel worked and requires no owner configuration.

See SANDBOX_TRANSACTION_EVIDENCE.md for transaction/timeline/commands,
WEBHOOK_VERIFICATION.md for signatures/events/redelivery, RELEASE_READINESS_UPDATE.md
for scope/remaining limitations and STEP7_HANDOFF.md for Opus continuation.
