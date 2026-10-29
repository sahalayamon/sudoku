"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Plain-text name for assistive tech when the label is not text. */
  ariaLabel?: string;
}

interface SegmentedProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** Equal-width radio group with a sliding highlight. Arrow keys move the selection. */
export function Segmented<T extends string | number>({ value, onChange, options, label, size = "md", className }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const dir = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    event.preventDefault();
    const next = (index + dir + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("relative grid rounded-[12px] bg-surface-2 p-1", size === "sm" ? "h-9" : "h-11", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1 bottom-1 rounded-[9px] bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--line)] transition-transform duration-200 ease-out"
        style={{ left: 4, width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 rounded-[9px] px-1 text-[13px] font-medium transition-colors duration-150",
              selected ? "text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
