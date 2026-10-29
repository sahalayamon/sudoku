import {
  ALL_DIGITS_MASK,
  ARE_PEERS,
  BIT,
  BOX_OF,
  BOX_UNIT_OFFSET,
  CELL_COUNT,
  COL_OF,
  COL_UNIT_OFFSET,
  LOWEST_DIGIT,
  PEERS,
  POPCOUNT,
  ROW_OF,
  SIZE,
  UNITS,
  digitsOfMask,
  unitRef,
} from "./constants";
import { TECHNIQUES, TECHNIQUE_BY_ID } from "./techniques";
import type { CellDigit, SolveStep, TechniqueCounts, TechniqueId, UnitRef } from "./types";

/**
 * Human-style solving state: placed values plus a candidate bitmask per cell.
 * Candidates only ever shrink. Placed cells have an empty candidate mask.
 */
export interface LogicState {
  values: Uint8Array;
  cands: Uint16Array;
}

/** Build a logic state, or null when the givens contradict each other. */
export function createLogicState(values: ArrayLike<number>): LogicState | null {
  const grid = new Uint8Array(CELL_COUNT);
  const rows = new Uint16Array(SIZE);
  const cols = new Uint16Array(SIZE);
  const boxes = new Uint16Array(SIZE);
  for (let i = 0; i < CELL_COUNT; i++) {
    const d = values[i] ?? 0;
    grid[i] = d;
    if (!d) continue;
    const bit = BIT[d]!;
    if ((rows[ROW_OF[i]!]! | cols[COL_OF[i]!]! | boxes[BOX_OF[i]!]!) & bit) return null;
    rows[ROW_OF[i]!]! |= bit;
    cols[COL_OF[i]!]! |= bit;
    boxes[BOX_OF[i]!]! |= bit;
  }
  const cands = new Uint16Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i]) continue;
    const mask = ALL_DIGITS_MASK & ~(rows[ROW_OF[i]!]! | cols[COL_OF[i]!]! | boxes[BOX_OF[i]!]!);
    if (mask === 0) return null;
    cands[i] = mask;
  }
  return { values: grid, cands };
}

export function cloneLogicState(state: LogicState): LogicState {
  return { values: Uint8Array.from(state.values), cands: Uint16Array.from(state.cands) };
}

function placeDigit(state: LogicState, cell: number, digit: number): void {
  state.values[cell] = digit;
  state.cands[cell] = 0;
  const keep = ~BIT[digit]!;
  for (const p of PEERS[cell]!) state.cands[p]! &= keep;
}

export function applyStep(state: LogicState, step: SolveStep): void {
  for (const e of step.eliminations) state.cands[e.cell]! &= ~BIT[e.digit]!;
  for (const p of step.placements) placeDigit(state, p.cell, p.digit);
}

export function isSolved(state: LogicState): boolean {
  for (let i = 0; i < CELL_COUNT; i++) if (!state.values[i]) return false;
  return true;
}

function hasDeadCell(state: LogicState): boolean {
  for (let i = 0; i < CELL_COUNT; i++) if (!state.values[i] && !state.cands[i]) return true;
  return false;
}

type Finder = (state: LogicState) => SolveStep | null;

/* -------------------------------------------------------------------------- */
/* Singles                                                                    */
/* -------------------------------------------------------------------------- */

const findNakedSingle: Finder = (s) => {
  for (let i = 0; i < CELL_COUNT; i++) {
    if (s.values[i]) continue;
    const c = s.cands[i]!;
    if (POPCOUNT[c] === 1) {
      const digit = LOWEST_DIGIT[c]!;
      return {
        technique: "nakedSingle",
        placements: [{ cell: i, digit }],
        eliminations: [],
        cells: [i],
        digits: [digit],
      };
    }
  }
  return null;
};

function hiddenSingleIn(s: LogicState, from: number, to: number, technique: TechniqueId): SolveStep | null {
  for (let u = from; u < to; u++) {
    const cells = UNITS[u]!;
    let once = 0;
    let twice = 0;
    for (let k = 0; k < SIZE; k++) {
      const m = s.cands[cells[k]!]!;
      twice |= once & m;
      once |= m;
    }
    const hidden = once & ~twice;
    if (!hidden) continue;
    const digit = LOWEST_DIGIT[hidden]!;
    const bit = BIT[digit]!;
    for (let k = 0; k < SIZE; k++) {
      const cell = cells[k]!;
      if (s.cands[cell]! & bit) {
        return {
          technique,
          placements: [{ cell, digit }],
          eliminations: [],
          cells: [cell],
          digits: [digit],
          unit: unitRef(u),
        };
      }
    }
  }
  return null;
}

const findHiddenSingleBox: Finder = (s) => hiddenSingleIn(s, BOX_UNIT_OFFSET, BOX_UNIT_OFFSET + SIZE, "hiddenSingleBox");
const findHiddenSingleLine: Finder = (s) => hiddenSingleIn(s, 0, BOX_UNIT_OFFSET, "hiddenSingleLine");

/* -------------------------------------------------------------------------- */
/* Locked candidates (pointing / claiming)                                    */
/* -------------------------------------------------------------------------- */

const ROW_BAND_MASKS = [0b000000111, 0b000111000, 0b111000000];
const COL_BAND_MASKS = [0b001001001, 0b010010010, 0b100100100];

const findLockedCandidates: Finder = (s) => {
  // Pointing: a digit confined to one row/column of a box leaves the rest of that line.
  for (let b = 0; b < SIZE; b++) {
    const cells = UNITS[BOX_UNIT_OFFSET + b]!;
    const boxRow = Math.floor(b / 3);
    const boxCol = b % 3;
    for (let d = 1; d <= SIZE; d++) {
      const bit = BIT[d]!;
      let pos = 0;
      for (let k = 0; k < SIZE; k++) if (s.cands[cells[k]!]! & bit) pos |= 1 << k;
      const n = POPCOUNT[pos]!;
      if (n < 2 || n > 3) continue;

      for (let r = 0; r < 3; r++) {
        if ((pos & ~ROW_BAND_MASKS[r]!) !== 0) continue;
        const row = boxRow * 3 + r;
        const elims: CellDigit[] = [];
        for (const cell of UNITS[row]!) {
          if (BOX_OF[cell] === b) continue;
          if (s.cands[cell]! & bit) elims.push({ cell, digit: d });
        }
        if (elims.length) {
          return {
            technique: "lockedCandidates",
            variant: "pointing",
            placements: [],
            eliminations: elims,
            cells: cells.filter((_, k) => pos & (1 << k)),
            digits: [d],
            unit: unitRef(BOX_UNIT_OFFSET + b),
            units: [unitRef(row)],
          };
        }
      }
      for (let c = 0; c < 3; c++) {
        if ((pos & ~COL_BAND_MASKS[c]!) !== 0) continue;
        const col = boxCol * 3 + c;
        const elims: CellDigit[] = [];
        for (const cell of UNITS[COL_UNIT_OFFSET + col]!) {
          if (BOX_OF[cell] === b) continue;
          if (s.cands[cell]! & bit) elims.push({ cell, digit: d });
        }
        if (elims.length) {
          return {
            technique: "lockedCandidates",
            variant: "pointing",
            placements: [],
            eliminations: elims,
            cells: cells.filter((_, k) => pos & (1 << k)),
            digits: [d],
            unit: unitRef(BOX_UNIT_OFFSET + b),
            units: [unitRef(COL_UNIT_OFFSET + col)],
          };
        }
      }
    }
  }

  // Claiming: a digit confined to one box within a row/column leaves the rest of that box.
  for (let u = 0; u < BOX_UNIT_OFFSET; u++) {
    const cells = UNITS[u]!;
    const isRow = u < COL_UNIT_OFFSET;
    for (let d = 1; d <= SIZE; d++) {
      const bit = BIT[d]!;
      let pos = 0;
      for (let k = 0; k < SIZE; k++) if (s.cands[cells[k]!]! & bit) pos |= 1 << k;
      const n = POPCOUNT[pos]!;
      if (n < 2 || n > 3) continue;
      for (let band = 0; band < 3; band++) {
        if ((pos & ~ROW_BAND_MASKS[band]!) !== 0) continue;
        const box = isRow ? Math.floor(u / 3) * 3 + band : band * 3 + Math.floor((u - COL_UNIT_OFFSET) / 3);
        const inLine = new Set(cells);
        const elims: CellDigit[] = [];
        for (const cell of UNITS[BOX_UNIT_OFFSET + box]!) {
          if (inLine.has(cell)) continue;
          if (s.cands[cell]! & bit) elims.push({ cell, digit: d });
        }
        if (elims.length) {
          return {
            technique: "lockedCandidates",
            variant: "claiming",
            placements: [],
            eliminations: elims,
            cells: cells.filter((_, k) => pos & (1 << k)),
            digits: [d],
            unit: unitRef(u),
            units: [unitRef(BOX_UNIT_OFFSET + box)],
          };
        }
      }
    }
  }
  return null;
};

/* -------------------------------------------------------------------------- */
/* Naked & hidden subsets                                                     */
/* -------------------------------------------------------------------------- */

function combinations<T>(items: readonly T[], size: number, visit: (combo: T[]) => boolean): boolean {
  const combo: T[] = [];
  const walk = (start: number): boolean => {
    if (combo.length === size) return visit(combo);
    for (let i = start; i <= items.length - (size - combo.length); i++) {
      combo.push(items[i]!);
      if (walk(i + 1)) return true;
      combo.pop();
    }
    return false;
  };
  return walk(0);
}

function nakedSubsetFinder(size: 2 | 3, technique: TechniqueId): Finder {
  return (s) => {
    for (let u = 0; u < UNITS.length; u++) {
      const cells = UNITS[u]!;
      const eligible: number[] = [];
      for (const c of cells) {
        const n = POPCOUNT[s.cands[c]!]!;
        if (n >= 2 && n <= size) eligible.push(c);
      }
      if (eligible.length < size) continue;
      let found: SolveStep | null = null;
      combinations(eligible, size, (combo) => {
        let union = 0;
        for (const c of combo) union |= s.cands[c]!;
        if (POPCOUNT[union] !== size) return false;
        const elims: CellDigit[] = [];
        for (const c of cells) {
          if (combo.includes(c)) continue;
          const overlap = s.cands[c]! & union;
          if (!overlap) continue;
          for (const d of digitsOfMask(overlap)) elims.push({ cell: c, digit: d });
        }
        if (!elims.length) return false;
        found = {
          technique,
          placements: [],
          eliminations: elims,
          cells: [...combo],
          digits: digitsOfMask(union),
          unit: unitRef(u),
        };
        return true;
      });
      if (found) return found;
    }
    return null;
  };
}

function hiddenSubsetFinder(size: 2 | 3, technique: TechniqueId): Finder {
  return (s) => {
    for (let u = 0; u < UNITS.length; u++) {
      const cells = UNITS[u]!;
      const positions: number[] = new Array(SIZE + 1).fill(0);
      const eligible: number[] = [];
      for (let d = 1; d <= SIZE; d++) {
        const bit = BIT[d]!;
        let pos = 0;
        for (let k = 0; k < SIZE; k++) if (s.cands[cells[k]!]! & bit) pos |= 1 << k;
        positions[d] = pos;
        const n = POPCOUNT[pos]!;
        if (n >= 2 && n <= size) eligible.push(d);
      }
      if (eligible.length < size) continue;
      let found: SolveStep | null = null;
      combinations(eligible, size, (combo) => {
        let union = 0;
        let digitMask = 0;
        for (const d of combo) {
          union |= positions[d]!;
          digitMask |= BIT[d]!;
        }
        if (POPCOUNT[union] !== size) return false;
        const elims: CellDigit[] = [];
        const patternCells: number[] = [];
        for (let k = 0; k < SIZE; k++) {
          if (!(union & (1 << k))) continue;
          const cell = cells[k]!;
          patternCells.push(cell);
          const extra = s.cands[cell]! & ~digitMask;
          for (const d of digitsOfMask(extra)) elims.push({ cell, digit: d });
        }
        if (!elims.length) return false;
        found = {
          technique,
          placements: [],
          eliminations: elims,
          cells: patternCells,
          digits: [...combo],
          unit: unitRef(u),
        };
        return true;
      });
      if (found) return found;
    }
    return null;
  };
}

/* -------------------------------------------------------------------------- */
/* Fish (X-Wing, Swordfish)                                                   */
/* -------------------------------------------------------------------------- */

function fishFinder(size: 2 | 3, technique: TechniqueId): Finder {
  return (s) => {
    for (let d = 1; d <= SIZE; d++) {
      const bit = BIT[d]!;
      for (const byRows of [true, false]) {
        const lines: { index: number; mask: number }[] = [];
        for (let i = 0; i < SIZE; i++) {
          let mask = 0;
          for (let j = 0; j < SIZE; j++) {
            const cell = byRows ? i * SIZE + j : j * SIZE + i;
            if (s.cands[cell]! & bit) mask |= 1 << j;
          }
          const n = POPCOUNT[mask]!;
          if (n >= 2 && n <= size) lines.push({ index: i, mask });
        }
        if (lines.length < size) continue;
        let found: SolveStep | null = null;
        combinations(lines, size, (combo) => {
          let cover = 0;
          for (const l of combo) cover |= l.mask;
          if (POPCOUNT[cover] !== size) return false;
          const baseSet = new Set(combo.map((l) => l.index));
          const elims: CellDigit[] = [];
          for (let j = 0; j < SIZE; j++) {
            if (!(cover & (1 << j))) continue;
            for (let i = 0; i < SIZE; i++) {
              if (baseSet.has(i)) continue;
              const cell = byRows ? i * SIZE + j : j * SIZE + i;
              if (s.cands[cell]! & bit) elims.push({ cell, digit: d });
            }
          }
          if (!elims.length) return false;
          const patternCells: number[] = [];
          for (const l of combo) {
            for (let j = 0; j < SIZE; j++) {
              if (!(l.mask & (1 << j))) continue;
              patternCells.push(byRows ? l.index * SIZE + j : j * SIZE + l.index);
            }
          }
          const baseKind = byRows ? "row" : "col";
          const coverKind = byRows ? "col" : "row";
          const baseUnits: UnitRef[] = combo.map((l) => ({ kind: baseKind, index: l.index }));
          const coverUnits: UnitRef[] = [];
          for (let j = 0; j < SIZE; j++) if (cover & (1 << j)) coverUnits.push({ kind: coverKind, index: j });
          found = {
            technique,
            variant: byRows ? "rows" : "cols",
            placements: [],
            eliminations: elims,
            cells: patternCells,
            digits: [d],
            units: baseUnits,
            coverUnits,
          };
          return true;
        });
        if (found) return found;
      }
    }
    return null;
  };
}

/* -------------------------------------------------------------------------- */
/* Wings                                                                      */
/* -------------------------------------------------------------------------- */

const findXYWing: Finder = (s) => {
  const bivalue: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) if (!s.values[i] && POPCOUNT[s.cands[i]!] === 2) bivalue.push(i);
  if (bivalue.length < 3) return null;

  for (const pivot of bivalue) {
    const pMask = s.cands[pivot]!;
    const pivotPeers = bivalue.filter((c) => c !== pivot && ARE_PEERS[pivot * CELL_COUNT + c]);
    for (const p1 of pivotPeers) {
      const m1 = s.cands[p1]!;
      const shared = m1 & pMask;
      if (POPCOUNT[shared] !== 1) continue;
      const zMask = m1 & ~pMask; // the third digit
      const otherPivot = pMask & ~shared;
      const wanted = otherPivot | zMask;
      for (const p2 of pivotPeers) {
        if (p2 === p1 || s.cands[p2] !== wanted) continue;
        const elims: CellDigit[] = [];
        const z = LOWEST_DIGIT[zMask]!;
        for (const cell of PEERS[p1]!) {
          if (cell === pivot || cell === p2) continue;
          if (!ARE_PEERS[p2 * CELL_COUNT + cell]) continue;
          if (s.cands[cell]! & zMask) elims.push({ cell, digit: z });
        }
        if (elims.length) {
          return {
            technique: "xyWing",
            placements: [],
            eliminations: elims,
            cells: [pivot, p1, p2],
            digits: digitsOfMask(pMask | zMask),
          };
        }
      }
    }
  }
  return null;
};

const findXYZWing: Finder = (s) => {
  for (let pivot = 0; pivot < CELL_COUNT; pivot++) {
    if (s.values[pivot] || POPCOUNT[s.cands[pivot]!] !== 3) continue;
    const pMask = s.cands[pivot]!;
    const pincers = PEERS[pivot]!.filter((c) => {
      if (s.values[c]) return false;
      const m = s.cands[c]!;
      return POPCOUNT[m] === 2 && (m & ~pMask) === 0;
    });
    for (let a = 0; a < pincers.length; a++) {
      for (let b = a + 1; b < pincers.length; b++) {
        const p1 = pincers[a]!;
        const p2 = pincers[b]!;
        const m1 = s.cands[p1]!;
        const m2 = s.cands[p2]!;
        if (m1 === m2 || (m1 | m2) !== pMask) continue;
        const zMask = m1 & m2;
        if (POPCOUNT[zMask] !== 1) continue;
        const z = LOWEST_DIGIT[zMask]!;
        const elims: CellDigit[] = [];
        for (const cell of PEERS[pivot]!) {
          if (cell === p1 || cell === p2) continue;
          if (!ARE_PEERS[p1 * CELL_COUNT + cell] || !ARE_PEERS[p2 * CELL_COUNT + cell]) continue;
          if (s.cands[cell]! & zMask) elims.push({ cell, digit: z });
        }
        if (elims.length) {
          return {
            technique: "xyzWing",
            placements: [],
            eliminations: elims,
            cells: [pivot, p1, p2],
            digits: digitsOfMask(pMask),
          };
        }
      }
    }
  }
  return null;
};

/* -------------------------------------------------------------------------- */
/* Registry & solving loop                                                    */
/* -------------------------------------------------------------------------- */

const FINDERS: Record<TechniqueId, Finder> = {
  nakedSingle: findNakedSingle,
  hiddenSingleBox: findHiddenSingleBox,
  hiddenSingleLine: findHiddenSingleLine,
  lockedCandidates: findLockedCandidates,
  nakedPair: nakedSubsetFinder(2, "nakedPair"),
  hiddenPair: hiddenSubsetFinder(2, "hiddenPair"),
  nakedTriple: nakedSubsetFinder(3, "nakedTriple"),
  hiddenTriple: hiddenSubsetFinder(3, "hiddenTriple"),
  xWing: fishFinder(2, "xWing"),
  xyWing: findXYWing,
  xyzWing: findXYZWing,
  swordfish: fishFinder(3, "swordfish"),
};

export function orderedTechniques(allowed?: readonly TechniqueId[]): TechniqueId[] {
  if (!allowed) return TECHNIQUES.map((t) => t.id);
  const set = new Set(allowed);
  return TECHNIQUES.filter((t) => set.has(t.id)).map((t) => t.id);
}

/** The simplest available deduction, or null when none of the allowed techniques apply. */
export function findNextStep(state: LogicState, allowed?: readonly TechniqueId[]): SolveStep | null {
  for (const id of orderedTechniques(allowed)) {
    const step = FINDERS[id](state);
    if (step) return step;
  }
  return null;
}

export interface LogicOptions {
  /** Restrict solving to these techniques. Defaults to all of them. */
  techniques?: readonly TechniqueId[];
  /** Keep the step list (needed for explanations, skipped by the generator for speed). */
  recordSteps?: boolean;
}

export interface LogicResult {
  solved: boolean;
  /** True when the givens were contradictory or no allowed technique applied. */
  stuck: boolean;
  steps: SolveStep[];
  stepCount: number;
  counts: TechniqueCounts;
  hardest: TechniqueId | null;
  rating: number;
  state: LogicState | null;
}

/** Solve like a person would, always applying the easiest technique that works. */
export function solveLogically(values: ArrayLike<number>, options: LogicOptions = {}): LogicResult {
  const state = createLogicState(values);
  const result: LogicResult = {
    solved: false,
    stuck: true,
    steps: [],
    stepCount: 0,
    counts: {},
    hardest: null,
    rating: 0,
    state,
  };
  if (!state) return result;

  const order = orderedTechniques(options.techniques);
  const record = options.recordSteps ?? false;

  for (;;) {
    if (isSolved(state)) {
      result.solved = true;
      result.stuck = false;
      return result;
    }
    if (hasDeadCell(state)) return result;
    let step: SolveStep | null = null;
    for (const id of order) {
      step = FINDERS[id](state);
      if (step) break;
    }
    if (!step) return result;
    applyStep(state, step);
    result.stepCount++;
    result.counts[step.technique] = (result.counts[step.technique] ?? 0) + 1;
    const rating = TECHNIQUE_BY_ID[step.technique].rating;
    if (rating > result.rating) {
      result.rating = rating;
      result.hardest = step.technique;
    }
    if (record) result.steps.push(step);
  }
}
