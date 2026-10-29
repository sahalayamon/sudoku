import { DIFFICULTIES, randomSeed, type Difficulty, type Puzzle } from "@/lib/sudoku";
import { loadDailyPuzzle, loadPool, saveDailyPuzzle, savePool, type PuzzlePool } from "@/lib/storage/repository";
import { PuzzleClient } from "./client";
import { dailyDifficulty, dailySeed } from "./daily";

/**
 * Single entry point for getting puzzles into the app.
 *  - standard puzzles come from a small pre-generated pool when available, so
 *    "New game" is instant, and are generated in a worker otherwise;
 *  - the Daily is deterministic from the date and cached for offline use.
 */

const POOL_TARGET: Record<Difficulty, number> = {
  beginner: 1,
  easy: 1,
  medium: 1,
  hard: 2,
  expert: 2,
};

let foreground: PuzzleClient | null = null;
let background: PuzzleClient | null = null;
let refilling = false;

function fg(): PuzzleClient {
  return (foreground ??= new PuzzleClient());
}
function bg(): PuzzleClient {
  return (background ??= new PuzzleClient());
}

function takeFromPool(difficulty: Difficulty): Puzzle | null {
  const pool = loadPool();
  const list = pool[difficulty];
  if (!list?.length) return null;
  const [puzzle, ...rest] = list;
  savePool({ ...pool, [difficulty]: rest });
  return puzzle ?? null;
}

/** A fresh puzzle at the requested level. */
export async function requestPuzzle(difficulty: Difficulty): Promise<Puzzle> {
  const pooled = takeFromPool(difficulty);
  if (pooled) {
    scheduleRefill();
    return pooled;
  }
  const puzzle = await fg().generate(difficulty, randomSeed());
  scheduleRefill();
  return puzzle;
}

/** Today's Daily. Same date => same puzzle on every device. */
export async function requestDailyPuzzle(date: string): Promise<Puzzle> {
  const cached = loadDailyPuzzle(date);
  if (cached && cached.seed === dailySeed(date)) return cached;
  const puzzle = await fg().generate(dailyDifficulty(date), dailySeed(date));
  saveDailyPuzzle(date, puzzle);
  return puzzle;
}

/** Quietly top the pool up while the browser is idle. */
export function scheduleRefill(): void {
  if (refilling || typeof window === "undefined") return;
  const idle: (cb: () => void) => void =
    typeof window.requestIdleCallback === "function"
      ? (cb) => window.requestIdleCallback(cb, { timeout: 4000 })
      : (cb) => window.setTimeout(cb, 1500);
  refilling = true;
  idle(() => void refill().finally(() => (refilling = false)));
}

async function refill(): Promise<void> {
  for (const difficulty of DIFFICULTIES) {
    for (;;) {
      const pool: PuzzlePool = loadPool();
      if ((pool[difficulty]?.length ?? 0) >= POOL_TARGET[difficulty]) break;
      try {
        const puzzle = await bg().generate(difficulty, randomSeed());
        const latest = loadPool();
        savePool({ ...latest, [difficulty]: [...(latest[difficulty] ?? []), puzzle] });
      } catch {
        return;
      }
    }
  }
}
