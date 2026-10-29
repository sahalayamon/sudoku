/**
 * Shared types for the Sudoku engine. The engine has no dependency on React,
 * the DOM or any store: it can run in a worker, on the server, or in tests.
 */

export type Difficulty = "beginner" | "easy" | "medium" | "hard" | "expert";

export const DIFFICULTIES: readonly Difficulty[] = ["beginner", "easy", "medium", "hard", "expert"];

/** A grid as an 81-character string ("0" or "." = empty) or any numeric array-like. */
export type GridInput = string | ArrayLike<number>;

export type UnitKind = "row" | "col" | "box";

/** Zero-based reference to a row, column or box. */
export interface UnitRef {
  kind: UnitKind;
  index: number;
}

export type TechniqueId =
  | "nakedSingle"
  | "hiddenSingleBox"
  | "hiddenSingleLine"
  | "lockedCandidates"
  | "nakedPair"
  | "hiddenPair"
  | "nakedTriple"
  | "hiddenTriple"
  | "xWing"
  | "xyWing"
  | "xyzWing"
  | "swordfish";

export interface CellDigit {
  cell: number;
  digit: number;
}

/** One logical deduction. Either places digits, removes candidates, or both. */
export interface SolveStep {
  technique: TechniqueId;
  placements: CellDigit[];
  eliminations: CellDigit[];
  /** The cells that form the pattern (the "reason" for the deduction). */
  cells: number[];
  /** The digits that form the pattern. */
  digits: number[];
  /** The primary unit the pattern lives in, when there is one. */
  unit?: UnitRef;
  /** Extra units: fish base lines, or the line a locked set points along. */
  units?: UnitRef[];
  /** Fish cover lines (where eliminations happen). */
  coverUnits?: UnitRef[];
  variant?: "pointing" | "claiming" | "rows" | "cols";
}

export type TechniqueCounts = Partial<Record<TechniqueId, number>>;

export interface DifficultyReport {
  /** False when the grid has duplicate givens or no solution. */
  valid: boolean;
  unique: boolean;
  level: Difficulty;
  /** 0-100 style composite. Higher is harder. Useful for ordering within a level. */
  score: number;
  /** Rating of the hardest technique that was needed (1.0 - 7.0), 0 when invalid. */
  rating: number;
  hardestTechnique: TechniqueId | null;
  techniques: TechniqueCounts;
  steps: number;
  clues: number;
  /** True if the full technique set was enough to finish the puzzle. */
  solvedLogically: boolean;
  /** True if the puzzle needs trial and error beyond the implemented techniques. */
  requiresSearch: boolean;
}

export interface Puzzle {
  /** Stable identifier derived from the givens. */
  id: string;
  /** 81 chars, 0 = empty. */
  givens: string;
  /** 81 chars, fully solved. */
  solution: string;
  difficulty: Difficulty;
  score: number;
  rating: number;
  clues: number;
  seed: string;
  techniques: TechniqueCounts;
  hardestTechnique: TechniqueId | null;
  generatorVersion: number;
}

export interface GenerateOptions {
  difficulty: Difficulty;
  /** Same seed + difficulty always yields the same puzzle. */
  seed?: string;
}

export type ValidationErrorCode = "length" | "characters" | "duplicate" | "no_solution" | "multiple_solutions";

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  cells?: number[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  clues: number;
  /** 0, 1, or 2 (meaning "two or more"). */
  solutions: 0 | 1 | 2;
  unique: boolean;
  solvable: boolean;
}

export interface MoveCheck {
  /** The move is structurally possible (digit 1-9, cell exists). */
  valid: boolean;
  /** The digit matches the solution. */
  correct: boolean;
  /** Other cells that already hold this digit in the same row, column or box. */
  conflicts: number[];
}

export type HintKind = "error" | "placement";

export interface HintStep {
  technique: TechniqueId | "error" | "solution";
  title: string;
  text: string;
  /** Pattern cells for this step. */
  cause: number[];
  /** Cells that lose a candidate in this step. */
  eliminate: number[];
}

export interface Hint {
  kind: HintKind;
  technique: TechniqueId | "error" | "solution";
  /** The cell the hint is about. */
  cell: number;
  /** The digit that belongs in the cell. */
  digit: number;
  title: string;
  /** Level 1: gentle nudge toward the cell. */
  nudge: string;
  /** Level 2: the reasoning, one entry per logical step (last step places the digit). */
  steps: HintStep[];
  /** All cells involved in the reasoning (union of causes). */
  cause: number[];
  /** Unit to emphasise while the hint is shown. */
  unit?: UnitRef;
}
