# AgentPay Guard — Product Brief

> **Give AI agents spending power. Keep humans in control.**

Status: v1.0 · Owner: founding design / frontend · Last updated: 2026-11-03
Binding companion docs: `DESIGN_SYSTEM.md` (design constitution), `API_CONTRACT.md`, `PAYMENT_STATE_MACHINE.md`.

---

## 1. The problem in one paragraph

AI agents can already find products, compare prices and fill carts. The last step, paying, is where organizations freeze, and for good reason. An agent with a card number has unlimited authority, no memory of policy, and can be steered by any text it reads, including a prompt injection hidden in a product page. Teams are left with two bad options. They can keep agents away from money, or they can trust them blindly.

## 2. The product

AgentPay Guard is a **payment control layer** that sits between an AI agent and PayPal.

```
Agent proposes ──► Policy (deterministic) ──► Risk (AI, advisory) ──► Verdict
                                                                    │
                     ALLOW ─► PayPal payer approval ─► Capture ─► Paid
                     REVIEW ─► Human reviewer ─► (approve) ─► PayPal …
                     BLOCK ─► Stopped. No payment call is ever made.
```

Every step writes an entry to a tamper-evident audit ledger.

### Core principles (product-level, non-negotiable)

1. **Rules authorize, AI advises.** Deterministic policies decide what is allowed. The AI risk model can only make a decision *more cautious* (ALLOW → REVIEW). It can never allow a request on its own, and it can never relax a rule.
2. **Two keys, never one.** *Policy approval* (Guard or a human reviewer says this purchase is permitted) and *payer approval* (a human approves the payment inside PayPal) are separate, visibly separate, and both required.
3. **Blocked means zero payment calls.** A blocked request never reaches PayPal. The ledger proves it.
4. **Retries are safe.** The same request never produces two payments. Idempotency is enforced at the API, the decision and the PayPal layer.
5. **Failure is never shown as success.** "Not paid" is stated plainly and paired with a clear recovery path.
6. **Every decision is explainable.** Each verdict cites the exact rules and risk signals that produced it.

## 3. Target users

| Persona | Context | Job to be done |
|---|---|---|
| **Agent developer** (primary) | Builds an AI agent that buys API credits, compute, SaaS seats or data | "Give my agent a safe, testable way to pay without hand-rolling limits." |
| **Approver / ops lead** | Owns the budget the agents spend from | "Only see the requests that need me, and decide in seconds with context." |
| **Finance / compliance** | Reconciles spend and answers "who allowed this?" | "Search any payment and see the full decision trail." |

The demo uses one fictional organization, **Halden & Rook Studio**, running three fictional agents. All sample data is fictional (see `DEMO_SCENARIOS.md`).

## 4. Scope for the hackathon (v1)

In scope:
- Agent-facing API: create a purchase request, read its status.
- Deterministic policy engine with a single active policy set (8 rules).
- AI risk assessment with structured output, cited signals and a safe fallback.
- Decision workspace: request queue, decision trace, verdict.
- Focused human review flow.
- Real **PayPal Sandbox** checkout through the Orders v2 API: create order, payer approval, capture.
- Idempotency and duplicate protection.
- Recoverable payment failure, using PayPal Sandbox negative testing.
- Searchable audit ledger with a hash chain.
- Landing page with a runnable, in-page decision demo.

Out of scope (recorded and deferred):
- Policy editor UI (policies are read-only in v1 and seeded from config).
- Multi-org tenancy, SSO and fine-grained RBAC (v1 has two roles: `operator` and `reviewer`).
- Refunds, disputes and payouts.
- Vaulted payment methods and agent-initiated payments without a payer present.
- Live (non-sandbox) PayPal.

## 5. How this wins each judging criterion (equal weights)

| Criterion | Our answer |
|---|---|
| **Implementation** | A real end-to-end flow: agent API → policy → AI → human review → PayPal Sandbox order → capture → webhook → ledger. Idempotency and state-machine guards are actually enforced, not just described. |
| **Design** | An original editorial "instrument" language. The decision trace, the typographic verdict and the two-key indicator make the core concept legible in seconds. No dashboard clichés. |
| **Impact** | Agentic commerce stalls without controls. This is the trust layer that lets teams turn agent purchasing on safely. |
| **Innovation** | Advisory-only AI with a one-way escalation rule, prompt-injection detection on agent-supplied text, two-key approval, and a hash-chained audit ledger. |
| **Presentation** | A 3-minute demo with five scripted scenarios, each answering one question a judge would ask. The landing hero lets judges run a decision themselves. |

## 6. Hackathon constraints (as researched)

- Event: PayPal AI Hackathon 2026 on Devpost. The `devpost.com` pages returned HTTP 403 to our fetch tool, so the facts below come from the brief plus third-party listings and **must be re-checked on the official rules page by a human before submission**.
- Deadline: **November 12, 2026, 12:00 PM PST** (as given in the brief; one third-party listing says Nov 13, so trust the official page).
- Must meaningfully integrate PayPal (Sandbox) **and** AI. The app must be genuinely functional.
- Third-party listings mention a public open-source repo, a project description in English, and a public demo video **under 3 minutes**.
- Judging: implementation, design, impact, innovation and presentation, weighted equally (from the brief).

## 7. Assumptions (decided, not asked)

| # | Assumption | Why |
|---|---|---|
| A1 | Single-tenant demo org; operator login is a demo passcode issued as a signed cookie. | Keeps the demo friction-free while still showing real authorization boundaries. |
| A2 | Agents authenticate with per-agent bearer keys (`agk_test_…`). | Matches how developers would integrate. Scopes requests per agent. |
| A3 | Currency is USD only. Amounts are decimal strings, PayPal-style. | Avoids floating-point errors and needs no translation at the PayPal boundary. |
| A4 | Payer approval uses PayPal JS SDK Buttons (popup), with a redirect `approve` link as fallback. | Keeps the demo on one screen. Uses official, unmodified PayPal branding. |
| A5 | The AI provider sits behind an interface. The default is a Claude model with JSON-schema output. | The backend owner (Codex) can swap providers without changing the contract. |
| A6 | Persistence is SQLite via Prisma (or Drizzle) locally, Postgres on deploy. | Fast to build. Conditional updates give us state-machine guards. |
| A7 | Payment failure is demonstrated with PayPal Sandbox negative testing (`PayPal-Mock-Response`), triggered only in demo mode. | Shows a *real* PayPal error path instead of a faked one. |
| A8 | The UI is English-first. All copy lives in one file so it is easy to localize. | The submission must be in English. |
