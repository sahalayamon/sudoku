import { DIFFICULTIES, type Difficulty } from "@/lib/sudoku";
import { addDays, dateKey, dayNumber } from "@/lib/date";
import type { GameRecord } from "@/types/game";

export interface DifficultyStats {
  difficulty: Difficulty;
  /** Started games, including the one in progress. */
  played: number;
  completed: number;
  failed: number;
  abandoned: number;
  inProgress: number;
  /** completed / (completed + failed + abandoned). */
  winRate: number;
  /** Fastest solve without hints. */
  bestTimeMs: number | null;
  avgTimeMs: number | null;
  avgMistakes: number | null;
  totalTimeMs: number;
  /** Solves with zero mistakes. */
  flawless: number;
}

export interface Streaks {
  current: number;
  best: number;
  /** True when today's daily has already been solved. */
  todayDone: boolean;
}

export interface Stats extends Omit<DifficultyStats, "difficulty"> {
  streak: Streaks;
  dailySolved: number;
  solvedToday: number;
  byDifficulty: Record<Difficulty, DifficultyStats>;
  /** Number of solves per local date, for the activity strip. */
  solvesByDate: Record<string, number>;
  /** Dates (YYYY-MM-DD) on which the daily was solved. */
  dailyDates: string[];
}

const isPlayed = (g: GameRecord) => g.status !== "in_progress" || g.moves > 0;

function emptyStats(difficulty: Difficulty): DifficultyStats {
  return {
    difficulty,
    played: 0,
    completed: 0,
    failed: 0,
    abandoned: 0,
    inProgress: 0,
    winRate: 0,
    bestTimeMs: null,
    avgTimeMs: null,
    avgMistakes: null,
    totalTimeMs: 0,
    flawless: 0,
  };
}

function summarize(difficulty: Difficulty, games: readonly GameRecord[]): DifficultyStats {
  const s = emptyStats(difficulty);
  let timeSum = 0;
  let mistakeSum = 0;
  for (const g of games) {
    if (!isPlayed(g)) continue;
    s.played++;
    s.totalTimeMs += g.elapsedMs;
    if (g.status === "completed") {
      s.completed++;
      timeSum += g.elapsedMs;
      mistakeSum += g.mistakes;
      if (g.mistakes === 0) s.flawless++;
      if (g.hintsUsed === 0 && (s.bestTimeMs === null || g.elapsedMs < s.bestTimeMs)) s.bestTimeMs = g.elapsedMs;
    } else if (g.status === "failed") s.failed++;
    else if (g.status === "abandoned") s.abandoned++;
    else s.inProgress++;
  }
  const finished = s.completed + s.failed + s.abandoned;
  s.winRate = finished ? s.completed / finished : 0;
  s.avgTimeMs = s.completed ? timeSum / s.completed : null;
  s.avgMistakes = s.completed ? mistakeSum / s.completed : null;
  return s;
}

/** Consecutive-day streaks from the set of dates on which the daily was solved. */
export function computeStreaks(dates: Iterable<string>, today: string): Streaks {
  const days = [...new Set(dates)]
    .map(dayNumber)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = -Infinity;
  for (const d of days) {
    run = d === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }

  const set = new Set(days);
  const t = dayNumber(today);
  const todayDone = set.has(t);
  let cursor = todayDone ? t : t - 1; // a streak stays alive until the day ends
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor--;
  }
  return { current, best, todayDone };
}

export function computeStats(games: readonly GameRecord[], today: string = dateKey()): Stats {
  const byDifficulty = {} as Record<Difficulty, DifficultyStats>;
  for (const d of DIFFICULTIES)
    byDifficulty[d] = summarize(
      d,
      games.filter((g) => g.difficulty === d),
    );
  const all = summarize("beginner", games);

  const dailyDates: string[] = [];
  const solvesByDate: Record<string, number> = {};
  let dailySolved = 0;
  let solvedToday = 0;
  for (const g of games) {
    if (g.status !== "completed") continue;
    const day = dateKey(new Date(g.completedAt ?? g.updatedAt));
    solvesByDate[day] = (solvesByDate[day] ?? 0) + 1;
    if (day === today) solvedToday++;
    if (g.mode === "daily" && g.dailyDate) {
      dailySolved++;
      dailyDates.push(g.dailyDate);
    }
  }

  const { difficulty: _ignored, ...rest } = all;
  void _ignored;
  return {
    ...rest,
    streak: computeStreaks(dailyDates, today),
    dailySolved,
    solvedToday,
    byDifficulty,
    solvesByDate,
    dailyDates: [...new Set(dailyDates)].sort(),
  };
}

/** Stats scoped to one difficulty, or everything. */
export function scopedStats(stats: Stats, scope: Difficulty | "all"): Omit<DifficultyStats, "difficulty"> {
  if (scope === "all") {
    const { streak: _s, dailySolved: _d, solvedToday: _t, byDifficulty: _b, solvesByDate: _v, dailyDates: _dd, ...rest } = stats;
    void [_s, _d, _t, _b, _v, _dd];
    return rest;
  }
  const { difficulty: _ignored, ...rest } = stats.byDifficulty[scope];
  void _ignored;
  return rest;
}

/** Last `days` calendar days ending today, oldest first. */
export function recentDays(today: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)));
}
