"use client";

import { memo, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { getElapsedMs, useGameStore } from "@/stores/game";

/**
 * The only component that ticks. It reads the clock itself and writes straight to the
 * DOM, so the second-by-second update never re-renders anything else.
 */
export const GameTimer = memo(function GameTimer({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const running = useGameStore((s) => s.phase === "playing" && !s.paused);
  const phase = useGameStore((s) => s.phase);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const paint = () => {
      const text = formatDuration(getElapsedMs());
      if (node.textContent !== text) node.textContent = text;
    };
    paint();
    if (!running) return;
    const id = window.setInterval(paint, 250);
    return () => window.clearInterval(id);
  }, [running, phase]);

  return (
    <span
      ref={ref}
      role="timer"
      aria-label="Elapsed time"
      className={cn("tabular font-mono font-medium tracking-[-0.02em]", className)}
      suppressHydrationWarning
    >
      00:00
    </span>
  );
});
