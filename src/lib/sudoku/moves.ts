import { CELL_COUNT, PEERS } from "./constants";
import { parseGrid } from "./grid";
import type { GridInput, MoveCheck } from "./types";

/**
 * Check one entry against the solution and against the current board.
 * `conflicts` lists peers that already hold the same digit (a rule violation),
 * `correct` says whether the digit is the solution's digit for that cell.
 */
export function checkMove(values: GridInput, solution: GridInput, cell: number, digit: number): MoveCheck {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT || !Number.isInteger(digit) || digit < 1 || digit > 9) {
    return { valid: false, correct: false, conflicts: [] };
  }
  const board = parseGrid(values);
  const sol = parseGrid(solution);
  const conflicts: number[] = [];
  for (const p of PEERS[cell]!) if (board[p] === digit) conflicts.push(p);
  return { valid: true, correct: sol[cell] === digit, conflicts };
}
