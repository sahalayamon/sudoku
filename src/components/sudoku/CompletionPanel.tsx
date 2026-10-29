"use client";

import { m } from "framer-motion";
import { Flame, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/primitives";
import { ACHIEVEMENT_BY_ID } from "@/features/achievements/definitions";
import { startNewGame } from "@/features/game/actions";
import { DIFFICULTY_LABEL, formatDuration, plural } from "@/lib/format";
import { useGameStore } from "@/stores/game";

/**
 * Not a modal: the solved board stays in view while this panel settles in beneath/beside it.
 */
export function CompletionPanel() {
  const router = useRouter();
  const summary = useGameStore((s) => s.completion);
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);
  const hintsUsed = useGameStore((s) => s.hintsUsed);
  if (!summary) return null;

  const { record, elapsedMs, isPersonalBest, isFirstAtDifficulty, daily, newAchievements } = summary;
  const flawless = record.mistakes === 0;

  return (
    <m.section
      aria-label="Puzzle solved"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.55, ease: [0.22, 0.8, 0.28, 1] }}
      className="rounded-[18px] border border-line bg-surface p-5 text-center side:text-left"
    >
      <div className="eyebrow text-accent">Solved</div>
      <div role="status" className="tabular mt-1 font-serif text-[56px] leading-[1.05] tracking-[-0.01em] text-ink">
        {formatDuration(elapsedMs)}
      </div>

      {daily?.streakIncreased ? (
        <p className="mt-1 text-[13px] text-ink-2">New streak.</p>
      ) : isPersonalBest ? (
        <p className="mt-1 text-[13px] text-ink-2">Personal best.</p>
      ) : (
        <p className="mt-1 text-[13px] text-ink-2">Puzzle solved.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 side:justify-start">
        {isPersonalBest ? <Pill tone="accent">Personal best</Pill> : null}
        {isFirstAtDifficulty && !isPersonalBest ? (
          <Pill tone="accent">First {DIFFICULTY_LABEL[difficulty].toLowerCase()} solve</Pill>
        ) : null}
        {daily?.streakIncreased ? (
          <Pill tone="hint">
            <Flame className="size-3" /> {daily.streak} day streak
          </Pill>
        ) : null}
        {flawless && hintsUsed === 0 ? <Pill>Flawless</Pill> : null}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
        <div>
          <dt className="eyebrow text-[10px]">{mode === "daily" ? "Daily" : "Level"}</dt>
          <dd className="mt-0.5 text-[15px] font-medium text-ink">{DIFFICULTY_LABEL[difficulty]}</dd>
        </div>
        <div>
          <dt className="eyebrow text-[10px]">Mistakes</dt>
          <dd className="mt-0.5 text-[15px] font-medium text-ink">{record.mistakes}</dd>
        </div>
        <div>
          <dt className="eyebrow text-[10px]">Hints</dt>
          <dd className="mt-0.5 text-[15px] font-medium text-ink">{hintsUsed}</dd>
        </div>
      </dl>

      {newAchievements.length ? (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-left">
          {newAchievements.map((id) => (
            <li key={id} className="flex items-center gap-2.5 text-[13px] text-ink-2">
              <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent">
                <Trophy className="size-3.5" />
              </span>
              <span>
                <span className="font-medium text-ink">{ACHIEVEMENT_BY_ID[id]?.title ?? id}</span> unlocked
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => router.push("/")} autoFocus>
          Continue
        </Button>
        {mode === "standard" ? (
          <Button variant="secondary" className="flex-1" onClick={() => void startNewGame(difficulty)}>
            Next puzzle
          </Button>
        ) : null}
      </div>
      <p className="sr-only">
        Solved in {formatDuration(elapsedMs)} with {plural(record.mistakes, "mistake")}.
      </p>
    </m.section>
  );
}
