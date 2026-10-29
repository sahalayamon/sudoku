import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Kbd({ children, inverted, className }: { children: ReactNode; inverted?: boolean; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-1 font-mono text-[10.5px] font-medium leading-none",
        inverted ? "bg-bg/15 text-bg" : "border border-line-strong bg-surface-2 text-ink-2",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
