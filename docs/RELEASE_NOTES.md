# AgentPay Guard — hackathon source release

Draft release notes. Publication is gated by `FINAL_RELEASE_REPORT.md`; no release/tag is created yet.

AgentPay Guard gives an operator a traceable way to control agent-proposed API-credit and GPU purchases.
Trusted catalog prices and eight deterministic rules determine whether a request is allowed, reviewed
or blocked. Meta Muse Spark supplies schema-validated advisory risk; it can add review, never override
a rule. Policy approval and PayPal payer approval remain separate keys throughout the UI.

The Sandbox integration includes guarded Orders v2 capture, deterministic provider request IDs,
duplicate protection, recipient/amount checks, verified webhook reconciliation and a hash-chained ledger.
The existing November 5, 2026 USD 18.00 completed capture and four signed original/redelivery receipts
were reverified during Step 8 without creating another payment.

Step 8 verification: typecheck, lint, 198 PostgreSQL-enabled tests, clean dependency installation,
fresh migration/startup, desktop/mobile mock scenarios, real backend/browser recovery and Webpack
production builds passed. Runtime dependency audit returned zero advisories. One moderate
ESLint/minimatch development dependency advisory remains disclosed.

This is a single-organization Sandbox prototype. Merchant labels are fictional and all payments go
to one configured Sandbox business account. Demo IAM uses shared private passcodes/stateless sessions;
there is no production-money deployment, calibrated fraud model, compliance certification, refund or
dispute support. Natural issuer decline and rare provider ambiguity are tested with controlled
transports rather than claimed as genuine live outcomes. Read the README for runnable setup and
the final report for the remaining video publication gates.

License: MIT for project source; dependency/font licenses remain applicable.
