/**
 * Minimal inline icon set (16px grid, 1.5 stroke, currentColor) — DESIGN_SYSTEM.md §1.7.
 * Kept in-repo to avoid an icon dependency for ~14 glyphs.
 */
import type { SVGProps } from "react";

const PATHS = {
  check: "M3.5 8.5l3 3 6-7",
  x: "M4 4l8 8M12 4l-8 8",
  alert: "M8 2.5l6 11H2l6-11zM8 6.5v3.2M8 11.6v.1",
  arrowRight: "M3 8h10M9 4l4 4-4 4",
  arrowLeft: "M13 8H3M7 4L3 8l4 4",
  external: "M9 3h4v4M13 3L7.5 8.5M12 9.5V13H3V4h3.5",
  search: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM10.6 10.6L14 14",
  copy: "M5.5 5.5V3h7.5v7.5h-2.5M3 5.5h7.5V13H3z",
  chevronDown: "M4 6l4 4 4-4",
  chevronRight: "M6 4l4 4-4 4",
  key: "M5 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM7.5 8h6.5M12 8v2.2M14 8v1.6",
  dot: "M8 8h.01",
  play: "M5 3.5v9l7-4.5-7-4.5z",
  reset: "M3 8a5 5 0 1 0 1.5-3.5M3 2.5V5h2.5",
  send: "M14 2L7 9M14 2l-4.5 12L7 9 2 6.5 14 2z",
  minus: "M4 8h8",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
