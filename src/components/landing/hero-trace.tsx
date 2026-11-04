"use client";

import { useEffect, useRef, useState } from "react";
import type { PurchaseRequest, ScenarioKey } from "@/contract";
import { MockEngine, emptyState } from "@/lib/api/mock/engine";
import { verdictFor } from "@/lib/copy";
import { formatMoney } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { Button, cx } from "@/components/ui/primitives";
import { DecisionTrace } from "@/components/guard/trace";
import { VerdictMark } from "@/components/guard/verdict";

const PRESETS: { key: ScenarioKey; label: string }[] = [
  { key: "a_low_risk", label: "$18 API credits" },
  { key: "b_needs_review", label: "$640 GPU hours" },
  { key: "c_blocked", label: "$2,400 gift cards" },
];

/** Deterministic: the same engine the workspace uses in mock mode, run locally for the hero. */
function computePresets(): Record<string, PurchaseRequest> {
  const fixedClock = () => Date.UTC(2026, 10, 10, 22, 0, 0);
  const out: Record<string, PurchaseRequest> = {};
  for (const p of PRESETS) {
    const isolated = new MockEngine(fixedClock, emptyState());
    const res = isolated.runScenario(p.key);
    isolated.evaluate(res.request.id);
    out[p.key] = isolated.get(res.request.id, "operator");
  }
  return out;
}

export function HeroTrace() {
  const [presets] = useState(computePresets);
  const [key, setKey] = useState<ScenarioKey>("b_needs_review");
  const [phase, setPhase] = useState<"static" | "running" | "done">("static");
  const [run, setRun] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const r = presets[key]!;
  const v = verdictFor(r);

  const start = (k: ScenarioKey) => {
    setKey(k);
    setPhase("running");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPhase("done");
      setRun((n) => n + 1);
    }, 900);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const verdictDelay = phase === "done" ? (r.evaluation!.policy.length + r.evaluation!.risk.signals.length + 3) * 90 : 0;

  return (
    <div className="rounded-lg border border-rule bg-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
        <div role="tablist" aria-label="Sample agent request" className="-mx-1 flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              role="tab"
              type="button"
              aria-selected={key === p.key}
              onClick={() => start(p.key)}
              className={cx(
                "h-8 rounded-sm px-2.5 t-small font-medium transition-colors duration-(--t-fast)",
                key === p.key ? "bg-ink text-on-ink" : "text-ink-2 hover:bg-sunken",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" icon="play" onClick={() => start(key)} loading={phase === "running"}>
          Run decision
        </Button>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="min-w-0 truncate t-small text-ink-2">
            <span className="font-mono text-ink">{r.agent.name}</span> → {r.merchant.name}
          </p>
          <p className="t-amount text-ink">{formatMoney(r.amount)}</p>
        </div>

        <div className="min-h-[102px]">
          {phase === "running" ? (
            <div className="flex h-[102px] items-center rounded-lg border border-dashed border-rule px-5">
              <p className="t-label text-muted motion-pulse">Evaluating · policy, then risk</p>
            </div>
          ) : (
            <VerdictMark key={`${key}-${run}`} tone={v.tone} word={v.word} reason={v.reason} tag={v.tag} size="m" animate={phase === "done"} delayMs={verdictDelay} />
          )}
        </div>

        <DecisionTrace
          key={`${key}-${run}`}
          evaluation={r.evaluation}
          decision={r.decision}
          evaluating={phase === "running"}
          animate={phase === "done"}
          compact
          className="border-rule"
        />
      </div>
      <p className="flex items-center gap-1.5 border-t border-rule px-4 py-2.5 t-small text-muted sm:px-5">
        <Icon name="dot" /> Runs locally on fictional data. Nothing is sent anywhere.
      </p>
    </div>
  );
}
