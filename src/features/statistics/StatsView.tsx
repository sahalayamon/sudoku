"use client";

import { ChartNoAxesColumn } from "lucide-react";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, EmptyState, SectionHeading, Stat } from "@/components/ui/primitives";
import { ActivityGrid } from "@/features/statistics/ActivityGrid";
import { scopedStats } from "@/features/statistics/compute";
import { useStats } from "@/hooks/useStats";
import { useToday } from "@/hooks/useToday";
import { cn } from "@/lib/cn";
import { DIFFICULTY_LABEL, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { DIFFICULTIES, type Difficulty } from "@/lib/sudoku";

type Scope = Difficulty | "all";

const SCOPES: { value: Scope; label: string }[] = [
  { value: "all", label: "All levels" },
  ...DIFFICULTIES.map((d) => ({ value: d as Scope, label: DIFFICULTY_LABEL[d] })),
];

const dash = "—";

export function StatsView() {
  const stats = useStats();
  const today = useToday();
  const [scope, setScope] = useState<Scope>("all");
  const s = scopedStats(stats, scope);
  const hasGames = stats.played > 0;

  return (
    <>
      <PageHeader
        eyebrow="Statistics"
        title="Your numbers"
        description="Everything here is computed from the games stored on this device."
      />

      {!hasGames ? (
        <Card>
          <EmptyState
            icon={<ChartNoAxesColumn className="size-5" />}
            title="Nothing to show yet"
            description="Finish a puzzle and your times, streaks and progress will appear here."
            action={
              <ButtonLink href="/" variant="primary">
                Play a puzzle
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-10 md:gap-12">
          <section aria-label="Summary">
            <FilterChips label="Difficulty" value={scope} onChange={setScope} options={SCOPES} className="mb-5" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Games played", value: formatNumber(s.played) },
                { label: "Completed", value: formatNumber(s.completed) },
                { label: "Win rate", value: s.completed + s.failed + s.abandoned ? formatPercent(s.winRate) : dash },
                { label: "Avg. mistakes", value: s.avgMistakes === null ? dash : formatNumber(s.avgMistakes, 1) },
                { label: "Best time", value: s.bestTimeMs === null ? dash : formatDuration(s.bestTimeMs) },
                { label: "Average time", value: s.avgTimeMs === null ? dash : formatDuration(s.avgTimeMs) },
                {
                  label: "Current streak",
                  value: `${stats.streak.current} ${stats.streak.current === 1 ? "day" : "days"}`,
                  hint: "Daily puzzles",
                },
                { label: "Best streak", value: `${stats.streak.best} ${stats.streak.best === 1 ? "day" : "days"}`, hint: "Daily puzzles" },
              ].map((item, i) => (
                <Card key={item.label} className={i < 2 ? "tile-hero p-4 md:p-5" : "p-4 md:p-5"}>
                  <Stat label={item.label} value={item.value} hint={item.hint} />
                </Card>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-ink-3">Best times exclude games where hints were used.</p>
          </section>

          <section aria-label="By difficulty">
            <SectionHeading title="By difficulty" />
            <Card className="divide-y divide-line">
              {DIFFICULTIES.map((d) => {
                const row = stats.byDifficulty[d];
                const finished = row.completed + row.failed + row.abandoned;
                const share = row.played ? row.completed / row.played : 0;
                return (
                  <div
                    key={d}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 p-4 md:grid-cols-[150px_1fr_auto_auto] md:gap-x-6 md:p-5"
                  >
                    <div className="font-medium text-ink">{DIFFICULTY_LABEL[d]}</div>
                    <div className="tabular text-right text-[13px] text-ink-2 md:order-3 md:w-[84px]">
                      {row.completed} / {row.played}
                    </div>
                    <div className="col-span-2 flex items-center gap-3 md:order-2 md:col-span-1">
                      <div
                        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"
                        role="progressbar"
                        aria-label={`${DIFFICULTY_LABEL[d]} completion`}
                        aria-valuenow={Math.round(share * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={cn("h-full rounded-full bg-accent transition-[width] duration-700 ease-out")}
                          style={{ width: `${share * 100}%` }}
                        />
                      </div>
                      <span className="tabular w-10 text-right text-[12px] text-ink-3">{finished ? formatPercent(row.winRate) : dash}</span>
                    </div>
                    <div className="tabular col-span-2 text-[12px] text-ink-3 md:order-4 md:col-span-1 md:w-[170px] md:text-right">
                      Best {row.bestTimeMs === null ? dash : formatDuration(row.bestTimeMs)} · Avg{" "}
                      {row.avgTimeMs === null ? dash : formatDuration(row.avgTimeMs)}
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>

          <section aria-label="Activity">
            <SectionHeading title="Activity" />
            <Card className="p-4 md:p-6">
              <ActivityGrid solvesByDate={stats.solvesByDate} today={today} />
            </Card>
          </section>
        </div>
      )}
    </>
  );
}
