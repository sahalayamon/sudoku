import { useId, type ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends Omit<ComponentPropsWithRef<"input">, "id"> {
  label: string;
  error?: string | null;
  hint?: string;
}

export function TextField({ label, error, hint, className, ...props }: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 w-full rounded-[10px] border bg-surface px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] duration-150",
          "placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] disabled:opacity-50",
          error ? "border-danger" : "border-line",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
