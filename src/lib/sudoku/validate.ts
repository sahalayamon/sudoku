import { CELL_COUNT } from "./constants";
import { GridFormatError, countClues, findConflictCells, parseGrid } from "./grid";
import { search } from "./solver";
import type { GridInput, ValidationError, ValidationResult } from "./types";

/**
 * Deterministic structural + semantic validation of a puzzle:
 * right length, only digits, no duplicates among the givens, and exactly one solution.
 */
export function validatePuzzle(input: GridInput): ValidationResult {
  const errors: ValidationError[] = [];
  let grid: Uint8Array;
  try {
    grid = parseGrid(input);
  } catch (error) {
    if (error instanceof GridFormatError) {
      errors.push({ code: error.code, message: error.message });
      return { valid: false, errors, clues: 0, solutions: 0, unique: false, solvable: false };
    }
    throw error;
  }

  const clues = countClues(grid);
  const conflicts = findConflictCells(grid);
  if (conflicts.length) {
    errors.push({
      code: "duplicate",
      message: "A number appears twice in the same row, column or box.",
      cells: conflicts,
    });
    return { valid: false, errors, clues, solutions: 0, unique: false, solvable: false };
  }

  const { count } = search(grid, 2);
  const solutions = (count >= 2 ? 2 : count) as 0 | 1 | 2;
  if (solutions === 0) {
    errors.push({ code: "no_solution", message: "This puzzle has no solution." });
  } else if (solutions === 2) {
    errors.push({ code: "multiple_solutions", message: "This puzzle has more than one solution." });
  }

  return {
    valid: errors.length === 0,
    errors,
    clues,
    solutions,
    unique: solutions === 1,
    solvable: solutions >= 1,
  };
}

/** True when `solution` is a complete, valid grid that agrees with every given. */
export function isValidSolution(givens: GridInput, solution: GridInput): boolean {
  let g: Uint8Array;
  let s: Uint8Array;
  try {
    g = parseGrid(givens);
    s = parseGrid(solution);
  } catch {
    return false;
  }
  for (let i = 0; i < CELL_COUNT; i++) {
    if (!s[i]) return false;
    if (g[i] && g[i] !== s[i]) return false;
  }
  return findConflictCells(s).length === 0;
}
