"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/copy";
import { useApi, useQuery } from "@/lib/hooks";
import { ButtonLink, Notice, StatusLine } from "@/components/ui/primitives";
import { LoadError, errorMessage } from "@/components/guard/request-parts";

function Cancel() {
  const api = useApi();
  const router = useRouter();
  const params = useSearchParams();
  const paymentId = params.get("payment");
  const session = useQuery("cancel-session", (api) => api.getSession());
  const started = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!paymentId) return void router.replace("/requests");
    if (session.data === null) return void router.replace(`/login?next=${encodeURIComponent(`/checkout/cancel?${params.toString()}`)}`);
    if (!session.data || started.current === paymentId) return;
    started.current = paymentId;
    api.getPayment(paymentId).then(async (payment) => {
      if (["AWAITING_PAYER", "APPROVED"].includes(payment.status)) await api.recordPayerCancel(payment.id).catch(() => {});
      router.replace(`/payments/${payment.id}`);
    }).catch((error) => setError(errorMessage(error)));
  }, [api, paymentId, router, session.data, params]);
  return (
    <main className="mx-auto max-w-[560px] py-16 gutter">
      {session.error ? <LoadError error={session.error} retry={session.refetch} />
        : error ? <Notice tone="review" title={COPY.returnUnconfirmed} action={<ButtonLink href={`/payments/${paymentId}`}>View payment</ButtonLink>}>{error}</Notice>
        : <StatusLine>{COPY.payerClosed}</StatusLine>}
    </main>
  );
}

export default function CheckoutCancelPage() {
  return <Suspense><Cancel /></Suspense>;
}
