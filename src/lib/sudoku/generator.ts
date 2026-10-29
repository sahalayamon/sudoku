import { CELL_COUNT, GENERATOR_VERSION } from "./constants";
import { calculateDifficulty } from "./difficulty";
import { countClues, gridToString } from "./grid";
import { solveLogically } from "./logic";
import { createRng, hashString, randomInt, randomSeed, shuffleInPlace, type Rng } from "./rng";
import { randomSolvedGrid } from "./solver";
import { techniquesUpTo } from "./techniques";
import type { Difficulty, GenerateOptions, Puzzle, TechniqueId } from "./types";
import { validatePuzzle } from "./validate";

/**
 * Generation profile per level.
 *
 * Puzzles are carved from a random solved grid. A cell is only removed when the
 * puzzle can still be solved completely using the techniques `allowed` for the
 * level. Logical solvability implies a unique solution, and it caps the difficulty
 * at the level's ceiling. The finished puzzle is then rated independently and only
 * accepted if it actually *requires* the level's signature technique.
 */
interface Profile {
  allowed: readonly TechniqueId[];
  /** Carving stops once this many clues remain (random in range). */
  clues: readonly [number, number];
}

const PROFILES: Record<Difficulty, Profile> = {
  beginner: { allowed: techniquesUpTo("beginner"), clues: [40, 46] },
  easy: { allowed: techniquesUpTo("easy"), clues: [34, 38] },
  medium: { allowed: techniquesUpTo("medium"), clues: [29, 33] },
  hard: { allowed: techniquesUpTo("hard"), clues: [23, 29] },
  expert: { allowed: techniquesUpTo("expert"), clues: [22, 26] },
};

const MAX_ATTEMPTS = 600;
const CENTER = 40;

export class PuzzleGenerationError extends Error {
  constructor(difficulty: Difficulty, seed: string) {
    super(`Could not generate a ${difficulty} puzzle for seed "${seed}".`);
    this.name = "PuzzleGenerationError";
  }
}

function carve(solution: Uint8Array, profile: Profile, rng: Rng): Uint8Array {
  const puzzle = Uint8Array.from(solution);
  const [minClues, maxClues] = profile.clues;
  const target = minClues + randomInt(rng, maxClues - minClues + 1);

  // Remove cells in 180-degree symmetric pairs, in random order.
  const order = shuffleInPlace(
    Array.from({ length: CENTER + 1 }, (_, i) => i),
    rng,
  );
  let clues = CELL_COUNT;
  for (const i of order) {
    if (clues <= target) break;
    const j = CELL_COUNT - 1 - i;
    const a = puzzle[i]!;
    const b = puzzle[j]!;
    puzzle[i] = 0;
    puzzle[j] = 0;
    if (solveLogically(puzzle, { techniques: profile.allowed }).solved) {
      clues -= i === j ? 1 : 2;
    } else {
      puzzle[i] = a;
      puzzle[j] = b;
    }
  }
  return puzzle;
}

export function puzzleIdFor(givens: string): string {
  return `p${hashString(givens)}`;
}

/**
 * Generate a validated puzzle. Same `seed` + `difficulty` always returns the same puzzle.
 * Throws PuzzleGenerationError only if no acceptable puzzle was found (practically never).
 */
export function generatePuzzle(options: GenerateOptions): Puzzle {
  const { difficulty } = options;
  const seed = options.seed ?? randomSeed();
  const profile = PROFILES[difficulty];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng(`${seed}|${difficulty}|${attempt}`);
    const solved = randomSolvedGrid(rng);
    const grid = carve(solved, profile, rng);

    const report = calculateDifficulty(grid);
    if (!report.valid || !report.unique || !report.solvedLogically || report.level !== difficulty) continue;

    const givens = gridToString(grid);
    const solution = gridToString(solved);

    // Final deterministic validation before the puzzle is ever shown.
    const validation = validatePuzzle(givens);
    if (!validation.valid) continue;

    return {
      id: puzzleIdFor(givens),
      givens,
      solution,
      difficulty,
      score: report.score,
      rating: report.rating,
      clues: countClues(grid),
      seed,
      techniques: report.techniques,
      hardestTechnique: report.hardestTechnique,
      generatorVersion: GENERATOR_VERSION,
    };
  }
  throw new PuzzleGenerationError(difficulty, seed);
}
