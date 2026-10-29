import { countClues, findConflictCells, parseGrid } from "./grid";
import { solveLogically } from "./logic";
import { search } from "./solver";
import { TECHNIQUE_BY_ID } from "./techniques";
import type { Difficulty, DifficultyReport, GridInput, TechniqueCounts } from "./types";

function scoreOf(counts: TechniqueCounts, rating: number, clues: number, requiresSearch: boolean): number {
  // Hardest technique dominates; every extra non-trivial step and every missing clue adds a little.
  let extra = 0;
  for (const [id, n] of Object.entries(counts)) {
    const info = TECHNIQUE_BY_ID[id as keyof typeof TECHNIQUE_BY_ID];
    extra += (info.rating - 1) * (n ?? 0) * 0.35;
  }
  const sparse = Math.max(0, 40 - clues) * 0.6;
  const searchPenalty = requiresSearch ? 30 : 0;
  return Math.round(rating * 10 + extra + sparse + searchPenalty);
}

const INVALID_REPORT = (clues: number): DifficultyReport => ({
  valid: false,
  unique: false,
  level: "beginner",
  score: 0,
  rating: 0,
  hardestTechnique: null,
  techniques: {},
  steps: 0,
  clues,
  solvedLogically: false,
  requiresSearch: false,
});

/**
 * Rate a puzzle by solving it the way a person would. The level is decided by the
 * hardest technique that was actually required, not by how many cells are empty.
 */
export function calculateDifficulty(input: GridInput): DifficultyReport {
  const grid = parseGrid(input);
  const clues = countClues(grid);
  if (findConflictCells(grid).length > 0) return INVALID_REPORT(clues);

  const { count } = search(grid, 2);
  if (count === 0) return INVALID_REPORT(clues);

  const logic = solveLogically(grid);
  const requiresSearch = !logic.solved;
  const hardest = logic.hardest;
  const level: Difficulty = requiresSearch ? "expert" : hardest ? TECHNIQUE_BY_ID[hardest].tier : "beginner"; // already complete

  return {
    valid: true,
    unique: count === 1,
    level,
    score: scoreOf(logic.counts, logic.rating, clues, requiresSearch),
    rating: logic.rating,
    hardestTechnique: hardest,
    techniques: logic.counts,
    steps: logic.stepCount,
    clues,
    solvedLogically: logic.solved,
    requiresSearch,
  };
}
