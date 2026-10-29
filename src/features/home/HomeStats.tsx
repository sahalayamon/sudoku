"use client";

import { Flame } from "lucide-react";
import { scopedStats } from "@/features/statistics/compute";
import { useStats } from "@/hooks/useStats";
import { cn } from "@/lib/cn";
import { DIFFICULTY_LABEL, formatDuration, plural } from "@/lib/format";
import type { Difficulty } from "@/lib/sudoku";

function Item({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow truncate text-[10px]">{label}</div>
      <div className="tabular mt-1 truncate text-[22px] leading-7 font-semibold tracking-[-0.02em] text-ink sm:text-[26px] sm:leading-8">
        {value}
      </div>
      {sub ? <div className="mt-0.5 truncate text-[11px] text-ink-3">{sub}</div> : null}
    </div>
  );
}

/**
 * Four plain numbers. Best and average follow the difficulty chosen in the level picker.
 * On phones it closes the page; on wide screens it sits beside the title.
 */
export function HomeStats({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  const stats = useStats();
  const scope = scopedStats(stats, difficulty);
  const streak = stats.streak.current;

  return (
    <section
      aria-label="Your numbers"
      className={cn("grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-4 lg:gap-x-5", className)}
    >
      <Item
        label="Streak"
        value={
          <span className="flex items-center gap-1.5">
            {streak > 0 ? <Flame className="size-5 text-hint" strokeWidth={2.2} /> : null}
            {streak}
            <span className="text-[13px] font-medium text-ink-3">{streak === 1 ? "day" : "days"}</span>
          </span>
        }
        sub={stats.streak.best > 0 ? `Best ${stats.streak.best}` : "Solve the Daily"}
      />
      <Item
        label="Completed"
        value={stats.completed}
        sub={stats.solvedToday > 0 ? `${plural(stats.solvedToday, "solve")} today` : "All levels"}
      />
      <Item
        label={`Best · ${DIFFICULTY_LABEL[difficulty]}`}
        value={scope.bestTimeMs === null ? "—" : formatDuration(scope.bestTimeMs)}
        sub={scope.completed ? `${scope.completed} solved` : "No solves yet"}
      />
      <Item
        label={`Average · ${DIFFICULTY_LABEL[difficulty]}`}
        value={scope.avgTimeMs === null ? "—" : formatDuration(scope.avgTimeMs)}
        sub={scope.completed ? "Solved games" : undefined}
      />
    </section>
  );
}
