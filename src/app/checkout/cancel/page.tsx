"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useApi } from "@/lib/hooks";
import { StatusLine } from "@/components/ui/primitives";

/** PayPal redirect fallback: the payer closed PayPal. Nothing was charged; the order stays open. */
function Cancel() {
  const api = useApi();
  const router = useRouter();
  const paymentId = useSearchParams().get("payment");
  useEffect(() => {
    if (!paymentId) return void router.replace("/requests");
    api.getPayment(paymentId)
      .then((p) => router.replace(`/payments/${p.id}`))
      .catch(() => router.replace("/requests"));
  }, [api, paymentId, router]);
  return <main className="mx-auto max-w-[560px] py-16 gutter"><StatusLine>You closed PayPal · nothing was charged</StatusLine></main>;
}

export default function CheckoutCancelPage() {
  return <Suspense><Cancel /></Suspense>;
}
