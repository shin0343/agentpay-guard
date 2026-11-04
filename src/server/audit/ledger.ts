import type { AuditEvent, AuditEventType, ChainVerification } from "@/contract";
import type { Principal, StoreState, StoredRequest } from "../model";
import { correlation } from "../idempotency/context";
import { sanitize } from "../privacy";
import { canonical, hash, id, now } from "../util";
export function audit(
  s: StoreState,
  type: AuditEventType,
  r: StoredRequest | null,
  actor: Principal | undefined = undefined,
  data: Record<string, unknown> = {},
) {
  const prev_hash = s.events.at(-1)?.hash ?? "0".repeat(64);
  const payment = r?.payment ? s.payments[r.payment.id] : undefined;
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
    data: sanitize(
      {
        correlation_id: correlation.getStore() ?? r?.correlation_id ?? null,
        request_correlation_id: r?.correlation_id ?? null,
        request_version: r?.version ?? null,
        policy_set: r?.evaluation?.policy_set ?? null,
        ...(type === "decision.made" ? { decision: r?.decision } : {}),
        ...(type.startsWith("review.") ? { review: r?.review } : {}),
        ...(payment
          ? {
              paypal: {
                order_id: payment.paypal.order_id,
                order_status: payment.paypal.order_status,
                capture_id: payment.paypal.capture_id,
                capture_status: payment.paypal.capture_status,
                verification: payment.paypal.capture_id
                  ? "verified_order_and_capture"
                  : payment.paypal.order_id
                    ? "verified_order"
                    : "unconfirmed",
                payment_version: payment.version,
                payment_status: payment.status,
                attempt: payment.attempts.at(-1) ?? null,
                failure: payment.failure,
              },
            }
          : {}),
        ...data,
      },
      true,
    ),
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
