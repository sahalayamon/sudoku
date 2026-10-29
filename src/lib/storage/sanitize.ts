import { isPaletteId } from "@/lib/palettes";
import { DIFFICULTIES, type Difficulty, type Puzzle } from "@/lib/sudoku";
import { DEFAULT_SETTINGS, type AchievementUnlock, type MistakeLimit, type Settings } from "@/types/settings";
import type { CellPatch, GameMode, GameRecord, GameStatus, Move } from "@/types/game";

/**
 * Stored data comes from disk, from other devices and from imported files.
 * Nothing is trusted: every record is checked and malformed ones are dropped
 * instead of crashing the app.
 */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const GRID_RE = /^[0-9]{81}$/;
const SOLUTION_RE = /^[1-9]{81}$/;

const MODES: readonly GameMode[] = ["standard", "daily"];
const STATUSES: readonly GameStatus[] = ["in_progress", "completed", "failed", "abandoned"];
const MAX_HISTORY = 200;

function sanitizePatch(raw: unknown): CellPatch | null {
  if (!isObject(raw)) return null;
  const { i, v0, n0, v1, n1 } = raw;
  if (!isInt(i, 0, 80) || !isInt(v0, 0, 9) || !isInt(v1, 0, 9) || !isInt(n0, 0, 511) || !isInt(n1, 0, 511)) return null;
  return { i, v0, n0, v1, n1 };
}

function sanitizeMoves(raw: unknown): Move[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const moves: Move[] = [];
  for (const move of raw.slice(-MAX_HISTORY)) {
    if (!Array.isArray(move)) return undefined;
    const patches: Move = [];
    for (const patch of move) {
      const p = sanitizePatch(patch);
      if (!p) return undefined;
      patches.push(p);
    }
    moves.push(patches);
  }
  return moves;
}

export function sanitizeGameRecord(raw: unknown): GameRecord | null {
  if (!isObject(raw)) return null;
  const r = raw;
  if (typeof r.id !== "string" || r.id.length === 0 || r.id.length > 64) return null;
  if (typeof r.givens !== "string" || !GRID_RE.test(r.givens)) return null;
  if (typeof r.solution !== "string" || !SOLUTION_RE.test(r.solution)) return null;
  if (typeof r.values !== "string" || !GRID_RE.test(r.values)) return null;
  if (!DIFFICULTIES.includes(r.difficulty as Difficulty)) return null;
  if (!MODES.includes(r.mode as GameMode)) return null;
  if (!STATUSES.includes(r.status as GameStatus)) return null;

  // Givens must be intact and every entered digit must be a real digit; otherwise the record is corrupt.
  for (let i = 0; i < 81; i++) {
    const g = r.givens[i]!;
    if (g !== "0" && (g !== r.solution[i] || r.values[i] !== g)) return null;
  }

  const notes =
    Array.isArray(r.notes) && r.notes.length === 81 && r.notes.every((n) => isInt(n, 0, 511))
      ? (r.notes as number[])
      : new Array<number>(81).fill(0);
  const elapsedMs = isFiniteNumber(r.elapsedMs) && r.elapsedMs >= 0 ? r.elapsedMs : 0;
  const startedAt = isFiniteNumber(r.startedAt) ? r.startedAt : 0;
  const updatedAt = isFiniteNumber(r.updatedAt) ? r.updatedAt : startedAt;

  const record: GameRecord = {
    id: r.id,
    puzzleId: typeof r.puzzleId === "string" ? r.puzzleId : r.id,
    givens: r.givens,
    solution: r.solution,
    difficulty: r.difficulty as Difficulty,
    score: isFiniteNumber(r.score) ? r.score : 0,
    seed: typeof r.seed === "string" ? r.seed : "",
    mode: r.mode as GameMode,
    dailyDate: typeof r.dailyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.dailyDate) ? r.dailyDate : null,
    status: r.status as GameStatus,
    values: r.values,
    notes,
    elapsedMs,
    mistakes: isInt(r.mistakes, 0, 9999) ? r.mistakes : 0,
    mistakeLimit: isInt(r.mistakeLimit, 0, 99) ? r.mistakeLimit : 0,
    hintsUsed: isInt(r.hintsUsed, 0, 9999) ? r.hintsUsed : 0,
    moves: isInt(r.moves, 0, 999999) ? r.moves : 0,
    startedAt,
    updatedAt,
    completedAt: isFiniteNumber(r.completedAt) ? r.completedAt : null,
  };
  if (record.mode === "daily" && !record.dailyDate) record.mode = "standard";
  if (r.paused === true) record.paused = true;
  if (isFiniteNumber(r.syncedAt)) record.syncedAt = r.syncedAt;
  const history = sanitizeMoves(r.history);
  const future = sanitizeMoves(r.future);
  if (history && record.status === "in_progress") record.history = history;
  if (future && record.status === "in_progress") record.future = future;
  return record;
}

export function sanitizeGameList(raw: unknown): GameRecord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: GameRecord[] = [];
  for (const item of raw) {
    const record = sanitizeGameRecord(item);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

export function sanitizeSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!isObject(raw)) return out;
  if (raw.theme === "system" || raw.theme === "light" || raw.theme === "dark") out.theme = raw.theme;
  if (isPaletteId(raw.palette)) out.palette = raw.palette;
  for (const key of [
    "sound",
    "haptics",
    "showTimer",
    "autoNotes",
    "highlightConflicts",
    "highlightSameNumbers",
    "highlightRelated",
    "completionAnimation",
  ] as const) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  if (raw.mistakeLimit === 0 || raw.mistakeLimit === 3 || raw.mistakeLimit === 5 || raw.mistakeLimit === 10) {
    out.mistakeLimit = raw.mistakeLimit as MistakeLimit;
  }
  if (isFiniteNumber(raw.updatedAt)) out.updatedAt = raw.updatedAt;
  return out;
}

export function sanitizeAchievements(raw: unknown): AchievementUnlock[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AchievementUnlock[] = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item.id !== "string" || !isFiniteNumber(item.unlockedAt)) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ id: item.id, unlockedAt: item.unlockedAt });
  }
  return out;
}

export function sanitizePuzzle(raw: unknown): Puzzle | null {
  if (!isObject(raw)) return null;
  if (typeof raw.givens !== "string" || !GRID_RE.test(raw.givens)) return null;
  if (typeof raw.solution !== "string" || !SOLUTION_RE.test(raw.solution)) return null;
  if (!DIFFICULTIES.includes(raw.difficulty as Difficulty)) return null;
  for (let i = 0; i < 81; i++) {
    if (raw.givens[i] !== "0" && raw.givens[i] !== raw.solution[i]) return null;
  }
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    givens: raw.givens,
    solution: raw.solution,
    difficulty: raw.difficulty as Difficulty,
    score: isFiniteNumber(raw.score) ? raw.score : 0,
    rating: isFiniteNumber(raw.rating) ? raw.rating : 0,
    clues: isInt(raw.clues, 0, 81) ? raw.clues : raw.givens.split("").filter((c) => c !== "0").length,
    seed: typeof raw.seed === "string" ? raw.seed : "",
    techniques: isObject(raw.techniques) ? (raw.techniques as Puzzle["techniques"]) : {},
    hardestTechnique: typeof raw.hardestTechnique === "string" ? (raw.hardestTechnique as Puzzle["hardestTechnique"]) : null,
    generatorVersion: isInt(raw.generatorVersion, 0, 9999) ? raw.generatorVersion : 0,
  };
}
