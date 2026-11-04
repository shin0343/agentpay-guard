"use client";

import Link from "next/link";
import {
  forwardRef, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes,
} from "react";
import type { Tone } from "@/lib/copy";
import { shortId } from "@/lib/format";
import { Icon, type IconName } from "./icon";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const TONE_TEXT: Record<Tone, string> = { allow: "text-allow", review: "text-review", block: "text-block", neutral: "text-muted" };
export const TONE_BG: Record<Tone, string> = { allow: "bg-allow", review: "bg-review", block: "bg-block", neutral: "bg-muted" };
export const TONE_TINT: Record<Tone, string> = { allow: "bg-allow-tint", review: "bg-review-tint", block: "bg-block-tint", neutral: "bg-sunken" };
export const TONE_BORDER: Record<Tone, string> = { allow: "border-allow", review: "border-review", block: "border-block", neutral: "border-rule-strong" };

// ── Button ────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "quiet" | "danger";
const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-on-ink hover:opacity-90 border border-ink",
  secondary: "border border-rule-strong text-ink hover:bg-sunken",
  quiet: "text-ink underline-offset-4 hover:underline px-0!",
  danger: "border border-block text-block hover:bg-block-tint",
};
const SIZE = { md: "h-10 px-4 t-body font-medium", lg: "h-12 px-5 text-[16px] font-medium", sm: "h-8 px-3 t-small font-medium" };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZE;
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, iconRight, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md transition-[background-color,opacity,transform] duration-(--t-fast) active:translate-y-px disabled:opacity-40 disabled:active:translate-y-0",
        VARIANT[variant], SIZE[size], className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {(children || loading) && <span>{children}{loading ? "…" : ""}</span>}
      {iconRight && <Icon name={iconRight} />}
    </button>
  );
});

export function ButtonLink({ href, variant = "secondary", size = "md", className, children, icon, iconRight, external }: {
  href: string; variant?: Variant; size?: keyof typeof SIZE; className?: string; children: ReactNode;
  icon?: IconName; iconRight?: IconName; external?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md transition-[background-color,opacity] duration-(--t-fast)", VARIANT[variant], SIZE[size], className)}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {icon && <Icon name={icon} />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} />}
    </Link>
  );
}

// ── StatusLabel: dot + word, never color alone ─────────────────────────────

export function StatusLabel({ tone, children, live, className, wrap }: { tone: Tone; children: ReactNode; live?: boolean; className?: string; wrap?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2 t-small font-medium", wrap ? "text-right" : "whitespace-nowrap", TONE_TEXT[tone], className)}>
      <span aria-hidden className={cx("size-2 shrink-0 rounded-full", TONE_BG[tone], live && "motion-pulse")} />
      {children}
    </span>
  );
}

// ── IdTag: mono, copies on click ───────────────────────────────────────────

export function IdTag({ id, full, className, label }: { id: string; full?: boolean; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      title={`Copy ${id}`}
      aria-label={`Copy ${label ?? "ID"} ${id}`}
      onClick={() => {
        navigator.clipboard?.writeText(id).then(() => setCopied(true), () => {});
      }}
      className={cx("inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-sm text-left t-data text-muted hover:text-ink transition-colors duration-(--t-fast)", className)}
    >
      <span className={full ? "min-w-0 break-all" : undefined}>{copied ? "Copied" : full ? id : shortId(id)}</span>
      <Icon name="copy" size={12} className="opacity-60" />
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-rule px-1 t-data text-[11px]! text-muted">{children}</kbd>;
}

export function Label({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={cx("t-label text-muted", className)}>{children}</div>;
}

// ── Fields ─────────────────────────────────────────────────────────────────

const FIELD = "w-full rounded-md border border-rule-strong bg-raised px-3 text-ink placeholder:text-muted transition-colors duration-(--t-fast) focus-visible:outline-2 focus-visible:outline-focus";

export const SearchField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }>(
  function SearchField({ label, hint = "/", className, ...rest }, ref) {
    return (
      <label className={cx("relative block", className)}>
        <span className="sr-only">{label}</span>
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input ref={ref} type="search" className={cx(FIELD, "h-10 pl-9 pr-10 t-body")} placeholder={label} {...rest} />
        {hint && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:block"><Kbd>{hint}</Kbd></span>}
      </label>
    );
  },
);

export function TextArea({ label, error, hint, ref, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string; error?: string | null; hint?: string; ref?: Ref<HTMLTextAreaElement>;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="t-label text-muted">{label}</label>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={cx(FIELD, "mt-2 min-h-20 py-2.5 t-body resize-y", error && "border-block")}
        {...rest}
      />
      {error ? <p id={`${id}-err`} className="mt-1.5 t-small text-block">{error}</p>
        : hint ? <p id={`${id}-hint`} className="mt-1.5 t-small text-muted">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ label, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="t-label text-muted">{label}</label>
      <input id={id} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-err` : undefined} className={cx(FIELD, "mt-2 h-10 t-body", error && "border-block")} {...rest} />
      {error && <p id={`${id}-err`} className="mt-1.5 t-small text-block">{error}</p>}
    </div>
  );
}

// ── Inline notice (errors never go in toasts) ──────────────────────────────

export function Notice({ tone = "neutral", title, children, action, className }: {
  tone?: Tone; title: string; children?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div role={tone === "block" ? "alert" : "status"} className={cx("flex flex-col gap-3 border-l-[3px] py-3 pl-4 pr-3 sm:flex-row sm:items-center", TONE_TINT[tone], TONE_BORDER[tone], className)}>
      <div className="min-w-0 flex-1">
        <p className={cx("t-body font-medium", tone === "neutral" ? "text-ink" : TONE_TEXT[tone])}>{title}</p>
        {children && <div className="mt-0.5 t-small text-ink-2">{children}</div>}
      </div>
      {action}
    </div>
  );
}

// ── Skeleton + mono status line ────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cx("block rounded-sm bg-sunken", className)} />;
}

export function StatusLine({ children }: { children: ReactNode }) {
  return (
    <p className="t-label text-muted" role="status" aria-live="polite">
      <span className="motion-pulse">{children}</span>
    </p>
  );
}

// ── Dialog / Sheet on native <dialog> (focus trap + Esc for free) ──────────

export function Dialog({ open, onClose, title, children, labelledBy, className, variant = "dialog" }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; labelledBy?: string; className?: string;
  variant?: "dialog" | "sheet";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy ?? (title ? titleId : undefined)}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "bg-raised text-ink shadow-(--shadow-pop) border border-rule p-0",
        variant === "sheet"
          ? "apg-sheet m-0 ml-auto h-dvh max-h-dvh w-full max-w-[460px] rounded-none border-y-0 border-r-0"
          : "m-auto w-[min(92vw,460px)] rounded-lg",
        className,
      )}
    >
      {open && (
        <div className={variant === "sheet" ? "flex h-full flex-col" : "p-6"}>
          {title && <h2 id={titleId} className="t-display-m">{title}</h2>}
          {children}
        </div>
      )}
    </dialog>
  );
}
