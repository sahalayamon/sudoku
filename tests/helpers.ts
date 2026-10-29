import { ALL_DIGITS_MASK, BIT } from "@/lib/sudoku/constants";
import { createLogicState, type LogicState } from "@/lib/sudoku/logic";
import { generatePuzzle, type Puzzle } from "@/lib/sudoku";
import type { GameRecord } from "@/types/game";

export const CLASSIC = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
export const CLASSIC_SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

/** An empty board where every cell still has every candidate. */
export function blankState(): LogicState {
  const state = createLogicState(new Uint8Array(81));
  if (!state) throw new Error("blank state must be valid");
  return state;
}

export function setCands(state: LogicState, cell: number, digits: number[]): void {
  let m = 0;
  for (const d of digits) m |= BIT[d]!;
  state.cands[cell] = m;
}

export function removeDigit(state: LogicState, cells: number[], digit: number): void {
  for (const c of cells) state.cands[c]! &= ~BIT[digit]! & ALL_DIGITS_MASK;
}

export const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

let cachedPuzzle: Puzzle | null = null;
export function samplePuzzle(): Puzzle {
  return (cachedPuzzle ??= generatePuzzle({ difficulty: "beginner", seed: "test-puzzle" }));
}

let counter = 0;
export function makeRecord(overrides: Partial<GameRecord> = {}): GameRecord {
  const puzzle = samplePuzzle();
  counter++;
  const base: GameRecord = {
    id: `game-${counter}`,
    puzzleId: puzzle.id,
    givens: puzzle.givens,
    solution: puzzle.solution,
    difficulty: puzzle.difficulty,
    score: puzzle.score,
    seed: puzzle.seed,
    mode: "standard",
    dailyDate: null,
    status: "completed",
    values: puzzle.solution,
    notes: new Array<number>(81).fill(0),
    elapsedMs: 300_000,
    mistakes: 0,
    mistakeLimit: 3,
    hintsUsed: 0,
    moves: 40,
    startedAt: 1_700_000_000_000,
    updatedAt: 1_700_000_300_000,
    completedAt: 1_700_000_300_000,
  };
  return { ...base, ...overrides };
}
