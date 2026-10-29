import Link from "next/link";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 select-none whitespace-nowrap font-medium rounded-[10px] " +
  "transition-[background-color,color,border-color,transform,box-shadow] duration-150 ease-out " +
  "active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none aria-disabled:opacity-45 aria-disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover shadow-[inset_0_1px_0_rgb(255_255_255/0.16)]",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
  danger: "bg-danger-soft text-danger hover:brightness-95 dark:hover:brightness-110",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-4 text-[15px]",
  lg: "h-[52px] px-6 text-[16px]",
};

export function buttonClasses(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends Omit<ComponentPropsWithRef<typeof Link>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  icon?: ReactNode;
}

export function ButtonLink({ variant = "secondary", size = "md", className, icon, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
