"use client";

import { cn } from "@/lib/cn";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onChange, label, disabled, id }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[28px] w-[48px] shrink-0 items-center rounded-full border transition-colors duration-200 ease-out",
        // Generous invisible hit area: the visible switch stays slim, the tap target reaches ~44px.
        "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']",
        "disabled:opacity-45",
        checked ? "border-accent bg-accent" : "border-line-strong bg-surface-3",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-[3px] size-[20px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-200 ease-[var(--ease-out)]",
          checked ? "translate-x-[20px]" : "translate-x-0",
        )}
      />
    </button>
  );
}
