"use client";

import { Calendar, Check, Compass, Flame, Gem, Layers, Lock, Puzzle, Target, Timer, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/primitives";
import { evaluateAchievements, type AchievementGlyph } from "@/features/achievements/definitions";
import { useStats } from "@/hooks/useStats";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/date";
import { useLibraryStore } from "@/stores/library";

const GLYPHS: Record<AchievementGlyph, LucideIcon> = {
  puzzle: Puzzle,
  layers: Layers,
  flame: Flame,
  gem: Gem,
  target: Target,
  timer: Timer,
  check: Check,
  compass: Compass,
  calendar: Calendar,
};

export function AchievementsView() {
  const stats = useStats();
  const finished = useLibraryStore((s) => s.finished);
  const live = useLibraryStore((s) => s.live);
  const unlocks = useLibraryStore((s) => s.achievements);

  const items = useMemo(() => {
    const unlockedAt = new Map(unlocks.map((u) => [u.id, u.unlockedAt]));
    return evaluateAchievements(stats, [...finished, ...live]).map((a) => ({
      ...a,
      unlockedAt: unlockedAt.get(a.def.id) ?? null,
      // Something recorded as unlocked stays unlocked even if the history it came from was cleared.
      earned: a.earned || unlockedAt.has(a.def.id),
    }));
  }, [stats, finished, live, unlocks]);

  const earned = items.filter((i) => i.earned).length;

  return (
    <>
      <PageHeader
        eyebrow="Achievements"
        title={`${earned} of ${items.length}`}
        description="Quiet milestones. They unlock on their own as you play."
      />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ def, current, earned: isEarned, unlockedAt }) => {
          const Icon = GLYPHS[def.glyph];
          return (
            <li
              key={def.id}
              className={cn(
                "flex gap-4 rounded-[16px] border p-4 transition-colors md:p-5",
                isEarned ? "border-line bg-surface" : "border-line bg-transparent",
              )}
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-full",
                  isEarned ? "bg-accent text-accent-ink" : "border border-line-strong text-ink-3",
                )}
              >
                {isEarned ? <Icon className="size-5" strokeWidth={2} /> : <Lock className="size-[18px]" strokeWidth={1.8} />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className={cn("text-[15px] leading-5 font-semibold tracking-[-0.005em]", isEarned ? "text-ink" : "text-ink-2")}>
                  {def.title}
                </h2>
                <p className="mt-0.5 text-[13px] leading-[19px] text-ink-2">{def.description}</p>
                <div className="mt-3">
                  {isEarned ? (
                    <p className="text-[12px] font-medium text-accent">Unlocked{unlockedAt ? ` · ${formatDateShort(unlockedAt)}` : ""}</p>
                  ) : (
                    <div className="flex items-center gap-3">
                      <ProgressBar value={current / def.target} label={`${def.title} progress`} className="flex-1" />
                      <span className="tabular text-[12px] text-ink-3">
                        {current} / {def.target}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
