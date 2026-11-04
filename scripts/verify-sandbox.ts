import { config } from "../src/server/config";
import { PostgresStore } from "../src/server/db/postgres";
import { SandboxPayPal, verifyOrder } from "../src/server/paypal/client";
const cfg = config();
const paymentId = process.argv[2];
if (!paymentId?.startsWith("pay_"))
  throw new Error("Usage: pnpm sandbox:verify pay_<id>");
const store = new PostgresStore(cfg.DATABASE_URL);
try {
  const { r, p } = await store.tx((s) => {
    const p = s.payments[paymentId];
    if (!p) throw new Error("Payment not found");
    const r = s.requests[p.purchase_request_id];
    if (!r) throw new Error("Request not found");
    return { r, p };
  });
  if (!p.paypal.order_id) throw new Error("No PayPal order exists");
  const order = await new SandboxPayPal(cfg).get(p.paypal.order_id);
  verifyOrder(order, r, p, cfg.PAYPAL_MERCHANT_ID);
  const capture = order.purchase_units[0]!.payments?.captures?.[0];
  if (
    order.status !== "COMPLETED" ||
    capture?.status !== "COMPLETED" ||
    p.status !== "COMPLETED" ||
    r.status !== "PAID" ||
    p.paypal.capture_id !== capture.id
  )
    throw new Error(
      "Sandbox payment is NOT verified completed. Reconcile first or complete payer checkout.",
    );
  console.log(
    JSON.stringify(
      {
        verified: true,
        environment: "sandbox",
        purchase_request_id: r.id,
        payment_id: p.id,
        paypal_order_id: order.id,
        paypal_capture_id: capture.id,
        capture_status: capture.status,
        amount: capture.amount,
        verified_at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} finally {
  await store.pool.end();
}
