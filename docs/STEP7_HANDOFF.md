# Step 7 handoff for Claude Opus 5.5

**Status: preparation only; NOT READY to start Step 7 as integration-complete.**
No Step 7 work was performed. Preserve the existing Ledger Instrument design and GuardApi boundary; read AGENTS.md, DESIGN_SYSTEM.md and FRONTEND_HANDOFF.md before touching UI.

## Verified product flows and limits

- Genuine Meta Model API Standard muse-spark-1.3 inference is integrated. Prior actual normal/unusual/blocked/injection cases passed conservatively; latest real purchase score 5, prompt r-3-meta-1. AI is advisory and cannot relax deterministic policy. Invalid/unavailable AI requires review. No validated fraud-detection accuracy claim.
- Actual policy/review/auth/CSRF, quote validation, API idempotency, persisted audit chain and one-open-payment protections remain. Human reviewer must be authorized, independent and version-matched.
- Actual Sandbox OAuth and three USD 18 orders verified. **No completed capture exists in the currently inspected PayPal orders or local DB.** All three are PAYER_ACTION_REQUIRED/zero captures; approvals elapsed. Earlier owner completion reports are not provider evidence. See WEBHOOK_VERIFICATION.md.
- Webhook ID 12968018AN5251707 verified for current Sandbox credentials and configured locally. Registered URL https://agentpay-guard-example.ngrok-free.app/api/v1/webhooks/paypal has its handler path corrected (PATCH and GET HTTP 200), but the hostname is offline. No genuine event, signed delivery or resend verified. Do not claim a successful payment/webhook demo yet.
- Existing mock mode and fixture scenarios remain labelled: A low risk, B human review, C policy block, D retries/duplicates, E decline/recovery. These controlled paths are regression demonstrations, not real payment evidence. The fixture provider must be explicitly selected; never silently fall back from genuine Meta.

## Routes and operating model

- `/requests`, `/requests/{id}`: persisted proposal, policy trace, model signals, decision and separate policy/payer keys.
- `/review`, `/review/{id}`: authorized reviewer decision; internal approval does not move money.
- `/requests/{id}/checkout`: official PayPal button/redirect fallback.
- `/checkout/return`, `/checkout/cancel`: guarded capture/recovery or abandonment reporting; callback tokens cannot select/prove an order.
- `/payments/{id}`: actual capture evidence, retries/reconciliation. Paid requires verified PAID/COMPLETED and matching capture references.
- `/ledger`, `/policies`: persisted audit and deterministic rules.
- `/login`: local demo credentials; passcodes are private, distinct and server-only.
- API: `/api/v1/purchase-requests`, review/checkout routes, `/payments/{id}/capture`, `/payments/{id}/reconcile`, `/audit-events`, `/audit-events/verify`.
- Public webhook ingress must be **POST /api/v1/webhooks/paypal** only. Local acceptance app: 127.0.0.1:3100. Isolated browser regression: port 3101; never reset the acceptance database.

## Required gate before recommendation

Restore the actual existing development tunnel and completed transaction evidence. Verify the current registration URL against its active handler, then genuine signed delivery/redelivery with accurate persisted financial state. If a new transaction is necessary, require a fresh policy approval and manual Sandbox Personal payer login; never capture expired approvals. Ambiguous capture stays CAPTURING and reuses the original provider ID. Complete the genuine capture and terminal repeat verification before changing readiness.

Regression totals and evidence boundaries: RELEASE_READINESS_UPDATE.md and WEBHOOK_VERIFICATION.md. Remaining operational limits include demo identities/stateless sessions, caller/webhook-driven reconciliation, public ingress not verified, development dependency advisory and absent production operations/load validation. Do not push, deploy, publish or submit without explicit authorization. Secrets stay in ignored .env.local; do not include raw buyer/event PII in handoff artifacts.
