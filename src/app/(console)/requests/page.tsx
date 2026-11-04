"use client";

import { RequestDetail } from "@/components/guard/request-detail";
import { EmptyState, LoadError } from "@/components/guard/request-parts";
import { API_MODE } from "@/lib/api";
import { useQuery } from "@/lib/hooks";

/** Desktop: shows the newest request beside the queue. Mobile: the layout shows only the queue. */
export default function RequestsIndex() {
  const q = useQuery("newest", (api) => api.listPurchaseRequests({ limit: 1 }), { pollMs: API_MODE === "live" ? 3000 : undefined });
  const first = q.data?.data[0];
  if (q.error && !q.data) return <div className="p-8"><LoadError error={q.error} retry={q.refetch} /></div>;
  if (!q.data) return null;
  if (!first) {
    return (
      <div className="mx-auto max-w-[880px] pt-8 gutter">
        <EmptyState title="No agent requests yet." line="Use “Send test request” to fire scenario A–E as an agent." />
      </div>
    );
  }
  return <RequestDetail key={first.id} id={first.id} showBack={false} />;
}
