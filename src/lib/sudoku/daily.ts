import { GENERATOR_VERSION } from "./constants";
import type { Difficulty } from "./types";

/**
 * The Daily schedule lives with the engine so the browser and the server-side job that
 * pre-registers each day's puzzle can never disagree about which puzzle a date maps to.
 */

/** Difficulty by weekday (0 = Sunday): gentle early in the week, sharper toward the weekend. */
const WEEKDAY_DIFFICULTY: readonly Difficulty[] = [
  "medium", // Sun
  "easy", // Mon
  "easy", // Tue
  "medium", // Wed
  "medium", // Thu
  "hard", // Fri
  "expert", // Sat
];

/** 0 = Sunday ... 6 = Saturday for a YYYY-MM-DD date key (timezone independent). */
export function weekdayOfDateKey(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return 0;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

export function dailyDifficulty(date: string): Difficulty {
  return WEEKDAY_DIFFICULTY[weekdayOfDateKey(date)]!;
}

/**
 * The seed depends only on the date and the generator version, so every device (and the
 * server) derives the identical puzzle for a given day with no coordination.
 */
export function dailySeed(date: string): string {
  return `daily-v${GENERATOR_VERSION}:${date}`;
}
