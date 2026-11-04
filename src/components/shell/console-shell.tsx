"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { API_MODE } from "@/lib/api";
import { COPY } from "@/lib/copy";
import { useQuery } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/primitives";
import { TopBar } from "./top-bar";
import { LoadError } from "@/components/guard/request-parts";

export function ConsoleShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useQuery("session", (api) => api.getSession(), { pollMs: API_MODE === "live" ? 30_000 : undefined });

  useEffect(() => {
    if (!session.loading && session.data === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [session.loading, session.data, router, pathname]);

  if (!session.data) {
    if (session.error) return <main className="mx-auto max-w-[560px] py-16 gutter"><LoadError error={session.error} retry={session.refetch} /></main>;
    return (
      <div className="min-h-dvh" aria-busy="true">
        <div className="flex h-(--topbar) items-center gap-6 border-b border-rule gutter">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2 w-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-on-ink">Skip to content</a>
      <TopBar session={session.data} />
      {API_MODE === "mock" && (
        <p className="border-b border-rule bg-review-tint py-1.5 text-center t-small text-review gutter">{COPY.mockBanner}</p>
      )}
      <main id="main" className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
