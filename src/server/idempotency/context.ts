import { AsyncLocalStorage } from "node:async_hooks";
import type { StoreState } from "../model";
/** Persist the API result in the SAME transaction as its business effect. */
export const operation = new AsyncLocalStorage<string>();
export function checkpoint(s: StoreState, body: unknown, status = 200) {
  const scope = operation.getStore();
  if (!scope) return;
  const row = s.idempotency[scope];
  if (!row || row.state === "done") return;
  row.state = "done";
  row.status = status;
  row.body = structuredClone(body);
}
