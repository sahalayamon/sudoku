import type { Difficulty, Hint } from "@/lib/sudoku";

export type GameMode = "standard" | "daily";

export type GameStatus = "in_progress" | "completed" | "failed" | "abandoned";

/** One cell change, with before/after values so it can be undone and redone. */
export interface CellPatch {
  /** Cell index 0-80. */
  i: number;
  v0: number;
  n0: number;
  v1: number;
  n1: number;
}

/** A single user action; may touch several cells (auto-removed notes, fill notes, ...). */
export type Move = CellPatch[];

/**
 * Everything needed to resume, review, sync or replay a game.
 * Finished games drop `history`/`future` to stay small.
 */
export interface GameRecord {
  id: string;
  puzzleId: string;
  givens: string;
  solution: string;
  difficulty: Difficulty;
  score: number;
  seed: string;
  mode: GameMode;
  /** Local calendar date (YYYY-MM-DD) for daily puzzles. */
  dailyDate: string | null;
  status: GameStatus;
  /** 81 chars, 0 = empty. */
  values: string;
  /** 81 candidate bitmasks (bit 0 = digit 1). */
  notes: number[];
  elapsedMs: number;
  mistakes: number;
  /** Snapshot of the mistake limit when the game started. 0 = unlimited. */
  mistakeLimit: number;
  hintsUsed: number;
  /** Number of user moves. A game with zero moves is never counted as "played". */
  moves: number;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  history?: Move[];
  future?: Move[];
  paused?: boolean;
  /** `updatedAt` value last acknowledged by the server. Client-only sync bookkeeping. */
  syncedAt?: number | null;
}

export type HintLevel = 1 | 2;

/** Per-cell highlight data derived once when a hint opens, so cells only do an array lookup. */
export interface HintView {
  target: number;
  /** Cells that form the reasoning (shown at level 2). */
  cause: boolean[];
  /** Cells that lose a candidate (shown at level 2). */
  eliminate: boolean[];
  /** The row/column/box the hint points into. */
  unit: boolean[];
}

export interface ActiveHint {
  hint: Hint;
  /** 1 = pointing at the cell, 2 = explaining. Revealing applies it and closes the hint. */
  level: HintLevel;
  view: HintView;
}

export type CellFxKind = "pop" | "shake" | "ripple" | "hint";

export interface CellFx {
  kind: CellFxKind;
  /** Changes on every trigger so the animation can replay. */
  nonce: number;
  /** Stagger in ms for ripple effects. */
  delay?: number;
}

export interface CompletionSummary {
  record: GameRecord;
  elapsedMs: number;
  isPersonalBest: boolean;
  isFirstAtDifficulty: boolean;
  previousBestMs: number | null;
  daily: { date: string; streak: number; bestStreak: number; streakIncreased: boolean } | null;
  newAchievements: string[];
}
