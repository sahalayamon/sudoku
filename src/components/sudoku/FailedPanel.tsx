"use client";

import { m } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { restartCurrent, startNewGame } from "@/features/game/actions";
import { DIFFICULTY_LABEL, plural } from "@/lib/format";
import { useGameStore } from "@/stores/game";

/** Calm, not punishing: the board stays visible for review, with clear next steps. */
export function FailedPanel() {
  const router = useRouter();
  const mistakes = useGameStore((s) => s.mistakes);
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);

  return (
    <m.section
      role="alert"
      aria-label="Mistake limit reached"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 0.8, 0.28, 1] }}
      className="rounded-[18px] border border-line bg-surface p-5"
    >
      <div className="eyebrow text-danger">Out of mistakes</div>
      <h2 className="mt-1 font-serif text-[30px] leading-[1.1] text-ink">That one got away.</h2>
      <p className="mt-1.5 text-[14px] text-ink-2">
        You reached {plural(mistakes, "mistake")} on this {DIFFICULTY_LABEL[difficulty].toLowerCase()} puzzle. Review the board, or try
        again with a clear head.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="primary" icon={<RotateCcw className="size-4" />} onClick={restartCurrent}>
          Try this puzzle again
        </Button>
        <div className="flex gap-2">
          {mode === "standard" ? (
            <Button variant="secondary" className="flex-1" onClick={() => void startNewGame(difficulty)}>
              New puzzle
            </Button>
          ) : null}
          <Button variant="ghost" className="flex-1" onClick={() => router.push("/")}>
            Home
          </Button>
        </div>
      </div>
    </m.section>
  );
}
