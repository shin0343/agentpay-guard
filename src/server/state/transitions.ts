import type { Payment, PurchaseRequest, AuditEventType } from "@/contract";
import { requireState } from "../util";
type RequestEvent =
  | "evaluate"
  | "allow"
  | "review"
  | "block"
  | "approve"
  | "reject"
  | "checkout"
  | "capture"
  | "completed"
  | "pending"
  | "declined"
  | "failed"
  | "payer_action"
  | "cancel"
  | "expire"
  | "create_failed"
  | "order_expired";
const requestEdges: Record<
  RequestEvent,
  Partial<Record<PurchaseRequest["status"], PurchaseRequest["status"]>>
> = {
  evaluate: { RECEIVED: "EVALUATING" },
  allow: { EVALUATING: "ALLOWED" },
  review: { EVALUATING: "IN_REVIEW" },
  block: { EVALUATING: "BLOCKED" },
  approve: { IN_REVIEW: "ALLOWED" },
  reject: { IN_REVIEW: "REJECTED" },
  checkout: { ALLOWED: "CHECKOUT_PENDING", PAYMENT_FAILED: "CHECKOUT_PENDING" },
  capture: { CHECKOUT_PENDING: "CAPTURING" },
  completed: { CAPTURING: "PAID", PAYMENT_PENDING: "PAID" },
  pending: { CAPTURING: "PAYMENT_PENDING" },
  declined: { CAPTURING: "PAYMENT_FAILED", PAYMENT_PENDING: "PAYMENT_FAILED" },
  failed: { CAPTURING: "PAYMENT_FAILED", PAYMENT_PENDING: "PAYMENT_FAILED" },
  payer_action: { CAPTURING: "CHECKOUT_PENDING" },
  create_failed: {
    ALLOWED: "PAYMENT_FAILED",
    PAYMENT_FAILED: "PAYMENT_FAILED",
  },
  order_expired: { CHECKOUT_PENDING: "PAYMENT_FAILED" },
  cancel: {
    IN_REVIEW: "CANCELLED",
    ALLOWED: "CANCELLED",
    CHECKOUT_PENDING: "CANCELLED",
    PAYMENT_FAILED: "CANCELLED",
  },
  expire: {
    IN_REVIEW: "EXPIRED",
    ALLOWED: "EXPIRED",
    CHECKOUT_PENDING: "EXPIRED",
    PAYMENT_FAILED: "EXPIRED",
  },
};
const effects: Partial<Record<RequestEvent, AuditEventType>> = {
  allow: "decision.made",
  review: "decision.made",
  block: "decision.made",
  approve: "review.approved",
  reject: "review.rejected",
  checkout: "checkout.created",
  capture: "payment.capture_requested",
  completed: "payment.completed",
  pending: "payment.pending",
  declined: "payment.declined",
  failed: "payment.failed",
  cancel: "request.cancelled",
  expire: "request.expired",
  create_failed: "payment.failed",
  order_expired: "payment.failed",
};
export function transition<T extends PurchaseRequest>(
  entity: T,
  event: RequestEvent,
  at: string,
): { next: T; effects: AuditEventType[] } {
  const edges = requestEdges[event];
  const status = edges[entity.status];
  requireState(!!status, entity.status, Object.keys(edges));
  return {
    next: {
      ...entity,
      status: status!,
      version: entity.version + 1,
      updated_at: at,
    },
    effects: effects[event] ? [effects[event]!] : [],
  };
}
const paymentEdges: Record<
  string,
  Partial<Record<Payment["status"], Payment["status"]>>
> = {
  created: { CREATING: "AWAITING_PAYER" },
  approved: { AWAITING_PAYER: "APPROVED" },
  capture: { AWAITING_PAYER: "CAPTURING", APPROVED: "CAPTURING" },
  completed: { CAPTURING: "COMPLETED", PENDING: "COMPLETED" },
  pending: { CAPTURING: "PENDING" },
  declined: { CAPTURING: "DECLINED", PENDING: "DECLINED" },
  failed: { CREATING: "FAILED", CAPTURING: "FAILED", PENDING: "FAILED" },
  retry: { DECLINED: "AWAITING_PAYER" },
  payer_action: { CAPTURING: "AWAITING_PAYER" },
  expire: {
    AWAITING_PAYER: "EXPIRED",
    APPROVED: "EXPIRED",
    CAPTURING: "EXPIRED",
  },
  void: {
    AWAITING_PAYER: "VOIDED",
    APPROVED: "VOIDED",
    DECLINED: "VOIDED",
    FAILED: "VOIDED",
    EXPIRED: "VOIDED",
  },
};
export function paymentTransition<T extends Payment>(
  p: T,
  event: string,
  at: string,
): T {
  const edges = paymentEdges[event] ?? {};
  const status = edges[p.status];
  requireState(!!status, p.status, Object.keys(edges));
  return { ...p, status: status!, version: p.version + 1, updated_at: at };
}
