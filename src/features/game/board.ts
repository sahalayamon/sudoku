import { CELL_UNITS, PEERS, UNITS } from "@/lib/sudoku/constants";
import { BIT, generateCandidates } from "@/lib/sudoku";
import type { Move } from "@/types/game";

/**
 * Pure board mechanics: building moves and applying/reverting them.
 * No stores, no timers, no side effects - which keeps them trivial to test.
 */

export const NOTE_MASK_ALL = 0x1ff;
export const HISTORY_LIMIT = 300;

export function parseDigits(grid: string): number[] {
  return Array.from(grid, (ch) => ch.charCodeAt(0) - 48);
}

export function givenMaskOf(givens: string): boolean[] {
  return Array.from(givens, (ch) => ch !== "0");
}

/** Replace one cell's value (clearing its notes) and optionally strip that digit from related notes. */
export function placeMove(
  values: readonly number[],
  notes: readonly number[],
  cell: number,
  digit: number,
  removePeerNotes: boolean,
): Move {
  const move: Move = [{ i: cell, v0: values[cell]!, n0: notes[cell]!, v1: digit, n1: 0 }];
  if (removePeerNotes) {
    const bit = BIT[digit]!;
    for (const p of PEERS[cell]!) {
      if (!values[p] && notes[p]! & bit) {
        move.push({ i: p, v0: values[p]!, n0: notes[p]!, v1: values[p]!, n1: notes[p]! & ~bit });
      }
    }
  }
  return move;
}

export function toggleNoteMove(values: readonly number[], notes: readonly number[], cell: number, digit: number): Move {
  if (values[cell]) return [];
  const n1 = notes[cell]! ^ BIT[digit]!;
  return [{ i: cell, v0: 0, n0: notes[cell]!, v1: 0, n1 }];
}

export function eraseMove(values: readonly number[], notes: readonly number[], cell: number): Move {
  if (!values[cell] && !notes[cell]) return [];
  return [{ i: cell, v0: values[cell]!, n0: notes[cell]!, v1: 0, n1: 0 }];
}

/** Fill every empty cell with all digits that are still legal there. */
export function fillNotesMove(values: readonly number[], notes: readonly number[]): Move {
  const candidates = generateCandidates(values);
  const move: Move = [];
  for (let i = 0; i < 81; i++) {
    if (values[i]) continue;
    if (candidates[i] !== notes[i]) move.push({ i, v0: 0, n0: notes[i]!, v1: 0, n1: candidates[i]! });
  }
  return move;
}

export function clearNotesMove(values: readonly number[], notes: readonly number[]): Move {
  const move: Move = [];
  for (let i = 0; i < 81; i++) if (notes[i]) move.push({ i, v0: values[i]!, n0: notes[i]!, v1: values[i]!, n1: 0 });
  return move;
}

export interface Board {
  values: number[];
  notes: number[];
}

/** Apply a move forwards (`do`) or backwards (`undo`). Returns new arrays. */
export function applyMove(board: Board, move: Move, direction: "do" | "undo"): Board {
  const values = board.values.slice();
  const notes = board.notes.slice();
  for (const p of move) {
    values[p.i] = direction === "do" ? p.v1 : p.v0;
    notes[p.i] = direction === "do" ? p.n1 : p.n0;
  }
  return { values, notes };
}

export function countDigit(values: readonly number[], digit: number): number {
  let n = 0;
  for (let i = 0; i < 81; i++) if (values[i] === digit) n++;
  return n;
}

export function countFilled(values: readonly number[]): number {
  let n = 0;
  for (let i = 0; i < 81; i++) if (values[i]) n++;
  return n;
}

export function isSolved(values: readonly number[], solution: readonly number[]): boolean {
  for (let i = 0; i < 81; i++) if (values[i] !== solution[i]) return false;
  return true;
}

/** Digits that already appear in the row, column or box of `cell` (as a bitmask). */
export function usedInContext(values: readonly number[], cell: number): number {
  let mask = 0;
  for (const p of PEERS[cell]!) if (values[p]) mask |= BIT[values[p]!]!;
  return mask;
}

/** Cells to celebrate after a correct entry: finished units and a finished digit. */
export function completionCells(
  values: readonly number[],
  solution: readonly number[],
  cell: number,
  digit: number,
): { cell: number; delay: number }[] {
  const out = new Map<number, number>();
  for (const u of CELL_UNITS[cell]!) {
    const cells = UNITS[u]!;
    if (cells.every((c) => values[c] === solution[c])) {
      const origin = cells.indexOf(cell);
      cells.forEach((c, k) => out.set(c, Math.abs(k - origin) * 38));
    }
  }
  const digitCells: number[] = [];
  for (let i = 0; i < 81; i++) if (values[i] === digit && solution[i] === digit) digitCells.push(i);
  if (digitCells.length === 9) digitCells.forEach((c, k) => out.set(c, k * 32));
  return [...out].map(([c, delay]) => ({ cell: c, delay }));
}
