/**
 * All user-facing vocabulary lives here (DESIGN_SYSTEM.md Part 3).
 * Canonical terms: Purchase request · Allowed / Needs review / Blocked · Policy approval ·
 * Payer approval · Paid / Not paid · Risk signal · Ledger. Never "successfully".
 */
import type { AuditEventType, Payment, PolicyResult, PurchaseRequest, RequestStatus } from "@/contract";
import { Decision, RiskAssessment, Review, type AuditEvent } from "@/contract";

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
      return { word: "Needs review.", tone: "review", reason: decisionReason(r, "review"), tag: "REVIEW" };
    case "ALLOWED":
      return {
        word: "Allowed.", tone: "allow", tag: "ALLOW",
        reason: rv?.action === "approve" ? `Allowed by ${rv.reviewer.name}. Payer approval is next.` : (d?.reason ?? "Within policy."),
      };
    case "BLOCKED":
      return { word: "Blocked.", tone: "block", reason: decisionReason(r, "block"), tag: "BLOCK" };
    case "REJECTED":
      return { word: "Rejected.", tone: "block", reason: `Rejected by ${rv?.reviewer.name ?? "a reviewer"}. No payment was taken.`, tag: "REJECTED" };
    case "CHECKOUT_PENDING":
      if (r.payment?.status === "APPROVED") return { word: "Payer approved.", tone: "review", reason: "Payer approval is recorded. Confirm the payment to request capture.", tag: "NOT PAID" };
      return { word: "Waiting for payer.", tone: "review", reason: "Policy approval granted. The payer approves in PayPal.", tag: "PAYER" };
    case "CAPTURING":
      return { word: "Confirming.", tone: "neutral", reason: "Confirming the capture with PayPal.", tag: "CAPTURING" };
    case "PAID":
      return { word: "Paid.", tone: "allow", reason: "PayPal confirmed the capture.", tag: "PAID" };
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

export const RULE_LABEL: Record<string, string> = {
  amount_auto_limit: "Purchase limit",
  daily_budget: "Daily budget",
  blocked_category: "Item category",
  merchant_category: "Item category",
  merchant_allowlist: "Merchant allowlist",
  currency: "Currency",
  agent_scope: "Agent scope",
  duplicate_guard: "Duplicate purchase",
  velocity: "Request frequency",
};

export const policyLabel = (rule: PolicyResult) => RULE_LABEL[rule.rule_key] ?? rule.rule_key;

// Explain returned outcomes; never calculate a policy decision in the frontend.
function decisionReason(request: PurchaseRequest, outcome: "review" | "block"): string {
  const original = request.decision?.reason;
  if (original && !["Human review required before payment.", "Hard policy limit violated."].includes(original)) return original;
  const flagged = request.evaluation?.policy.filter((rule) => rule.outcome === outcome) ?? [];
  if (outcome === "block") {
    if (flagged.some((rule) => ["blocked_category", "merchant_category"].includes(rule.rule_key))) return COPY.categoryBlocked;
    if (flagged.some((rule) => rule.rule_key === "amount_auto_limit")) return COPY.amountBlocked;
  } else {
    if (flagged.some((rule) => rule.rule_key === "amount_auto_limit")) return COPY.amountReview;
    if (flagged.some((rule) => rule.rule_key === "merchant_allowlist")) return COPY.merchantReview;
  }
  return original ?? (outcome === "block" ? "Blocked by policy." : "A person must decide.");
}

export const EVENT_LABEL: Record<AuditEventType, string> = {
  "checkout.failed": "Checkout unconfirmed",
  "payment.outcome_unknown": "Confirming payment",
  "payment.retry_requested": "Payment retry requested",
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

/** Prefer persisted evidence to the backend's generic event-name summary. */
export function auditSummary(event: AuditEvent): string | null {
  if (event.summary.toLowerCase() !== event.type.replaceAll(".", " ").toLowerCase()) return event.summary;
  const decision = Decision.safeParse(event.data.decision);
  if (decision.success) return decision.data.reason;
  const risk = RiskAssessment.safeParse(event.data.risk);
  if (risk.success) return risk.data.summary;
  const review = Review.safeParse(event.data.review);
  if (review.success) return review.data.note ?? review.data.reviewer.name;
  return null;
}

export const COPY = {
  tagline: "Give AI agents spending power. Keep humans in control.",
  untrusted: "Agent-supplied · untrusted",
  aiBoundary: "AI can raise caution, never lower it.",
  mockBanner: "Mock mode: simulated data. No PayPal or AI calls are made.",
  mockCapture: "Simulated capture. No PayPal API was called and no money moved.",
  paypalPromise: "You'll approve the payment in PayPal. Nothing is charged until you do.",
  sandboxPayee: "Sandbox: all payments go to the demo merchant account.",
  connectionInterrupted: "Connection interrupted. Refresh to check the latest state.",
  staleData: "Connection interrupted. Showing the last confirmed state.",
  refresh: "Refresh status",
  signInAgain: "Sign in again",
  sessionUnavailable: "Couldn't connect to the workspace.",
  livePasscode: "Use the private passcode configured by your workspace operator.",
  approvePayment: "Approve payment",
  notPaidYet: "Not paid. Payer approval is next.",
  fixtureRisk: "Simulated AI assessment",
  advisoryRisk: "Advisory score, not a fraud probability.",
  riskUnavailable: "AI analysis unavailable. Policy still applies; an allowed request needs human review.",
  reviewerRequired: "Sign in with a reviewer passcode to decide. Policy approval alone never moves money.",
  payerClosed: "PayPal was closed. Check the payment status before trying again.",
  checkoutLoading: "Loading PayPal Sandbox checkout",
  confirmingPayment: "Checking the stored payment with PayPal",
  checkoutUnavailable: "PayPal checkout is unavailable.",
  checkoutRecovery: "Retry loading checkout or check the existing payment. Nothing is marked paid here.",
  retryCheckout: "Reload checkout",
  redirectCheckout: "Open PayPal checkout",
  redirectHint: "Use PayPal's full page if the button or popup doesn't open.",
  demoScenario: "Demonstration request. Backend policies and configured AI provider evaluate it.",
  demoResetLive: "Reset removes unpaid requests without payment records. Payment records and the ledger are preserved.",
  demoResetMock: "Reset restores the fictional demonstration data in this browser.",
  ledgerSample: "Illustrative ledger · fictional data, not verified payment evidence",
  returnUnconfirmed: "Payment not yet confirmed.",
  missingPayment: "Missing payment reference.",
  returnRecovery: "Open the stored payment to check its verified status.",
  captureUnverified: "A completed capture is being checked against the request. Payment is not yet confirmed.",
  noCapture: "No capture attempted yet.",
  confirmPolicyApproval: "Grant policy approval?",
  loadRequests: "Load more requests",
  loadEvents: "Load earlier events",
  chainUnavailable: "Chain verification unavailable.",
  landingHeadline: ["Let agents propose.", "Keep humans in control."],
  landingSubline: "Control AI purchases with spending rules, advisory AI and human review. PayPal captures payment only after separate payer approval.",
  demoHeading: ["Five questions,", "five demonstrations."],
  reviewerNote: "Reviewer note",
  reviewerSource: "Reviewer-supplied",
  approvalKeys: "Approval keys",
  amountReview: "Amount exceeds the automatic limit. A reviewer must decide.",
  merchantReview: "This merchant requires human review before payment.",
  categoryBlocked: "This item category is blocked. Nothing reached PayPal.",
  amountBlocked: "Amount exceeds the policy cap. Nothing reached PayPal.",
  policyLimit: "Policy",
  confirmPayment: "Confirm payment",
  payerApproved: "Payer approved",
};

/** Both stored resources and PayPal capture evidence must agree before a paid result. */
export function isVerifiedPaid(p: Payment, r: PurchaseRequest): boolean {
  return r.status === "PAID" && p.status === "COMPLETED" && p.paypal.capture_status === "COMPLETED"
    && !!p.paypal.capture_id && r.payment?.id === p.id && r.payment.paypal_capture_id === p.paypal.capture_id;
}

export function paymentOutcome(p: Payment, r: PurchaseRequest): { tone: Tone; word: string; reason: string; tag: string } {
  switch (p.status) {
    case "COMPLETED":
      return isVerifiedPaid(p, r)
        ? { tone: "allow", word: "Paid.", reason: "PayPal confirmed the capture.", tag: p.paypal.environment === "mock" ? "SIMULATED" : "PAID" }
        : { tone: "neutral", word: "Confirming.", reason: COPY.captureUnverified, tag: "CONFIRMING" };
    case "DECLINED":
    case "FAILED":
      return { tone: "block", word: "Not paid.", reason: p.failure?.message ?? "The capture did not complete. No payment was taken.", tag: "NOT PAID" };
    case "PENDING":
      return { tone: "review", word: "Payment pending.", reason: "PayPal is reviewing the capture. Settlement is not confirmed.", tag: "PENDING" };
    case "CAPTURING":
      return { tone: "neutral", word: "Confirming.", reason: "The capture outcome is unconfirmed. Check this payment before retrying.", tag: "CAPTURING" };
    case "VOIDED":
      return { tone: "neutral", word: "Cancelled.", reason: "The order was abandoned. Nothing was charged.", tag: "VOIDED" };
    case "EXPIRED":
      return { tone: "neutral", word: "Expired.", reason: "The PayPal order expired. Nothing was charged.", tag: "EXPIRED" };
    case "APPROVED":
      return { tone: "review", word: "Payer approved.", reason: "Payer approval is recorded. A verified capture is still required.", tag: "NOT PAID" };
    case "CREATING":
      return { tone: "neutral", word: "Preparing checkout.", reason: "The PayPal order is not yet confirmed. No capture is confirmed.", tag: "CREATING" };
    default:
      return { tone: "review", word: "Waiting for payer.", reason: "Policy approval granted. Approve payment in PayPal next.", tag: "NOT PAID" };
  }
};
