import type { Difficulty, TechniqueId } from "./types";

export interface TechniqueInfo {
  id: TechniqueId;
  name: string;
  /** Subjective solving effort. Used for scoring and to classify puzzles. */
  rating: number;
  /** The easiest difficulty level that requires this technique. */
  tier: Difficulty;
}

/** Ordered easiest to hardest. The solver always applies the first technique that fires. */
export const TECHNIQUES: readonly TechniqueInfo[] = [
  { id: "nakedSingle", name: "Naked single", rating: 1.0, tier: "beginner" },
  { id: "hiddenSingleBox", name: "Hidden single", rating: 1.5, tier: "easy" },
  { id: "hiddenSingleLine", name: "Hidden single", rating: 2.0, tier: "medium" },
  { id: "lockedCandidates", name: "Locked candidates", rating: 3.0, tier: "hard" },
  { id: "nakedPair", name: "Naked pair", rating: 3.4, tier: "hard" },
  { id: "hiddenPair", name: "Hidden pair", rating: 3.8, tier: "hard" },
  { id: "nakedTriple", name: "Naked triple", rating: 4.2, tier: "hard" },
  { id: "hiddenTriple", name: "Hidden triple", rating: 4.6, tier: "hard" },
  { id: "xWing", name: "X-Wing", rating: 5.5, tier: "expert" },
  { id: "xyWing", name: "XY-Wing", rating: 6.0, tier: "expert" },
  { id: "xyzWing", name: "XYZ-Wing", rating: 6.3, tier: "expert" },
  { id: "swordfish", name: "Swordfish", rating: 6.8, tier: "expert" },
];

export const TECHNIQUE_BY_ID: Readonly<Record<TechniqueId, TechniqueInfo>> = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t])) as Record<
  TechniqueId,
  TechniqueInfo
>;

export const ALL_TECHNIQUE_IDS: readonly TechniqueId[] = TECHNIQUES.map((t) => t.id);

export function techniquesUpTo(tier: Difficulty): TechniqueId[] {
  const order: Difficulty[] = ["beginner", "easy", "medium", "hard", "expert"];
  const max = order.indexOf(tier);
  return TECHNIQUES.filter((t) => order.indexOf(t.tier) <= max).map((t) => t.id);
}

export const DIFFICULTY_ORDER: readonly Difficulty[] = ["beginner", "easy", "medium", "hard", "expert"];

export function difficultyIndex(level: Difficulty): number {
  return DIFFICULTY_ORDER.indexOf(level);
}
