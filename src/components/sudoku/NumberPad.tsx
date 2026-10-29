"use client";

import { Check, X } from "lucide-react";
import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/cn";
import { useGameStore } from "@/stores/game";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Per digit: how many are on the board, and how many of those are correct. */
function digitProgress(values: readonly number[], solution: readonly number[]): number[] {
  const out = new Array<number>(20).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = values[i]!;
    if (!v) continue;
    out[v]!++;
    if (solution[i] === v) out[10 + v]!++;
  }
  return out;
}

export const NumberPad = memo(function NumberPad() {
  const progress = useGameStore(useShallow((s) => digitProgress(s.values, s.solutionDigits)));
  const notesMode = useGameStore((s) => s.notesMode);
  const playable = useGameStore((s) => s.phase === "playing" && !s.paused);
  const input = useGameStore((s) => s.input);

  const canErase = useGameStore(
    (s) => s.selected !== null && !s.givenMask[s.selected] && (s.values[s.selected]! > 0 || s.notes[s.selected]! > 0),
  );
  const erase = useGameStore((s) => s.erase);

  const keyClass = cn(
    "numpad-key relative flex flex-col items-center justify-center border border-line-strong/60 bg-transparent select-none",
    "transition-[background-color,transform,color,border-color,opacity] duration-150 ease-out",
    "hover:bg-surface-2 active:scale-[0.92] active:bg-surface-3 disabled:opacity-40 disabled:pointer-events-none",
  );

  return (
    <div className="numpad" role="group" aria-label="Number pad">
      {DIGITS.map((d) => {
        const placed = progress[d]!;
        const correct = progress[10 + d]!;
        const done = correct >= 9;
        return (
          <button
            key={d}
            type="button"
            disabled={!playable}
            onClick={() => input(d)}
            aria-label={`${notesMode ? "Note" : "Enter"} ${d}. ${done ? "All placed." : `${Math.max(0, 9 - placed)} left.`}`}
            data-state={done ? "done" : "normal"}
            className={cn(keyClass, notesMode ? "text-accent" : "text-ink", done && "opacity-60")}
          >
            <span className="tabular text-[28px] leading-none font-semibold">{d}</span>
            <span className="numpad-count tabular mt-1 flex h-3 items-center text-[11px] leading-none font-medium text-ink-2">
              {done ? <Check className="size-3" strokeWidth={3} /> : Math.max(0, 9 - placed)}
            </span>
          </button>
        );
      })}
      <button type="button" disabled={!playable || !canErase} onClick={erase} aria-label="Erase" className={cn(keyClass, "text-ink")}>
        <X className="size-8" strokeWidth={2.6} />
      </button>
    </div>
  );
});
