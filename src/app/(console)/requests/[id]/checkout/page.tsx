"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { API_MODE } from "@/lib/api";
import { COPY } from "@/lib/copy";
import { countdown, formatMoney } from "@/lib/format";
import { useNow, useQuery } from "@/lib/hooks";
import { Icon } from "@/components/ui/icon";
import { ButtonLink, IdTag, Notice } from "@/components/ui/primitives";
import { DetailSkeleton } from "@/components/guard/request-detail";
import { LoadError, RequestActions, StaleNotice, requestTitle } from "@/components/guard/request-parts";
import { PayPalZone } from "@/components/guard/paypal-zone";
import { TwoKey } from "@/components/guard/verdict";

const PAYABLE = ["ALLOWED", "CHECKOUT_PENDING", "PAYMENT_FAILED"];

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery(`request:${id}`, (api) => api.getPurchaseRequest(id), { pollMs: API_MODE === "live" ? 3000 : undefined });
  const now = useNow(1000);
  const r = q.data;

  if (q.error && !r) return <div className="mx-auto max-w-[680px] py-8 gutter"><LoadError error={q.error} retry={q.refetch} /></div>;
  if (!r) return <DetailSkeleton />;

  const payable = PAYABLE.includes(r.status) && r.next_actions.some((action) => ["start_checkout", "resume_checkout", "retry_payment"].includes(action))
    && (!r.decision?.expires_at || new Date(r.decision.expires_at).getTime() > now);
  const expiresIn = r.decision?.expires_at ? new Date(r.decision.expires_at).getTime() - now : null;

  return (
    <article className="mx-auto w-full max-w-[680px] space-y-8 pb-24 pt-6 gutter sm:pt-10">
      <Link href={`/requests/${r.id}`} className="inline-flex items-center gap-1.5 t-small font-medium text-ink-2 hover:text-ink">
        <Icon name="arrowLeft" size={14} /> Request
      </Link>

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="t-label text-muted">Checkout</p>
          <h1 className="mt-1 t-display-m">{COPY.approvePayment}</h1>
          <p className="mt-1 t-small text-ink-2">{requestTitle(r)} · {r.merchant.name} · <IdTag id={r.id} label="request ID" /></p>
        </div>
        <p className="t-amount-l">{formatMoney(r.amount)}</p>
      </header>

      {!!q.error && <StaleNotice retry={q.refetch} />}
      <div className="border-y border-rule"><TwoKey keys={r.keys} status={r.status} /></div>

      {payable ? (
        <>
          {r.status === "PAYMENT_FAILED" && (
            <Notice tone="block" title="The last attempt was not paid.">No payment was taken. Approve again in PayPal to retry.</Notice>
          )}
          <PayPalZone request={r} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="t-small text-ink-2">
              {expiresIn !== null && expiresIn > 0 ? <>Policy approval expires in <span className="t-data text-ink">{countdown(expiresIn)}</span></> : "Policy approval has expired."}
            </p>
            <RequestActions r={{ ...r, next_actions: r.next_actions.filter((a) => a === "cancel") }} />
          </div>
          {API_MODE === "live" && <p className="t-small text-muted">{COPY.sandboxPayee}</p>}
        </>
      ) : (
        <Notice
          tone={r.status === "BLOCKED" || r.status === "REJECTED" ? "block" : "neutral"}
          title={
            r.status === "BLOCKED" ? "Blocked requests can never reach PayPal."
              : r.status === "IN_REVIEW" ? "This request needs a reviewer first."
              : r.status === "PAID" ? "This request is already paid."
              : r.status === "CAPTURING" ? "A capture is in progress."
              : "Checkout isn't available for this request."
          }
          action={
            r.payment ? <ButtonLink size="sm" href={`/payments/${r.payment.id}`}>View payment</ButtonLink>
              : r.status === "IN_REVIEW" ? <ButtonLink size="sm" href={`/review/${r.id}`}>Open review</ButtonLink>
              : <ButtonLink size="sm" href={`/requests/${r.id}`}>Back to request</ButtonLink>
          }
        >
          {r.status === "PAID" || r.status === "CAPTURING" || r.status === "PAYMENT_PENDING"
            ? "Open the payment to see its current state."
            : "No PayPal button is shown, because policy approval is not in place."}
        </Notice>
      )}
    </article>
  );
}
