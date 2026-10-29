import type { UnitRef } from "./types";

export const SIZE = 9;
export const BOX_SIZE = 3;
export const CELL_COUNT = 81;
export const ALL_DIGITS_MASK = 0x1ff;
export const GENERATOR_VERSION = 1;

export const ROW_OF: readonly number[] = Array.from({ length: CELL_COUNT }, (_, i) => Math.floor(i / SIZE));
export const COL_OF: readonly number[] = Array.from({ length: CELL_COUNT }, (_, i) => i % SIZE);
export const BOX_OF: readonly number[] = Array.from(
  { length: CELL_COUNT },
  (_, i) => Math.floor(ROW_OF[i]! / BOX_SIZE) * BOX_SIZE + Math.floor(COL_OF[i]! / BOX_SIZE),
);

/** Unit indexes: 0-8 rows, 9-17 columns, 18-26 boxes. */
export const UNIT_COUNT = 27;
export const COL_UNIT_OFFSET = 9;
export const BOX_UNIT_OFFSET = 18;

export const UNITS: readonly (readonly number[])[] = (() => {
  const units: number[][] = [];
  for (let r = 0; r < SIZE; r++) {
    units.push(Array.from({ length: SIZE }, (_, c) => r * SIZE + c));
  }
  for (let c = 0; c < SIZE; c++) {
    units.push(Array.from({ length: SIZE }, (_, r) => r * SIZE + c));
  }
  for (let b = 0; b < SIZE; b++) {
    const br = Math.floor(b / BOX_SIZE) * BOX_SIZE;
    const bc = (b % BOX_SIZE) * BOX_SIZE;
    const cells: number[] = [];
    for (let r = 0; r < BOX_SIZE; r++) {
      for (let c = 0; c < BOX_SIZE; c++) cells.push((br + r) * SIZE + bc + c);
    }
    units.push(cells);
  }
  return units;
})();

/** For each cell: [rowUnit, colUnit, boxUnit] indexes into UNITS. */
export const CELL_UNITS: readonly (readonly [number, number, number])[] = Array.from(
  { length: CELL_COUNT },
  (_, i) => [ROW_OF[i]!, COL_UNIT_OFFSET + COL_OF[i]!, BOX_UNIT_OFFSET + BOX_OF[i]!] as const,
);

/** The 20 cells that share a row, column or box with each cell. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: CELL_COUNT }, (_, i) => {
  const set = new Set<number>();
  for (const u of CELL_UNITS[i]!) for (const c of UNITS[u]!) if (c !== i) set.add(c);
  return [...set].sort((a, b) => a - b);
});

/** 81x81 lookup: ARE_PEERS[a * 81 + b] === 1 when the cells share a unit. */
export const ARE_PEERS: Uint8Array = (() => {
  const t = new Uint8Array(CELL_COUNT * CELL_COUNT);
  for (let a = 0; a < CELL_COUNT; a++) for (const b of PEERS[a]!) t[a * CELL_COUNT + b] = 1;
  return t;
})();

export function unitRef(unit: number): UnitRef {
  if (unit < COL_UNIT_OFFSET) return { kind: "row", index: unit };
  if (unit < BOX_UNIT_OFFSET) return { kind: "col", index: unit - COL_UNIT_OFFSET };
  return { kind: "box", index: unit - BOX_UNIT_OFFSET };
}

export function unitIndex(ref: UnitRef): number {
  if (ref.kind === "row") return ref.index;
  if (ref.kind === "col") return COL_UNIT_OFFSET + ref.index;
  return BOX_UNIT_OFFSET + ref.index;
}

/** Bit for a digit 1-9 (index 0 unused). */
export const BIT: readonly number[] = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256];

export const POPCOUNT: Uint8Array = (() => {
  const t = new Uint8Array(512);
  for (let i = 1; i < 512; i++) t[i] = (t[i >> 1] ?? 0) + (i & 1);
  return t;
})();

/** Digit (1-9) of the lowest set bit, 0 for an empty mask. */
export const LOWEST_DIGIT: Uint8Array = (() => {
  const t = new Uint8Array(512);
  for (let i = 1; i < 512; i++) {
    let d = 1;
    while (!(i & (1 << (d - 1)))) d++;
    t[i] = d;
  }
  return t;
})();

export function digitsOfMask(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= SIZE; d++) if (mask & BIT[d]!) out.push(d);
  return out;
}

export function maskOfDigits(digits: readonly number[]): number {
  let m = 0;
  for (const d of digits) m |= BIT[d]!;
  return m;
}

export function cellIndex(row: number, col: number): number {
  return row * SIZE + col;
}
