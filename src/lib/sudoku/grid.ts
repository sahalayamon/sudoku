import { ALL_DIGITS_MASK, BIT, BOX_OF, CELL_COUNT, COL_OF, PEERS, ROW_OF, SIZE } from "./constants";
import type { GridInput } from "./types";

export class GridFormatError extends Error {
  readonly code: "length" | "characters";

  constructor(message: string, code: "length" | "characters") {
    super(message);
    this.name = "GridFormatError";
    this.code = code;
  }
}

/** Parse a string ("0" or "." for empty) or numeric array into a fresh Uint8Array(81). */
export function parseGrid(input: GridInput): Uint8Array {
  if (typeof input === "string") {
    if (input.length !== CELL_COUNT) {
      throw new GridFormatError(`A grid needs ${CELL_COUNT} cells, got ${input.length}.`, "length");
    }
    const grid = new Uint8Array(CELL_COUNT);
    for (let i = 0; i < CELL_COUNT; i++) {
      const ch = input.charCodeAt(i);
      if (ch === 46 /* . */) continue;
      const d = ch - 48;
      if (d < 0 || d > 9) throw new GridFormatError(`Unexpected character at cell ${i}.`, "characters");
      grid[i] = d;
    }
    return grid;
  }
  if (input.length !== CELL_COUNT) {
    throw new GridFormatError(`A grid needs ${CELL_COUNT} cells, got ${input.length}.`, "length");
  }
  const grid = new Uint8Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    const d = input[i]!;
    if (!Number.isInteger(d) || d < 0 || d > 9) {
      throw new GridFormatError(`Unexpected value at cell ${i}.`, "characters");
    }
    grid[i] = d;
  }
  return grid;
}

/** Accept strings or numeric arrays everywhere a grid is read. */
function digitsOf(input: GridInput): ArrayLike<number> {
  return typeof input === "string" ? parseGrid(input) : input;
}

export function gridToString(grid: ArrayLike<number>): string {
  let out = "";
  for (let i = 0; i < CELL_COUNT; i++) out += String(grid[i] ?? 0);
  return out;
}

export function countClues(input: GridInput): number {
  const grid = digitsOf(input);
  let n = 0;
  for (let i = 0; i < CELL_COUNT; i++) if (grid[i]) n++;
  return n;
}

export function isComplete(input: GridInput): boolean {
  const grid = digitsOf(input);
  for (let i = 0; i < CELL_COUNT; i++) if (!grid[i]) return false;
  return true;
}

/** Cells whose digit also appears in one of their peers. */
export function findConflictCells(input: GridInput): number[] {
  const grid = digitsOf(input);
  const out: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const d = grid[i]!;
    if (!d) continue;
    for (const p of PEERS[i]!) {
      if (grid[p] === d) {
        out.push(i);
        break;
      }
    }
  }
  return out;
}

/** Boolean-per-cell version of findConflictCells (fast path for UI state). */
export function conflictMask(input: GridInput): boolean[] {
  const grid = digitsOf(input);
  const mask = new Array<boolean>(CELL_COUNT).fill(false);
  for (let i = 0; i < CELL_COUNT; i++) {
    const d = grid[i]!;
    if (!d) continue;
    for (const p of PEERS[i]!) {
      if (grid[p] === d) {
        mask[i] = true;
        break;
      }
    }
  }
  return mask;
}

/**
 * Bitmask of legal digits for every cell, derived only from the values on the
 * board. Filled cells have mask 0.
 */
export function generateCandidates(input: GridInput): number[] {
  const grid = parseGrid(input);
  const rows = new Uint16Array(SIZE);
  const cols = new Uint16Array(SIZE);
  const boxes = new Uint16Array(SIZE);
  for (let i = 0; i < CELL_COUNT; i++) {
    const d = grid[i]!;
    if (!d) continue;
    const bit = BIT[d]!;
    rows[ROW_OF[i]!]! |= bit;
    cols[COL_OF[i]!]! |= bit;
    boxes[BOX_OF[i]!]! |= bit;
  }
  const out = new Array<number>(CELL_COUNT).fill(0);
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i]) continue;
    out[i] = ALL_DIGITS_MASK & ~(rows[ROW_OF[i]!]! | cols[COL_OF[i]!]! | boxes[BOX_OF[i]!]!);
  }
  return out;
}

/** Candidates of one cell as digit list. */
export function candidatesOfCell(input: GridInput, cell: number): number[] {
  const mask = generateCandidates(input)[cell] ?? 0;
  const out: number[] = [];
  for (let d = 1; d <= SIZE; d++) if (mask & BIT[d]!) out.push(d);
  return out;
}
