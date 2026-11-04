"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { ScenarioKey } from "@/contract";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import { useApi, useIntentKey } from "@/lib/hooks";
import { API_MODE } from "@/lib/api";
import { COPY } from "@/lib/copy";
import { Button, Dialog, Label, cx } from "@/components/ui/primitives";
import { errorMessage } from "@/components/guard/request-parts";

/** "Send test request": fires a documented scenario through the same path as the agent API. */
export function ScenarioSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useApi();
  const router = useRouter();
  const [key, setKey] = useState<ScenarioKey>("a_low_risk");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [intentKey, renewIntent] = useIntentKey();
  const groupId = useId();
  const def = SCENARIOS.find((s) => s.key === key)!;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.runScenario(key, { idempotencyKey: intentKey });
      renewIntent();
      onClose();
      router.push(`/requests/${res.purchase_request.id}${res.replayed ? "?replayed=1" : ""}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setResetting(true);
    try {
      await api.resetDemo();
      onClose();
      router.push("/requests");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} variant="sheet" labelledBy={`${groupId}-title`}>
      <div className="flex items-start justify-between gap-4 border-b border-rule px-6 py-5">
        <div>
          <h2 id={`${groupId}-title`} className="t-display-m">Send test request</h2>
          <p className="mt-1 t-small text-ink-2">{API_MODE === "mock" ? COPY.mockBanner : COPY.demoScenario}</p>
        </div>
        <Button variant="quiet" size="sm" onClick={onClose} aria-label="Close" icon="x">{""}</Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <fieldset>
          <legend id={groupId} className="t-label text-muted">Scenario</legend>
          <div className="mt-2 border-t border-rule" role="radiogroup" aria-labelledby={groupId}>
            {SCENARIOS.map((s) => (
              <label
                key={s.key}
                className={cx(
                  "flex cursor-pointer items-start gap-3 border-b border-rule py-3 transition-colors duration-(--t-fast) hover:bg-sunken/60",
                  key === s.key && "bg-sunken",
                )}
              >
                <input
                  type="radio"
                  name="scenario"
                  value={s.key}
                  checked={key === s.key}
                  onChange={() => { setKey(s.key); renewIntent(); setError(null); }}
                  disabled={busy || resetting}
                  className="mt-1 ml-2 accent-(--ink)"
                />
                <span className="t-data w-5 text-muted">{s.letter}</span>
                <span className="min-w-0">
                  <span className="block t-body font-medium">{s.title}</span>
                  <span className="block t-small text-ink-2">{s.line}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6">
          <Label>Agent payload · {def.agent_id}</Label>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-rule bg-sunken p-3 t-data text-[12px]! leading-[18px]! text-ink-2">
            {JSON.stringify(def.payload, null, 2)}
          </pre>
          {def.idempotency_key && (
            <p className="mt-2 t-small text-muted">
              Idempotency-Key <span className="font-mono text-ink-2">{def.idempotency_key}</span>{def.send_twice ? " · sent twice" : ""}
            </p>
          )}
        </div>
        {error && <p className="mt-4 t-small text-block" role="alert">{error}</p>}
        <p className="mt-4 t-small text-muted">{API_MODE === "mock" ? COPY.demoResetMock : COPY.demoResetLive}</p>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-rule px-6 py-4">
        <Button variant="quiet" size="sm" icon="reset" loading={resetting} disabled={busy} onClick={reset}>Reset demo</Button>
        <Button variant="primary" icon="send" loading={busy} disabled={resetting} onClick={send}>Send as agent</Button>
      </div>
    </Dialog>
  );
}
