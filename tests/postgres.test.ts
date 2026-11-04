import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { PostgresStore } from "@/server/db/postgres";
import { SCENARIOS } from "@/contract/fixtures/scenarios";
import { harness } from "./backend-helpers";
import { PurchaseRequest, RequestWithPayment } from "@/contract";
import { verify } from "@/server/audit/ledger";
const enabled = process.env.APG_POSTGRES_TEST === "true";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!enabled)("real PostgreSQL migration and concurrency", () => {
  if (enabled && !url)
    throw new Error(
      "TEST_DATABASE_URL required: use a dedicated disposable migrated database.",
    );
  const stores: PostgresStore[] = [];
  const schema = `apg_test_${Date.now()}`;
  const scoped = new URL(url ?? "postgresql://localhost/test");
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  beforeAll(async () => {
    const admin = new PostgresStore(url!);
    stores.push(admin);
    await admin.pool.query(`CREATE SCHEMA ${schema}`);
    const migrated = open();
    await migrated.pool.query(
      await readFile(
        new URL("../migrations/001_foundation.sql", import.meta.url),
        "utf8",
      ),
    );
  });
  const open = () => {
    const s = new PostgresStore(scoped.toString());
    stores.push(s);
    return s;
  };
  afterAll(async () => {
    await Promise.all(stores.map((s) => s.pool.end()));
  });
  it("persistent rows, immutable audit and API idempotency survive fresh connections", async () => {
    const store = open();
    const h = await harness(store);
    const key = `pg-${Date.now()}`;
    const req = {
      method: "POST",
      body: SCENARIOS[0]!.payload,
      role: "agent" as const,
      key,
    };
    const first = await h.call("purchase-requests", req);
    expect(first.status).toBe(201);
    const body = PurchaseRequest.parse(await first.json());
    const fresh = await harness(open());
    const replay = await fresh.call("purchase-requests", req);
    expect(replay.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await replay.json()).toEqual(body);
    expect(await fresh.store.tx((s) => verify(s.events))).toMatchObject({
      ok: true,
    });
    await expect(
      store.pool.query(
        "UPDATE audit_events SET doc=jsonb_set(doc,'{summary}','\"tamper\"') WHERE seq=1",
      ),
    ).rejects.toThrow("append-only");
  });
  it("separate clients serialize semantic duplicates, review races and capture claims", async () => {
    const s1 = open();
    const s2 = open();
    const a = await harness(s1);
    const b = await harness(s2);
    const body = structuredClone(SCENARIOS[1]!.payload);
    body.items[0]!.quantity = 39;
    body.amount.value = "624.00";
    const [one, two] = await Promise.all([
      a.service.create(body, "agt_research01"),
      b.service.create(body, "agt_research01"),
    ]);
    expect([one.status, two.status].sort()).toEqual(["BLOCKED", "IN_REVIEW"]);
    const review = one.status === "IN_REVIEW" ? one : two;
    const responses = await Promise.all(
      [a, b].map((h, i) =>
        h.call(`purchase-requests/${review.id}/reviews`, {
          method: "POST",
          version: review.version,
          key: `review-race-${i}`,
          body: { action: "approve" },
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 412]);
    const checkout = await a.call(`purchase-requests/${review.id}/checkout`, {
      method: "POST",
      body: {},
    });
    expect(checkout.status).toBe(200);
    const result = RequestWithPayment.parse(await checkout.json());
    a.paypal.approve(result.payment.paypal.order_id!);
    b.paypal.orders = a.paypal.orders;
    let release!: () => void;
    a.paypal.delay = new Promise<void>((r) => (release = r));
    const first = a.call(`payments/${result.payment.id}/capture`, {
      method: "POST",
      body: {},
    });
    for (let i = 0; i < 200 && a.paypal.captures === 0; i++)
      await new Promise((r) => setTimeout(r, 5));
    const second = await b.call(`payments/${result.payment.id}/capture`, {
      method: "POST",
      body: {},
    });
    expect(second.status).toBe(409);
    release();
    expect((await first).status).toBe(200);
    expect(a.paypal.captures + b.paypal.captures).toBe(1);
    const fresh = await harness(open());
    expect(
      RequestWithPayment.parse(
        await (
          await fresh.call(`payments/${result.payment.id}/capture`, {
            method: "POST",
            body: {},
          })
        ).json(),
      ).purchase_request.status,
    ).toBe("PAID");
    expect(await fresh.store.tx((s) => verify(s.events))).toMatchObject({
      ok: true,
    });
  });
  it("database rejects a second open payment", async () => {
    const store = open();
    const h = await harness(store);
    const source = {
      id: "pay_template",
      object: "payment",
      purchase_request_id: "unused",
      status: "CREATING",
      version: 1,
      amount: { currency_code: "USD", value: "36.00" },
      paypal: {
        environment: "sandbox",
        order_id: null,
        order_status: null,
        capture_id: null,
        capture_status: null,
        payer_action_url: null,
      },
      attempts: [],
      failure: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const copy = {
      ...source,
      id: "pay_duplicate_test",
      status: "AWAITING_PAYER",
      paypal: {
        ...source.paypal,
        order_id: "DIFFERENTORDER",
        capture_id: null,
      },
    };
    // Use an existing active request, or create one, to hit the partial index rather than application guards.
    const def = structuredClone(SCENARIOS[0]!.payload);
    def.items[0]!.quantity = 2;
    def.amount.value = "36.00";
    const r = await h.service.create(def, "agt_research01");
    await store.pool.query("INSERT INTO payments(id,doc) VALUES($1,$2)", [
      copy.id,
      JSON.stringify({ ...copy, purchase_request_id: r.id }),
    ]);
    await expect(
      store.pool.query("INSERT INTO payments(id,doc) VALUES($1,$2)", [
        copy.id + "2",
        JSON.stringify({
          ...copy,
          id: copy.id + "2",
          purchase_request_id: r.id,
          paypal: { ...copy.paypal, order_id: "DIFFERENTORDER2" },
        }),
      ]),
    ).rejects.toThrow("one_open_payment");
  });
});
