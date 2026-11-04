import { Pool } from "pg";
import { emptyState, type Store, type StoreState } from "../model";
const tables = {
  requests: "purchase_requests",
  payments: "payments",
  agents: "agents",
  idempotency: "idempotency",
  webhooks: "webhooks",
  limits: "rate_limits",
} as const;
/** Conservative single-org baseline: short transactions serialize reservations + ledger. No I/O in callbacks. */
export class PostgresStore implements Store {
  readonly pool: Pool;
  constructor(url: string) {
    this.pool = new Pool({ connectionString: url, max: 5 });
  }
  async tx<T>(fn: (s: StoreState) => T | Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL lock_timeout = '5s'");
      await c.query("SELECT pg_advisory_xact_lock(73290411)");
      const s = emptyState();
      for (const [key, table] of Object.entries(tables)) {
        const r = await c.query(`SELECT id,doc FROM ${table}`);
        Object.assign(
          s[key as keyof typeof tables],
          Object.fromEntries(r.rows.map((r) => [r.id, r.doc])),
        );
      }
      s.events = (
        await c.query("SELECT doc FROM audit_events ORDER BY seq")
      ).rows.map((r) => r.doc);
      const before = structuredClone(s);
      const result = await fn(s);
      for (const [key, table] of Object.entries(tables)) {
        const k = key as keyof typeof tables;
        for (const [rid, doc] of Object.entries(s[k]))
          if (JSON.stringify(doc) !== JSON.stringify(before[k][rid]))
            await c.query(
              `INSERT INTO ${table}(id,doc) VALUES ($1,$2) ON CONFLICT(id) DO UPDATE SET doc=EXCLUDED.doc`,
              [rid, JSON.stringify(doc)],
            );
      }
      // Remove children before parents (demo reset never removes payment history).
      for (const [key, table] of Object.entries(tables).reverse()) {
        const k = key as keyof typeof tables;
        for (const rid of Object.keys(before[k]))
          if (!s[k][rid])
            await c.query(`DELETE FROM ${table} WHERE id=$1`, [rid]);
      }
      for (const e of s.events.slice(before.events.length))
        await c.query("INSERT INTO audit_events(seq,id,doc) VALUES($1,$2,$3)", [
          e.seq,
          e.id,
          JSON.stringify(e),
        ]);
      await c.query("COMMIT");
      return structuredClone(result);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
}
