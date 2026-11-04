import type { AuditEvent, AuditEventType, ChainVerification } from "@/contract";
import type { Principal, StoreState, StoredRequest } from "../model";
import { canonical, hash, id, now } from "../util";
export function audit(
  s: StoreState,
  type: AuditEventType,
  r: StoredRequest | null,
  actor: Principal | undefined = undefined,
  data: Record<string, unknown> = {},
) {
  const prev_hash = s.events.at(-1)?.hash ?? "0".repeat(64);
  const e: Omit<AuditEvent, "hash"> = {
    id: id("evt"),
    object: "audit_event",
    seq: s.events.length + 1,
    type,
    occurred_at: now(),
    purchase_request_id: r?.id ?? null,
    payment_id: r?.payment?.id ?? null,
    actor: actor
      ? { kind: actor.kind, id: actor.id, name: actor.name }
      : { kind: "system", id: null, name: "AgentPay Guard" },
    amount: r?.amount ?? null,
    state_after: r?.status ?? null,
    summary: type.replaceAll(".", " "),
    data,
    prev_hash,
  };
  s.events.push({ ...e, hash: hash(prev_hash + canonical(e)) });
}
export function verify(events: AuditEvent[]): ChainVerification {
  let head = "0".repeat(64);
  let seq = 0;
  for (const event of events) {
    const { hash: h, ...e } = event;
    seq++;
    if (
      e.seq !== seq ||
      e.prev_hash !== head ||
      hash(head + canonical(e)) !== h
    )
      return { ok: false, broken_at_seq: e.seq, event_id: e.id };
    head = h;
  }
  return { ok: true, events: seq, head_hash: head };
}
