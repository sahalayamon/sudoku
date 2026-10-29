"use client";

import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useIsClient } from "@/hooks/useIsClient";
import { IconButton } from "./IconButton";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Whether scrim click / Escape / the close button dismiss it. */
  dismissible?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: "sm:max-w-[400px]", md: "sm:max-w-[460px]", lg: "sm:max-w-[560px]" } as const;

/** Bottom sheet on phones, centred dialog from 640px up. */
export function Modal({ open, onClose, title, description, children, footer, dismissible = true, size = "md", className }: ModalProps) {
  const mounted = useIsClient();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useFocusTrap(panel, open, dismissible ? onClose : undefined);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60]">
          <m.div
            className="absolute inset-0 bg-[var(--scrim)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={dismissible ? onClose : undefined}
          />
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-6">
            <m.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descId : undefined}
              tabIndex={-1}
              className={cn(
                "pointer-events-auto flex max-h-[min(86dvh,720px)] w-full flex-col rounded-t-[20px] border border-line bg-surface shadow-[var(--shadow-pop)] outline-none sm:rounded-[20px]",
                SIZES[size],
                className,
              )}
              initial={{ opacity: 0, y: 28, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.24, ease: [0.22, 0.8, 0.28, 1] }}
            >
              <div className="flex items-start gap-3 px-5 pt-5 pb-1">
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="text-[19px] leading-6 font-semibold tracking-[-0.01em] text-ink">
                    {title}
                  </h2>
                  {description ? (
                    <p id={descId} className="mt-1 text-[14px] leading-5 text-ink-2">
                      {description}
                    </p>
                  ) : null}
                </div>
                {dismissible ? (
                  <IconButton label="Close" onClick={onClose} tooltip={false} className="-mt-1 -mr-2">
                    <X className="size-[18px]" />
                  </IconButton>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>
              {footer ? (
                <div className="px-5 pt-2 pb-[max(20px,calc(var(--safe-bottom)+8px))]">{footer}</div>
              ) : (
                <div className="h-[max(12px,var(--safe-bottom))]" />
              )}
            </m.div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
