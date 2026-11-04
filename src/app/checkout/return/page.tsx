"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/copy";
import { useApi, useIntentKey, useQuery } from "@/lib/hooks";
import { ButtonLink, Notice, StatusLine } from "@/components/ui/primitives";
import { errorMessage, LoadError } from "@/components/guard/request-parts";
import { simulateFor } from "@/components/guard/paypal-zone";

/** The query token never proves approval: capture verifies the owned order on the server. */
function Return() {
  const api = useApi();
  const router = useRouter();
  const params = useSearchParams();
  const paymentId = params.get("payment");
  const session = useQuery("return-session", (api) => api.getSession());
  const [error, setError] = useState<string | null>(null);
  const started = useRef<string | null>(null);
  const [intentKey] = useIntentKey();

  useEffect(() => {
    if (session.data === null) {
      router.replace(`/login?next=${encodeURIComponent(`/checkout/return?${params.toString()}`)}`);
      return;
    }
    if (!session.data || !paymentId || started.current === paymentId) return;
    started.current = paymentId;
    api.getPayment(paymentId)
      .then(async (payment) => {
        const request = await api.getPurchaseRequest(payment.purchase_request_id);
        return api.capturePayment(paymentId, simulateFor(request, payment), { idempotencyKey: `${intentKey}:${paymentId}` });
      })
      .then(() => router.replace(`/payments/${paymentId}`))
      .catch((error) => setError(errorMessage(error)));
  }, [api, paymentId, router, session.data, params, intentKey]);

  return (
    <main className="mx-auto max-w-[560px] py-16 gutter">
      {!paymentId ? <Notice tone="block" title={COPY.missingPayment} action={<ButtonLink href="/requests">Open requests</ButtonLink>}>{COPY.returnRecovery}</Notice>
        : session.error ? <LoadError error={session.error} retry={session.refetch} />
        : error ? <Notice tone="review" title={COPY.returnUnconfirmed} action={<ButtonLink href={`/payments/${paymentId}`}>View payment</ButtonLink>}>{error} {COPY.returnRecovery}</Notice>
        : <StatusLine>{COPY.confirmingPayment}</StatusLine>}
    </main>
  );
}

export default function CheckoutReturnPage() {
  return <Suspense><Return /></Suspense>;
}
