/** Opt-in local acceptance through real authenticated HTTP routes. Never mocks PayPal/AI. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { config } from "../src/server/config";
import { PostgresStore } from "../src/server/db/postgres";
import { SandboxPayPal, verifyOrder } from "../src/server/paypal/client";
import { PurchaseRequest, RequestWithPayment } from "../src/contract";
import { SCENARIOS } from "../src/contract/fixtures/scenarios";
import { verify } from "../src/server/audit/ledger";

class VerificationFailure extends Error {}

async function main() {
  const cfg = config();
  const mode = process.argv[2];
  if (
    !["create", "inspect", "capture"].includes(mode ?? "") ||
    process.env.PAYPAL_LIVE_VERIFY !== "true"
  )
    throw new VerificationFailure(
      "Explicit PAYPAL_LIVE_VERIFY=true and create|inspect|capture required",
    );
  const origin = new URL(cfg.APP_URL);
  if (
    !["localhost", "127.0.0.1"].includes(origin.hostname) ||
    cfg.RISK_PROVIDER !== "meta"
  )
    throw new VerificationFailure(
      "Use the local Meta-configured verification application",
    );
  const file = "qa/paypal-live/transaction.json";
  let evidence = await readFile(file, "utf8")
    .then((s) => JSON.parse(s))
    .catch((e) => {
      if (e.code !== "ENOENT") throw e;
      return null;
    });
  if (mode === "create" && evidence)
    throw new VerificationFailure(
      "Evidence already exists; inspect the saved transaction instead of creating another",
    );
  if (mode !== "create" && !evidence?.payment_id)
    throw new VerificationFailure("No saved payment exists");
  const passcode = cfg.DEMO_PASSCODES.split(",")
    .find((entry) => entry.startsWith("operator:"))
    ?.slice("operator:".length);
  if (!passcode || !cfg.DEMO_AGENT_KEY)
    throw new VerificationFailure(
      "Private operator and agent configuration required",
    );
  const session = await fetch(`${origin.origin}/api/v1/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode }),
  });
  if (!session.ok)
    throw new VerificationFailure(`Session HTTP ${session.status}`);
  const cookies = session.headers.getSetCookie().map((s) => s.split(";")[0]!);
  const csrf = cookies
    .find((s) => s.startsWith("apg_csrf="))
    ?.slice("apg_csrf=".length);
  async function post(
    path: string,
    body: unknown,
    agent = false,
    key = randomUUID(),
  ) {
    const res = await fetch(`${origin.origin}/api/v1/${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(60000),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        ...(agent
          ? { Authorization: `Bearer ${cfg.DEMO_AGENT_KEY}` }
          : { Cookie: cookies.join("; "), "X-CSRF-Token": csrf! }),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { res, data };
  }
  const store = new PostgresStore(cfg.DATABASE_URL);
  const paypal = new SandboxPayPal(cfg);
  try {
    if (mode === "create") {
      const key = randomUUID();
      const input = structuredClone(
        SCENARIOS.find((s) => s.key === "a_low_risk")!.payload,
      );
      const created = await post("purchase-requests", input, true, key);
      if (created.res.status !== 201)
        throw new VerificationFailure(
          `Create HTTP ${created.res.status}: ${created.data.error?.code}`,
        );
      const request = PurchaseRequest.parse(created.data);
      if (
        request.status !== "ALLOWED" ||
        request.evaluation?.risk.status !== "completed" ||
        request.evaluation.risk.model !== "muse-spark-1.3"
      )
        throw new VerificationFailure(
          `Request ${request.id} requires review; no payment started`,
        );
      const replay = await post("purchase-requests", input, true, key);
      if (
        replay.data.id !== request.id ||
        replay.res.headers.get("Idempotent-Replayed") !== "true"
      )
        throw new VerificationFailure("Create replay mismatch");
      const duplicate = await post("purchase-requests", input, true);
      if (
        duplicate.data.status !== "BLOCKED" ||
        duplicate.data.duplicate_of !== request.id
      )
        throw new VerificationFailure("Duplicate was not blocked");
      const checkoutKey = randomUUID();
      const checkout = await post(
        `purchase-requests/${request.id}/checkout`,
        {},
        false,
        checkoutKey,
      );
      if (!checkout.res.ok)
        throw new VerificationFailure(
          `Checkout HTTP ${checkout.res.status}: ${checkout.data.error?.code}`,
        );
      const result = RequestWithPayment.parse(checkout.data);
      const replayCheckout = await post(
        `purchase-requests/${request.id}/checkout`,
        {},
        false,
        checkoutKey,
      );
      if (
        replayCheckout.data.payment?.id !== result.payment.id ||
        replayCheckout.res.headers.get("Idempotent-Replayed") !== "true"
      )
        throw new VerificationFailure("Checkout replay mismatch");
      evidence = {
        created_at: new Date().toISOString(),
        scope: "Genuine local HTTP + Meta + PayPal Sandbox + PostgreSQL",
        purchase_request_id: request.id,
        payment_id: result.payment.id,
        risk: request.evaluation.risk,
        expires_at: request.decision?.expires_at,
        create_replay_verified: true,
        duplicate_blocked: true,
        checkout_replay_verified: true,
        payer_action_url: result.payment.paypal.payer_action_url,
      };
      await mkdir("qa/paypal-live", { recursive: true });
      await writeFile(file, JSON.stringify(evidence, null, 2), { mode: 0o600 });
    }
    const snapshot = () =>
      store.tx((s) => {
        const p = s.payments[evidence.payment_id];
        const r = p && s.requests[p.purchase_request_id];
        if (!p || !r)
          throw new VerificationFailure("Saved transaction missing");
        return {
          p,
          r,
          chain: verify(s.events),
          payment_count: Object.values(s.payments).filter(
            (x) => x.purchase_request_id === r.id,
          ).length,
        };
      });
    let saved = await snapshot();
    let order = await paypal.get(saved.p.paypal.order_id!);
    verifyOrder(order, saved.r, saved.p, cfg.PAYPAL_MERCHANT_ID);
    if (mode === "capture") {
      if (order.status !== "APPROVED" && order.status !== "COMPLETED")
        throw new VerificationFailure(
          `Payer approval still pending (${order.status}); no capture attempted`,
        );
      const result = await post(`payments/${saved.p.id}/capture`, {});
      if (!result.res.ok)
        throw new VerificationFailure(
          `Capture HTTP ${result.res.status}: ${result.data.error?.code}`,
        );
      if (result.data.payment?.status === "COMPLETED") {
        const repeat = await post(`payments/${saved.p.id}/capture`, {});
        if (
          !repeat.res.ok ||
          repeat.data.payment?.paypal.capture_id !==
            result.data.payment?.paypal.capture_id
        )
          throw new VerificationFailure(
            "Repeat capture inconsistent; inspect authoritative state",
          );
        evidence.repeated_capture_same_result = true;
      }
      saved = await snapshot();
      order = await paypal.get(saved.p.paypal.order_id!);
      verifyOrder(order, saved.r, saved.p, cfg.PAYPAL_MERCHANT_ID);
    }
    const capture = order.purchase_units[0]!.payments?.captures?.[0];
    const completed =
      order.status === "COMPLETED" &&
      capture?.status === "COMPLETED" &&
      saved.r.status === "PAID" &&
      saved.p.status === "COMPLETED" &&
      saved.p.paypal.capture_id === capture.id;
    Object.assign(evidence, {
      checked_at: new Date().toISOString(),
      order_id: order.id,
      order_status: order.status,
      capture_id: capture?.id ?? null,
      capture_status: capture?.status ?? null,
      amount: saved.p.amount,
      merchant_binding_present: !!saved.p.paypal_merchant_id,
      merchant_verified: true,
      request_status: saved.r.status,
      payment_status: saved.p.status,
      capture_attempts: saved.p.attempts.length,
      payment_count: saved.payment_count,
      audit_chain: saved.chain,
      completed_verified: completed,
    });
    await writeFile(file, JSON.stringify(evidence, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(evidence, null, 2));
    if (mode === "capture" && !completed) process.exitCode = 1;
  } finally {
    await store.pool.end();
  }
}
main().catch((e) => {
  console.error(
    e instanceof VerificationFailure
      ? e.message
      : "Verification failed; private values withheld",
  );
  process.exitCode = 1;
});
