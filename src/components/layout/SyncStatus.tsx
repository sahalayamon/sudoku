"use client";

import { AnimatePresence, m } from "framer-motion";
import { AlertCircle, Check, CloudOff, RefreshCw } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { runSync } from "@/lib/sync/controller";
import { useUiStore, type SyncPhase } from "@/stores/ui";

const COPY: Partial<Record<SyncPhase, { label: string; icon: typeof Check; tone: string }>> = {
  syncing: { label: "Syncing", icon: RefreshCw, tone: "text-ink-2" },
  synced: { label: "Synced", icon: Check, tone: "text-accent" },
  offline: { label: "Offline", icon: CloudOff, tone: "text-ink-2" },
  error: { label: "Sync failed", icon: AlertCircle, tone: "text-danger" },
};

/** Quiet status pill. Only appears when there is something worth saying. */
export function SyncStatus({ className }: { className?: string }) {
  const phase = useUiStore((s) => s.syncPhase);
  const copy = COPY[phase];

  return (
    <AnimatePresence initial={false}>
      {copy ? (
        <m.div
          key={phase}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          className={className}
        >
          {phase === "error" ? (
            <button
              type="button"
              onClick={() => void runSync()}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-medium hover:bg-surface-2",
                copy.tone,
              )}
              aria-label="Sync failed. Retry"
            >
              <copy.icon className="size-3.5" />
              {copy.label}
              <span className="text-ink-3">· Retry</span>
            </button>
          ) : (
            <Link
              href="/account/"
              role="status"
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-medium",
                copy.tone,
              )}
            >
              <copy.icon className={cn("size-3.5", phase === "syncing" && "animate-[spin_1.2s_linear_infinite]")} />
              {copy.label}
            </Link>
          )}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
