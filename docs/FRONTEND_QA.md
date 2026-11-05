# Frontend QA

Current integration update (2026-11-05T17:12Z): genuine Meta, USD 18.00 completed capture, original signed approval/completion webhooks, supported provider resends and actual desktop/mobile Paid UI are VERIFIED. Verdict READY WITH DISCLOSED LIMITATIONS for the controlled local Sandbox workflow; see RELEASE_READINESS_UPDATE.md and SANDBOX_TRANSACTION_EVIDENCE.md. The original audit/QA findings and historical NOT READY verdict below retain their original dated scope.

2026-11-04 · Integration and UX verification. Final observations and evidence
boundaries are recorded below.

## Evidence boundaries

- Real backend: Next route handlers, shared Zod contracts, session/CSRF,
  deterministic policy, reviews and PostgreSQL persistence.
- AI: explicit fixture assessments or unavailable-provider behavior. No genuine
  OpenAI inference is claimed without credentials.
- Payments: actual backend lifecycle with FakePayPal in automated integration
  tests; explicitly intercepted HTTP/SDK states in browser tests; labelled offline
  mock scenarios. None establishes a genuine PayPal Sandbox transaction.
- No server authorization, policy engine, payment transitions or existing PayPal
  credentials were changed.

## Initial findings

| Priority | Finding | Resolution / verification |
|---|---|---|
| P1 | Default adapter was mock despite implemented backend | Live default; explicit mock build retained |
| P1 | Ledger requested limit=200, exceeding contract maximum=100 | 100 plus cursor pagination |
| P1 | Query hook retained data from a different resource key | Key-bound results, late-response invalidation, no overlapping read starvation |
| P1 | Live mutations did not refresh request keys or ledger | Adapter notifications plus external-state polling |
| P1 | Payment page read its request once; reconciliation timer reset on each render | Poll both resources; stable timer and manual check |
| P1 | SDK failure lacked recovery; request refresh could destroy active checkout | Stable lifecycle, shared loader, reload and redirect fallback |
| P1 | Return/cancel copy treated redirect parameters as payer/settlement evidence | Neutral verification copy, stored-payment reads, sign-in recovery |
| P1 | Paid result relied on payment status alone | Both resources and capture evidence must agree |
| P2 | Human review auto-advanced, hiding the next checkout step | Explicit next navigation and actual TwoKey state |
| P2 | Mobile ledger exposed technical identifiers in a narrow column | Human event label, request link and stacked evidence |
| P2 | Fixture AI in live mode could look like genuine inference | Visible simulated-AI label |

Baseline screenshot walkthrough: `qa/frontend-before/desktop-*.png` (24 states,
`errors: none`). Representative request and review screenshots were opened and
visually inspected before refinement.

## Final verification

Status: **DONE_WITH_CONCERNS**. The frontend integration is delivered; genuine
external-provider acceptance is still required before a technical launch.

| Check | Result / scope |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass, zero warnings |
| Full Vitest suite with opt-in PostgreSQL | 109/109 passed, including four actual PostgreSQL tests and five new frontend/route integration tests |
| `NEXT_PUBLIC_API_MODE=live pnpm build:webpack` | Pass, optimized production build |
| `NEXT_PUBLIC_API_MODE=mock pnpm build:webpack` | Pass, explicitly simulated production build |
| `scripts/visual-qa.cjs`, desktop 1440×900 | A–E pass; 24 screenshots; `errors: none` |
| `scripts/visual-qa.cjs`, mobile 390×844, DPR 2 | A–E pass; 23 screenshots; `errors: none` |
| `scripts/frontend-qa.cjs` | Real Next/PostgreSQL decision flows plus explicitly intercepted payment boundaries, desktop and mobile |
| `scripts/frontend-accessibility.cjs` | 12 live page/viewport scans using axe WCAG A/AA rules; zero violations after fixing the loading region's missing role |

The standard Turbopack build has a previously documented local worker-port sandbox
limitation (`DEMO_VERIFICATION.md`). Webpack builds were used without changing the
project's default build command or CI.

### Real backend browser coverage

Used a separate migrated database, `apg_frontend_qa`, and test-only local session
configuration. Risk was explicitly `fixture`. PayPal configuration contained
nonfunctional placeholders solely to start non-payment backend routes. No supplied
credentials were modified, no real payer was used and no external payment was made.

Desktop and mobile both exercised sign-in, request creation through the demo agent
route, ALLOWED with payer approval still waiting, human review/approval/rejection,
blocked checkout, idempotent replay, semantic duplicate detection, cancellation,
reload persistence, ledger chain verification, pagination, event filters, CSV export,
policies and missing-resource recovery. Blocked-request ledger checks found zero
checkout, payer or payment events. Every live response traversed GuardApi and the
shared Zod contracts. No application runtime/hydration errors were observed.
Expected missing-resource responses were kept separate from runtime errors.

### Payment and failure coverage

The new HTTP adapter tests call the actual GuardHttp handlers and service with
FakePayPal. They verify CSRF, If-Match, idempotency, no PayPal for blocked requests,
no capture before payer approval, same-order funding-decline recovery, persisted
audit events, pagination and capture/reference agreement before Paid.

Browser boundary tests deliberately intercept API/SDK responses and label their
screenshots **QA boundary fixture**. They verify:

- Creating an order never captures or displays Paid.
- Request polling leaves an active SDK button/payer interaction intact.
- A known funding decline invokes `actions.restart()` on the same order; the next
  verified fixture capture can render Paid.
- APPROVED is distinct from PAID and provides a protected Confirm payment action.
- Unknown captures and pending captures remain unconfirmed; no fresh-payment retry
  is offered. Stable reconciliation runs despite payment polling.
- A COMPLETED payment with a still-pending purchase request cannot display Paid.
- SDK load failure offers reload and full-page checkout; reload recovers.
- Return/cancel use the stored payment; return parameters alone do not prove approval.
  Session expiry preserves the payment reference through sign-in. Payer closure is
  audited without asserting settlement.
- Expired policy approval removes payer controls.
- Interrupted reads retain the last confirmed state and expose recovery.
- Different payment references show loading instead of the prior payment's result.
- 375px, 768px and 1280px request layouts have no horizontal page overflow.
  A representative dark/reduced-motion request state was also inspected.

These tests establish frontend behavior and server invariants under controlled
inputs. They do **not** establish a genuine Sandbox transaction, live AI inference,
actual PayPal SDK funding recovery, webhook delivery or provider semantic accuracy.

## Screenshots

Full runs are retained locally under `qa/frontend-before/`,
`qa/frontend-final-mock/` and `qa/frontend-live/` (ignored generated artifacts).
Representative screenshots are committed under [screenshots](screenshots/README.md).
Landing, request detail, review, checkout, payment failure/result, ledger, expanded
ledger, policies and sign-in were visually inspected. Payment fixtures are labelled
on the image; mock screens keep the persistent mock banner.

## Reproduce

Use a disposable migrated database and local test-only session/passcode setup.
Keep actual provider secrets server-only. Playwright and axe are intentionally
scratch-installed tools, matching the existing visual QA convention.

```bash
pnpm typecheck
pnpm lint
APG_POSTGRES_TEST=true TEST_DATABASE_URL=postgresql://localhost:55439/apg_frontend_qa pnpm test
NEXT_PUBLIC_API_MODE=live pnpm build:webpack
pnpm start -p 3100
# Supply the configured reviewer passcode via QA_PASSCODE, never in a report.
NODE_PATH=<scratch-node_modules> QA_PASSCODE=<private-passcode> node scripts/frontend-qa.cjs qa/frontend-live
NODE_PATH=<scratch-node_modules> QA_AXE_MODULE=<axe-playwright-path> QA_PASSCODE=<private-passcode> node scripts/frontend-accessibility.cjs qa/frontend-accessibility
# Offline demonstration needs a separate mock build:
NEXT_PUBLIC_API_MODE=mock pnpm build:webpack
pnpm start -p 3100
NODE_PATH=<scratch-node_modules> MODE=desktop node scripts/visual-qa.cjs qa/frontend-final-mock
NODE_PATH=<scratch-node_modules> MODE=mobile node scripts/visual-qa.cjs qa/frontend-final-mock
```

## Remaining issues, prioritized

### Design

- **P2:** Manual VoiceOver/screen-reader acceptance, actual 200% browser zoom and
  full dark-mode coverage across all routes remain unverified. Automated axe and
  keyboard checks are useful but do not replace those checks.
- **P3:** Some legacy labels remain inline rather than in copy.ts; no localization
  system is present. New state/recovery vocabulary is centralized.

### Integration

- **P1:** Complete genuine PayPal Sandbox acceptance with a configured business app
  and separate personal payer: popup, redirect, cancel, capture, funding decline /
  `actions.restart()`, pending settlement and webhook reconciliation. Preserve
  actual order/capture IDs and run `pnpm sandbox:verify`.
- **P1:** Run the existing real OpenAI probe and inspect genuine model metadata,
  evidence, unavailable-provider recovery and latency with account credentials.
- **P2:** Run the standard Turbopack build in the target CI/deployment environment;
  the local sandbox required the documented Webpack alternative.

### Backend

- **P2:** Backend rule messages and audit summaries are often generic. The UI now
  exposes returned observed values, thresholds and persisted decision/risk detail;
  backend-authored concise explanations would improve consistency for other clients.
- **P2:** The existing single-organization PostgreSQL store loads full documents
  under a shared advisory lock. High-volume/multi-tenant use and load testing remain
  outside the implemented foundation; the audit head is not externally anchored.
- **P2:** Live risk semantic accuracy, false positives and injection coverage need a
  dedicated evaluation dataset/run. Fixture/stub tests do not establish accuracy.

## Design constitution checklist

- [x] One primary action per active view; official PayPal button preserved.
- [x] No component hex colors; existing Ledger Instrument tokens retained.
- [x] Color encodes a decision/payment state and has a visible word.
- [x] Concise canonical state/recovery copy; long evidence stays in trace/disclosures.
- [x] Policy approval and Payer approval stay separate and visible together.
- [x] Paid requires PAID plus matching payment/capture evidence on the result.
- [x] Signature motion retained, delays capped and reduced motion respected.
- [x] Visible keyboard focus and tested keyboard confirmation; axe contrast rules checked.
- [x] 375px, 768px, 1280px inspected with no page overflow.
- [x] No dashboard KPI tiles, gradients, decorative charts or visual/architecture rewrite.

No comparable numeric before/after launch score is claimed: the original baseline
was mock-only, while this work adds real-route and persistence verification. All
observed frontend blockers were fixed; the unverified external acceptance items
above remain explicit launch concerns.

Browser tooling: Chromium through the project's scratch-installed Playwright
workflow. The installed gstack package did not include a runnable browse binary;
the project visual script and additional explicit browser scripts supplied the
same user-flow/screenshot checks. Nine representative PNGs are committed, including
before/after live review evidence. The final live run captured 37 states.
