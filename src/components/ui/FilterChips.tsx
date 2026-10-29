"use client";

import { cn } from "@/lib/cn";

interface FilterChipsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; count?: number }[];
  label: string;
  /** From the `lg` breakpoint up, list the options vertically (for a side column). */
  stacked?: boolean;
  className?: string;
}

/** Single-choice filters: scrolling chips on small screens, an optional vertical list beside the content on wide ones. */
export function FilterChips<T extends string>({ value, onChange, options, label, stacked, className }: FilterChipsProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "scroll-hide -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0",
        stacked && "lg:flex-col lg:gap-1 lg:overflow-visible",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150",
              selected ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
              stacked &&
                "lg:h-10 lg:w-full lg:justify-between lg:rounded-[10px] lg:border-transparent lg:bg-transparent lg:px-3 lg:text-[14px] lg:hover:bg-surface-2 " +
                  (selected ? "lg:!bg-surface-2 lg:!text-ink" : ""),
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={cn("tabular text-[12px]", selected ? "opacity-70" : "text-ink-3", stacked && "lg:text-ink-3 lg:opacity-100")}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
