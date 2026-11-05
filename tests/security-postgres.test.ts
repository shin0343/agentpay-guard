import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresStore } from "@/server/db/postgres";
import { PayPalError } from "@/server/paypal/client";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import { RequestWithPayment } from "@/contract";
import { verify } from "@/server/audit/ledger";
import { harness } from "./backend-helpers";

const enabled = process.env.APG_POSTGRES_TEST === "true";
const database = process.env.TEST_DATABASE_URL;
describe.skipIf(!enabled)(
  "security recovery across actual PostgreSQL clients",
  () => {
    const stores: PostgresStore[] = [];
    const schema = `apg_security_${Date.now()}`;
    const scoped = new URL(database ?? "postgresql://localhost/test");
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const open = () => {
      const store = new PostgresStore(scoped.toString());
      stores.push(store);
      return store;
    };
    beforeAll(async () => {
      if (!database)
        throw new Error(
          "TEST_DATABASE_URL must identify a disposable test database.",
        );
      const admin = new PostgresStore(database);
      stores.push(admin);
      await admin.pool.query(`CREATE SCHEMA ${schema}`);
      await open().pool.query(
        await readFile(
          new URL("../migrations/001_foundation.sql", import.meta.url),
          "utf8",
        ),
      );
    });
    afterAll(async () => {
      await Promise.all(stores.map((store) => store.pool.end()));
    });

    it("a conflicted unknown capture survives restart and later settles without another capture", async () => {
      const first = await harness(open());
      const request = await first.service.create(
        SCENARIOS.find((item) => item.key === "a_low_risk")!.payload,
        "agt_research01",
      );
      const checkout = RequestWithPayment.parse(
        await (
          await first.call(`purchase-requests/${request.id}/checkout`, {
            method: "POST",
            body: {},
          })
        ).json(),
      );
      first.paypal.approve(checkout.payment.paypal.order_id!);
      first.paypal.failCapture = new PayPalError(0, "NETWORK_UNKNOWN");
      await first.call(`payments/${checkout.payment.id}/capture`, {
        method: "POST",
        body: {},
      });
      first.paypal.failCapture = new PayPalError(409, "RESOURCE_CONFLICT");
      const unknown = RequestWithPayment.parse(
        await (
          await first.call(`payments/${checkout.payment.id}/reconcile`, {
            method: "POST",
            body: {},
          })
        ).json(),
      );
      expect(unknown.purchase_request.status).toBe("CAPTURING");
      expect(unknown.payment.attempts).toHaveLength(1);
      expect(unknown.payment.failure).toBeNull();
      const providerOrder = first.paypal.orders.get(
        checkout.payment.paypal.order_id!,
      )!;
      providerOrder.status = "COMPLETED";
      providerOrder.purchase_units[0]!.payments = {
        captures: [
          {
            id: "PGRECOVEREDCAPTURE",
            status: "COMPLETED",
            amount: checkout.payment.amount,
            final_capture: true,
          },
        ],
      };
      const restarted = await harness(open());
      restarted.paypal.orders = first.paypal.orders;
      const recovered = RequestWithPayment.parse(
        await (
          await restarted.call(`payments/${checkout.payment.id}/reconcile`, {
            method: "POST",
            body: {},
          })
        ).json(),
      );
      expect(recovered.purchase_request.status).toBe("PAID");
      expect(recovered.payment.paypal.capture_id).toBe("PGRECOVEREDCAPTURE");
      expect(recovered.payment.attempts[0]!.paypal_request_id).toBe(
        `cap_${checkout.payment.id}_1`,
      );
      expect(restarted.paypal.captures).toBe(0);
      expect(
        await restarted.store.tx((state) => verify(state.events)),
      ).toMatchObject({ ok: true });
    });
  },
);
