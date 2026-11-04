import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpAdapter } from "@/lib/api/http/http-adapter";
import { ApiError } from "@/lib/api/types";
import { auditSummary, isVerifiedPaid, paymentOutcome, verdictFor } from "@/lib/copy";
import { harness } from "./backend-helpers";

// Regression: live mutations left keys/ledger stale; payment rendering trusted a payment alone.
// Found by /qa on 2026-11-04. Report: docs/FRONTEND_QA.md
async function connected() {
  const backend = await harness();
  let cookies = "";
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("document", { get cookie() { return cookies; } });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const response = await backend.http.handle(new Request(new URL(url, "http://localhost:3000"), {
      ...init, headers: { ...init.headers, Cookie: cookies },
    }));
    const issued = response.headers.getSetCookie();
    if (issued.length) cookies = issued.map((cookie) => cookie.split(";")[0]).join("; ");
    return response;
  });
  const api = createHttpAdapter();
  await api.signIn("reviewer");
  return { ...backend, api, calls };
}

afterEach(() => vi.unstubAllGlobals());

describe("frontend HTTP adapter through actual GuardHttp routes", () => {
  it("creates, explains, reviews and cancels with CSRF, version checks and read invalidation", async () => {
    const { api, calls, paypal } = await connected();
    const invalidated = vi.fn();
    api.subscribe(invalidated);
    const created = await api.runScenario("b_needs_review");
    expect(created.purchase_request.status).toBe("IN_REVIEW");
    expect(created.purchase_request.evaluation?.policy).toHaveLength(8);
    expect(verdictFor(created.purchase_request).reason).toContain("automatic limit");
    const reviewed = await api.submitReview(created.purchase_request.id, { action: "approve", note: "Budget verified." }, created.purchase_request.version);
    expect(reviewed.status).toBe("ALLOWED");
    expect(reviewed.keys.policy.state).toBe("granted");
    expect(reviewed.keys.payer.state).not.toBe("granted");
    expect(verdictFor(reviewed).word).toBe("Allowed.");
    expect(paypal.creates).toBe(0);
    const reviewCall = calls.find((call) => call.url.endsWith("/reviews"))!;
    expect(reviewCall.init.headers).toMatchObject({ "If-Match": `"${created.purchase_request.version}"` });
    expect((reviewCall.init.headers as Record<string, string>)["X-CSRF-Token"]).toBeTruthy();
    expect((await api.cancelPurchaseRequest(reviewed.id)).status).toBe("CANCELLED");
    expect(invalidated).toHaveBeenCalledTimes(3);
    const events = (await api.listAuditEvents({ purchase_request_id: reviewed.id, limit: 100 })).data;
    expect(events.some((event) => event.type === "review.approved")).toBe(true);
    expect(auditSummary(events.find((event) => event.type === "decision.made")!)).toBe(created.purchase_request.decision?.reason);
    expect((await api.verifyAuditChain()).ok).toBe(true);
  });

  it("never reaches PayPal for blocked proposals and preserves scenario replay and duplicate behavior", async () => {
    const { api, paypal } = await connected();
    const blocked = await api.runScenario("c_blocked");
    await expect(api.startCheckout(blocked.purchase_request.id)).rejects.toBeInstanceOf(ApiError);
    expect(paypal.creates).toBe(0);
    expect(paypal.captures).toBe(0);
    await api.runScenario("a_low_risk");
    const replay = await api.runScenario("d_retry");
    expect(replay.replayed).toBe(true);
    const duplicate = await api.runScenario("d_duplicate");
    expect(duplicate.purchase_request.status).toBe("BLOCKED");
    expect(duplicate.purchase_request.duplicate_of).toBeTruthy();
  });

  it("keeps payer approval separate, recovers a known decline and shows paid only with matched capture evidence", async () => {
    const { api, paypal } = await connected();
    const created = await api.runScenario("e_capture_declined");
    const checkout = await api.startCheckout(created.purchase_request.id);
    expect(paymentOutcome(checkout.payment, checkout.purchase_request).word).toBe("Waiting for payer.");
    expect(isVerifiedPaid(checkout.payment, checkout.purchase_request)).toBe(false);
    await api.recordPayerCancel(checkout.payment.id);
    expect((await api.listAuditEvents({ type: ["payer.cancelled"] })).data).toHaveLength(1);
    const unapproved = await api.capturePayment(checkout.payment.id, "none");
    expect(unapproved.payment.status).toBe("AWAITING_PAYER");
    expect(isVerifiedPaid(unapproved.payment, unapproved.purchase_request)).toBe(false);
    expect(paypal.captures).toBe(0);
    paypal.approve(checkout.payment.paypal.order_id!);
    const approved = await api.reconcilePayment(checkout.payment.id);
    expect(paymentOutcome(approved.payment, approved.purchase_request).word).toBe("Payer approved.");
    expect(verdictFor(approved.purchase_request).word).toBe("Payer approved.");
    const decline = await api.capturePayment(checkout.payment.id, "instrument_declined");
    expect(paymentOutcome(decline.payment, decline.purchase_request).word).toBe("Not paid.");
    const resumed = await api.startCheckout(created.purchase_request.id);
    expect(resumed.payment.paypal.order_id).toBe(checkout.payment.paypal.order_id);
    paypal.approve(resumed.payment.paypal.order_id!);
    const paid = await api.capturePayment(resumed.payment.id, "none");
    expect(isVerifiedPaid(paid.payment, paid.purchase_request)).toBe(true);
    expect(paymentOutcome(paid.payment, paid.purchase_request).word).toBe("Paid.");
    for (const requestStatus of ["ALLOWED", "CHECKOUT_PENDING", "CAPTURING", "PAYMENT_PENDING"] as const) {
      expect(paymentOutcome(paid.payment, { ...paid.purchase_request, status: requestStatus }).word).toBe("Confirming.");
    }
    expect(isVerifiedPaid({ ...paid.payment, paypal: { ...paid.payment.paypal, capture_status: "PENDING" } }, paid.purchase_request)).toBe(false);
    expect(isVerifiedPaid({ ...paid.payment, paypal: { ...paid.payment.paypal, capture_id: "mismatch" } }, paid.purchase_request)).toBe(false);
    expect(isVerifiedPaid(paid.payment, { ...paid.purchase_request, payment: null })).toBe(false);
  });

  it("covers live ledger pagination and exports the same request filter", async () => {
    const { api } = await connected();
    const result = await api.runScenario("b_needs_review");
    const first = await api.listAuditEvents({ purchase_request_id: result.purchase_request.id, limit: 2 });
    expect(first.next_cursor).toBeTruthy();
    const next = await api.listAuditEvents({ purchase_request_id: result.purchase_request.id, limit: 2, cursor: first.next_cursor! });
    expect(next.data.every((event) => !first.data.some((previous) => previous.id === event.id))).toBe(true);
    expect(api.auditCsvUrl({ purchase_request_id: result.purchase_request.id })).toContain(`purchase_request_id=${result.purchase_request.id}`);
  });

  it("normalizes interrupted response bodies without claiming a mutation did not happen", async () => {
    vi.stubGlobal("fetch", async () => ({ headers: new Headers(), text: async () => { throw new Error("body interrupted"); } }));
    const error = await createHttpAdapter().startCheckout("preq_test").catch((error) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.retryable).toBe(true);
    expect(error.message).not.toMatch(/nothing was changed|no payment was taken/i);
  });
});
