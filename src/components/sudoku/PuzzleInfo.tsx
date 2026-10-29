"use client";

import { Pause, Play } from "lucide-react";
import { memo } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { formatDateLong } from "@/lib/date";
import { DIFFICULTY_LABEL, formatPercent } from "@/lib/format";
import { SIDE_LAYOUT_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useGameStore } from "@/stores/game";
import { useSettingsStore } from "@/stores/settings";
import { GameTimer } from "./GameTimer";

function MistakeMeter({ mistakes, limit }: { mistakes: number; limit: number }) {
  const unlimited = limit === 0;
  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label={unlimited ? `${mistakes} mistakes` : `${mistakes} of ${limit} mistakes`}
    >
      {!unlimited ? (
        <span className="flex gap-1" aria-hidden="true">
          {Array.from({ length: limit }, (_, i) => (
            <span
              key={i}
              className={cn("size-[7px] rounded-full transition-colors duration-300", i < mistakes ? "bg-danger" : "bg-line-strong")}
            />
          ))}
        </span>
      ) : null}
      <span className="tabular text-[15px] font-medium text-ink">{unlimited ? mistakes : `${mistakes} / ${limit}`}</span>
    </div>
  );
}

function ProgressMeter({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-[5px] min-w-[40px] flex-1 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Puzzle progress"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="tabular w-9 text-right text-[13px] font-medium text-ink-2">{formatPercent(value)}</span>
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <div className="eyebrow mb-1 text-[10px]">{children}</div>;
}

function PauseButton({ className }: { className?: string }) {
  const paused = useGameStore((s) => s.paused);
  const pause = useGameStore((s) => s.pause);
  const resume = useGameStore((s) => s.resume);
  const label = paused ? "Resume" : "Pause";
  return (
    <IconButton label={label} shortcut="Space" onClick={() => (paused ? resume() : pause("user"))} className={className}>
      {paused ? <Play className="size-[18px] fill-current" /> : <Pause className="size-[18px]" />}
    </IconButton>
  );
}

/** One row above the board on phones and portrait tablets. */
function CompactInfo({ progress }: { progress: number }) {
  const mistakes = useGameStore((s) => s.mistakes);
  const limit = useGameStore((s) => s.mistakeLimit);
  const playing = useGameStore((s) => s.phase === "playing");
  const showTimer = useSettingsStore((s) => s.showTimer);
  return (
    <div className="flex h-11 items-center gap-4 px-1">
      <MistakeMeter mistakes={mistakes} limit={limit} />
      <ProgressMeter value={progress} className="min-w-0 flex-1 max-[400px]:hidden" />
      <div className="ml-auto flex items-center gap-0.5">
        {showTimer ? <GameTimer className="text-[19px] text-ink" /> : null}
        {playing ? <PauseButton className="-mr-2" /> : null}
      </div>
    </div>
  );
}

/** A quiet card beside the board on laptops and landscape tablets. */
function SideInfo({ progress }: { progress: number }) {
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);
  const dailyDate = useGameStore((s) => s.dailyDate);
  const mistakes = useGameStore((s) => s.mistakes);
  const limit = useGameStore((s) => s.mistakeLimit);
  const playing = useGameStore((s) => s.phase === "playing");
  const showTimer = useSettingsStore((s) => s.showTimer);

  return (
    <div className="flex flex-col gap-5 rounded-[16px] border border-line bg-surface p-5">
      <div>
        <div className="eyebrow">{mode === "daily" ? "Daily Sudoku" : "Puzzle"}</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-[36px] leading-none text-ink">{DIFFICULTY_LABEL[difficulty]}</h2>
          {mode === "daily" && dailyDate ? <span className="text-[13px] text-ink-2">{formatDateLong(dailyDate)}</span> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6">
        <div>
          <Label>Mistakes</Label>
          <MistakeMeter mistakes={mistakes} limit={limit} />
        </div>
        <div>
          <Label>Progress</Label>
          <ProgressMeter value={progress} />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-4">
        <div>
          <Label>Time</Label>
          {showTimer ? (
            <GameTimer className="text-[34px] leading-none text-ink" />
          ) : (
            <span className="text-[13px] text-ink-3">Timer hidden</span>
          )}
        </div>
        {playing ? <PauseButton className="border border-line" /> : null}
      </div>
    </div>
  );
}

export const PuzzleInfo = memo(function PuzzleInfo() {
  const side = useMediaQuery(SIDE_LAYOUT_QUERY);
  const filled = useGameStore((s) => s.filled);
  const progress = filled / 81;
  return <section aria-label="Puzzle information">{side ? <SideInfo progress={progress} /> : <CompactInfo progress={progress} />}</section>;
});
