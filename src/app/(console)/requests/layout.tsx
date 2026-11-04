"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import { RequestQueue } from "@/components/guard/queue";
import { cx } from "@/components/ui/primitives";

/**
 * Fixed context, scrolling detail (DESIGN_REFERENCES principle 7).
 * ≥1024px: queue + detail side by side. <1024px: /requests is the queue, /requests/[id] the detail.
 */
export default function RequestsLayout({ children }: { children: React.ReactNode }) {
  const segments = useSelectedLayoutSegments();
  const id = segments[0];
  if (segments[1] === "checkout") return <>{children}</>;

  return (
    <div className="grid flex-1 lg:grid-cols-[392px_minmax(0,1fr)]">
      <aside
        aria-label="Request queue"
        className={cx(
          "border-rule lg:sticky lg:top-(--topbar) lg:block lg:h-[calc(100dvh-var(--topbar))] lg:border-r",
          id ? "hidden" : "block",
        )}
      >
        <RequestQueue selectedId={id} />
      </aside>
      <div className={cx("min-w-0", id ? "block" : "hidden lg:block")}>{children}</div>
    </div>
  );
}
