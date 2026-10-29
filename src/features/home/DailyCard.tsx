"use client";

import { Check, Flame } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card, Pill } from "@/components/ui/primitives";
import { startDailyGame } from "@/features/game/actions";
import { dailyDifficulty } from "@/features/puzzle/daily";
import { recentDays } from "@/features/statistics/compute";
import { useStats } from "@/hooks/useStats";
import { useToday } from "@/hooks/useToday";
import { cn } from "@/lib/cn";
import { formatDateLong, parseDateKey } from "@/lib/date";
import { DIFFICULTY_LABEL, formatDuration, formatPercent } from "@/lib/format";
import { filledCells } from "@/lib/sync/merge";
import { useLibraryStore } from "@/stores/library";

const WEEKDAY_INITIAL = ["S", "M", "T", "W", "T", "F", "S"];

function WeekStrip({ days, solved, today }: { days: string[]; solved: Set<string>; today: string }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="Last seven days of Daily puzzles">
      {days.map((day) => {
        const p = parseDateKey(day)!;
        const weekday = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
        const done = solved.has(day);
        const isToday = day === today;
        return (
          <li
            key={day}
            className="flex flex-col items-center gap-1.5"
            aria-label={`${formatDateLong(day)}: ${done ? "solved" : isToday ? "today" : "not solved"}`}
          >
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full border text-accent-ink transition-colors",
                done
                  ? "border-accent bg-accent"
                  : isToday
                    ? "border-accent/60 border-dashed bg-transparent"
                    : "border-line-strong bg-transparent",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3.2} /> : null}
            </span>
            <span className={cn("text-[11px] font-medium", isToday ? "text-ink" : "text-ink-3")}>{WEEKDAY_INITIAL[weekday]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function DailyCard({ className }: { className?: string }) {
  const router = useRouter();
  const today = useToday();
  const stats = useStats();
  const live = useLibraryStore((s) => s.live.find((g) => g.mode === "daily" && g.dailyDate === today));
  const solvedGame = useLibraryStore((s) =>
    s.finished.find((g) => g.mode === "daily" && g.dailyDate === today && g.status === "completed"),
  );
  const days = useMemo(() => recentDays(today, 7), [today]);
  const solvedDays = useMemo(() => new Set(stats.dailyDates), [stats.dailyDates]);
  const difficulty = dailyDifficulty(today);
  const streak = stats.streak.current;

  const play = () => {
    void startDailyGame(today);
    router.push("/play/");
  };

  return (
    <Card className={cn("flex flex-col p-5 md:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Daily Sudoku</div>
          <h2 className="mt-0.5 text-[19px] leading-6 font-semibold tracking-[-0.01em] text-ink">{formatDateLong(today)}</h2>
        </div>
        {streak > 0 ? (
          <Pill tone="hint" className="shrink-0">
            <Flame className="size-3" />
            {streak} day streak
          </Pill>
        ) : (
          <Pill className="shrink-0">{DIFFICULTY_LABEL[difficulty]}</Pill>
        )}
      </div>

      <p className="mt-2 text-[14px] leading-[22px] text-ink-2">
        {solvedGame
          ? "You've solved today's puzzle. A new one arrives at midnight."
          : `Today's puzzle is ${DIFFICULTY_LABEL[difficulty].toLowerCase()}. Everyone gets the same one.`}
      </p>

      <div className="mt-5">
        <WeekStrip days={days} solved={solvedDays} today={today} />
      </div>

      <div className="mt-auto pt-6">
        {solvedGame ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-accent">
                <Check className="size-4" strokeWidth={2.6} />
              </span>
              <div>
                <div className="text-[14px] font-semibold text-ink">Solved today</div>
                <div className="tabular text-[12px] text-ink-2">
                  {formatDuration(solvedGame.elapsedMs)} · {solvedGame.mistakes} {solvedGame.mistakes === 1 ? "mistake" : "mistakes"}
                </div>
              </div>
            </div>
            <span className="text-[12px] text-ink-3">Back tomorrow</span>
          </div>
        ) : live ? (
          <Button variant="primary" size="lg" className="w-full" onClick={play}>
            Continue Daily · {formatPercent(filledCells(live) / 81)}
          </Button>
        ) : (
          <Button variant="primary" size="lg" className="w-full" onClick={play}>
            Play today&apos;s puzzle
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Quiet one-line entry to today's daily puzzle (the minimal Home screen). */
export function DailyLink() {
  const router = useRouter();
  const today = useToday();
  const stats = useStats();
  const live = useLibraryStore((s) => s.live.find((g) => g.mode === "daily" && g.dailyDate === today));
  const solved = useLibraryStore((s) => s.finished.some((g) => g.mode === "daily" && g.dailyDate === today && g.status === "completed"));
  const streak = stats.streak.current;
  const go = () => {
    void startDailyGame(today);
    router.push("/play/");
  };
  return (
    <button type="button" onClick={go} className="rounded-full px-4 py-2 text-[15px] text-ink-2 transition-colors hover:text-ink">
      Daily · {DIFFICULTY_LABEL[dailyDifficulty(today)]}
      {solved ? " · solved" : live ? " · in progress" : ""}
      {streak > 0 ? ` · ${streak}-day streak` : ""}
    </button>
  );
}
