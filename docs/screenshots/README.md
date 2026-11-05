# Screenshots

## Step 7 final set · 2026-11-05

Production build, real Next.js API and PostgreSQL (`apg_step7_demo`, a clone of the evidence database).
Desktop 1440×900 and mobile 390×844, both at 2×. No API interception.

| Image | Evidence |
|---|---|
| [Landing](step7-desktop-landing.png) | Hero trace runs locally on fictional data (labelled). Ledger excerpt below the fold is the recorded Sandbox run |
| [Paid](step7-desktop-paid.png) · [mobile](step7-mobile-paid.png) | **Genuine Sandbox payment** `preq_…5CQ8`: Meta score 5, eight rules pass, both keys granted |
| [Payment](step7-desktop-payment.png) | **Genuine** PayPal order `2UE55412FX0764120` and capture `32E66103YN1557633`, one attempt |
| [Allowed](step7-desktop-allowed.png) | Request created through the real agent API during recording; genuine Meta inference (score 12); payer key waiting |
| [Checkout](step7-desktop-checkout.png) | Official PayPal JS SDK button, Sandbox client ID; no order exists until the payer clicks |
| [Human approved](step7-desktop-human-approved.png) · [mobile](step7-mobile-human-approved.png) | Scenario B with genuine Meta inference, approved by the reviewer; key 1 "by M. Okafor", key 2 waiting |
| [Blocked](step7-desktop-blocked.png) · [mobile](step7-mobile-blocked.png) | Scenario C with genuine Meta inference flagging the injection; rules block; `PayPal calls 0` |
| [Ledger](step7-desktop-ledger.png) · [mobile](step7-mobile-ledger.png) | Persisted audit events, chain verified |

## Earlier evidence · 2026-11-04

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
