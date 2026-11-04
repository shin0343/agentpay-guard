"use client";

import { RequestQueue } from "@/components/guard/queue";

export default function ReviewQueuePage() {
  return (
    <div className="mx-auto w-full max-w-[760px] lg:border-x lg:border-rule">
      <RequestQueue fixedStatus={["IN_REVIEW"]} basePath="/review" title="Review" />
    </div>
  );
}
