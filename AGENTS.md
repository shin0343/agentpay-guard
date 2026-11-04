# AGENTS.md — rules for every AI contributor

This project has a fixed design philosophy and a frozen API contract. You are expected to **extend** them, never reinterpret or override them.

## Read before writing any code

| If you touch… | You must follow |
|---|---|
| Anything visible (pages, components, copy, CSS) | `docs/DESIGN_SYSTEM.md` (binding constitution) + `docs/UX_BLUEPRINT.md` |
| API routes, server logic, DB | `docs/API_CONTRACT.md` + `docs/PAYMENT_STATE_MACHINE.md` |
| Demo data or seeds | `docs/DEMO_SCENARIOS.md` (all fictional) |
| Scope or priorities | `docs/PRODUCT_BRIEF.md` + `docs/IMPLEMENTATION_PLAN.md` |

## Non-negotiables (summary; the docs win if they differ)

**Design: "Ledger Instrument"**
1. Ink chrome, semantic color. Color appears only for verdict or payment state, always paired with a word.
2. At most one primary (ink-filled) button per view.
3. Rows on hairline rules, not cards. No KPI tile rows, gradients, glass, illustrations or emoji.
4. Newsreader = headlines and verdicts. Geist = UI. Geist Mono = money, IDs and time. Never swap their jobs.
5. One line of reason (≤ 16 words) per state. Detail goes behind a disclosure.
6. Motion is limited to the three signature motions (trace resolve, verdict land, key turn). Respect reduced motion.
7. Never show "Paid" unless status is `PAID`. Always show both keys (Policy approval and Payer approval).
8. Use design tokens only (`src/styles/globals.css`). No raw hex in components.
9. Use the canonical vocabulary in `DESIGN_SYSTEM.md` Part 3. All strings go in `src/lib/copy.ts`.
10. Never restyle the PayPal button.

**Backend**
1. Response shapes come from `src/contract` (Zod). Never redefine them.
2. All status changes go through `src/server/state/transitions.ts`.
3. A BLOCKED request never calls PayPal. AI can only escalate ALLOW → REVIEW.
4. `Idempotency-Key` is required on every POST (except session and webhooks). `PayPal-Request-Id` must be deterministic.
5. Money is a string decimal or integer cents. Never floats.
6. No secrets in the client, logs or audit data.

## Changing the rules

To change a design law or the API contract, edit the doc **first**, stating the reason. Change code after that. A PR that violates `docs/DESIGN_SYSTEM.md` without an amendment is reverted.

Every UI PR description must include the checklist from `docs/DESIGN_SYSTEM.md` Part 6, with each item ticked.
