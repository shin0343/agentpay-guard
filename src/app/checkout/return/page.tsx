"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/hooks";
import { Notice, StatusLine } from "@/components/ui/primitives";
import { errorMessage } from "@/components/guard/request-parts";

/** PayPal redirect fallback (§2.5): the payer returns here after approving; capture, then show the result. */
function Return() {
  const api = useApi();
  const router = useRouter();
  const paymentId = useSearchParams().get("payment");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!paymentId || started.current) return;
    started.current = true;
    api.capturePayment(paymentId, "none")
      .then(() => router.replace(`/payments/${paymentId}`))
      .catch((e) => setError(errorMessage(e)));
  }, [api, paymentId, router]);

  return (
    <main className="mx-auto max-w-[560px] py-16 gutter">
      {!paymentId ? <Notice tone="block" title="Missing payment reference.">Return to the request and continue to PayPal again.</Notice>
        : error ? <Notice tone="block" title="We couldn't confirm the payment.">{error} Nothing is shown as paid until PayPal confirms it.</Notice>
        : <StatusLine>Payer approved · confirming with PayPal</StatusLine>}
    </main>
  );
}

export default function CheckoutReturnPage() {
  return <Suspense><Return /></Suspense>;
}
