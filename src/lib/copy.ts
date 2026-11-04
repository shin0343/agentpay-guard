/**
 * All user-facing vocabulary lives here (DESIGN_SYSTEM.md Part 3).
 * Canonical terms: Purchase request · Allowed / Needs review / Blocked · Policy approval ·
 * Payer approval · Paid / Not paid · Risk signal · Ledger. Never "successfully".
 */
import type { AuditEventType, PurchaseRequest, RequestStatus } from "@/contract";

export type Tone = "allow" | "review" | "block" | "neutral";

export const STATUS: Record<RequestStatus, { label: string; tone: Tone; live?: boolean }> = {
  RECEIVED: { label: "Received", tone: "neutral", live: true },
  EVALUATING: { label: "Evaluating", tone: "neutral", live: true },
  IN_REVIEW: { label: "Needs review", tone: "review" },
  ALLOWED: { label: "Allowed", tone: "allow" },
  BLOCKED: { label: "Blocked", tone: "block" },
  REJECTED: { label: "Rejected", tone: "block" },
  CHECKOUT_PENDING: { label: "Waiting for payer", tone: "review" },
  CAPTURING: { label: "Confirming", tone: "neutral", live: true },
  PAID: { label: "Paid", tone: "allow" },
  PAYMENT_PENDING: { label: "Payment pending", tone: "review" },
  PAYMENT_FAILED: { label: "Not paid", tone: "block" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/** The verdict headline + one reason line (≤ 16 words) for a request in any state. */
export function verdictFor(r: PurchaseRequest): { word: string; tone: Tone; reason: string; tag: string } {
  const d = r.decision;
  const rv = r.review;
  switch (r.status) {
    case "RECEIVED":
    case "EVALUATING":
      return { word: "Evaluating.", tone: "neutral", reason: "Rules first, then an advisory risk check.", tag: "EVALUATING" };
    case "IN_REVIEW":
      return { word: "Needs review.", tone: "review", reason: d?.reason ?? "A person must decide.", tag: "REVIEW" };
    case "ALLOWED":
      return {
        word: "Allowed.", tone: "allow", tag: "ALLOW",
        reason: rv?.action === "approve" ? `Allowed by ${rv.reviewer.name}. Payer approval is next.` : (d?.reason ?? "Within policy."),
      };
    case "BLOCKED":
      return { word: "Blocked.", tone: "block", reason: d?.reason ?? "Denied by policy.", tag: "BLOCK" };
    case "REJECTED":
      return { word: "Rejected.", tone: "block", reason: `Rejected by ${rv?.reviewer.name ?? "a reviewer"}.${rv?.note ? ` “${rv.note}”` : ""}`, tag: "REJECTED" };
    case "CHECKOUT_PENDING":
      return { word: "Waiting for payer.", tone: "review", reason: "Policy approval granted. The payer approves in PayPal.", tag: "PAYER" };
    case "CAPTURING":
      return { word: "Confirming.", tone: "neutral", reason: "Confirming the capture with PayPal.", tag: "CAPTURING" };
    case "PAID":
      return { word: "Paid.", tone: "allow", reason: `${r.merchant.name} was paid.`, tag: "PAID" };
    case "PAYMENT_PENDING":
      return { word: "Payment pending.", tone: "review", reason: "PayPal is holding this capture for review.", tag: "PENDING" };
    case "PAYMENT_FAILED":
      return { word: "Not paid.", tone: "block", reason: "The capture did not complete. No payment was taken.", tag: "NOT PAID" };
    case "EXPIRED":
      return { word: "Expired.", tone: "neutral", reason: d?.outcome === "REVIEW" && !rv ? "No reviewer decided in time." : "Policy approval lapsed before payment.", tag: "EXPIRED" };
    case "CANCELLED":
      return { word: "Cancelled.", tone: "neutral", reason: "Withdrawn before any payment.", tag: "CANCELLED" };
  }
}

export const EVENT_LABEL: Record<AuditEventType, string> = {
  "request.received": "Request received",
  "request.duplicate_detected": "Duplicate detected",
  "idempotency.replayed": "Retry replayed",
  "policy.evaluated": "Policy evaluated",
  "risk.assessed": "Risk assessed",
  "risk.unavailable": "Risk unavailable",
  "decision.made": "Decision made",
  "review.approved": "Reviewer allowed",
  "review.rejected": "Reviewer rejected",
  "checkout.created": "Checkout created",
  "payer.approved": "Payer approved",
  "payer.cancelled": "Payer closed PayPal",
  "payment.capture_requested": "Capture requested",
  "payment.completed": "Paid",
  "payment.pending": "Payment pending",
  "payment.declined": "Payment declined",
  "payment.failed": "Payment failed",
  "payment.reconciled": "Payment reconciled",
  "request.expired": "Expired",
  "request.cancelled": "Cancelled",
  "webhook.received": "Webhook received",
};

export const COPY = {
  tagline: "Give AI agents spending power. Keep humans in control.",
  untrusted: "Agent-supplied · untrusted",
  aiBoundary: "AI can raise caution, never lower it.",
  mockBanner: "Mock mode: simulated data. No PayPal or AI calls are made.",
  mockCapture: "Simulated capture. No PayPal API was called and no money moved.",
  paypalPromise: "You'll approve the payment in PayPal. Nothing is charged until you do.",
  sandboxPayee: "Sandbox: all payments go to the demo merchant account.",
};
