"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@/contract";
import { API_MODE } from "@/lib/api";
import { useApi, useQuery } from "@/lib/hooks";
import { Icon } from "@/components/ui/icon";
import { Button, cx } from "@/components/ui/primitives";
import { ScenarioSheet } from "./scenario-sheet";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-baseline gap-1.5", className)}>
      <span className="font-display text-[19px] font-medium tracking-[-0.01em]">AgentPay</span>
      <span className="t-label text-muted">Guard</span>
    </span>
  );
}

/** Always visible: never let anyone think this is live money. */
export function EnvTag() {
  const mock = API_MODE === "mock";
  return (
    <span className="t-label text-review" title={mock ? "Mock mode: simulated data, no PayPal or AI calls." : "PayPal Sandbox: no real money moves."}>
      [{mock ? "MOCK" : "SANDBOX"}]
    </span>
  );
}

const NAV = [
  { href: "/requests", label: "Requests" },
  { href: "/review", label: "Review" },
  { href: "/ledger", label: "Ledger" },
  { href: "/policies", label: "Policies" },
] as const;

export function TopBar({ session }: { session: Session }) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);
  const counts = useQuery("summary", (api) => api.listPurchaseRequests({ status: ["IN_REVIEW"], limit: 1 }), { pollMs: API_MODE === "live" ? 3000 : undefined });
  const needsReview = counts.data?.summary.needs_review ?? 0;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur-[2px] supports-[backdrop-filter]:bg-paper/90">
        <div className="flex h-(--topbar) items-center gap-4 gutter lg:gap-8">
          <Link href="/" aria-label="AgentPay Guard home" className="shrink-0"><Wordmark /></Link>
          <nav aria-label="Primary" className="hidden md:block">
            <NavItems pathname={pathname} needsReview={needsReview} />
          </nav>
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <EnvTag />
            {/* Wrappers own the display toggle so it never fights the button's own inline-flex. */}
            <span className="hidden sm:block">
              <Button size="sm" variant="secondary" icon="send" onClick={() => setSheet(true)}>Send test request</Button>
            </span>
            <span className="sm:hidden">
              <Button size="sm" variant="secondary" icon="send" onClick={() => setSheet(true)} aria-label="Send test request" className="w-8 px-0">{null}</Button>
            </span>
            <UserMenu session={session} />
          </div>
        </div>
        <nav aria-label="Primary" className="border-t border-rule md:hidden">
          <div className="gutter"><NavItems pathname={pathname} needsReview={needsReview} /></div>
        </nav>
      </header>
      <ScenarioSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}

function NavItems({ pathname, needsReview }: { pathname: string; needsReview: number }) {
  return (
    <ul className="flex items-center gap-5 sm:gap-6">
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative inline-flex h-10 items-center gap-1.5 t-small font-medium transition-colors duration-(--t-fast) md:h-(--topbar)",
                active ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-ink" : "text-muted hover:text-ink",
              )}
            >
              {n.label}
              {n.href === "/review" && needsReview > 0 && (
                <span className="t-data rounded-sm bg-review-tint px-1.5 text-[11px]! leading-[18px]! text-review" aria-label={`${needsReview} need review`}>{needsReview}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserMenu({ session }: { session: Session }) {
  const api = useApi();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const signOut = async () => {
    await api.signOut();
    router.push("/login");
  };
  const switchRole = async () => {
    await api.signIn(session.user.role === "reviewer" ? "operator" : "reviewer");
    setOpen(false);
    router.refresh();
  };

  const initials = session.user.name.split(/[\s.]+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-2 rounded-md px-1.5 transition-colors duration-(--t-fast) hover:bg-sunken"
      >
        <span className="inline-flex size-6 items-center justify-center rounded-full border border-rule-strong t-data text-[11px]!">{initials}</span>
        <span className="hidden t-small text-ink-2 lg:inline">{session.user.name}</span>
        <Icon name="chevronDown" size={14} className="text-muted" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-40 w-60 rounded-lg border border-rule bg-raised py-1 shadow-(--shadow-pop) motion-fade">
          <div className="border-b border-rule px-4 py-3">
            <p className="t-body font-medium">{session.user.name}</p>
            <p className="t-label text-muted">{session.user.role}</p>
          </div>
          {API_MODE === "mock" && (
            <button role="menuitem" type="button" onClick={switchRole} className="block w-full px-4 py-2.5 text-left t-small hover:bg-sunken">
              Switch to {session.user.role === "reviewer" ? "operator" : "reviewer"} (mock)
            </button>
          )}
          <button role="menuitem" type="button" onClick={signOut} className="block w-full px-4 py-2.5 text-left t-small hover:bg-sunken">Sign out</button>
        </div>
      )}
    </div>
  );
}
