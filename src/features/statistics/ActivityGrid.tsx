"use client";

import { useMemo } from "react";
import { addDays, parseDateKey, weekdayOf } from "@/lib/date";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";

const WEEKS = 20;
const LEVEL_OPACITY = [0, 0.28, 0.5, 0.75, 1];

function level(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/** Solves per day over the last 14 weeks. Reads like a calendar, not a chart. */
export function ActivityGrid({ solvesByDate, today }: { solvesByDate: Record<string, number>; today: string }) {
  const columns = useMemo(() => {
    // Weeks start on Monday; the last column ends on today's week.
    const mondayOffset = (weekdayOf(today) + 6) % 7;
    const start = addDays(today, -(mondayOffset + (WEEKS - 1) * 7));
    return Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  }, [today]);

  const total = useMemo(
    () => columns.flat().reduce((sum, day) => sum + (day <= today ? (solvesByDate[day] ?? 0) : 0), 0),
    [columns, solvesByDate, today],
  );

  return (
    <figure>
      <div className="flex gap-1.5" role="img" aria-label={`${plural(total, "puzzle")} solved in the last ${WEEKS} weeks`}>
        <div className="hidden flex-col justify-between py-[1px] pr-1 text-[10px] leading-none text-ink-3 sm:flex" aria-hidden="true">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
          <span>Sun</span>
        </div>
        <div className="flex flex-1 justify-between gap-[3px] [--c:clamp(10px,2.6vw,22px)]">
          {columns.map((week, w) => (
            <div key={w} className="grid grid-rows-7 gap-[3px]" style={{ width: "var(--c)" }}>
              {week.map((day) => {
                const future = day > today;
                const count = solvesByDate[day] ?? 0;
                const p = parseDateKey(day)!;
                const lv = level(count);
                return (
                  <div
                    key={day}
                    title={future ? undefined : `${day}: ${plural(count, "solve")}`}
                    className={cn(
                      "h-[var(--c)] w-full rounded-[3px]",
                      future ? "opacity-0" : lv === 0 ? "bg-surface-3" : "bg-accent",
                      day === today && "ring-1 ring-ink/50",
                    )}
                    style={lv > 0 ? { opacity: LEVEL_OPACITY[lv] } : undefined}
                    data-day={p.d}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-3 flex items-center justify-between text-[12px] text-ink-3">
        <span>
          {plural(total, "solve")} in {WEEKS} weeks
        </span>
        <span className="flex items-center gap-1" aria-hidden="true">
          Less
          {LEVEL_OPACITY.map((o, i) => (
            <span
              key={i}
              className={cn("size-2.5 rounded-[3px]", i === 0 ? "bg-surface-3" : "bg-accent")}
              style={i > 0 ? { opacity: o } : undefined}
            />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  );
}
