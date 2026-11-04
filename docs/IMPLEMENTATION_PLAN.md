# Implementation Plan

Today: **Tue 2026-11-03**. Deadline: **Thu 2026-11-12, 12:00 PM PST**. Internal target: **submit by Wed 2026-11-11, 8:00 PM PST**, which leaves a 16-hour buffer.

## 1. Stack (decided)

| Layer | Choice | Note |
|---|---|---|
| App | Next.js (App Router) + React + TypeScript (strict) | One repo, one deploy |
| Styling | Tailwind CSS v4 + CSS variables from `DESIGN_SYSTEM.md` | Tokens only, no raw hex in components |
| Validation | Zod (`src/contract`) shared by UI and route handlers | Single source of truth |
| Data | Prisma + SQLite (local) / Postgres (deploy: Neon or Vercel Postgres) | Partial unique index needs Postgres or SQLite ≥ 3.8 |
| AI | `RiskAssessor` interface; Anthropic `claude-sonnet-5-5` default; `FixtureRiskAssessor` | Structured JSON output |
| Payments | PayPal Orders v2 REST (server) + PayPal JS SDK Buttons (client), Sandbox | No PayPal secrets in the browser |
| Tests | Vitest (unit/state machine), Playwright (scenarios A–E end-to-end) | |
| Deploy | Vercel (or Render if long-running functions are needed) | |
| Icons/fonts | lucide-react; Newsreader, Geist, Geist Mono via `next/font` | |

## 2. Repository layout

```
agentpay-guard/
├─ AGENTS.md / CLAUDE.md          # binding rules for any AI contributor
├─ docs/                          # this folder (source of truth)
├─ src/
│  ├─ contract/                   # Zod schemas + fixtures — shared, frontend-owned
│  │  ├─ common.ts  purchase-request.ts  payment.ts  audit.ts  errors.ts
│  │  └─ fixtures/                # scenario A–E responses, validated by tests
│  ├─ app/
│  │  ├─ (marketing)/page.tsx     # landing
│  │  ├─ (console)/requests/…  review/…  ledger/  policies/  payments/[id]/
│  │  ├─ checkout/return|cancel/
│  │  ├─ login/
│  │  └─ api/v1/**/route.ts       # backend-owned (Codex)
│  ├─ server/                     # backend-owned (Codex)
│  │  ├─ db/ policy/ risk/ paypal/ state/ audit/ idempotency/ auth/
│  ├─ components/
│  │  ├─ ui/                      # Button, Field, Dialog, StatusLabel, IdTag, Kbd, Skeleton
│  │  └─ guard/                   # DecisionTrace, VerdictMark, TwoKey, QueueRow, LedgerRow, PayPalZone
│  ├─ lib/api-client.ts           # typed fetch wrapper; parses every response with Zod
│  ├─ lib/copy.ts                 # all UI strings (canonical vocabulary)
│  └─ styles/globals.css          # tokens (light + dark)
└─ tests/ unit/  e2e/
```

## 3. Ownership and handshake

| Area | Owner | Contract |
|---|---|---|
| `docs/`, `src/contract/`, `src/components/`, `src/app/(marketing|console)`, `styles/` | Frontend / design | — |
| `src/server/**`, `src/app/api/**`, Prisma schema, PayPal and AI integration | Backend (Codex) | `API_CONTRACT.md`, `PAYMENT_STATE_MACHINE.md`, `src/contract/*` |

Rules:
1. Backend **imports** `src/contract`. It never redefines response shapes.
2. A contract change happens in `docs/API_CONTRACT.md` first, then `src/contract`, then both sides.
3. The frontend develops against `NEXT_PUBLIC_API_MODE=mock`, which serves fixtures from a mock route layer, and switches to `live` with no code changes.
4. A contract test parses every route handler response with its Zod schema in CI.

## 4. Schedule

| Day | Frontend / design | Backend (Codex) | Exit criterion |
|---|---|---|---|
| **Tue 11/3** | ✅ Docs. Scaffold app, tokens, fonts, `src/contract` + fixtures | — | `pnpm test` validates fixtures |
| **Wed 11/4** | App shell, top bar, `Button/StatusLabel/IdTag`, mock API client | Prisma schema, `transitions.ts` + tests T1–T10 (PayPal and AI mocked), idempotency middleware | State machine tests green |
| **Thu 11/5** | Workspace (queue + detail), `DecisionTrace`, `VerdictMark`, `TwoKey`, live trace motion | Policy engine (P-01…P-08), endpoints 1–4, 6, 12, 13; agent key + session auth | Scenario B/C/D decisions correct via `curl` |
| **Fri 11/6** | Review flow, Send-test-request sheet, empty/error states | `RiskAssessor` (Anthropic + fixture), prompt r-2, injection detection | A gets risk < 35; C flags `prompt_injection` |
| **Sat 11/7** | Checkout handoff + PayPal JS SDK, result page | PayPal client: OAuth, create order, capture, mock header, reconcile; endpoints 5, 7–9, 17 | A and E pass end-to-end in Sandbox (local) |
| **Sun 11/8** | Ledger (search, filters, expand, verify line), Policies page | Audit hash chain, endpoints 10–11, webhook 14, demo 15–16 | Chain verifies after the full run |
| **Mon 11/9** | Landing page with runnable hero trace | Deploy, Postgres, webhook registration, seed | **All scenarios A–E pass on the deployed URL** (Playwright) |
| **Tue 11/10** | Polish: responsive (375/768/1280), a11y, reduced motion, constitution checklist | Hardening: rate limits, error mapping, logs | Zero checklist violations |
| **Wed 11/11** | Record the 3-min video (2 takes), Devpost write-up, README, screenshots | Freeze; bug fixes only | **Submitted by 20:00 PST** |
| Thu 11/12 | Buffer only | Buffer only | Deadline 12:00 PST |

## 5. Definition of done (v1)

- Scenarios A–E pass end-to-end on the deployed URL against the real PayPal Sandbox and the real AI provider, and also pass with `RISK_PROVIDER=fixture`.
- Tests T1–T10 are green.
- No constitution violations (`DESIGN_SYSTEM.md` Part 6 checklist).
- Lighthouse a11y ≥ 95 on landing, workspace and ledger. Keyboard-only path works for review.
- README: one-command local start, sandbox setup steps, demo passcodes, and architecture diagram.

## 6. Unresolved integration risks

| # | Risk | Impact | Mitigation / spike | By |
|---|---|---|---|---|
| R1 | **Negative-testing semantics.** We have not verified whether a capture mocked with `INSTRUMENT_DECLINED` leaves the Sandbox order re-capturable, or whether the JS SDK re-approval (`actions.restart()`) works when the decline happens on *our* server. | Scenario E may not recover as scripted | Spike on 11/7. Fallback: retry creates a **new** order (already supported by §3.4 step 4) | 11/7 |
| R2 | **Serverless lifetime vs async evaluation.** Work after a `202` may be killed on Vercel. | Requests stuck in `EVALUATING` | Evaluate synchronously inside the request (AI timeout 8s, `Prefer: wait` default 10). Use the `202` path only on overflow, with lazy re-evaluation on `GET` | 11/5 |
| R3 | **Webhooks need a public URL** and a per-environment `PAYPAL_WEBHOOK_ID`. | No reconciliation locally | The demo never depends on webhooks. `/reconcile` covers it. Register a webhook only on deploy | 11/9 |
| R4 | **AI nondeterminism.** Scenario A must score < 35 to be allowed. | A might go to review on stage | Temperature 0, a fixed prompt version, and fixture fallback. B, C and D outcomes are rule-driven, so they are robust whatever the score is | 11/6 |
| R5 | **Devpost rules unverified.** Our fetch got 403. | Possible non-compliance (video length, license, required PayPal products) | **A human must read the official rules page** and update `PRODUCT_BRIEF.md §6` | 11/4 |
| R6 | **Sandbox popup friction** (login, popup blockers, slow Sandbox). | Lost demo seconds | Pre-logged-in payer, redirect fallback, pre-recorded video as the primary submission | 11/11 |
| R7 | **SQLite on serverless** doesn't persist. | Data loss on deploy | Postgres for deploy, chosen by 11/4 | 11/4 |
| R8 | **Hash-chain write contention.** | Broken chain under concurrency | Serialize audit inserts (transaction + advisory lock or `SELECT … FOR UPDATE` on the chain head) | 11/8 |
| R9 | **PayPal brand rules** for the button and wording. | Design review risk | Use the official SDK button unmodified, and don't use the PayPal logo elsewhere | 11/7 |
| R10 | **Design drift** from multiple AI contributors. | Generic look by demo day | `AGENTS.md` makes `DESIGN_SYSTEM.md` binding. The PR checklist is mandatory. Tokens only | ongoing |
| R11 | **Font loading** (Geist via `next/font/google` availability on the chosen Next version). | Layout shift or fallback fonts | Fall back to the `geist` npm package, with `display: swap` and metric-matched fallbacks | 11/4 |

## 7. The exact next step

**Scaffold the app and freeze the contract in code:**

1. In `agentpay-guard/`, create the Next.js app (App Router, TypeScript strict, Tailwind v4, `src/` dir, pnpm), keeping `docs/`, `AGENTS.md` and `CLAUDE.md`.
2. Write `src/contract/{common,purchase-request,payment,audit,errors}.ts` **verbatim** from `API_CONTRACT.md §1`.
3. Write `src/contract/fixtures/` with one `PurchaseRequest` (and `Payment` where relevant) per scenario A–E, using the data in `DEMO_SCENARIOS.md`, plus `tests/unit/contract.test.ts` that parses every fixture.
4. Put the light and dark tokens from `DESIGN_SYSTEM.md` Part 1 in `src/styles/globals.css` and wire the three fonts.
5. Hand the backend agent `API_CONTRACT.md`, `PAYMENT_STATE_MACHINE.md` and `src/contract/` with the instruction: "Implement `src/server/state/transitions.ts` and make tests T1–T10 pass before any route handler."
