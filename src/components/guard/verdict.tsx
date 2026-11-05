"use client";

import type { KeyState, PurchaseRequest, RequestStatus } from "@/contract";
import { payerKeyNote, policyKeyNote, type Tone } from "@/lib/copy";
import { clock } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { StatusLabel, TONE_BORDER, TONE_TEXT, TONE_TINT, cx } from "@/components/ui/primitives";

/** Signature: the typographic verdict. One word in serif, one line of reason. */
export function VerdictMark({ tone, word, reason, tag, animate = true, delayMs = 0, size = "l", className }: {
  tone: Tone; word: string; reason: string; tag?: string; animate?: boolean; delayMs?: number; size?: "l" | "m"; className?: string;
}) {
  const style = animate ? { animationDelay: `${delayMs}ms` } : undefined;
  return (
    <div className={cx("relative overflow-hidden rounded-lg", className)} aria-live="polite">
      <div aria-hidden className={cx("absolute inset-0", TONE_TINT[tone], animate && "motion-band")} style={style} />
      <div className={cx("relative flex items-start gap-4 border-l-[3px] px-5 py-4 sm:px-6 sm:py-5", TONE_BORDER[tone])}>
        <div className="min-w-0 flex-1">
          <p className={cx(size === "l" ? "t-display-l" : "t-display-m", "text-ink", animate && "motion-land")} style={style}>{word}</p>
          <p className="mt-1.5 t-body text-ink-2 text-pretty">{reason}</p>
        </div>
        {tag && <span className={cx("t-label mt-2 shrink-0", TONE_TEXT[tone])}>[{tag}]</span>}
      </div>
    </div>
  );
}

const KEY_TONE: Record<KeyState["state"], { tone: Tone; word: string }> = {
  granted: { tone: "allow", word: "Granted" },
  waiting: { tone: "review", word: "Waiting" },
  denied: { tone: "block", word: "Denied" },
  not_applicable: { tone: "neutral", word: "Not applicable" },
};

function KeyColumn({ n, title, k, source, note }: { n: 1 | 2; title: string; k: KeyState; source: string; note?: { word: string; detail: string } | null }) {
  const meta = KEY_TONE[k.state];
  const word = note?.word ?? meta.word;
  const detail = note?.detail ?? k.detail;
  return (
    <div className="flex min-w-0 gap-3 py-4 sm:px-5 first:sm:pl-0">
      <span
        key={k.state}
        aria-hidden
        className={cx("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border", k.state === "granted" ? "border-allow text-allow motion-turn" : "border-rule-strong text-muted")}
      >
        <Icon name="key" />
      </span>
      <div className="min-w-0">
        <p className="t-label text-muted">Key {n} · {source}</p>
        <p className="t-title mt-0.5">{title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <StatusLabel tone={meta.tone}>{word}</StatusLabel>
          {detail && <span className="t-small text-ink-2">· {detail}</span>}
        </div>
        {k.at && <p className="mt-0.5 t-data text-muted">{clock(k.at)}</p>}
      </div>
    </div>
  );
}

/** Signature: Policy approval and Payer approval are always shown together and never merged. */
export function TwoKey({ keys, status, className }: { keys: PurchaseRequest["keys"]; status?: RequestStatus; className?: string }) {
  return (
    <section aria-label="Approval keys" className={cx("grid grid-cols-1 divide-y divide-rule sm:grid-cols-2 sm:divide-x sm:divide-y-0", className)}>
      <KeyColumn n={1} title="Policy approval" k={keys.policy} source="Guard" note={policyKeyNote(keys.policy, status)} />
      <KeyColumn n={2} title="Payer approval" k={keys.payer} source="PayPal" note={payerKeyNote(keys.payer.state, status)} />
    </section>
  );
}
