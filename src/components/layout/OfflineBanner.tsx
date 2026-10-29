"use client";

import { AnimatePresence, m } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

/** Reassures rather than alarms: the game works fully offline. */
export function OfflineBanner() {
  const online = useOnline();
  return (
    <AnimatePresence>
      {!online ? (
        <m.div
          key="offline"
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[75] flex justify-center px-4"
          style={{ paddingBottom: "calc(var(--safe-bottom) + 84px)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
        >
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2 text-[13px] text-ink-2 shadow-[var(--shadow-pop)]">
            <WifiOff className="size-4 text-ink-3" />
            <span>
              <span className="font-medium text-ink">Offline.</span> Progress is saved on this device.
            </span>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
