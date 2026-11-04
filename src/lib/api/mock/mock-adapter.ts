/**
 * Mock adapter: wraps MockEngine with realistic latency, background evaluation/capture timing,
 * localStorage persistence (so a reload mid-demo keeps state) and change notifications.
 *
 * Nothing here calls PayPal or an AI model. All results are labelled simulated in the UI.
 */
import type { ScenarioKey } from "@/contract";
import type { GuardApi } from "../types";
import { MockEngine, emptyState, type EngineState } from "./engine";

const STORAGE_KEY = "apg.mock.v1";
const EVALUATION_MS = 1700;
const CAPTURE_MS = 1300;
const LATENCY_MS = 140;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function load(): EngineState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as EngineState;
    return s?.v === 1 ? s : null;
  } catch {
    return null;
  }
}

function save(state: EngineState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: keep in-memory only */
  }
}

export function createMockAdapter(): GuardApi {
  const restored = typeof window !== "undefined" ? load() : null;
  const engine = new MockEngine(Date.now, restored ?? emptyState());
  if (!restored) engine.seedHistory();

  const listeners = new Set<() => void>();
  const commit = () => {
    if (typeof window !== "undefined") save(engine.state);
    listeners.forEach((l) => l());
  };

  const scheduleEvaluation = (id: string) => {
    setTimeout(() => {
      engine.evaluate(id);
      commit();
    }, EVALUATION_MS);
  };
  const scheduleSettle = (paymentId: string) => {
    setTimeout(() => {
      engine.settleCapture(paymentId, engine.session()?.user.role ?? "operator");
      commit();
    }, CAPTURE_MS);
  };

  // Resume work interrupted by a reload.
  for (const r of Object.values(engine.state.requests)) if (r.status === "EVALUATING") scheduleEvaluation(r.id);
  for (const p of Object.values(engine.state.payments)) if (p.status === "CAPTURING") scheduleSettle(p.id);
  if (!restored) commit();

  /** Run a synchronous engine op with simulated network latency; persist and notify after mutations. */
  async function op<T>(fn: () => T, mutate = false): Promise<T> {
    await wait(LATENCY_MS);
    const out = fn();
    if (mutate) commit();
    return out;
  }
  const role = () => engine.requireUser().role;

  return {
    mode: "mock",

    getSession: () => op(() => engine.session()),
    signIn: (passcode) => op(() => engine.signIn(passcode), true),
    signOut: () => op(() => engine.signOut(), true),

    listPurchaseRequests: (params = {}) => op(() => engine.list(params, role())),
    getPurchaseRequest: (id) => op(() => engine.get(id, role())),
    submitReview: (id, body, version) => op(() => engine.review(id, body, version, engine.requireUser()), true),
    startCheckout: (id) => op(() => engine.startCheckout(id, engine.requireUser()), true),
    cancelPurchaseRequest: (id) => op(() => engine.cancel(id, engine.requireUser()), true),

    getPayment: (id) => op(() => engine.getPayment(id)),
    capturePayment: async (id, simulate) => {
      const res = await op(() => engine.beginCapture(id, simulate, engine.requireUser()), true);
      scheduleSettle(id);
      return res;
    },
    reconcilePayment: (id) => op(() => engine.reconcile(id, role()), true),
    recordPayerCancel: (id) => op(() => { engine.payerClose(id); }, true),
    getCheckoutConfig: () => op(() => ({ paypal_client_id: "mock", currency: "USD" as const, intent: "capture" as const })),

    listAuditEvents: (params = {}) => op(() => engine.listAudit(params)),
    verifyAuditChain: () => op(() => engine.verifyChain()),
    auditCsvUrl: () => null,
    getActivePolicy: () => op(() => engine.activePolicy()),

    runScenario: async (key: ScenarioKey) => {
      engine.requireUser();
      const res = await op(() => engine.runScenario(key), true);
      if (res.created) scheduleEvaluation(res.created);
      return { purchase_request: res.request, replayed: res.replayed };
    },
    resetDemo: () =>
      op(() => {
        const session = engine.state.session;
        engine.state = { ...emptyState(), session };
        engine.seedHistory();
      }, true),

    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },

    mockPayer: {
      approve: (paymentId) => op(() => engine.payerApprove(paymentId), true),
      close: (paymentId) => op(() => engine.payerClose(paymentId), true),
    },
  };
}
