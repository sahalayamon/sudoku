"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Card } from "@/components/ui/primitives";
import { startNewGame } from "@/features/game/actions";
import { cn } from "@/lib/cn";
import { DIFFICULTY_BLURB, DIFFICULTY_GIVENS, DIFFICULTY_LABEL, DIFFICULTY_SKILLS } from "@/lib/format";
import { DIFFICULTIES, difficultyIndex, type Difficulty } from "@/lib/sudoku";
import { useMetaStore } from "@/stores/meta";

const OPTIONS = DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }));

function Meter({ level }: { level: number }) {
  return (
    <span className="flex items-end gap-[3px]" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[4px] rounded-full bg-accent transition-opacity"
          style={{ height: 6 + i * 3, opacity: i <= level ? 1 : 0.2 }}
        />
      ))}
    </span>
  );
}

interface NewGamePanelProps {
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  className?: string;
}

/** The level picker and the start button, as a card that stretches to match its neighbours. */
export function NewGamePanel({ difficulty, onDifficulty, className }: NewGamePanelProps) {
  const router = useRouter();

  const start = () => {
    useMetaStore.getState().patch({ lastDifficulty: difficulty });
    void startNewGame(difficulty);
    router.push("/play/");
  };

  return (
    <Card className={cn("flex flex-col p-5 md:p-6", className)}>
      <section aria-labelledby="new-game-heading" className="flex flex-1 flex-col">
        <div className="eyebrow">New game</div>
        <h2 id="new-game-heading" className="mt-0.5 text-[19px] leading-6 font-semibold tracking-[-0.01em] text-ink">
          Pick your level
        </h2>

        <Segmented<Difficulty> label="Difficulty" value={difficulty} onChange={onDifficulty} options={OPTIONS} className="mt-5" />
        <div className="mt-4 flex min-h-[44px] items-start gap-3" aria-live="polite">
          <Meter level={difficultyIndex(difficulty)} />
          <p className="text-[14px] leading-[22px] text-ink-2">{DIFFICULTY_BLURB[difficulty]}</p>
        </div>

        <dl className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-[1fr_auto] sm:gap-x-8" aria-live="polite">
          <div>
            <dt className="eyebrow text-[10px]">You&apos;ll use</dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {DIFFICULTY_SKILLS[difficulty].map((skill) => (
                <span key={skill} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-2">
                  {skill}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="eyebrow text-[10px]">Starting numbers</dt>
            <dd className="tabular mt-1.5 text-[17px] leading-6 font-semibold text-ink">{DIFFICULTY_GIVENS[difficulty]}</dd>
          </div>
        </dl>

        <div className="mt-auto pt-6">
          <Button variant="primary" size="lg" className="w-full" onClick={start} icon={<ArrowRight className="order-last size-[18px]" />}>
            New game
          </Button>
        </div>
      </section>
    </Card>
  );
}
