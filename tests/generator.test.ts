import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_ORDER,
  TECHNIQUE_BY_ID,
  calculateDifficulty,
  findConflictCells,
  generatePuzzle,
  hasUniqueSolution,
  isValidSolution,
  solvePuzzle,
  validatePuzzle,
  type Difficulty,
  type Puzzle,
  type TechniqueId,
} from "@/lib/sudoku";
import { solveLogically } from "@/lib/sudoku/logic";
import { techniquesUpTo } from "@/lib/sudoku/techniques";

const SEEDS = ["alpha", "bravo", "charlie"];

const cache = new Map<string, Puzzle>();
function puzzleFor(difficulty: Difficulty, seed: string): Puzzle {
  const key = `${difficulty}:${seed}`;
  let p = cache.get(key);
  if (!p) {
    p = generatePuzzle({ difficulty, seed });
    cache.set(key, p);
  }
  return p;
}

const SIGNATURE: Record<Difficulty, TechniqueId[]> = {
  beginner: ["nakedSingle"],
  easy: ["hiddenSingleBox"],
  medium: ["hiddenSingleLine"],
  hard: ["lockedCandidates", "nakedPair", "hiddenPair", "nakedTriple", "hiddenTriple"],
  expert: ["xWing", "xyWing", "xyzWing", "swordfish"],
};

describe.each(DIFFICULTY_ORDER)("generatePuzzle (%s)", (difficulty) => {
  it("produces valid, unique, solvable puzzles with no duplicate givens", () => {
    for (const seed of SEEDS) {
      const p = puzzleFor(difficulty, seed);
      expect(p.givens).toHaveLength(81);
      expect(p.solution).toHaveLength(81);
      expect(findConflictCells(p.givens)).toHaveLength(0);
      expect(validatePuzzle(p.givens)).toMatchObject({ valid: true, unique: true, solutions: 1 });
      expect(hasUniqueSolution(p.givens)).toBe(true);
      expect(solvePuzzle(p.givens)).toBe(p.solution);
      expect(isValidSolution(p.givens, p.solution)).toBe(true);
      expect(p.clues).toBe(p.givens.split("").filter((c) => c !== "0").length);
    }
  });

  it("is rated at the requested level by an independent calculation", () => {
    for (const seed of SEEDS) {
      const p = puzzleFor(difficulty, seed);
      const report = calculateDifficulty(p.givens);
      expect(report.level).toBe(difficulty);
      expect(report.solvedLogically).toBe(true);
      expect(report.score).toBe(p.score);
      expect(p.difficulty).toBe(difficulty);
    }
  });

  it("really requires the technique that defines the level and nothing harder", () => {
    for (const seed of SEEDS) {
      const p = puzzleFor(difficulty, seed);
      const used = Object.keys(p.techniques) as TechniqueId[];
      expect(used.some((t) => SIGNATURE[difficulty].includes(t))).toBe(true);
      const ceiling = techniquesUpTo(difficulty);
      expect(used.every((t) => ceiling.includes(t))).toBe(true);
      // Solvable with the allowed techniques only...
      expect(solveLogically(Uint8Array.from(p.givens, Number), { techniques: ceiling }).solved).toBe(true);
      // ...but not with the next-lower level's techniques (except beginner, which has none below).
      if (difficulty !== "beginner") {
        const lower = DIFFICULTY_ORDER[DIFFICULTY_ORDER.indexOf(difficulty) - 1]!;
        expect(solveLogically(Uint8Array.from(p.givens, Number), { techniques: techniquesUpTo(lower) }).solved).toBe(false);
      }
    }
  });

  it("is reproducible from its seed and different across seeds", () => {
    const again = generatePuzzle({ difficulty, seed: SEEDS[0]! });
    const first = puzzleFor(difficulty, SEEDS[0]!);
    expect(again.givens).toBe(first.givens);
    expect(again.solution).toBe(first.solution);
    expect(again.id).toBe(first.id);
    expect(puzzleFor(difficulty, SEEDS[1]!).givens).not.toBe(first.givens);
  });
});

describe("difficulty progression", () => {
  it("scores rise with the level, and clues are not the only signal", () => {
    const avg = (difficulty: Difficulty) => SEEDS.reduce((sum, seed) => sum + puzzleFor(difficulty, seed).score, 0) / SEEDS.length;
    const scores = DIFFICULTY_ORDER.map(avg);
    for (let i = 1; i < scores.length; i++) expect(scores[i]!).toBeGreaterThan(scores[i - 1]!);

    // Ratings are driven by technique, so the hardest technique's rating rises with the level.
    const hardestRating = (difficulty: Difficulty) =>
      Math.min(...SEEDS.map((s) => TECHNIQUE_BY_ID[puzzleFor(difficulty, s).hardestTechnique!].rating));
    const ratings = DIFFICULTY_ORDER.map(hardestRating);
    for (let i = 1; i < ratings.length; i++) expect(ratings[i]!).toBeGreaterThan(ratings[i - 1]!);
  });

  it("beginner puzzles need only naked singles", () => {
    for (const seed of SEEDS) {
      const p = puzzleFor("beginner", seed);
      expect(Object.keys(p.techniques)).toEqual(["nakedSingle"]);
      expect(p.clues).toBeGreaterThanOrEqual(38);
    }
  });
});

describe("seed handling", () => {
  it("generates something when no seed is given", () => {
    const p = generatePuzzle({ difficulty: "easy" });
    expect(p.seed.length).toBeGreaterThan(0);
    expect(validatePuzzle(p.givens).valid).toBe(true);
  });

  it("gives the same puzzle to everyone for a daily seed", () => {
    const a = generatePuzzle({ difficulty: "medium", seed: "daily-v1:2026-10-04" });
    const b = generatePuzzle({ difficulty: "medium", seed: "daily-v1:2026-10-04" });
    expect(a).toEqual(b);
  });
});
