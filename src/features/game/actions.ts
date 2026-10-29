import { GENERATOR_VERSION, type Difficulty, type Puzzle } from "@/lib/sudoku";
import { DIFFICULTY_LABEL } from "@/lib/format";
import { dailyDifficulty } from "@/features/puzzle/daily";
import { requestDailyPuzzle, requestPuzzle } from "@/features/puzzle/service";
import { useGameStore } from "@/stores/game";
import { useLibraryStore } from "@/stores/library";
import type { GameRecord } from "@/types/game";

/**
 * Game lifecycle orchestration: starting, continuing, replaying and restarting.
 * Components call these; they coordinate the game, library and puzzle service.
 */

/** In-progress standard games kept around so a quick restart never loses one. */
const MAX_LIVE_STANDARD = 3;

export function puzzleFromRecord(record: Pick<GameRecord, "puzzleId" | "givens" | "solution" | "difficulty" | "score" | "seed">): Puzzle {
  return {
    id: record.puzzleId,
    givens: record.givens,
    solution: record.solution,
    difficulty: record.difficulty,
    score: record.score,
    rating: 0,
    clues: record.givens.split("").filter((c) => c !== "0").length,
    seed: record.seed,
    techniques: {},
    hardestTechnique: null,
    generatorVersion: GENERATOR_VERSION,
  };
}

/** Keep the library's idea of "in progress" within bounds: oldest extras become abandoned. */
function trimLiveStandard(): void {
  const lib = useLibraryStore.getState();
  const standard = lib.live.filter((g) => g.mode === "standard");
  for (const extra of standard.slice(MAX_LIVE_STANDARD - 1)) lib.abandonLive(extra.id);
}

/** Starting a new game at a level throws away the unfinished one at that level (it is deleted, not kept in history). */
function discardLiveAt(difficulty: Difficulty): void {
  const lib = useLibraryStore.getState();
  for (const g of lib.live) if (g.mode === "standard" && g.difficulty === difficulty) lib.removeLive(g.id);
}

/** Save whatever is on screen before another game takes over. */
function parkCurrent(): void {
  const game = useGameStore.getState();
  if (game.phase === "playing") {
    game.pause("auto");
    game.flushSave();
  }
}

export async function startNewGame(difficulty: Difficulty): Promise<void> {
  parkCurrent();
  const game = useGameStore.getState();
  game.setGenerating(`Generating a ${DIFFICULTY_LABEL[difficulty].toLowerCase()} puzzle`, { difficulty, mode: "standard" });
  try {
    const puzzle = await requestPuzzle(difficulty);
    discardLiveAt(difficulty);
    trimLiveStandard();
    useGameStore.getState().loadNew(puzzle, "standard");
  } catch {
    useGameStore.getState().setError("We couldn't generate a puzzle. Please try again.");
  }
}

export async function startDailyGame(date: string): Promise<void> {
  parkCurrent();
  const lib = useLibraryStore.getState();
  const existing = lib.live.find((g) => g.mode === "daily" && g.dailyDate === date);
  if (existing) {
    useGameStore.getState().loadRecord(existing);
    return;
  }
  useGameStore.getState().setGenerating("Preparing today's puzzle", { difficulty: dailyDifficulty(date), mode: "daily", dailyDate: date });
  try {
    const puzzle = await requestDailyPuzzle(date);
    useGameStore.getState().loadNew(puzzle, "daily", date);
  } catch {
    useGameStore.getState().setError("We couldn't prepare today's puzzle. Please try again.");
  }
}

/** Resume a specific in-progress game, or the most recent one. Returns false if there is nothing to resume. */
export function continueGame(id?: string): boolean {
  const lib = useLibraryStore.getState();
  const record = id ? lib.live.find((g) => g.id === id) : lib.live[0];
  if (!record) return false;
  const game = useGameStore.getState();
  if (game.phase === "playing" && game.id === record.id) return true;
  parkCurrent();
  useGameStore.getState().loadRecord(record);
  return true;
}

/** Play the same puzzle again from scratch (as a standard game). */
export function replayGame(record: GameRecord): void {
  parkCurrent();
  trimLiveStandard();
  useGameStore.getState().loadNew(puzzleFromRecord(record), "standard");
}

/** Restart the open puzzle. The current attempt stays in history as abandoned. */
export function restartCurrent(): void {
  const game = useGameStore.getState();
  if (game.phase === "idle" || game.phase === "generating") return;
  const record = { ...game.toRecord(), id: game.id };
  const puzzle = puzzleFromRecord(record);
  const { mode, dailyDate } = game;
  if (game.phase === "playing") game.flushSave();
  useLibraryStore.getState().abandonLive(game.id);
  useGameStore.getState().loadNew(puzzle, mode, dailyDate);
}

/** The live game for today's daily, if one is in progress. */
export function liveDailyFor(date: string): GameRecord | undefined {
  return useLibraryStore.getState().live.find((g) => g.mode === "daily" && g.dailyDate === date);
}
