import { puzzleIdFor, solvePuzzle } from "@/lib/sudoku";
import { sanitizeGameRecord } from "@/lib/storage/sanitize";
import type { GameRecord } from "@/types/game";

/**
 * Translation between local game records and the server's tables.
 * Kept free of network code so it can be tested on its own.
 */

/** Payload for the `sync_game` RPC. The server re-validates everything it receives. */
export interface SyncGamePayload {
  id: string;
  givens: string;
  difficulty: string;
  score: number;
  seed: string;
  mode: string;
  daily_date: string | null;
  status: string;
  board: string;
  notes: number[];
  paused: boolean;
  elapsed_ms: number;
  mistakes: number;
  mistake_limit: number;
  hints_used: number;
  moves: number;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  device_id: string;
}

export function recordToPayload(record: GameRecord, deviceId: string): SyncGamePayload {
  return {
    id: record.id,
    givens: record.givens,
    difficulty: record.difficulty,
    score: Math.round(record.score),
    seed: record.seed,
    mode: record.mode,
    daily_date: record.dailyDate,
    status: record.status,
    board: record.values,
    notes: record.notes,
    paused: record.paused === true,
    elapsed_ms: Math.max(0, Math.round(record.elapsedMs)),
    mistakes: record.mistakes,
    mistake_limit: record.mistakeLimit,
    hints_used: record.hintsUsed,
    moves: record.moves,
    started_at: new Date(record.startedAt).toISOString(),
    completed_at: record.completedAt ? new Date(record.completedAt).toISOString() : null,
    updated_at: new Date(record.updatedAt).toISOString(),
    device_id: deviceId,
  };
}

type Maybe<T> = T | T[] | null | undefined;

const one = <T>(value: Maybe<T>): T | null => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

/** Shape returned by the pull query (games joined with puzzles and game_sessions). */
export interface RemoteGameRow {
  id: string;
  mode: string;
  daily_date: string | null;
  status: string;
  difficulty: string;
  elapsed_ms: number;
  mistakes: number;
  mistake_limit: number;
  hints_used: number;
  moves: number;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  received_at: string;
  puzzles: Maybe<{ givens: string; score: number; seed: string | null }>;
  game_sessions: Maybe<{ board: string; notes: unknown; paused: boolean }>;
}

/** Convert a server row to a local record. Returns null for rows that cannot be trusted. */
export function rowToRecord(row: RemoteGameRow): GameRecord | null {
  const puzzle = one(row.puzzles);
  // Server rows are untrusted input: one malformed row must never abort a whole sync pass.
  if (!puzzle || typeof puzzle.givens !== "string" || !/^[0-9]{81}$/.test(puzzle.givens)) return null;
  const solution = solvePuzzle(puzzle.givens);
  if (!solution) return null;
  const session = one(row.game_sessions);
  const inProgress = row.status === "in_progress";

  return sanitizeGameRecord({
    id: row.id,
    puzzleId: puzzleIdFor(puzzle.givens),
    givens: puzzle.givens,
    solution,
    difficulty: row.difficulty,
    score: puzzle.score ?? 0,
    seed: puzzle.seed ?? "",
    mode: row.mode,
    dailyDate: row.daily_date,
    status: row.status,
    values: inProgress ? (session?.board ?? puzzle.givens) : solution,
    notes: session?.notes,
    elapsedMs: row.elapsed_ms,
    mistakes: row.mistakes,
    mistakeLimit: row.mistake_limit,
    hintsUsed: row.hints_used,
    moves: row.moves,
    startedAt: Date.parse(row.started_at),
    updatedAt: Date.parse(row.updated_at),
    completedAt: row.completed_at ? Date.parse(row.completed_at) : null,
    paused: inProgress ? session?.paused === true : undefined,
    syncedAt: Date.parse(row.updated_at),
  });
}
