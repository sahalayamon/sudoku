import { CELL_UNITS, COL_OF, PEERS, ROW_OF, SIZE, UNITS, unitIndex, unitRef } from "./constants";
import type { LogicState } from "./logic";
import { TECHNIQUE_BY_ID } from "./techniques";
import type { SolveStep, UnitRef } from "./types";

export function cellName(cell: number): string {
  return `R${ROW_OF[cell]! + 1}C${COL_OF[cell]! + 1}`;
}

export function unitName(ref: UnitRef): string {
  const label = ref.kind === "col" ? "column" : ref.kind;
  return `${label} ${ref.index + 1}`;
}

/** [1,2,4] -> "1, 2 and 4" */
export function listJoin(items: readonly (string | number)[], word = "and"): string {
  const list = items.map(String);
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} ${word} ${list[list.length - 1]}`;
}

function kindLabel(kind: UnitRef["kind"]): string {
  return kind === "col" ? "column" : kind;
}

function linesText(units: readonly UnitRef[]): string {
  const first = units[0];
  if (!first) return "";
  const label = units.length === 1 ? kindLabel(first.kind) : `${kindLabel(first.kind)}s`;
  return `${label} ${listJoin(units.map((u) => u.index + 1))}`;
}

function digitsPresentAmongPeers(state: LogicState, cell: number): Set<number> {
  const seen = new Set<number>();
  for (const p of PEERS[cell]!) {
    const v = state.values[p]!;
    if (v) seen.add(v);
  }
  return seen;
}

function emptyCountIn(state: LogicState, unit: number): number {
  let n = 0;
  for (const c of UNITS[unit]!) if (!state.values[c]) n++;
  return n;
}

export interface StepText {
  title: string;
  text: string;
}

/**
 * Plain-language description of one deduction. `state` must be the state the
 * step was found in (before it was applied).
 */
export function describeStep(step: SolveStep, state: LogicState): StepText {
  const title = TECHNIQUE_BY_ID[step.technique].name;
  const digit = step.digits[0] ?? 0;
  const cells = step.cells.map(cellName);
  const unit = step.unit ? unitName(step.unit) : "";

  switch (step.technique) {
    case "nakedSingle": {
      const cell = step.cells[0]!;
      const placed = step.placements[0]!.digit;
      for (const u of CELL_UNITS[cell]!) {
        if (emptyCountIn(state, u) === 1) {
          return {
            title: "Last empty cell",
            text: `${capitalize(unitName(unitRef(u)))} has one empty cell left, and ${placed} is the only number it is missing.`,
          };
        }
      }
      const seen = digitsPresentAmongPeers(state, cell);
      const others: number[] = [];
      for (let d = 1; d <= SIZE; d++) if (d !== placed) others.push(d);
      const seenOthers = others.filter((d) => seen.has(d));
      const ruledOut = others.filter((d) => !seen.has(d));
      if (ruledOut.length === 0) {
        return {
          title,
          text: `Only ${placed} can fit here because ${listJoin(others)} already appear in this row, column, or box.`,
        };
      }
      return {
        title,
        text: `Only ${placed} can fit here: ${listJoin(seenOthers)} already appear in this row, column, or box, and ${listJoin(ruledOut)} ${ruledOut.length > 1 ? "were" : "was"} ruled out by the steps above.`,
      };
    }

    case "hiddenSingleBox":
    case "hiddenSingleLine": {
      const kind = step.unit ? kindLabel(step.unit.kind) : "unit";
      return {
        title,
        text: `In ${unit}, ${digit} has only one place left, and it is this cell. Every other cell in the ${kind} is filled or already sees a ${digit}.`,
      };
    }

    case "lockedCandidates": {
      const other = step.units?.[0] ? unitName(step.units[0]) : "";
      return {
        title,
        text: `In ${unit}, every remaining ${digit} sits in ${other}. So the ${digit} for ${unit} must be in ${other}, and the rest of ${other} cannot be ${digit}.`,
      };
    }

    case "nakedPair":
    case "nakedTriple": {
      const noun = step.cells.length === 2 ? "two" : "three";
      return {
        title,
        text: `${listJoin(cells)} can only hold ${listJoin(step.digits, "or")}. Those ${noun} cells use up ${listJoin(step.digits)}, so none of them can appear elsewhere in ${unit}.`,
      };
    }

    case "hiddenPair":
    case "hiddenTriple":
      return {
        title,
        text: `In ${unit}, ${listJoin(step.digits)} can only go in ${listJoin(cells)}. Those cells must hold exactly those digits, so every other candidate in them can be removed.`,
      };

    case "xWing":
    case "swordfish": {
      const base = linesText(step.units ?? []);
      const cover = linesText(step.coverUnits ?? []);
      const baseKind = step.units?.[0] ? kindLabel(step.units[0].kind) : "line";
      return {
        title,
        text: `In ${base}, ${digit} can only go in ${cover}. Each of those ${baseKind}s needs a ${digit}, so they use up ${cover} between them. No other cell in ${cover} can be ${digit}.`,
      };
    }

    case "xyWing": {
      const [pivot, p1, p2] = step.cells as [number, number, number];
      const z = step.eliminations[0]?.digit ?? 0;
      return {
        title,
        text: `${cellName(pivot)} is the pivot, with exactly two options. ${cellName(p1)} and ${cellName(p2)} each share one of them and could both be ${z}. Whichever way the pivot goes, one of those two becomes ${z}, so ${z} cannot appear in any cell that sees both.`,
      };
    }

    case "xyzWing": {
      const [pivot, p1, p2] = step.cells as [number, number, number];
      const z = step.eliminations[0]?.digit ?? 0;
      return {
        title,
        text: `${cellName(pivot)}, ${cellName(p1)} and ${cellName(p2)} between them must place a ${z}, whichever way the pivot resolves. So ${z} cannot appear in any cell that sees all three.`,
      };
    }
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Cells of a unit reference. */
export function unitCells(ref: UnitRef): readonly number[] {
  return UNITS[unitIndex(ref)]!;
}
