import { DIFFICULTIES, type Difficulty, type Puzzle } from "@/lib/sudoku";
import { DEFAULT_SETTINGS, type AchievementUnlock, type Meta, type Settings } from "@/types/settings";
import type { GameRecord } from "@/types/game";
import { clearAllKeys, listKeys, readEnvelope, removeRaw, writeEnvelope } from "./safe-storage";
import { sanitizeAchievements, sanitizeGameList, sanitizePuzzle, sanitizeSettings } from "./sanitize";

/**
 * The only module that knows how data is laid out on disk. Everything else goes
 * through these functions, so swapping localStorage for IndexedDB (or a native
 * store under Capacitor) is a change in one file.
 */

const SCHEMA_VERSION = 1;
const MAX_FINISHED_GAMES = 5000;

const KEYS = {
  settings: "settings",
  finished: "finished",
  live: "live",
  achievements: "achievements",
  meta: "meta",
  pool: "pool",
  dailyPrefix: "daily:",
} as const;

function newDeviceId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function defaultMeta(): Meta {
  return {
    onboardingSeen: false,
    lastDifficulty: "easy",
    currentGameId: null,
    deviceId: newDeviceId(),
    lastSyncedAt: null,
    lastPulledAt: null,
  };
}

export function loadSettings(): Settings {
  return sanitizeSettings(readEnvelope<unknown>(KEYS.settings, SCHEMA_VERSION) ?? DEFAULT_SETTINGS);
}
export function saveSettings(settings: Settings): void {
  writeEnvelope(KEYS.settings, SCHEMA_VERSION, settings);
}

export function loadFinished(): GameRecord[] {
  return sanitizeGameList(readEnvelope<unknown>(KEYS.finished, SCHEMA_VERSION));
}
export function saveFinished(games: GameRecord[]): void {
  writeEnvelope(KEYS.finished, SCHEMA_VERSION, games.slice(0, MAX_FINISHED_GAMES));
}

export function loadLive(): GameRecord[] {
  return sanitizeGameList(readEnvelope<unknown>(KEYS.live, SCHEMA_VERSION)).filter((g) => g.status === "in_progress");
}
export function saveLive(games: GameRecord[]): void {
  writeEnvelope(KEYS.live, SCHEMA_VERSION, games);
}

export function loadAchievements(): AchievementUnlock[] {
  return sanitizeAchievements(readEnvelope<unknown>(KEYS.achievements, SCHEMA_VERSION));
}
export function saveAchievements(list: AchievementUnlock[]): void {
  writeEnvelope(KEYS.achievements, SCHEMA_VERSION, list);
}

export function loadMeta(): Meta {
  const raw = readEnvelope<Partial<Meta>>(KEYS.meta, SCHEMA_VERSION);
  const base = defaultMeta();
  if (!raw || typeof raw !== "object") return base;
  return {
    onboardingSeen: raw.onboardingSeen === true,
    lastDifficulty: DIFFICULTIES.includes(raw.lastDifficulty as Difficulty) ? (raw.lastDifficulty as Difficulty) : base.lastDifficulty,
    currentGameId: typeof raw.currentGameId === "string" ? raw.currentGameId : null,
    deviceId: typeof raw.deviceId === "string" && raw.deviceId.length >= 8 ? raw.deviceId : base.deviceId,
    lastSyncedAt: typeof raw.lastSyncedAt === "number" ? raw.lastSyncedAt : null,
    lastPulledAt: typeof raw.lastPulledAt === "string" ? raw.lastPulledAt : null,
  };
}
export function saveMeta(meta: Meta): void {
  writeEnvelope(KEYS.meta, SCHEMA_VERSION, meta);
}

/* Pre-generated puzzles so "New game" is instant even for Expert. */
export type PuzzlePool = Partial<Record<Difficulty, Puzzle[]>>;

export function loadPool(): PuzzlePool {
  const raw = readEnvelope<Record<string, unknown>>(KEYS.pool, SCHEMA_VERSION);
  const pool: PuzzlePool = {};
  if (!raw || typeof raw !== "object") return pool;
  for (const [difficulty, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const puzzles = list.map(sanitizePuzzle).filter((p): p is Puzzle => p !== null && p.difficulty === difficulty);
    if (puzzles.length) pool[difficulty as Difficulty] = puzzles;
  }
  return pool;
}
export function savePool(pool: PuzzlePool): void {
  writeEnvelope(KEYS.pool, SCHEMA_VERSION, pool);
}

/* Daily puzzles are deterministic, but caching them makes the daily instant and available offline. */
export function loadDailyPuzzle(date: string): Puzzle | null {
  return sanitizePuzzle(readEnvelope<unknown>(KEYS.dailyPrefix + date, SCHEMA_VERSION));
}
export function saveDailyPuzzle(date: string, puzzle: Puzzle): void {
  writeEnvelope(KEYS.dailyPrefix + date, SCHEMA_VERSION, puzzle);
  // Keep only recent days.
  const keys = listKeys()
    .filter((k) => k.startsWith(KEYS.dailyPrefix))
    .sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 7))) removeRaw(k);
}

export function clearAllData(): void {
  clearAllKeys();
}

/* Export / import: portable backup of everything that matters. */

export interface ExportBundle {
  app: "sudoku";
  version: 1;
  exportedAt: number;
  settings: Settings;
  finished: GameRecord[];
  live: GameRecord[];
  achievements: AchievementUnlock[];
}

export function buildExportBundle(data: {
  settings: Settings;
  finished: GameRecord[];
  live: GameRecord[];
  achievements: AchievementUnlock[];
}): ExportBundle {
  return { app: "sudoku", version: 1, exportedAt: Date.now(), ...data };
}

export function parseExportBundle(json: string): ExportBundle | null {
  try {
    const raw = JSON.parse(json) as Partial<ExportBundle> | null;
    if (!raw || typeof raw !== "object" || raw.app !== "sudoku" || raw.version !== 1) return null;
    return {
      app: "sudoku",
      version: 1,
      exportedAt: typeof raw.exportedAt === "number" ? raw.exportedAt : Date.now(),
      settings: sanitizeSettings(raw.settings),
      finished: sanitizeGameList(raw.finished),
      live: sanitizeGameList(raw.live).filter((g) => g.status === "in_progress"),
      achievements: sanitizeAchievements(raw.achievements),
    };
  } catch {
    return null;
  }
}
