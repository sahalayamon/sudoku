"use client";

import { AnimatePresence, m } from "framer-motion";
import { AlertCircle, Check, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui";

const ICONS = { success: Check, error: AlertCircle, neutral: Info } as const;

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4"
      style={{ top: "calc(var(--safe-top) + 12px)" }}
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <m.div
              key={toast.id}
              layout
              role={toast.tone === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: -14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 0.8, 0.28, 1] }}
              className="pointer-events-auto flex max-w-[min(420px,100%)] items-center gap-3 rounded-[14px] border border-line bg-surface py-2.5 pr-3 pl-3 shadow-[var(--shadow-pop)]"
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full",
                  toast.tone === "success" && "bg-accent-soft text-accent",
                  toast.tone === "error" && "bg-danger-soft text-danger",
                  toast.tone === "neutral" && "bg-surface-2 text-ink-2",
                )}
              >
                <Icon className="size-3.5" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 text-[14px] leading-5">
                <span className="font-medium text-ink">{toast.message}</span>
                {toast.detail ? <span className="block text-[13px] text-ink-2">{toast.detail}</span> : null}
              </span>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="ml-1 rounded-md px-2 py-1 text-[13px] font-semibold text-accent hover:bg-accent-soft"
                >
                  {toast.action.label}
                </button>
              ) : null}
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
