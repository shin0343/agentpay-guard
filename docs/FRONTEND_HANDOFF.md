# Frontend Handoff

Status: frontend **complete in mock mode** (2026-11-03). Backend foundation and Sandbox REST adapter are now implemented; see `PAYPAL_INTEGRATION.md` and `TEST_REPORT.md`. The real OpenAI provider is now implemented; live inference and real payer checkout remain unverified. See `AI_RISK_ENGINE.md` and `DEMO_VERIFICATION.md`. Existing frontend components are unchanged.
Read first: `AGENTS.md` (binding rules), `DESIGN_SYSTEM.md` (constitution), `API_CONTRACT.md`, `PAYMENT_STATE_MACHINE.md`.

---

## 1. Run it

```bash
pnpm install
pnpm dev                      # http://localhost:3000 (mock mode by default)
pnpm check                    # typecheck + lint + tests + production build
```

| Env | Values | Effect |
|---|---|---|
| `NEXT_PUBLIC_API_MODE` | `mock` (default) / `live` | Selects the data adapter. No UI code changes between modes. |

Mock passcodes: `reviewer` (M. Okafor) and `operator` (S. Lindqvist). In mock mode you are signed in as the reviewer by default, and the user menu can switch roles.

Toolchain note: TypeScript is pinned to **6.0.x** because typescript-eslint does not yet support TS 7.

## 2. Architecture: one boundary

```
 UI (pages + components)                                     ← design-owned, do not rewrite
   │   uses only: getApi() + useQuery()  (src/lib/hooks.ts)
   ▼
 GuardApi interface  (src/lib/api/types.ts)                  ← THE integration boundary
   ├─ mock adapter  (src/lib/api/mock/*)   in-browser engine, no network
   └─ http adapter  (src/lib/api/http/http-adapter.ts)       fetch /api/v1/*, Zod-parses every response
                                    │
                                    ▼
                    /api/v1 route handlers  (src/app/api/v1/**)   ← backend owner (Codex) implements
                    shapes from src/contract/*  (Zod, shared)
```

Rules:
- Components never call `fetch` and never import from `src/lib/api/mock/*`. The landing hero is the one sanctioned exception: it runs a private `MockEngine` locally for its offline demo.
- Every request and response shape comes from `src/contract/*.ts`, which is a verbatim copy of `API_CONTRACT.md §1`.
- Errors surface as `ApiError` (`code`, `status`, `retryable`, `details`), which mirrors the contract's error envelope.

## 3. Route and component map

| Route | File | Purpose | Primary action |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Landing with a runnable hero trace (`components/landing/hero-trace.tsx`) | Open the workspace |
| `/login` | `src/app/login/page.tsx` | Passcode sign-in | Sign in |
| `/requests`, `/requests/[id]` | `src/app/(console)/requests/*` (layout = queue + detail) | Workspace and request detail | Status-dependent (`RequestActions`) |
| `/review`, `/review/[id]` | `src/app/(console)/review/*`, `components/guard/review-focus.tsx` | Review queue and focused review | Approve purchase (`a`), Reject (`r`) |
| `/requests/[id]/checkout` | `src/app/(console)/requests/[id]/checkout/page.tsx` | Two keys plus PayPal handoff (`components/guard/paypal-zone.tsx`) | PayPal button (live) / Open PayPal (simulated) |
| `/payments/[id]` | `src/app/(console)/payments/[id]/page.tsx` | Paid / Not paid / Pending / Confirming | Try payment again (when retryable) |
| `/ledger` | `src/app/(console)/ledger/page.tsx` | Search, filter, expand, verify chain, export CSV | Search |
| `/policies` | `src/app/(console)/policies/page.tsx` | Read-only rules and the AI boundary | — |
| `/checkout/return`, `/checkout/cancel` | `src/app/checkout/*` | PayPal redirect fallback targets | — |

| Component | File | Notes |
|---|---|---|
| `VerdictMark`, `TwoKey` | `components/guard/verdict.tsx` | Signature pieces. Never merge the two keys. |
| `DecisionTrace`, `RiskMeter` | `components/guard/trace.tsx` | `animate` only when an evaluation *arrives*. `compact` is used for the hero. |
| `RequestQueue` | `components/guard/queue.tsx` | `j`/`k`/`/` shortcuts. Filter chips. One-sentence summary (no KPI tiles). |
| `RequestDetail` | `components/guard/request-detail.tsx` | Header → verdict → keys + action → trace → agent quote → ledger. |
| `RequestActions` | `components/guard/request-parts.tsx` | Maps `next_actions` to the single primary button. |
| `PayPalZone` | `components/guard/paypal-zone.tsx` | Mock: simulated payer window. Live: official JS SDK button, unmodified. |
| `ScenarioSheet` | `components/shell/scenario-sheet.tsx` | "Send test request": fires scenarios A–E. |
| UI primitives | `components/ui/primitives.tsx`, `icon.tsx` | Button, StatusLabel, IdTag, Notice, Dialog/Sheet (native `<dialog>`), fields. |

## 4. What the backend must provide (to switch to `live`)

Implement these in `src/app/api/v1/**/route.ts`, importing schemas from `src/contract`:

| `GuardApi` method | Endpoint | Contract § |
|---|---|---|
| `getSession` / `signIn` / `signOut` | `GET/POST/DELETE /session` | 2.13 |
| `listPurchaseRequests` | `GET /purchase-requests` (must include `summary`) | 2.3 |
| `getPurchaseRequest` | `GET /purchase-requests/{id}` | 2.2 |
| `submitReview` | `POST /purchase-requests/{id}/reviews` + `If-Match` | 2.4 |
| `startCheckout` | `POST /purchase-requests/{id}/checkout` | 2.5 |
| `cancelPurchaseRequest` | `POST /purchase-requests/{id}/cancel` | 2.6 |
| `getPayment` | `GET /payments/{id}` | 2.7 |
| `capturePayment` | `POST /payments/{id}/capture` `{ simulate }` | 2.8 |
| `reconcilePayment` | `POST /payments/{id}/reconcile` | 2.9 |
| `listAuditEvents` / `auditCsvUrl` | `GET /audit-events` (+ `format=csv`) | 2.10 |
| `verifyAuditChain` | `GET /audit-events/verify` | 2.11 |
| `getActivePolicy` | `GET /policies/active` | 2.12 |
| `runScenario` / `resetDemo` | `POST /demo/scenarios/{key}/run`, `POST /demo/reset` | 2.15 |
| `getCheckoutConfig` | `GET /checkout/config` | 2.1x (#17) |

Also required: `POST /purchase-requests` (the agent API, §2.1) and `POST /webhooks/paypal` (§2.14). The UI does not call these directly.

Behaviours the UI relies on:
1. **`next_actions` is computed for the caller's role.** The UI shows exactly one primary action from it, so do not leave it empty for states that can move forward.
2. **`keys.policy` / `keys.payer`** are filled in for every status (see `PAYMENT_STATE_MACHINE.md §1.1`). The `detail` strings are shown verbatim, so keep them ≤ 80 characters and in plain English.
3. **`decision.reason` ≤ 16 words, and `policy[].message` ≤ 120 characters.** They are rendered as-is.
4. **All 8 policy results are always returned**, in rule order.
5. **`capturePayment` returns 2xx for declined captures** with `payment.status = "DECLINED"` and `failure`. Errors are only for calls that could not be processed.
6. **Scenario E:** the UI sends `simulate: "instrument_declined"` on the first capture when `metadata.demo_simulate === "decline_first_capture"`. Translate that into `PayPal-Mock-Response` (sandbox + `DEMO_MODE` only).
7. **CSRF:** the HTTP adapter echoes the `apg_csrf` cookie as `X-CSRF-Token` on mutations, so set that cookie at sign-in.
8. **Polling:** in live mode the UI polls (queue every 3s, a request every 500ms while `EVALUATING`/`CAPTURING`, payments every 1.5s, the ledger every 5s). Support `updated_after`.
9. **`paypal.environment`** must be `"sandbox"` from the backend. The value `"mock"` is reserved for the mock adapter, and the UI uses it to label results "Simulated".

## 5. Replacing the mock with real calls (step by step)

1. Implement the route handlers and validate inputs with `src/contract`. Build responses as contract objects.
2. Add a contract test per route: parse the handler output with the Zod schema (see `tests/boundary.test.ts` for the pattern).
3. Run with `NEXT_PUBLIC_API_MODE=live pnpm dev`. Do not edit components. If a screen breaks, the response does not match the contract: fix the backend, or amend `API_CONTRACT.md` first and then `src/contract`.
4. Walk scenarios A–E with `scripts/visual-qa.cjs` (§7) and compare against the mock screenshots.
5. Keep the mock adapter. It is the offline demo fallback and the fixture source for UI work.

## 6. Mock mode honesty

- A persistent `[MOCK]` tag and a top banner: "Mock mode: simulated data. No PayPal or AI calls are made."
- Payer approval is an explicit "Simulated PayPal approval" panel. It never imitates PayPal branding.
- IDs are prefixed `MOCK-`, the AI model is reported as `mock-fixture`, a paid result is tagged `[SIMULATED]`, and a notice reads "No PayPal API was called and no money moved."
- State persists in `localStorage` (`apg.mock.v1`). "Reset demo" in the Send-test-request sheet reseeds it.

## 7. Visual QA (done, and repeatable)

On 2026-11-03 the production build was inspected in headless Chromium (Playwright 1.64) at **1440×900** and **390×844 (mobile, DPR 2)**. `scripts/visual-qa.cjs` walks scenarios A–E end to end, screenshots 24 states per viewport, and fails on console errors or horizontal overflow.

Found and fixed during QA:

| Issue | Fix |
|---|---|
| Hero text column ended about 500px above the trace panel (dead space) | Compact trace variant; text column is sticky beside it |
| Trace rows were two lines tall (limit stacked under observed) | Limit moved to its own column at ≥1280px. Rows are single-line (40px) |
| Risk score wrapped ("48 /" over "100"); score clipped on mobile | `whitespace-nowrap`; meter is 72px on mobile |
| Queue rows faded on every remount (decorative motion) | Removed. Motion only marks arrival |
| Mobile page was 500px wide: a `hidden` class lost to the Button's own `inline-flex` | Display toggles live on wrapper elements (see DESIGN_SYSTEM §7) |
| Mobile hero grid overflowed (implicit grid column) | `grid-cols-1` + `min-w-0` |
| Mobile ledger and payment IDs overflowed | Table container scroll, anywhere-wrap on event types, `break-all` on full IDs |
| Filter chips wrapped | Queue pane 392px, tighter chips |
| Ambiguous key glyph | Redrawn as a horizontal key |
| Duplicate mock copy on checkout; repetitive "Open request" per ledger row | Removed / replaced with an icon link |
| Search autofocus opened the phone keyboard | Autofocus only on fine-pointer devices |

**Not verified:**
- The live PayPal JS SDK path. It has no backend or client ID, so it has never run.
- Dark mode. The tokens are defined, but the screens were not inspected in dark mode.
- Screen-reader output. The semantics were reviewed in code, but no VoiceOver pass was done.

## 8. Known gaps (for the next contributor)

- No websocket push; live mode polls.
- `/checkout/cancel` assumes the payment ID is in the query string (`cancel_url` must include `?payment=`).
- No i18n. All strings are in `src/lib/copy.ts` plus page files.
- The landing ledger excerpt is static, fictional sample data.
