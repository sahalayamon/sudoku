/**
 * Development-only helpers for visual QA, attached to `window.__sudokuDev`.
 * Loaded exclusively when NODE_ENV === "development" (see AppProvider), so none of this ships.
 */
import { addDays, dateKey } from "@/lib/date";
import { newId } from "@/lib/id";
import { DIFFICULTIES, generatePuzzle, type Difficulty } from "@/lib/sudoku";
import { createRng } from "@/lib/sudoku/rng";
import { clearAllData } from "@/lib/storage/repository";
import { useGameStore } from "@/stores/game";
import { useLibraryStore } from "@/stores/library";
import type { GameRecord } from "@/types/game";

function completedRecord(difficulty: Difficulty, seed: string, when: number, rng: () => number, daily: string | null): GameRecord {
  const puzzle = generatePuzzle({ difficulty, seed });
  const base = { beginner: 160, easy: 260, medium: 420, hard: 760, expert: 1200 }[difficulty];
  const elapsedMs = Math.round(base * (0.6 + rng() * 0.9) * 1000);
  return {
    id: newId(),
    puzzleId: puzzle.id,
    givens: puzzle.givens,
    solution: puzzle.solution,
    difficulty,
    score: puzzle.score,
    seed: puzzle.seed,
    mode: daily ? "daily" : "standard",
    dailyDate: daily,
    status: "completed",
    values: puzzle.solution,
    notes: new Array<number>(81).fill(0),
    elapsedMs,
    mistakes: rng() < 0.55 ? 0 : Math.floor(rng() * 3),
    mistakeLimit: 3,
    hintsUsed: rng() < 0.8 ? 0 : 1 + Math.floor(rng() * 2),
    moves: 60,
    startedAt: when - elapsedMs,
    updatedAt: when,
    completedAt: when,
  };
}

export function installDevTools(): void {
  const api = {
    /** Fill history with ~5 weeks of plausible games, including a recent daily streak. */
    seed(days = 35) {
      const rng = createRng("dev-seed");
      const today = dateKey();
      const records: GameRecord[] = [];
      for (let back = 0; back < days; back++) {
        const day = addDays(today, -back);
        const [y, m, d] = day.split("-").map(Number) as [number, number, number];
        const count = back % 4 === 3 ? 0 : 1 + Math.floor(rng() * 3);
        for (let i = 0; i < count; i++) {
          const difficulty = DIFFICULTIES[Math.floor(rng() * DIFFICULTIES.length)]!;
          const when = new Date(y, m - 1, d, 9 + i * 3, Math.floor(rng() * 59)).getTime();
          if (when > Date.now()) continue;
          records.push(completedRecord(difficulty, `dev-${back}-${i}`, when, rng, null));
        }
        if (back < 9 && back !== 0) {
          const when = new Date(y, m - 1, d, 20, 10).getTime();
          records.push(completedRecord("medium", `dev-daily-${back}`, when, rng, day));
        }
      }
      const failed = completedRecord("hard", "dev-failed", Date.now() - 86_400_000 * 2, rng, null);
      records.push({ ...failed, status: "failed", mistakes: 3, values: failed.givens });
      useLibraryStore.getState().mergeRemote(records);
      useLibraryStore.getState().reevaluateAchievements();
      return records.length;
    },
    /** Solve the open puzzle except the last `remaining` empty cells. */
    solveAllBut(remaining = 1) {
      const game = useGameStore.getState();
      const empty = game.values.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
      for (const cell of empty.slice(0, Math.max(0, empty.length - remaining))) {
        useGameStore.getState().select(cell);
        useGameStore.getState().input(game.solutionDigits[cell]!);
      }
      return useGameStore.getState().values.filter((v) => v === 0).length;
    },
    game: useGameStore,
    clear() {
      clearAllData();
      useLibraryStore.getState().reset();
      location.reload();
    },
  };
  (window as unknown as { __sudokuDev: typeof api }).__sudokuDev = api;
}
