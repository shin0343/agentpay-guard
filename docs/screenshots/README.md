# Frontend evidence · 2026-11-04

These images have different evidence categories. **None proves a genuine PayPal
Sandbox payment or OpenAI inference.** Real-backend views use PostgreSQL and
explicit fixture AI. Fixture payment screens say so on the image. Mock screens
keep the persistent mock banner. Full generated runs remain locally in `qa/`.

| Image | Evidence |
|---|---|
| [Landing](landing-mock-desktop.png) | Explicit offline demonstration; local fictional hero |
| [Allowed request](allowed-live-desktop.png) | Actual Next API/PostgreSQL request; fixture AI; payer key waiting |
| [Review, mobile](review-live-mobile.png) | Actual returned amount/merchant/thresholds; policy approval is separate from payment |
| [Ledger, mobile](ledger-live-mobile.png) | Persisted real-backend audit events, readable labels and request links |
| [Checkout recovery](checkout-unavailable-fixture-desktop.png) | Intercepted SDK failure; reload and redirect recovery, no real payment |
| [Unconfirmed capture](payment-unconfirmed-fixture-desktop.png) | Intercepted unknown outcome; no Paid label or new-payment retry |
| [Declined payment](payment-declined-mock-mobile.png) | Explicitly simulated decline and retry action |
| [Dark / reduced motion](request-dark-fixture-desktop.png) | Intercepted representative request state; no real payment |
| [Before: generic review](before-review-live-mobile.png) | Actual initial live messages repeated “Human review required”; compare returned evidence in final review |
| [Security audit: review](security-review-live-mobile.png) | Re-run against the audit PostgreSQL database; fixture AI; real reviewer route |
| [Security audit: unknown capture](security-unknown-capture-fixture-desktop.png) | Re-run intercepted payment boundary; Confirming with no capture reference or fresh-payment retry; no genuine payment |
| [Integration: AI unavailable](integration-ai-unavailable-desktop.png) | Actual Next/PostgreSQL, OpenAI selected with no API key; eight policy passes still require review; no inference or payment |
| [Integration: unavailable AI review, mobile](integration-ai-unavailable-review-mobile.png) | Corrected failure explanation and separate policy/payer keys; actual backend, no model request or payment |
| [Meta: normal purchase, desktop](meta-recorded-normal-desktop.png) | Actual saved Muse Spark 1.3 score 5 and policy ALLOW; display GETs intercepted and labelled; no payment |
| [Meta: description injection, mobile](meta-recorded-injection-mobile.png) | Actual saved score 82 and prompt-injection review; display GETs intercepted and labelled; no payment |

Desktop: 1440×900. Mobile: 390×844 (mock DPR 2). Additional 375/768/1280 layouts
were verified. See [FRONTEND_QA.md](../FRONTEND_QA.md) for scope and limitations.
The security-audit rerun is documented in [TEST_EVIDENCE.md](../TEST_EVIDENCE.md).
The integration follow-up is documented in [LIVE_INTEGRATION_REPORT.md](../LIVE_INTEGRATION_REPORT.md).
Current genuine Meta inference and recorded-data display boundaries are documented
in [META_MODEL_API_INTEGRATION.md](../META_MODEL_API_INTEGRATION.md).
