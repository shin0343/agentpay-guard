# AgentPay Guard

> Give AI agents spending power. Keep humans in control.

A payment control layer for AI agents, built for the PayPal AI Hackathon 2026. An agent proposes a purchase. Deterministic policies decide, an AI risk model advises (and can only add caution), a human reviews when needed, and PayPal moves money only after a second, separate payer approval. Every step is written to a hash-chained ledger.

**Status:** frontend mock mode is preserved. The backend now implements PostgreSQL persistence, deterministic policies, server authorization, idempotency, audit chaining and a real PayPal Sandbox Orders v2 adapter. Automated tests use a fake payment provider. A real OpenAI structured-output risk service is integrated with conservative failure handling. No live AI inference or real Sandbox payment was completed in this session; automated provider tests use stub transports.

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


For the live backend, copy `.env.example` to `.env.local`, configure PostgreSQL and Sandbox account credentials, set `NEXT_PUBLIC_API_MODE=live`, run `pnpm db:migrate`, then `pnpm dev`. Full setup, limitations and the manual payment acceptance procedure are in [PAYPAL_INTEGRATION.md](docs/PAYPAL_INTEGRATION.md). Live sign-in requires `DEMO_MODE=true` and private `DEMO_PASSCODES`; mock passcodes apply only in mock mode.

```bash
pnpm test                       # fake-provider lifecycle, policy, API and adapter tests
TEST_DATABASE_URL=postgresql://... pnpm test:postgres # disposable DB; creates an isolated test schema
pnpm build:webpack              # fallback when the environment blocks Turbopack workers
pnpm risk:verify preq_<id>      # opt-in real AI probe; no payments or decision changes
pnpm sandbox:verify pay_<id>    # real read-only verification after a manual Sandbox checkout
```

[Test evidence and untested behavior](docs/TEST_REPORT.md) are recorded separately. Backend source is under `src/server`; the existing UI continues through `GuardApi`. Migrations are numbered SQL under `migrations/`. Runtime payment code has no fake-provider environment switch.

Configure `RISK_PROVIDER=openai`, server-only `OPENAI_API_KEY` and `OPENAI_RISK_MODEL` for genuine inference. `fixture` requires explicit demo mode and is simulated. See [AI risk architecture](docs/AI_RISK_ENGINE.md) and [demo verification](docs/DEMO_VERIFICATION.md) for trust boundaries, seven required scenarios, evidence categories and live acceptance steps.
