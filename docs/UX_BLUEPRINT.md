# UX Blueprint

Read with `DESIGN_SYSTEM.md` (binding). Wireframes are structural, not visual. Spacing and type come from the design tokens.

---

## 1. Page map

```
/                              Landing (public)
/login                         Demo operator sign-in (passcode)
/requests                      Workspace: queue + selected request      [nav: Requests]
/requests/[id]                 Request detail (full page < 1024px)
/review                        Review queue (only IN_REVIEW)            [nav: Review · n]
/review/[id]                   Focused review
/requests/[id]/checkout        PayPal handoff (two keys + PayPal button)
/checkout/return               PayPal redirect return (fallback flow) → redirects to result
/checkout/cancel               PayPal redirect cancel (fallback flow) → redirects to result
/payments/[id]                 Payment result (Paid / Not paid / Pending)
/ledger                        Searchable decision + payment audit ledger [nav: Ledger]
/policies                      Read-only active policy set               [nav: Policies]
```

**Global top bar (all app pages):**
`AgentPay Guard` wordmark · Requests · Review `3` · Ledger · Policies ··· `[SANDBOX]` · `Send test request` (secondary) · operator menu

There are four nav items, and that is the maximum (constitution §0.2). The "Send test request" sheet is the demo driver. It lets the presenter fire scenarios A–E as a real agent would, using a demo agent key on the server side.

### Core journey

```
 Agent ──POST──► RECEIVED ─► EVALUATING ─┬─► ALLOWED ──► Checkout ─► PayPal ─► Capture ─┬─► PAID
                                         │                  ▲                           ├─► PAYMENT_FAILED ─► retry ─┘
                                         │                  │                           └─► PAYMENT_PENDING
                                         ├─► IN_REVIEW ─► reviewer approves ──┘
                                         │        └─► reviewer rejects ─► REJECTED
                                         └─► BLOCKED  (no PayPal call, ever)
```
Full definitions are in `PAYMENT_STATE_MACHINE.md`.

---

## 2. Screens

Each screen lists **purpose → hierarchy → primary action → states → judging contribution**.

### 2.1 Landing `/`

**Purpose:** Explain the concept in under 10 seconds and let a judge *run* a decision without logging in.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ AgentPay Guard                              How it works  Ledger  [Open ▸]│
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ Give AI agents spending power.            ┌─ DECISION TRACE ────────────┐ │
│ Keep humans in control.                   │ [$18 API credits][$640 GPU] │ │
│ (display-xl, 2 lines)                     │ [$2,400 gift cards]         │ │
│                                           │                             │ │
│ Policies decide. AI advises.              │ 01 POLICY   ✓ ✓ ✓ ! ✓ ✓ ✓ ✓ │ │
│ PayPal moves the money only when          │ 02 RISK     48/100 ▸ 2 sig. │ │
│ two humans' keys turn.  (subline)         │ 03 VERDICT  Needs review.   │ │
│                                           │                             │ │
│ [Open the workspace]  Watch 3-min demo ▸  │          [▶ Run decision]   │ │
│                                           └─────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────────┤
│ 01 Policy             │ 02 Risk                │ 03 Two keys             │
│ Deterministic rules.  │ An AI model reads the  │ Policy approval and     │
│ Same input, same      │ request for intent and │ payer approval, kept    │
│ answer.               │ injection. It can only │ separate.               │
│                       │ add caution.           │                         │
├───────────────────────────────────────────────────────────────────────────┤
│ Every decision is written down.                                           │
│ 14:02:11  decision.made     preq_…Q2  GPU hours   $640.00  ● Needs review │
│ 14:05:47  review.approved   preq_…Q2  m.okafor               ● Allowed    │
│ 14:06:30  payment.completed preq_…Q2  PayPal     $640.00     ● Paid       │
│ hash 9c1e…a07 ← 51b2…ee4                                                  │
├───────────────────────────────────────────────────────────────────────────┤
│ [SANDBOX] Fictional data · PayPal Sandbox · Built for PayPal AI Hackathon │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Hierarchy:** (1) headline → (2) runnable trace → (3) three numbered principles → (4) ledger excerpt → (5) footer honesty line.
- **Primary action:** `Open the workspace`. "Run decision" is a *secondary* button scoped to the demo panel. It runs a client-side replay of fixture traces, so judges get a deterministic result offline.
- **Copy:** headline 9 words. Each principle is 1 title plus ≤ 2 lines. No feature grid, no testimonials, no metrics.
- **Mobile:** headline → trace (full width) → principles stacked with horizontal rules → ledger excerpt (2-line rows).
- **Judging:** *Design* (the first impression has to stand out), *Presentation* (the concept is self-explanatory and judges can run it themselves), *Innovation* (two keys and advisory AI stated up front).

### 2.2 Decision workspace `/requests`

**Purpose:** The operator's home. See every agent request and understand any one of them instantly.

```
┌ top bar ──────────────────────────────────────────────────────────────────────┐
├───────────────────────────┬───────────────────────────────────────────────────┤
│ Requests                  │ GPU hours · 40 × H-class            $640.00       │
│ 3 need review · $1,024.00 │ Kestrel Compute · research-assistant · 2m ago    │
│ allowed today             │ preq_01JC…Q2                                      │
│ [Search…  /] [All▾]       │ ┌──────────────────────────────────────────────┐ │
│───────────────────────────│ │ ▍ Needs review.                     [REVIEW] │ │
│ ● Needs review  $640.00   │ │ ▍ Over the $250 auto limit; new merchant.    │ │
│   GPU hours · Kestrel     │ └──────────────────────────────────────────────┘ │
│───────────────────────────│ KEY 1 Policy approval ○ Waiting for reviewer     │
│ ● Allowed       $18.00    │ KEY 2 Payer approval  ○ Not started              │
│   API credits · Larkspur  │                                   [Open review]  │
│───────────────────────────│ ── DecisionTrace (01 Policy / 02 Risk / 03) ──    │
│ ● Blocked     $2,400.00   │ ── Agent's justification (quoted, untrusted) ──   │
│   Gift cards · Brightmart │ ── Ledger for this request (last 5) · View all ▸ │
│ …                         │                                                   │
└───────────────────────────┴───────────────────────────────────────────────────┘
```

- **Hierarchy (detail pane):** (1) what and how much (title + `amount-l`) → (2) **VerdictMark** → (3) **TwoKey** + the primary action → (4) DecisionTrace → (5) the agent's justification, shown in a quoted block labeled `AGENT-SUPPLIED · UNTRUSTED` → (6) per-request ledger.
- **Primary action by status:**

| Status | Primary action | Secondary |
|---|---|---|
| `EVALUATING` | none (live trace resolving) | — |
| `IN_REVIEW` | **Open review** | Copy ID |
| `ALLOWED` | **Continue to PayPal** | Cancel request |
| `CHECKOUT_PENDING` | **Continue to PayPal** (resumes the same order) | Cancel request |
| `PAYMENT_FAILED` | **Try payment again** (only if `retry_payment` ∈ `next_actions`) | Cancel request |
| `CAPTURING` | none (mono line `CONFIRMING WITH PAYPAL…`, auto-reconcile after 5s) | — |
| `PAYMENT_PENDING` | none ("Payment pending.") | View in ledger |
| `BLOCKED` / `REJECTED` / `EXPIRED` / `CANCELLED` | none | View in ledger |
| `PAID` | none | View in ledger |

- **Queue:** filter chips are `All · Needs review · Allowed · Blocked · Paid · Not paid`. The header summary is a single sentence (no KPI tiles). New requests slide in at the top with the trace-resolve motion.
- **Empty state:** "No agent requests yet." / "Send a test request to see a decision." / [Send test request]
- **Judging:** *Implementation* (live data from the real API), *Design* (fixed-context/scrolling-detail composition), *Impact* (shows how an operator would actually work).

### 2.3 Evaluation flow (live trace)

**Purpose:** The memorable moment. A request arrives and you *watch* the decision being made.

Sequence when a request is created (from the agent API or the "Send test request" sheet):
1. The queue row appears with `EVALUATING` and the detail pane auto-opens.
2. **01 Policy** rows resolve one by one (P-01 … P-08). There is no streaming in v1. The client polls `GET /purchase-requests/{id}` every 500ms until the status leaves `EVALUATING`, then replays each `policy.results[]` row at a 90ms stagger.
3. **02 Risk** shows a mono status line (`ASSESSING · claude-sonnet-5-5`) and then the score, meter and signals.
4. **03 Verdict:** the VerdictMark lands (signature motion) and the TwoKey updates.
5. The primary action appears.

A rule that blocks short-circuits nothing visually. All 8 rules still show, so the explanation is complete, but the verdict cites the blocking rule first.

**"Send test request" sheet** (right side sheet, 440px):
`SCENARIO` radio list A–E (one-line description each) → a read-only JSON preview of the agent payload (mono) → [Send as agent]. A checkbox `Simulate card decline at capture` is pre-checked only for scenario E.

- **Judging:** *Presentation* (the 3-minute "wow"), *Innovation* (visible advisory-AI boundary), *Implementation* (real evaluation).

### 2.4 Focused review `/review/[id]`

**Purpose:** Let a human make one decision, quickly and with everything needed, without distraction.

```
┌ top bar ──────────────────────────────────────────────────────────────────────┐
│ ← Review queue (2 more)                                         1 of 3        │
│                                                                               │
│ GPU hours · 40 × H-class                                         $640.00      │
│ Kestrel Compute · requested by research-assistant · 4m ago                    │
│                                                                               │
│ WHY THIS NEEDS YOU                                                            │
│ ! P-01 Over the $250 auto-approve limit ($640.00).                            │
│ ! P-04 Kestrel Compute is not on the merchant allowlist.                      │
│ ▸ Risk 48/100: first purchase from this merchant; 3.2× agent median.          │
│                                                                               │
│ WHAT THE AGENT SAID                          AGENT-SUPPLIED · UNTRUSTED       │
│ "Fine-tuning run for the Q4 evaluation set needs 40 GPU hours…"               │
│                                                                               │
│ AFTER YOU APPROVE                                                             │
│ KEY 1 Policy approval  → you        KEY 2 Payer approval → in PayPal          │
│                                                                               │
│ Note (required to reject, optional to approve)                                │
│ [______________________________________________]                              │
│                                                                               │
│ [Reject]                                              [Approve purchase]      │
│  r                                                     a                      │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Hierarchy:** what/amount → *why this needs you* (only the non-passing rules plus the top 2 risk signals) → the agent's words → the consequence of approving (TwoKey) → note → decision.
- **Primary action:** **Approve purchase**. Reject is `danger` (secondary) and opens a confirm dialog that requires a note.
- **Copy rule:** the screen explains *why a human is needed*, not everything that passed. Full trace is one click away (`Show full trace`).
- **After action:** an inline confirmation ("Allowed by you. Payer approval is next.") that auto-advances to the next item after 1.5s, with an `Undo`-free design (decisions are final and recorded) and a `Stay` link.
- **Guards:** If the request changed state meanwhile (409 `STATE_CONFLICT`), show "This request was already decided by m.okafor at 14:05." and load the new state.
- **Judging:** *Impact* (human-in-the-loop done well), *Design* (focus and restraint), *Implementation* (role check and optimistic concurrency).

### 2.5 PayPal checkout handoff `/requests/[id]/checkout`

**Purpose:** Make the second key explicit and hand off to PayPal with zero ambiguity about money.

```
│ Pay Larkspur Data                                                 $18.00      │
│ API credits · 100k tokens · preq_…7A                                          │
│                                                                               │
│ KEY 1 Policy approval  ● Granted · rule set v3 (auto)                         │
│ KEY 2 Payer approval   ○ Your turn · in PayPal                                │
│                                                                               │
│ ┌ PayPalZone ─────────────────────────────────────────────┐                   │
│ │            [ official PayPal button ]                    │                   │
│ │ You'll approve the payment in PayPal.                    │                   │
│ │ Nothing is charged until you do.                         │                   │
│ └──────────────────────────────────────────────────────────┘                   │
│ Policy approval expires in 28:41                         Cancel request       │
```

- **Primary action:** the PayPal button (official SDK, unmodified).
- **Flow:** `createOrder` → `POST /api/v1/purchase-requests/{id}/checkout` → returns `paypal_order_id`. On `onApprove` → `POST /api/v1/payments/{payment_id}/capture` → navigate to `/payments/[id]`. `onCancel` → inline "You closed PayPal. Nothing was charged." and the button stays. `onError` → inline error with retry.
- **Redirect fallback:** if popups are blocked, show `Continue to PayPal ↗` (the `payer-action` link). The return lands on `/checkout/return?token=…`, which triggers capture server-side and redirects to the result.
- **Judging:** *Implementation* (real PayPal Sandbox), *Design* (the two keys made tangible), *Innovation*.

### 2.6 Payment result `/payments/[id]`

**Purpose:** State the truth about money, then point to the next step.

| Outcome | VerdictMark | Reason line | Primary | Secondary |
|---|---|---|---|---|
| `COMPLETED` | **Paid.** (allow) | "$18.00 to Larkspur Data. PayPal capture 3C6…91." | — | View in ledger · Back to requests |
| `DECLINED` / failed | **Not paid.** (block) | "PayPal declined the funding source. No payment was taken." | **Try payment again** | Cancel request |
| `PENDING` | **Payment pending.** (review) | "PayPal is holding this capture for review. We'll update when it settles." | — | View in ledger |
| Payer cancelled | **Not paid.** (muted) | "You closed PayPal before approving. Nothing was charged." | **Continue to PayPal** | Cancel request |

Below the mark: TwoKey (both states), an attempts list (`Attempt 1 · Declined · 14:20:03`, `Attempt 2 · Paid · 14:21:40`) and the PayPal IDs (order ID, capture ID) as IdTags.

- **Judging:** *Implementation* (scenario E), *Design* (honest states), *Impact* (trust).

### 2.7 Ledger `/ledger`

**Purpose:** Answer "who allowed this, when and why" for any payment.

```
│ Ledger                                       Chain verified ✓ · 214 events    │
│ [Search ID, merchant, agent, PayPal ID…  /]  [Event ▾] [State ▾] [Date ▾]     │
│                                                                    Export CSV │
│ TIME       EVENT              REQUEST                 ACTOR       AMOUNT STATE│
│ 14:21:40   payment.completed  preq_…E5 Font license   PayPal      $96.00 ●Paid│
│ 14:20:03   payment.declined   preq_…E5 Font license   PayPal      $96.00 ●Not │
│ 14:06:30   payment.completed  preq_…Q2 GPU hours      PayPal     $640.00 ●Paid│
│ ▾ expanded row: payload (mono key: value), hash 9c1e…a07 ← 51b2…ee4           │
```

- **Primary action:** search (focused on load; `/` shortcut). No ink button. Export is secondary.
- **Search:** free text across request ID, PayPal order/capture ID, merchant, agent, item title, plus filters `event_type`, `state`, `from`/`to`. Results group by request when the query is a request ID.
- **Chain verified:** a header line from `GET /api/v1/audit-events/verify`. If it fails: "Chain broken at evt_… · investigate" in block color.
- **Judging:** *Impact* (compliance), *Innovation* (tamper evidence), *Implementation*.

### 2.8 Policies `/policies` (read-only)

A single page listing the active policy set `Default · v3`: one row per rule (`code · name · plain-English rule · thresholds`) plus a highlighted line, "AI risk may escalate ALLOW → REVIEW. It cannot allow or block." There is no primary action. It exists so judges see that rules are deterministic and inspectable.

### 2.9 Login `/login`

Centered narrow column: wordmark, "Operator sign-in", a passcode field, and [Sign in]. A muted line reads "Demo passcode is in the README." The role toggle (`operator` / `reviewer`) is part of the demo passcode table.

---

## 3. Cross-cutting UX rules

- **Freshness:** the workspace polls `GET /purchase-requests?updated_after=` every 3s while visible (no websockets in v1). The detail polls at 500ms only while `EVALUATING` or `CAPTURING`.
- **Errors:** inline at the point of action. Network loss: a top-bar mono line `OFFLINE · retrying`. Never wipe visible state on error.
- **Truth over optimism:** no optimistic UI for anything that moves money. Review decisions may update optimistically (with rollback on 409).
- **Untrusted text:** anything an agent wrote is shown in a quoted block, labeled `AGENT-SUPPLIED · UNTRUSTED`, rendered as plain text (never markdown or HTML) and clamped to 4 lines with "Show all".
- **Time:** relative in queues ("2m ago"), absolute mono `HH:MM:SS PST` in traces and the ledger, with full ISO in a tooltip.
