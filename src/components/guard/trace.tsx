"use client";

import { useId } from "react";
import type { Decision, Evaluation, RiskAssessment, RuleOutcome } from "@/contract";
import type { Tone } from "@/lib/copy";
import { COPY } from "@/lib/copy";
import { Icon } from "@/components/ui/icon";
import { Skeleton, StatusLabel, StatusLine, TONE_BG, TONE_TEXT, cx } from "@/components/ui/primitives";

const STAGGER = 90;

const RESULT: Record<RuleOutcome, { tone: Tone; word: string }> = {
  pass: { tone: "neutral", word: "Pass" },
  review: { tone: "review", word: "Review" },
  block: { tone: "block", word: "Block" },
  skipped: { tone: "neutral", word: "Skipped" },
};

const OUTCOME: Record<Decision["outcome"], { tone: Tone; word: string }> = {
  ALLOW: { tone: "allow", word: "Allow" },
  REVIEW: { tone: "review", word: "Review" },
  BLOCK: { tone: "block", word: "Block" },
};

function RuleResult({ outcome }: { outcome: RuleOutcome }) {
  const r = RESULT[outcome];
  // Pass is deliberately muted ink, not green: green stays reserved for the verdict.
  if (outcome === "pass") {
    return (
      <span className="inline-flex items-center gap-1.5 t-small font-medium text-muted">
        <Icon name="check" size={14} />
        Pass
      </span>
    );
  }
  return <StatusLabel tone={r.tone}>{r.word}</StatusLabel>;
}

/** Risk score as a 120px hairline meter: ink fill, verdict color only past thresholds. No gauges. */
export function RiskMeter({ score }: { score: number }) {
  const tone: Tone = score >= 70 ? "block" : score >= 35 ? "review" : "neutral";
  return (
    <span className="inline-flex items-center gap-3 whitespace-nowrap" aria-label={`Risk score ${score} out of 100`}>
      <span aria-hidden className="relative h-[3px] w-[72px] rounded-full bg-rule sm:w-[120px]">
        <span className={cx("absolute inset-y-0 left-0 rounded-full", tone === "neutral" ? "bg-ink" : TONE_BG[tone])} style={{ width: `${score}%` }} />
        <span className="absolute -top-1 h-[11px] w-px bg-rule-strong" style={{ left: "35%" }} />
        <span className="absolute -top-1 h-[11px] w-px bg-rule-strong" style={{ left: "70%" }} />
      </span>
      <span className={cx("t-amount", tone === "neutral" ? "text-ink" : TONE_TEXT[tone])}>
        {score}<span className="text-muted"> / 100</span>
      </span>
    </span>
  );
}

function GroupHead({ n, title, kind, right }: { n: string; title: string; kind: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-2 pt-4 sm:px-5">
      <span className="t-label text-muted">{n}</span>
      <h3 className="t-label text-ink">{title}</h3>
      <span className="hidden t-label text-muted sm:inline">· {kind}</span>
      <span className="ml-auto">{right}</span>
    </div>
  );
}

function RiskBlock({ risk, animate, baseDelay, compact }: { risk: RiskAssessment; animate: boolean; baseDelay: number; compact?: boolean }) {
  const style = (i: number) => (animate ? { animationDelay: `${baseDelay + i * STAGGER}ms` } : undefined);
  const cls = animate ? "motion-resolve" : "";

  if (risk.status !== "completed") {
    return (
      <div className={cx("px-4 pb-4 sm:px-5", cls)} style={style(0)}>
        <p className="t-small text-ink-2">
          {risk.status === "skipped" ? risk.summary ?? "Skipped." : "Risk could not be assessed. The request goes to a person."}
        </p>
      </div>
    );
  }
  return (
    <div className="px-4 pb-4 sm:px-5">
      {risk.summary && !compact && <p className={cx("t-body text-ink-2 text-pretty", cls)} style={style(0)}>{risk.summary}</p>}
      {risk.signals.length > 0 && (
        <ul className={cx("divide-y divide-rule border-y border-rule", !compact && "mt-3")}>
          {risk.signals.map((s, i) => (
            <li
              key={s.code + i}
              className={cx("flex gap-1 py-2", compact ? "flex-row items-baseline gap-3" : "flex-col sm:flex-row sm:items-baseline sm:gap-4", cls)}
              style={style(i + 1)}
            >
              <span className={cx("flex min-w-0 shrink-0 items-baseline gap-2 t-small font-medium", !compact && "sm:w-[42%]", s.severity === "high" ? "text-block" : s.severity === "warn" ? "text-review" : "text-ink-2")}>
                <span aria-hidden>▸</span>
                <span>{s.label}</span>
              </span>
              {s.evidence ? (
                <q className={cx("t-data text-ink-2 [quotes:none] before:content-['“'] after:content-['”']", compact && "min-w-0 truncate")} title={s.evidence}>{s.evidence}</q>
              ) : (
                <span className={cx("t-data text-muted", compact && "min-w-0 truncate")}>{s.source_field}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!compact && (
        <p className={cx("mt-3 t-data text-muted", cls)} style={style(risk.signals.length + 1)}>
          model {risk.model} · prompt {risk.prompt_version}{risk.latency_ms ? ` · ${(risk.latency_ms / 1000).toFixed(1)}s` : ""}
        </p>
      )}
      {compact && risk.signals.length === 0 && risk.summary && <p className={cx("t-small text-ink-2", cls)} style={style(0)}>{risk.summary}</p>}
    </div>
  );
}

/**
 * Signature: the decision trace. 01 Policy (deterministic) → 02 Risk (advisory) → 03 Verdict.
 * Rows resolve top-down only when the evaluation *arrives* (`animate`), never on revisit.
 */
export function DecisionTrace({ evaluation, decision, evaluating, animate = false, className, compact = false }: {
  evaluation: Evaluation | null; decision: Decision | null; evaluating?: boolean; animate?: boolean; className?: string; compact?: boolean;
}) {
  const titleId = useId();
  const counts = evaluation?.policy.reduce<Record<RuleOutcome, number>>((acc, p) => ((acc[p.outcome] += 1), acc), { pass: 0, review: 0, block: 0, skipped: 0 });
  const policyCount = evaluation?.policy.length ?? 8;
  const riskDelay = policyCount * STAGGER + 120;
  const verdictDelay = riskDelay + ((evaluation?.risk.signals.length ?? 0) + 2) * STAGGER;
  const rowStyle = (i: number) => (animate ? { animationDelay: `${i * STAGGER}ms` } : undefined);
  const pad = compact ? "py-2" : "py-2.5";

  return (
    <section aria-labelledby={titleId} className={cx("overflow-hidden rounded-lg border border-rule bg-raised", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
        <h2 id={titleId} className="t-label text-ink">Decision trace</h2>
        <span className="t-data text-muted">
          {evaluation ? `${evaluation.policy_set.name} · v${evaluation.policy_set.version}` : "Default · v3"}
        </span>
      </div>

      {/* 01 POLICY */}
      <GroupHead
        n="01"
        title="Policy"
        kind="deterministic"
        right={counts ? (
          <span className="t-data text-muted">
            {counts.pass} pass{counts.review ? ` · ${counts.review} review` : ""}{counts.block ? ` · ${counts.block} block` : ""}
          </span>
        ) : null}
      />
      {evaluating || !evaluation ? (
        <div className="px-4 pb-4 sm:px-5">
          <div className="space-y-3 py-1" aria-hidden>
            {Array.from({ length: compact ? 4 : 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-2 w-10" />
                <Skeleton className="h-2 flex-1 max-w-[220px]" />
                <Skeleton className="ml-auto h-2 w-12" />
              </div>
            ))}
          </div>
          <div className="mt-3"><StatusLine>Evaluating · policy, then risk</StatusLine></div>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <caption className="sr-only">Policy rule results</caption>
          <thead className="sr-only">
            <tr><th scope="col">Rule</th><th scope="col">Check</th><th scope="col">Observed</th>{!compact && <th scope="col">Limit</th>}<th scope="col">Result</th></tr>
          </thead>
          <tbody>
            {evaluation.policy.map((p, i) => (
              <tr
                key={p.rule_id}
                className={cx("border-t border-rule align-baseline", animate && "motion-resolve", p.outcome === "block" && "bg-block-tint/60", p.outcome === "review" && "bg-review-tint/50")}
                style={rowStyle(i)}
              >
                <th scope="row" className={cx("w-[64px] pl-4 pr-2 text-left font-normal sm:pl-5", pad)}>
                  <span className="t-data text-muted">{p.rule_id}</span>
                </th>
                <td className={cx("pr-3", pad)}>
                  <span className="t-data text-ink">{p.rule_key}</span>
                  {!compact && <span className="block t-small text-ink-2 md:hidden">{p.message}</span>}
                </td>
                <td className={cx("hidden pr-3 md:table-cell", pad)}>
                  <span className="t-data text-ink-2" title={p.limit ?? undefined}>{p.observed}</span>
                </td>
                {!compact && (
                  <td className={cx("hidden pr-3 xl:table-cell", pad)}>
                    <span className="t-data text-muted">{p.limit}</span>
                  </td>
                )}
                <td className={cx("w-[96px] pr-4 text-right sm:pr-5", pad)}><RuleResult outcome={p.outcome} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 02 RISK */}
      <div className="border-t border-rule">
        <GroupHead
          n="02"
          title="Risk"
          kind="advisory"
          right={evaluation?.risk.status === "completed" && evaluation.risk.score !== null && !evaluating ? (
            <span className={cx(animate && "motion-resolve")} style={animate ? { animationDelay: `${riskDelay}ms` } : undefined}>
              <RiskMeter score={evaluation.risk.score} />
            </span>
          ) : null}
        />
        {evaluating || !evaluation ? (
          <div className="px-4 pb-4 sm:px-5" aria-hidden>
            <Skeleton className="h-2 w-2/3" />
          </div>
        ) : (
          <RiskBlock risk={evaluation.risk} animate={animate} baseDelay={riskDelay} compact={compact} />
        )}
      </div>

      {/* 03 VERDICT */}
      <div className="border-t border-rule">
        <GroupHead
          n="03"
          title="Verdict"
          kind="combined"
          right={decision && !evaluating ? (
            <span className={cx(animate && "motion-resolve")} style={animate ? { animationDelay: `${verdictDelay}ms` } : undefined}>
              <StatusLabel tone={OUTCOME[decision.outcome].tone}>{OUTCOME[decision.outcome].word}</StatusLabel>
            </span>
          ) : null}
        />
        <p className={cx("px-4 pb-4 t-small text-ink-2 sm:px-5", compact && "pb-3")}>
          {decision && !evaluating ? verdictFootnote(decision, evaluation) : COPY.aiBoundary}
        </p>
      </div>
    </section>
  );
}

function verdictFootnote(d: Decision, e: Evaluation | null): string {
  if (d.risk_escalated) return "Rules passed. AI raised caution, so a person decides.";
  if (d.outcome === "BLOCK" && e?.risk.level === "high") return "AI flagged this; rules blocked it. AI can raise caution, never lower it.";
  if (d.outcome === "BLOCK") return "Blocked by rule. Nothing reaches PayPal.";
  return COPY.aiBoundary;
}
