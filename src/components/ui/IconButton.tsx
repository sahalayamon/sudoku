import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

interface IconButtonProps extends Omit<ComponentPropsWithRef<"button">, "aria-label"> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  shortcut?: string;
  tooltip?: boolean;
  children: ReactNode;
  tone?: "default" | "accent";
}

/** 44px touch target with a calmer 36px visual footprint. */
export function IconButton({
  label,
  shortcut,
  tooltip = true,
  tone = "default",
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "relative inline-flex size-11 items-center justify-center rounded-[10px] text-ink-2 transition-[background-color,color,transform] duration-150 ease-out",
        "hover:bg-surface-2 hover:text-ink active:scale-[0.94] disabled:pointer-events-none disabled:opacity-40",
        tone === "accent" && "text-accent hover:text-accent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
  return tooltip ? (
    <Tooltip label={label} shortcut={shortcut}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}
