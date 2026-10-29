"use client";

import { m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LevelSelector } from "@/components/ui/LevelSelector";
import { startNewGame, continueGame } from "@/features/game/actions";
import { DIFFICULTY_LABEL } from "@/lib/format";
import type { Difficulty } from "@/lib/sudoku";
import { useLibraryStore } from "@/stores/library";
import { useMetaStore } from "@/stores/meta";

/** The mark: a filled circle with a bold grid, in the accent colour. */
function Mark() {
  return (
    <svg viewBox="0 0 200 200" className="size-[184px] sm:size-[200px]" aria-hidden="true">
      <circle cx="100" cy="100" r="100" fill="var(--accent)" />
      <g stroke="var(--bg)" strokeWidth="13" strokeLinecap="round">
        <path d="M80 48V152M120 48V152M52 80H148M52 120H148" />
      </g>
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const lastDifficulty = useMetaStore((s) => s.lastDifficulty);
  const [choice, setChoice] = useState<Difficulty | null>(null);
  const difficulty = choice ?? lastDifficulty;
  // Only a game in progress at the level currently shown can be continued.
  const record = useLibraryStore((s) => s.live.find((g) => g.difficulty === difficulty));

  const [confirming, setConfirming] = useState(false);

  const start = () => {
    setConfirming(false);
    useMetaStore.getState().patch({ lastDifficulty: difficulty });
    void startNewGame(difficulty);
    router.push("/play/");
  };
  const resume = () => {
    if (record && continueGame(record.id)) router.push("/play/");
  };

  return (
    <div className="mx-auto flex w-full max-w-[300px] flex-1 flex-col items-center justify-center gap-9 py-6">
      <h1 className="sr-only">Sudoku</h1>
      <ConfirmDialog
        open={confirming}
        title="Start a new game?"
        description={`Your unfinished ${DIFFICULTY_LABEL[difficulty]} game will be deleted. This can't be undone.`}
        confirmLabel="Start new game"
        destructive
        onConfirm={start}
        onCancel={() => setConfirming(false)}
      />
      <m.div
        initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
      >
        <div className="animate-[float-soft_5s_ease-in-out_infinite]">
          <Mark />
        </div>
      </m.div>

      <div className="flex w-full flex-col items-center gap-5">
        <LevelSelector value={difficulty} onChange={setChoice} className="enter" />

        <button
          type="button"
          onClick={() => (record ? setConfirming(true) : start())}
          className="enter h-11 w-full rounded-full border border-accent/40 text-[16px] text-ink transition-colors hover:bg-surface-2 active:bg-surface-2"
        >
          New game
        </button>
        {/* The slot is always reserved, so nothing else moves when Continue appears. */}
        <div className="enter h-11 w-full">
          {record ? (
            <m.button
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              type="button"
              onClick={resume}
              className="h-full w-full rounded-full bg-accent text-[16px] font-medium text-accent-ink transition-opacity active:opacity-85"
            >
              Continue
            </m.button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
