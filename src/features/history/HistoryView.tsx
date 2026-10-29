"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LevelSelector } from "@/components/ui/LevelSelector";
import { replayGame } from "@/features/game/actions";
import { formatDuration } from "@/lib/format";
import type { Difficulty } from "@/lib/sudoku";
import { useLibraryStore } from "@/stores/library";
import { useMetaStore } from "@/stores/meta";
import type { GameRecord } from "@/types/game";

const dateOf = (g: GameRecord) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(g.completedAt ?? g.updatedAt));

/** Solved puzzles only, fastest first, one level at a time. Games in progress never appear here. */
export function HistoryView() {
  const router = useRouter();
  const finished = useLibraryStore((s) => s.finished);
  const lastDifficulty = useMetaStore((s) => s.lastDifficulty);
  const [choice, setChoice] = useState<Difficulty | null>(null);
  const difficulty = choice ?? lastDifficulty;

  const times = useMemo(
    () => finished.filter((g) => g.status === "completed" && g.difficulty === difficulty).sort((a, b) => a.elapsedMs - b.elapsedMs),
    [finished, difficulty],
  );

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center pt-2 md:pt-6">
      <h1 className="sr-only">Times</h1>
      <LevelSelector value={difficulty} onChange={setChoice} className="mt-2" />

      {times.length === 0 ? (
        <p className="mt-16 text-center text-[16px] text-ink-2">No solved puzzles at this level yet.</p>
      ) : (
        <ol className="mt-4 w-full">
          {times.map((g, i) => (
            <li
              key={g.id}
              className="enter flex items-center gap-3 border-b border-line/60 px-1 py-4 last:border-0"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <button
                type="button"
                onClick={() => {
                  replayGame(g);
                  router.push("/play/");
                }}
                aria-label={`Replay puzzle solved on ${dateOf(g)} in ${formatDuration(g.elapsedMs)}`}
                className="flex flex-1 items-baseline justify-between gap-4 text-left"
              >
                <span className="text-[17px] text-ink">
                  <span className="tabular text-ink-3">{i + 1}.</span> {dateOf(g)}
                </span>
                <span className="tabular text-[17px] text-ink">{formatDuration(g.elapsedMs)}</span>
              </button>
              <button
                type="button"
                onClick={() => useLibraryStore.getState().removeFinished(g.id)}
                aria-label={`Delete the time from ${dateOf(g)}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2 hover:text-ink"
              >
                <Trash2 className="size-5" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
