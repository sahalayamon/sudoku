import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Quiet surface used for grouped content. One border, no heavy shadow. */
export function Card({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("rise rounded-[16px] border border-line bg-surface", className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-[10px] bg-[linear-gradient(90deg,var(--surface-2),var(--surface-3),var(--surface-2))] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]",
        className,
      )}
    />
  );
}

export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "hint" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold tracking-[0.06em] uppercase",
        tone === "neutral" && "bg-surface-2 text-ink-2",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "hint" && "bg-hint-soft text-hint",
        tone === "danger" && "bg-danger-soft text-danger",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="eyebrow">{label}</div>
      <div className="tabular mt-1 truncate text-[26px] leading-8 font-semibold tracking-[-0.02em] text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-[12px] leading-4 text-ink-3">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon ? <div className="mb-4 grid size-12 place-items-center rounded-full bg-surface-2 text-ink-2">{icon}</div> : null}
      <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-[34ch] text-[14px] text-ink-2">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="text-[13px] font-semibold tracking-[0.09em] text-ink-2 uppercase">{title}</h2>
      {aside}
    </div>
  );
}
