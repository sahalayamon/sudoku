import { DIFFICULTIES, difficultyIndex, type Difficulty } from "@/lib/sudoku";
import type { GameRecord } from "@/types/game";
import type { Stats } from "@/features/statistics/compute";

export type AchievementGlyph = "puzzle" | "layers" | "flame" | "gem" | "target" | "timer" | "check" | "compass" | "calendar";

export interface AchievementContext {
  stats: Stats;
  /** Completed games only. */
  solved: readonly GameRecord[];
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  glyph: AchievementGlyph;
  target: number;
  /** Current progress toward `target`. Anything >= target means unlocked. */
  progress: (ctx: AchievementContext) => number;
}

const atLeast = (level: Difficulty, g: GameRecord) => difficultyIndex(g.difficulty) >= difficultyIndex(level);

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: "first_solve",
    title: "First Solve",
    description: "Complete your first puzzle.",
    glyph: "puzzle",
    target: 1,
    progress: ({ stats }) => stats.completed,
  },
  {
    id: "ten_games",
    title: "10 Games",
    description: "Complete ten puzzles.",
    glyph: "layers",
    target: 10,
    progress: ({ stats }) => stats.completed,
  },
  {
    id: "fifty_games",
    title: "50 Games",
    description: "Complete fifty puzzles.",
    glyph: "layers",
    target: 50,
    progress: ({ stats }) => stats.completed,
  },
  {
    id: "hundred_games",
    title: "100 Games",
    description: "Complete one hundred puzzles.",
    glyph: "layers",
    target: 100,
    progress: ({ stats }) => stats.completed,
  },
  {
    id: "streak_7",
    title: "7 Day Streak",
    description: "Solve the Daily seven days in a row.",
    glyph: "flame",
    target: 7,
    progress: ({ stats }) => stats.streak.best,
  },
  {
    id: "streak_30",
    title: "30 Day Streak",
    description: "Solve the Daily thirty days in a row.",
    glyph: "flame",
    target: 30,
    progress: ({ stats }) => stats.streak.best,
  },
  {
    id: "expert_solver",
    title: "Expert Solver",
    description: "Solve an Expert puzzle.",
    glyph: "gem",
    target: 1,
    progress: ({ stats }) => stats.byDifficulty.expert.completed,
  },
  {
    id: "perfect_game",
    title: "Perfect Game",
    description: "Solve a Medium or harder puzzle with no mistakes and no hints.",
    glyph: "target",
    target: 1,
    progress: ({ solved }) => (solved.some((g) => atLeast("medium", g) && g.mistakes === 0 && g.hintsUsed === 0) ? 1 : 0),
  },
  {
    id: "under_five",
    title: "Under 5 Minutes",
    description: "Solve a Medium or harder puzzle in under five minutes, without hints.",
    glyph: "timer",
    target: 1,
    progress: ({ solved }) => (solved.some((g) => atLeast("medium", g) && g.hintsUsed === 0 && g.elapsedMs < 5 * 60_000) ? 1 : 0),
  },
  {
    id: "no_mistakes",
    title: "No Mistakes",
    description: "Solve ten puzzles without a single mistake.",
    glyph: "check",
    target: 10,
    progress: ({ stats }) => stats.flawless,
  },
  {
    id: "full_range",
    title: "Full Range",
    description: "Solve a puzzle at every difficulty.",
    glyph: "compass",
    target: DIFFICULTIES.length,
    progress: ({ stats }) => DIFFICULTIES.filter((d) => stats.byDifficulty[d].completed > 0).length,
  },
  {
    id: "daily_ten",
    title: "Daily Regular",
    description: "Solve ten Daily puzzles.",
    glyph: "calendar",
    target: 10,
    progress: ({ stats }) => stats.dailySolved,
  },
];

export const ACHIEVEMENT_BY_ID: Readonly<Record<string, AchievementDef>> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export interface AchievementProgress {
  def: AchievementDef;
  current: number;
  earned: boolean;
}

export function evaluateAchievements(stats: Stats, games: readonly GameRecord[]): AchievementProgress[] {
  const ctx: AchievementContext = { stats, solved: games.filter((g) => g.status === "completed") };
  return ACHIEVEMENTS.map((def) => {
    const current = Math.min(def.target, def.progress(ctx));
    return { def, current, earned: current >= def.target };
  });
}
