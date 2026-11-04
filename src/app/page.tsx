import Link from "next/link";
import { ButtonLink, StatusLabel } from "@/components/ui/primitives";
import { EnvTag, Wordmark } from "@/components/shell/top-bar";
import { HeroTrace } from "@/components/landing/hero-trace";
import { PacificClock } from "@/components/landing/clock";
import type { Tone } from "@/lib/copy";

const PRINCIPLES = [
  { n: "01", title: "Policy", kind: "deterministic", body: "Eight rules decide what an agent may buy. Same input, same answer, every time." },
  { n: "02", title: "Risk", kind: "advisory", body: "An AI model reads intent and spots prompt injection. It can add caution, never remove it." },
  { n: "03", title: "Two keys", kind: "human", body: "Policy approval from Guard or a reviewer. Payer approval inside PayPal. Always both." },
];

const SCENARIOS: { l: string; q: string; tone: Tone; outcome: string; amount: string }[] = [
  { l: "A", q: "Does it really pay through PayPal?", tone: "allow", outcome: "Allowed, then paid", amount: "$18.00" },
  { l: "B", q: "Where does a person step in?", tone: "review", outcome: "Needs review", amount: "$640.00" },
  { l: "C", q: "What if the agent is manipulated?", tone: "block", outcome: "Blocked · 0 PayPal calls", amount: "$2,400.00" },
  { l: "D", q: "What if the agent retries?", tone: "neutral", outcome: "Replayed, never duplicated", amount: "$18.00" },
  { l: "E", q: "What if the payment fails?", tone: "block", outcome: "Not paid, then recovered", amount: "$96.00" },
];

const LEDGER: { t: string; e: string; who: string; amount: string; tone: Tone; state: string }[] = [
  { t: "14:02:11", e: "decision.made", who: "AgentPay Guard", amount: "$640.00", tone: "review", state: "Needs review" },
  { t: "14:05:47", e: "review.approved", who: "M. Okafor", amount: "$640.00", tone: "allow", state: "Allowed" },
  { t: "14:06:02", e: "checkout.created", who: "S. Lindqvist", amount: "$640.00", tone: "review", state: "Waiting for payer" },
  { t: "14:06:30", e: "payment.completed", who: "PayPal", amount: "$640.00", tone: "allow", state: "Paid" },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-on-ink">Skip to content</a>

      <header className="border-b border-rule">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 gutter">
          <Link href="/" aria-label="AgentPay Guard home"><Wordmark /></Link>
          <nav aria-label="Sections" className="hidden md:block">
            <ul className="flex gap-6 t-small font-medium text-ink-2">
              <li><a className="hover:text-ink" href="#how">How it works</a></li>
              <li><a className="hover:text-ink" href="#scenarios">Scenarios</a></li>
              <li><a className="hover:text-ink" href="#ledger">Ledger</a></li>
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <EnvTag />
            <ButtonLink href="/requests" size="sm">Open workspace</ButtonLink>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero: headline + the product, running. */}
        <section className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 pb-20 pt-12 gutter sm:pt-16 lg:grid-cols-12 lg:gap-10 lg:pb-24 lg:pt-20">
          <div className="min-w-0 lg:sticky lg:top-10 lg:col-span-6 lg:self-start lg:pt-6">
            <p className="t-label text-muted">Payment control for AI agents</p>
            <h1 className="mt-5 t-display-xl text-balance">
              Give AI agents spending power. <em className="font-display italic text-ink-2">Keep humans in control.</em>
            </h1>
            <p className="mt-6 max-w-[34ch] text-[18px] leading-[28px] text-ink-2 text-pretty">
              Policies decide. AI advises. PayPal moves money only after two approvals: the rules&apos; and a person&apos;s.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <ButtonLink href="/requests" variant="primary" size="lg" iconRight="arrowRight">Open the workspace</ButtonLink>
              <a href="#scenarios" className="t-body font-medium text-ink underline-offset-4 hover:underline">See the five scenarios</a>
            </div>
          </div>
          <div className="min-w-0 lg:col-span-6">
            <HeroTrace />
          </div>
        </section>

        {/* 01 / 02 / 03 — numbered columns on rules, not cards. */}
        <section id="how" aria-labelledby="how-title" className="border-y border-rule">
          <div className="mx-auto max-w-[1200px] gutter">
            <h2 id="how-title" className="sr-only">How a decision is made</h2>
            <ol className="grid divide-y divide-rule md:grid-cols-3 md:divide-x md:divide-y-0">
              {PRINCIPLES.map((p) => (
                <li key={p.n} className="py-10 md:px-8 md:first:pl-0 md:last:pr-0">
                  <p className="t-label text-muted">{p.n} · {p.kind}</p>
                  <h3 className="mt-3 font-display text-[30px] leading-[34px] tracking-[-0.015em]">{p.title}</h3>
                  <p className="mt-3 max-w-[36ch] t-body text-ink-2">{p.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Scenarios — the demo, as an index. */}
        <section id="scenarios" aria-labelledby="scenarios-title" className="mx-auto max-w-[1200px] py-20 gutter lg:py-24">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 id="scenarios-title" className="t-display-m">Five questions,<br />answered live.</h2>
              <p className="mt-3 max-w-[32ch] t-body text-ink-2">Each scenario runs through the same agent API in the workspace.</p>
            </div>
            <ol className="border-t border-rule lg:col-span-8">
              {SCENARIOS.map((s) => (
                <li key={s.l} className="grid grid-cols-[28px_1fr] items-baseline gap-x-4 gap-y-1 border-b border-rule py-4 sm:grid-cols-[32px_1fr_auto_96px]">
                  <span className="t-data text-muted">{s.l}</span>
                  <span className="t-body text-ink">{s.q}</span>
                  <span className="col-start-2 sm:col-start-auto"><StatusLabel tone={s.tone}>{s.outcome}</StatusLabel></span>
                  <span className="hidden text-right t-amount text-ink-2 sm:block">{s.amount}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Ledger excerpt */}
        <section id="ledger" aria-labelledby="ledger-title" className="border-t border-rule bg-raised">
          <div className="mx-auto grid max-w-[1200px] gap-10 py-20 gutter lg:grid-cols-12 lg:py-24">
            <div className="lg:col-span-4">
              <h2 id="ledger-title" className="t-display-m">Every decision is written down.</h2>
              <p className="mt-3 max-w-[32ch] t-body text-ink-2">Append-only and hash-chained, so an edited row breaks the chain.</p>
            </div>
            <div className="min-w-0 lg:col-span-8">
              <ol className="border-t border-rule">
                {LEDGER.map((row) => (
                  <li key={row.e} className="grid grid-cols-[72px_1fr_auto] items-baseline gap-x-4 border-b border-rule py-3 sm:grid-cols-[80px_180px_1fr_96px_auto]">
                    <span className="t-data text-muted">{row.t}</span>
                    <span className="t-data text-ink">{row.e}</span>
                    <span className="hidden t-small text-ink-2 sm:block">{row.who}</span>
                    <span className="hidden text-right t-amount text-ink-2 sm:block">{row.amount}</span>
                    <span className="text-right"><StatusLabel tone={row.tone}>{row.state}</StatusLabel></span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 t-data text-muted">hash 9c1e…a07 ← 51b2…ee4 · chain verified</p>
            </div>
          </div>
        </section>

        <section className="border-t border-rule">
          <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 py-16 gutter sm:flex-row sm:items-center">
            <p className="font-display text-[30px] leading-[36px] tracking-[-0.015em] text-balance">Run all five scenarios yourself.</p>
            <ButtonLink href="/requests" size="lg" iconRight="arrowRight">Open the workspace</ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 py-6 gutter sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 t-small text-muted">
            <EnvTag /> <span>Fictional data · PayPal Sandbox · Built for the PayPal AI Hackathon 2026</span>
          </p>
          <PacificClock />
        </div>
      </footer>
    </div>
  );
}
