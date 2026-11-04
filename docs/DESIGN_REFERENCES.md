# Design References

Purpose: record what we studied, how we studied it, and which **principles** (never assets, layouts or code) we carried into AgentPay Guard.

## How these were inspected (honest method note)

On 2026-11-03 we inspected the references below in two ways:

1. **Text and structure extraction** (an HTML-to-markdown fetch). This shows section order, navigation, copy length, labels and microcopy.
2. **Raw HTML/CSS download** (`curl`) to read real design tokens: font families, color variables, easing, radii and breakpoints.

We did **not** view rendered screenshots. Claims about motion and visual feel are marked *(inferred)* where they come from labels or CSS rather than from watching the page. Devpost pages (`paypalaihackathon.devpost.com`, `/rules`) returned **HTTP 403** to our tools and were **not inspected**. Hackathon facts come from the brief and are flagged for human verification.

---

## 1. Primary references

### jin.pixelberry.io (Jin Yi, product designer/engineer)
**Observed (text + CSS):**
- A single scrolling page: hero → about → recent work → marquee → contact → footer. A skip link sits at the top. The nav has 4 items plus a language toggle.
- The hero is a **runnable workflow canvas**: Design → Engineering → profile → Ship nodes, a "Run" button, and the status text "실행 완료 · 0 → 1" (run complete). Nodes can be dragged.
- Work cards are very short: client · year, a single **quantified** outcome line, tech tags, and "자세히 보기" (see details).
- Copy is short and direct. Example: "보기 좋은 화면보다, 쓰는 사람이 망설이지 않는 화면을 만드는 게 목표예요." ("The goal is a screen people never hesitate on, not just a pretty one.")
- CSS tokens: a warm tinted neutral background (`--bg: #fbf7f9`), ink `#17151b`, **one** brand accent (`--berry: #e04f95`) plus a separate `--live: #1fb374` status color. Display font Syne paired with Pretendard Variable. Display tracking `-0.035em`. Easing `cubic-bezier(.22,1,.36,1)`. Radius 22px. Wrap width 1240px. Fluid gutter `clamp(20px,4vw,40px)`. Full dark-mode token set. A `prefers-reduced-motion` block. Small UI text at 12.5–15.5px.

**Principles we take:**
- **Let the visitor run the product in the hero.** Show a working idea instead of describing it. → Our landing hero is a live *decision trace* you can run.
- **One accent, plus status colors used only for meaning.** → Ink-only UI chrome. Color is reserved for verdicts.
- **Quantified, one-line outcomes** instead of paragraphs. → Every verdict has a single-line reason.
- **Tool-like meta labels** next to big type. → Monospace IDs, timestamps and environment tags.
- **Accessibility as structure:** skip link, reduced-motion support, tokenized dark mode.

**Deliberately not taken:** the node-graph canvas, draggable nodes, the marquee, the pink palette, Syne, 22px radii, and the card grid.

### colorlib.com/wp/developer-portfolios (curated list)
We read the full list (21 portfolios) and fetched several for a closer look.

| Portfolio | Observed | Principle we take |
|---|---|---|
| **brittanychiang.com** | A fixed left column (name, one-line role, 3 section links) beside a scrolling right column. Experience rows are *date column → "Role · Company" → 1–3 sentences → tags*. Tailwind slate palette with one teal accent. A skip link. | **A fixed context pane with a scrolling detail pane** → the workspace layout (queue left, decision right). **Rows, not cards**, built on a strict and repeatable anatomy. |
| **antfu.me** | No project cards. Projects are inline links grouped by short role labels ("Creator of", "Maintaining"). Very dense, yet it skims fast because most text is link labels. | **Density through grouping and labels, not boxes** → ledger rows and trace rows grouped under short labels. |
| **laplaya.studio** | Bracketed index-style metadata ("[CURRENTLY EXPLORING: 29°12'28"N …]", "[Instagram]") and footnote-style asterisk sublines. | **Metadata as texture.** → bracketed environment/ID tags such as `[SANDBOX]` and `[REQ 7F3K]`. Used sparingly. |
| **lelandjansen.com** | A very sparse hero (one line plus a ~12-word tagline). Employment rows are *date · company · one line · Read more →*. | **Headline plus one line, then proof.** → landing copy budget. |
| **andrevv.com** | A fixed minimal header (name + "Info"). Project names and roles reveal in place *(scramble effect described by Colorlib; not confirmed in our extraction)*. | **Motion only where content arrives.** → trace rows resolve one by one. No ambient animation. |
| **linear.app** (contemporary SaaS) | Hero headline is ~9 words with a one-line subline. Real product UI is the hero visual. Numbered "Fig" motif. Inter Variable plus a monospace font used heavily for metadata. | **Real UI as the illustration, numbered sections.** → numbered 01/02/03 sections and real product surfaces. No illustrations. |

### Contemporary fintech (token check only)
- **mercury.com**: a custom serif/sans pair (Arcadia Display / Arcadia Text). It confirms that a *serif display face* reads as premium and trustworthy in finance.
- **ramp.com**: an almost entirely black/white token set (`black-600`, `white-100`). It confirms that **monochrome chrome with restrained color** is credible for spend control.
- **stripe.com/docs**: dense documentation built from obfuscated font tokens. We drew no visual principle from it, but it guides how we write the API contract (precise, example-led).

---

## 2. Synthesis: the principles that shape AgentPay Guard

1. **Show, don't claim.** The hero is the product running. No illustrations, robots or shields.
2. **Ink chrome, semantic color.** Neutrals carry the whole UI. Green, amber and vermilion appear *only* as verdicts and state.
3. **Rows over cards.** Information is composed on hairline rules and strict row anatomies. Cards are the exception.
4. **Editorial type contrast.** A serif display face for verdicts and headlines, a precise sans for UI, and monospace tabular figures for money and IDs.
5. **One line of reason.** Every state has a single sentence of explanation. Detail is one click deeper, never on the surface.
6. **Motion marks arrival, never decoration.** Things animate when they *resolve* (a rule passes, a verdict lands) and at no other time.
7. **Fixed context, scrolling detail.** You always know which request you are looking at.
8. **Metadata as quiet texture.** Bracketed environment tags and mono IDs signal "instrument", not "marketing site".

## 3. Anti-references (what "generic AI SaaS" looks like, so we avoid it)

- A metric-tile row ("Total spend · Requests · Approval rate") at the top of every screen.
- Purple-to-blue gradients, glowing orbs, glass panels.
- A three-card "Features" grid with icons in rounded squares.
- Shield or robot hero illustrations.
- Center-aligned marketing paragraphs of 40+ words.
- A dashboard sidebar with 9 navigation items.
