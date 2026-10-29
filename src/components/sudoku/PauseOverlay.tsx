"use client";

import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/stores/game";
import { GameTimer } from "./GameTimer";

/** Covers the (blurred) board while paused. The timer is stopped; nothing underneath is readable. */
export function PauseOverlay() {
  const resume = useGameStore((s) => s.resume);
  return (
    <div className="absolute inset-0 z-[4] flex flex-col items-center justify-center gap-5 bg-[color-mix(in_srgb,var(--board-bg)_55%,transparent)] text-center">
      <div className="grid size-14 place-items-center rounded-full border border-line bg-surface text-ink-2">
        <Pause className="size-6" strokeWidth={1.8} />
      </div>
      <div>
        <div className="font-serif text-[34px] leading-none text-ink">Paused</div>
        <div className="mt-2 text-[13px] text-ink-2">
          <GameTimer className="text-[15px] text-ink" /> <span className="text-ink-3">· timer stopped</span>
        </div>
      </div>
      <Button variant="primary" size="lg" icon={<Play className="size-[18px] fill-current" />} onClick={resume} autoFocus>
        Resume
      </Button>
    </div>
  );
}
