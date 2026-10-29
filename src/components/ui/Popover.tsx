"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/cn";

interface TriggerProps {
  open: boolean;
  toggle: () => void;
  id: string;
  panelId: string;
  ref: RefObject<HTMLButtonElement | null>;
}

interface PopoverProps {
  /** Accessible name of the panel. */
  label: string;
  trigger: (props: TriggerProps) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A non-modal panel anchored to its trigger. Closes on outside press and Escape, and
 * hands focus back to the trigger. Focus moves to the selected option when it opens.
 */
export function Popover({ label, trigger, children, align = "end", className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const panelId = `${id}-panel`;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = panel.current;
    const target =
      node?.querySelector<HTMLElement>('[aria-checked="true"], [aria-pressed="true"]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus({ preventScroll: true });
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      {trigger({ open, toggle: () => setOpen((o) => !o), id, panelId, ref: triggerRef })}
      <AnimatePresence>
        {open ? (
          <m.div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 0.8, 0.28, 1] }}
            style={{ transformOrigin: align === "end" ? "top right" : "top left" }}
            className={cn(
              "absolute top-full z-50 mt-2 max-h-[calc(100dvh-96px)] w-[min(300px,calc(100vw-24px))] overflow-y-auto rounded-[16px] border border-line bg-surface p-4 shadow-[var(--shadow-pop)]",
              align === "end" ? "right-0" : "left-0",
              className,
            )}
          >
            {children}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
