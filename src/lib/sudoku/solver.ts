import { ALL_DIGITS_MASK, BIT, BOX_OF, CELL_COUNT, COL_OF, LOWEST_DIGIT, POPCOUNT, ROW_OF, SIZE } from "./constants";
import { parseGrid } from "./grid";
import { shuffleInPlace, type Rng } from "./rng";
import type { GridInput } from "./types";

export interface SearchResult {
  /** Number of solutions found, capped at `limit`. */
  count: number;
  /** First solution found, if any. */
  solution: Uint8Array | null;
}

/**
 * Bitmask backtracking search with minimum-remaining-values cell selection.
 * Used for solving, uniqueness checks and for building random solved grids.
 */
export function search(input: Uint8Array, limit: number, rng: Rng | null = null): SearchResult {
  const grid = Uint8Array.from(input);
  const rows = new Uint16Array(SIZE);
  const cols = new Uint16Array(SIZE);
  const boxes = new Uint16Array(SIZE);

  for (let i = 0; i < CELL_COUNT; i++) {
    const d = grid[i]!;
    if (!d) continue;
    const bit = BIT[d]!;
    const r = ROW_OF[i]!;
    const c = COL_OF[i]!;
    const b = BOX_OF[i]!;
    if ((rows[r]! | cols[c]! | boxes[b]!) & bit) return { count: 0, solution: null };
    rows[r]! |= bit;
    cols[c]! |= bit;
    boxes[b]! |= bit;
  }

  let count = 0;
  let solution: Uint8Array | null = null;

  const recurse = (): boolean => {
    // Pick the empty cell with the fewest candidates.
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (grid[i]) continue;
      const mask = ALL_DIGITS_MASK & ~(rows[ROW_OF[i]!]! | cols[COL_OF[i]!]! | boxes[BOX_OF[i]!]!);
      const n = POPCOUNT[mask]!;
      if (n === 0) return false;
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 1) break;
      }
    }

    if (best === -1) {
      count++;
      if (!solution) solution = Uint8Array.from(grid);
      return count >= limit;
    }

    const r = ROW_OF[best]!;
    const c = COL_OF[best]!;
    const b = BOX_OF[best]!;

    let order: number[];
    if (rng) {
      order = [];
      for (let d = 1; d <= SIZE; d++) if (bestMask & BIT[d]!) order.push(d);
      shuffleInPlace(order, rng);
    } else {
      order = [];
      let m = bestMask;
      while (m) {
        const d = LOWEST_DIGIT[m]!;
        order.push(d);
        m &= ~BIT[d]!;
      }
    }

    for (const d of order) {
      const bit = BIT[d]!;
      grid[best] = d;
      rows[r]! |= bit;
      cols[c]! |= bit;
      boxes[b]! |= bit;
      if (recurse()) return true;
      grid[best] = 0;
      rows[r]! &= ~bit;
      cols[c]! &= ~bit;
      boxes[b]! &= ~bit;
    }
    return false;
  };

  recurse();
  return { count, solution };
}

/** Number of solutions, stopping at `limit` (default 2: "unique or not"). */
export function countSolutions(input: GridInput, limit = 2): number {
  return search(parseGrid(input), limit).count;
}

/** True when the grid has exactly one solution. */
export function hasUniqueSolution(input: GridInput): boolean {
  return countSolutions(input, 2) === 1;
}

/** Returns the first solution as an 81-char string, or null if the grid is unsolvable. */
export function solvePuzzle(input: GridInput): string | null {
  const { solution } = search(parseGrid(input), 1);
  return solution ? Array.from(solution, String).join("") : null;
}

/** A uniformly shuffled, fully solved grid. */
export function randomSolvedGrid(rng: Rng): Uint8Array {
  const { solution } = search(new Uint8Array(CELL_COUNT), 1, rng);
  if (!solution) throw new Error("Failed to build a solved grid");
  return solution;
}
