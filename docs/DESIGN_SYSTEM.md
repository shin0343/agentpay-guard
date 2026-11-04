# Design System — "Ledger Instrument"

This document is **binding**. Every contributor, human or AI, must follow it. If a change would break a rule in Part 0, it needs an explicit amendment to this file *before* the code changes (see §0.4). "It looked better" is not a valid reason.

The direction in one sentence:
> **A precise financial instrument printed in ink on paper: editorial type, hairline rules and color that appears only when a decision is made.**

---

## Part 0 — The Constitution

### 0.1 The ten laws

1. **Ink chrome, semantic color.** All UI chrome is neutral (paper, ink, rules). Verdict colors (`allow`, `review`, `block`) appear *only* where they encode a decision or payment state. No decorative color anywhere.
2. **One primary action per screen.** At most one ink-filled primary button is visible per view. If the viewer can move the request forward, there is exactly one. Everything else is secondary or quiet. The PayPal button counts as the primary action on the checkout view.
3. **Rows over cards.** Compose on hairline rules and fixed row anatomies. A bordered box is allowed only for (a) the decision trace, (b) form fields, (c) the PayPal zone and (d) dialogs and popovers.
4. **Three typefaces, three jobs.** Serif = verdicts and headlines. Sans = interface. Mono = money, IDs, time and code. Never swap their jobs.
5. **One line of reason.** Each status, verdict or error gets one sentence (≤ 16 words) on the surface. Detail goes behind a disclosure.
6. **Motion marks arrival.** Animate only when something resolves or enters. No looping, ambient, parallax or scroll-jacking motion.
7. **Never imply money moved when it didn't.** Words like "Paid" or "Complete" and the `allow` color for payment are reserved for `PAID`, a PayPal-confirmed capture.
8. **The two keys are always visible together.** Wherever payment readiness is shown, *Policy approval* and *Payer approval* appear as two separate indicators. Never merge them into one "Approved".
9. **Contrast is not negotiable.** Text ≥ 4.5:1. UI boundaries and icons ≥ 3:1. Never encode state by color alone; always pair it with a word.
10. **No filler.** No metric-tile rows, no gradients, no glass, no illustrations, no stock icons in rounded squares, no emoji in the UI.

### 0.2 Forbidden patterns (instant reject in review)

| Pattern | Use instead |
|---|---|
| KPI tile row ("Total spend / Requests / Approval %") | A single inline summary sentence in the page header, e.g. `3 need review · $1,024.00 allowed today` |
| Gradient fills, glows, blurred blobs, glassmorphism | Flat `--paper` / `--raised` surfaces |
| Robot, shield, lock or AI-sparkle illustrations | Real product UI (the trace) |
| Card grid for features | Numbered columns separated by vertical rules |
| `rounded-2xl` / pill-everything | Radius tokens below (max 10px, except the 999px status dot) |
| Centered paragraphs > 2 lines | Left-aligned text with a max measure of 64ch |
| Toasts for errors that need action | Inline error at the point of action |
| Spinners longer than 400ms without words | Skeleton rows plus a mono status line (`EVALUATING · policy 4/8`) |
| Color-only status chips | `StatusLabel` (dot + word) |
| Restyling the PayPal button | Render the official PayPal JS SDK button unmodified |
| More than 4 top-level nav items | Merge, or move into a page |

### 0.3 Copy budgets

| Surface | Budget |
|---|---|
| Landing headline | ≤ 9 words |
| Landing subline | ≤ 22 words |
| Section intro | ≤ 2 lines (≤ 140 chars) |
| Verdict reason line | ≤ 16 words |
| Button label | ≤ 3 words, verb first ("Approve purchase", "Continue to PayPal") |
| Empty state | 1 headline + 1 line + 1 action |
| Error | What happened + what is true now + what to do (≤ 3 short lines) |

### 0.4 Amending the constitution

1. Open a change to this file first, stating the law affected, the reason, and before/after screenshots.
2. Update `DESIGN_REFERENCES.md` if a new reference justifies it.
3. Only then change the code. Code changes that contradict this file without an amendment are reverted.

---

## Part 1 — Tokens

Defined once as CSS custom properties in `app/globals.css` and exposed to Tailwind through `@theme` (Tailwind v4) or `theme.extend` (v3). **Never hard-code hex values in components.**

### 1.1 Color: light (default)

| Token | Hex | Use | Contrast on `--paper` |
|---|---|---|---|
| `--paper` | `#F4F2EC` | App background (warm paper) | — |
| `--raised` | `#FBFAF7` | Trace panel, fields, popovers | — |
| `--sunken` | `#ECE9E1` | Selected row, code blocks | — |
| `--ink` | `#16150F` | Primary text, primary button fill | 16.3:1 |
| `--ink-2` | `#45423A` | Secondary text | 9.0:1 |
| `--muted` | `#6B675D` | Meta, labels, placeholders | 5.0:1 |
| `--rule` | `#DDD9CE` | Hairline dividers (decorative) | 1.3:1 (non-text) |
| `--rule-strong` | `#8C887D` | Field borders, focusable boundaries | 3.2:1 |
| `--allow` | `#1D6B45` | ALLOW / PAID text and marks | 5.8:1 |
| `--allow-tint` | `#E3EFE6` | Verdict band background | `--allow` on it: 5.5:1 |
| `--review` | `#8F5600` | REVIEW / pending text and marks | 5.4:1 |
| `--review-tint` | `#F5E9D3` | | 5.0:1 |
| `--block` | `#B42A18` | BLOCK / failed text and marks | 5.7:1 |
| `--block-tint` | `#F6E1DC` | | 5.1:1 |
| `--focus` | `#2F4FD8` | Focus ring **only** | 5.8:1 |
| `--on-ink` | `#FFFFFF` | Text on ink buttons | 18.3:1 |

### 1.2 Color: dark

Applied via `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`. The workspace supports dark mode. The landing page ships light-first.

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `--paper` | `#121210` | | `--allow` | `#5BC18A` |
| `--raised` | `#1A1A17` | | `--allow-tint` | `#15291D` |
| `--sunken` | `#22221E` | | `--review` | `#E0A43A` |
| `--ink` | `#EDEBE4` | | `--review-tint` | `#2C2212` |
| `--ink-2` | `#C2BEB3` | | `--block` | `#F0785F` |
| `--muted` | `#9A968B` | | `--block-tint` | `#2E1813` |
| `--rule` | `#2C2B27` | | `--focus` | `#8FA4FF` |
| `--rule-strong` | `#6B6A63` | | `--on-ink` | `#121210` |

All dark text tokens measure ≥ 5.9:1 on `--paper` and `--raised`.

### 1.3 Typography

| Family | Role | Source |
|---|---|---|
| **Newsreader** (variable, opsz 6–72, wght 300–800) | Display: headlines, verdict words, page titles | `next/font/google` |
| **Geist** (variable) | Interface: body, labels, buttons, navigation | `next/font/google` (or the `geist` package) |
| **Geist Mono** | Data: money, IDs, timestamps, rule codes, API samples | `next/font/google` |

Always set `font-variant-numeric: tabular-nums` on mono data and on any column of numbers.

| Style token | Family | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `display-xl` | Newsreader | `clamp(40px, 6vw, 72px)` / 1.02 | 450 | -0.025em | Landing hero only |
| `display-l` | Newsreader | 44 / 48 (mobile 34/38) | 450 | -0.02em | Verdict word ("Allowed.") |
| `display-m` | Newsreader | 28 / 34 | 500 | -0.015em | Page titles, section titles |
| `title` | Geist | 17 / 24 | 600 | -0.01em | Row titles, panel headers |
| `body` | Geist | 15 / 22 | 400 | 0 | Default text |
| `small` | Geist | 13 / 18 | 400 | 0 | Secondary lines |
| `label` | Geist Mono | 11.5 / 16, UPPERCASE | 500 | 0.06em | Field labels, column heads, env tags |
| `data` | Geist Mono | 13 / 20 | 400 | 0 | IDs, timestamps, rule codes |
| `amount-l` | Geist Mono | 32 / 36 | 500 | -0.01em | Hero amount on a request |
| `amount` | Geist Mono | 15 / 22 | 500 | 0 | Amounts in rows |

Rules:
- At most **4 type styles per screen region**.
- Serif is never used below 24px and never for UI controls.
- The verdict word ends with a period: "Allowed." "Needs review." "Blocked." "Paid." The full stop is part of the identity.
- Currency format: `$640.00` with the code as a muted `label` suffix only where currency could be ambiguous (`640.00 USD`).

### 1.4 Space, grid, layout

- Base unit: **4px**. Scale: `4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96`.
- Side gutter: `clamp(16px, 4vw, 40px)`.
- Landing: 12-column grid, `max-width: 1200px`.
- Workspace: full-bleed app shell.
  - Top bar: 56px.
  - Queue pane: 360px fixed (≥ 1024px).
  - Detail pane: fluid, content measure `max-width: 880px`.
- Text measure: ≤ 64ch.
- Row heights: queue row 72px, ledger row 48px, trace row 40px.
- Vertical rhythm between sections: 56px (workspace) / 96px (landing).

### 1.5 Shape and elevation

| Token | Value | Use |
|---|---|---|
| `--r-sm` | 4px | Tags, kbd |
| `--r-md` | 8px | Buttons, fields |
| `--r-lg` | 10px | Trace panel, dialogs, PayPal zone |
| `--r-dot` | 999px | Status dot only |
| `--hairline` | 1px solid `var(--rule)` | Dividers |
| `--shadow-pop` | `0 1px 2px rgb(22 21 15 / .06), 0 8px 24px rgb(22 21 15 / .08)` | Popovers and dialogs **only** |

Nothing else casts a shadow.

### 1.6 Motion

| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(.2, .8, .2, 1)` |
| `--ease-in-out` | `cubic-bezier(.6, 0, .2, 1)` |
| `--t-fast` | 120ms (hover, press) |
| `--t-base` | 200ms (enter/exit, tabs) |
| `--t-slow` | 320ms (verdict landing) |

Signature motions (the only "showpiece" animations allowed):
1. **Trace resolve.** Rows resolve top-down at a 90ms stagger. Each row fades from `--muted` to its final state with a 4px upward settle. Real backend timing drives this; cosmetic delay is capped at 1.2s in total.
2. **Verdict land.** The verdict word fades in with a 2% scale settle over `--t-slow`. The verdict band tint grows from 0 to full width over 320ms.
3. **Key turn.** When a key in the two-key indicator flips to granted, its glyph rotates 90° over `--t-base`.

`prefers-reduced-motion: reduce` replaces all motion with instant state changes (opacity only, ≤ 120ms).

### 1.7 Iconography

- A Lucide-style geometry set, 16px (20px in top bar), stroke 1.5, `currentColor`. *Amended 2026-11-03:* implemented as ~16 inline paths in `src/components/ui/icon.tsx` instead of the `lucide-react` dependency. Add new glyphs there in the same 16px grid.
- Icons accompany labels. Icon-only buttons need `aria-label` and a tooltip.
- No icon backgrounds, circles or squares.

---

## Part 2 — Components (anatomy specs)

Each component lives in `components/ui/` (primitives) or `components/guard/` (domain). Names are canonical.

### Button
- `primary`: `--ink` fill, `--on-ink` text, 40px high (48px on landing), `--r-md`, padding 0 16px, `body` 500. **Max one per view.**
- `secondary`: transparent, 1px `--rule-strong` border, `--ink` text.
- `quiet`: text only, underline on hover.
- `danger`: transparent with `--block` text and border. Used only for "Reject" and "Cancel request".
- States: hover darkens or lightens 6%, press translates 1px, `disabled` uses 40% opacity with a reason tooltip, `loading` keeps the label and appends `…` plus a 12px mono spinner, and the width never jumps.
- Focus: 2px `--focus` outline, 2px offset, always visible on `:focus-visible`.

### VerdictMark (signature)
```
┌──────────────────────────────────────────────────────────────┐
│ ▍ Needs review.                                   [REVIEW]   │  ← display-l + label tag
│ ▍ Over the $250 auto-approve limit; merchant is new.         │  ← body, ≤16 words
└──────────────────────────────────────────────────────────────┘
  ▍ = 3px left bar in verdict color; band background = *-tint
```
- Variants: `allow` ("Allowed."), `review` ("Needs review."), `block` ("Blocked."), `paid` ("Paid." in allow), `failed` ("Not paid." in block), `pending` ("Waiting for payer." in review).

### DecisionTrace (signature)
A bordered `--raised` panel with three numbered groups and mono rows.
```
01  POLICY · Default v3                              8 rules
    P-01  amount_auto_limit   $640.00 ≤ $250.00      REVIEW
    P-02  daily_budget        $640 of $1,500 left    PASS
    P-03  merchant_category   compute                PASS
    …
02  RISK · advisory                                  48 / 100
    ▸ new_merchant           first purchase from Kestrel Compute
    ▸ amount_above_typical   3.2× this agent's median
    model claude-sonnet-5-5 · 1.4s · prompt r-2
03  VERDICT                                          REVIEW
    AI can raise caution, never lower it.
```
- Row anatomy: `code` (data, muted) · `name` (data) · `observed vs limit` (data, ink-2) · `result` (StatusLabel, right-aligned).
- Results: `PASS` (muted ink with a check icon; *not* green, so green stays special), `REVIEW` (review), `BLOCK` (block), `SKIPPED` (muted).
- The risk score is a mono number plus a 120px hairline meter (ink fill, verdict color only past thresholds). No gauges or donuts.

### TwoKey (signature)
```
KEY 1  Policy approval   ● Granted · rule set v3      KEY 2  Payer approval   ○ Waiting · PayPal
```
- Two equal columns separated by a vertical rule. Each column is a key glyph, a label, a StatusLabel and a mono source.
- Shown on the request detail, the review screen, the checkout handoff and the result.

### StatusLabel
An 8px dot plus a word in `small` 500. The dot and word share the semantic color. Neutral states use `--muted`. Never color without the word.

### Amount
Mono and tabular, with the `$` included. Negative values or refunds are out of scope. `amount-l` on detail headers, `amount` in rows.

### IdTag
Mono `data` in `--muted`, e.g. `preq_7F3K…Q2`. It copies on click and shows "Copied" for 1.2s. Truncation keeps the prefix and the last 4 characters.

### EnvTag
`[SANDBOX]` as a bracketed `label` in `--review`, fixed in the top bar. It is always present, because we never let a viewer think this is live money.

### QueueRow (workspace list)
```
● Needs review   GPU hours · Kestrel Compute            $640.00
  research-assistant · 2m ago                    preq_…Q2
```
72px high, hairline below. Selected row: `--sunken` background plus a 2px ink left bar. Hover: `--sunken` at 50%.

### LedgerRow (audit history)
Columns: `time` (data) · `event` (data) · `request` (IdTag + title) · `actor` (small) · `amount` (amount) · `state` (StatusLabel). 48px high. Expands inline to show the event payload as a mono key-value list plus `hash ← prev_hash`.

### Field / Textarea / Search
- 40px high, `--raised` background, 1px `--rule-strong` border, `--r-md`. Label sits above in `label` style.
- Error: border and text in `--block`, plus a message below.
- Search supports the `/` shortcut and shows a `Kbd` hint.

### PayPalZone
A `--raised` bordered box (`--r-lg`) holding the official PayPal JS SDK button, plus one muted line: "You'll approve the payment in PayPal. Nothing is charged until you do." **No restyling of the PayPal button.**

### Dialog
Used only for destructive confirmations (Reject, Cancel). Title in `display-m`, one line of body text, then two buttons. Esc closes and focus is trapped.

### Toast
Only for non-blocking confirmations ("Copied", "Ledger exported"). Bottom-left, 4s, `aria-live="polite"`. **Never used for errors that need action.**

### Skeleton
Hairline-height bars in `--sunken`. Paired with a mono status line describing the actual step.

---

## Part 3 — Voice and vocabulary

Voice: calm, exact, slightly formal, like a good bank statement written by a good editor.

**Canonical terms (always use these exact words):**

| Use | Never use |
|---|---|
| Purchase request | Transaction (before payment), order (except PayPal order) |
| Allowed / Needs review / Blocked | Approved (ambiguous), Denied, Rejected (reserved for a reviewer's action) |
| Policy approval | Approval (alone) |
| Payer approval | Authorization, sign-off |
| Paid | Success, Done, Completed (in UI copy) |
| Not paid | Failed (alone), Error |
| Risk signal | Red flag, alert |
| Ledger | Logs, history (in UI copy) |

Rules:
- Name the actor: "Kestrel Compute is a new merchant" beats "Merchant risk detected".
- Failure copy always states what is true about money: "No payment was taken."
- Never say "successfully".
- Numbers beat adjectives: "3.2× this agent's median", not "unusually high".

---

## Part 4 — Accessibility

- Semantic landmarks: `header`, `nav`, `main`, `aside` (queue), and a skip link to `main`.
- Every interactive target is ≥ 40×40px (44px on touch).
- The decision trace is a `<section aria-labelledby>`. Rows are a `<table>` with proper headers. Verdict changes are announced via `aria-live="polite"`.
- Keyboard: `j`/`k` move through the queue, `Enter` opens, `/` focuses search, `a` approves and `r` rejects (review screen only, each with a confirmation step).
- No information conveyed only by color, motion or hover.
- Test with VoiceOver, keyboard only, 200% zoom and `prefers-reduced-motion`.

## Part 5 — Responsive

| Breakpoint | Behavior |
|---|---|
| ≥ 1280 | Workspace: queue + detail. The trace and TwoKey sit side by side where space allows. |
| 1024–1279 | Queue + detail. The trace stacks above TwoKey. |
| 640–1023 | The queue is its own page (`/requests`) and the detail is a full page (`/requests/[id]`) with a back link. |
| < 640 | Single column, 16px gutter, primary action pinned in a bottom bar (56px, safe-area aware). Ledger rows collapse to two lines. |

No horizontal page scroll at any width. Wide tables scroll inside their own container, with a visible edge fade.

## Part 6 — Review checklist (paste into every UI PR)

(See Part 7 for where each rule lives in code.)

- [ ] Exactly one primary button in each view
- [ ] No hex values outside `globals.css`
- [ ] Color only on verdict or payment state, always paired with a word
- [ ] Copy within the budgets in §0.3, using canonical vocabulary from Part 3
- [ ] TwoKey shown wherever payment readiness appears
- [ ] Nothing says "Paid" unless status is `PAID`
- [ ] Motion limited to the three signature motions, and reduced-motion respected
- [ ] Keyboard path works, focus is visible, contrast checked
- [ ] Verified at 375px, 768px, 1280px with no horizontal scroll
- [ ] None of the forbidden patterns from §0.2 are present


---

## Part 7 — Implementation map (added 2026-11-03, binding)

| Concept | Lives in | Notes |
|---|---|---|
| Tokens (light + dark) | `src/app/globals.css` (`:root`, `@theme inline`) | The only file allowed to contain color literals |
| Type styles | `@utility t-display-xl … t-amount` in `globals.css` | Use these utilities. Never ad-hoc font sizes for these roles |
| Signature motions | `.motion-resolve`, `.motion-land`, `.motion-band`, `.motion-turn` | Plus `.motion-fade` (menus/sheets only) and `.motion-pulse` (live status dots, status lines). Nothing else animates |
| Vocabulary and verdict lines | `src/lib/copy.ts` (`STATUS`, `verdictFor`, `EVENT_LABEL`, `COPY`) | Add new states here first |
| Tone → class maps | `TONE_TEXT/BG/TINT/BORDER` in `components/ui/primitives.tsx` | Never build class names dynamically (`border-${tone}`): Tailwind cannot see them |
| Signature components | `components/guard/verdict.tsx`, `trace.tsx` | `DecisionTrace` has a `compact` variant for the landing hero only |

Layout decisions made during visual QA (keep them):
- Workspace queue pane is **392px** (fits all six filter chips on one line). Detail measure stays ≤ 880px.
- Trace rows are **single-line**. The `limit` gets its own column at ≥ 1280px and is a tooltip below that. On < 768px each row shows its one-line `message` instead of observed/limit (except the compact hero).
- The landing hero's text column is `sticky` beside the taller trace panel. Do not pad the text column with filler to "balance" it.
- Responsive display toggles go on a **wrapper element**, never on a `Button`/`ButtonLink` itself (`hidden` loses to the component's own `inline-flex`; this caused a 500px-wide mobile page).
- Every grid that holds the trace or tables needs `grid-cols-1`/`minmax(0,1fr)` + `min-w-0` on its children.
- Long IDs: short form (`preq_…7F3K`) everywhere except the References list, which uses the `IdTag full` variant (`break-all`).
- Mock mode is always labelled: `[MOCK]` env tag, top banner, "Simulated PayPal approval" panel, `[SIMULATED]` tag on paid results. Never style the mock payer panel like PayPal.

Visual QA procedure: `scripts/visual-qa.cjs` (desktop 1440×900, mobile 390×844). A UI change is not done until both runs report `errors: none` and the screenshots have been looked at.
