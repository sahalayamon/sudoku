import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Kbd } from "./Kbd";

interface TooltipProps {
  label: string;
  /** Keyboard shortcut shown beside the label. */
  shortcut?: string;
  side?: "top" | "bottom";
  children: ReactNode;
  className?: string;
}

/**
 * Pure-CSS tooltip: shows on hover and keyboard focus, never on touch.
 * The trigger keeps its own aria-label; the bubble is decorative for assistive tech.
 */
export function Tooltip({ label, shortcut, side = "top", children, className }: TooltipProps) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[12px] font-medium text-bg opacity-0 shadow-[var(--shadow-pop)]",
          "transition-opacity duration-150 delay-0 group-hover/tip:opacity-100 group-hover/tip:delay-500 group-focus-within/tip:opacity-100",
          "[@media(hover:none)]:hidden flex items-center gap-1.5",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {label}
        {shortcut ? <Kbd inverted>{shortcut}</Kbd> : null}
      </span>
    </span>
  );
}
