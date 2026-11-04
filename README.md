# AgentPay Guard

> Give AI agents spending power. Keep humans in control.

A payment control layer for AI agents, built for the PayPal AI Hackathon 2026. An agent proposes a purchase. Deterministic policies decide, an AI risk model advises (and can only add caution), a human reviews when needed, and PayPal moves money only after a second, separate payer approval. Every step is written to a hash-chained ledger.

**Status:** the frontend is complete and runs standalone in **mock mode** (no PayPal or AI calls; everything is labelled simulated). The real backend (PayPal Sandbox Orders v2, AI provider, database) is specified but not yet implemented.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm check        # typecheck, lint, tests, build
```

Mock passcodes: `reviewer` / `operator`. Use **Send test request** in the workspace to run demo scenarios A–E.

| Doc | What |
|---|---|
| `AGENTS.md` | Binding rules for every contributor (human or AI) |
| `docs/PRODUCT_BRIEF.md` | Product, principles, scope |
| `docs/DESIGN_SYSTEM.md` | The "Ledger Instrument" design constitution |
| `docs/UX_BLUEPRINT.md` | Screens, hierarchy, primary actions |
| `docs/API_CONTRACT.md` · `docs/PAYMENT_STATE_MACHINE.md` | Frozen v1 contract and state machines |
| `docs/DEMO_SCENARIOS.md` | Fictional demo data and the 3-minute script |
| `docs/FRONTEND_HANDOFF.md` | How to connect the real backend without touching the UI |

All people, companies and merchants in the demo are fictional.
