import { DEFAULT_PALETTE, type PaletteId } from "@/lib/palettes";
import type { Difficulty } from "@/lib/sudoku";

export type ThemePreference = "system" | "light" | "dark";

/** 0 turns the limit off. */
export type MistakeLimit = 0 | 3 | 5 | 10;

export interface Settings {
  theme: ThemePreference;
  /** Accent colour family. */
  palette: PaletteId;
  sound: boolean;
  haptics: boolean;
  showTimer: boolean;
  mistakeLimit: MistakeLimit;
  /** Remove a candidate note from related cells when a number is placed. */
  autoNotes: boolean;
  highlightConflicts: boolean;
  highlightSameNumbers: boolean;
  highlightRelated: boolean;
  completionAnimation: boolean;
  /** Last change time, used to resolve conflicts when syncing. */
  updatedAt: number;
}

export const MISTAKE_LIMIT_OPTIONS: readonly MistakeLimit[] = [3, 5, 10, 0];

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  palette: DEFAULT_PALETTE,
  sound: false,
  haptics: true,
  showTimer: true,
  mistakeLimit: 3,
  autoNotes: true,
  highlightConflicts: true,
  highlightSameNumbers: true,
  highlightRelated: true,
  completionAnimation: true,
  updatedAt: 0,
};

export interface AchievementUnlock {
  id: string;
  unlockedAt: number;
}

/** Small bits of UI memory that are not gameplay data. */
export interface Meta {
  onboardingSeen: boolean;
  /** Difficulty last chosen on the home screen. */
  lastDifficulty: Difficulty;
  /** Game currently shown on the play screen (restored after reload). */
  currentGameId: string | null;
  /** Stable per-install id used to tell devices apart when syncing. */
  deviceId: string;
  lastSyncedAt: number | null;
  /** ISO timestamp of the newest remote change already merged. */
  lastPulledAt: string | null;
}
