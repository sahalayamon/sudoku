import { CELL_COUNT, CELL_UNITS, PEERS, POPCOUNT, UNITS, BIT, BOX_UNIT_OFFSET, digitsOfMask, unitRef } from "./constants";
import { cellName, describeStep, unitName } from "./explain";
import { parseGrid } from "./grid";
import { applyStep, cloneLogicState, createLogicState, findNextStep, type LogicState } from "./logic";
import { TECHNIQUE_BY_ID } from "./techniques";
import type { GridInput, Hint, HintStep, SolveStep, TechniqueId, UnitRef } from "./types";

export interface HintOptions {
  /** Cell the player is looking at. Used when a simple step exists for it. */
  prefer?: number | null;
}

const MAX_CHAIN = 10;

const NUDGE_NOUN: Record<TechniqueId, string> = {
  nakedSingle: "a naked single",
  hiddenSingleBox: "a hidden single",
  hiddenSingleLine: "a hidden single",
  lockedCandidates: "locked candidates",
  nakedPair: "a naked pair",
  hiddenPair: "a hidden pair",
  nakedTriple: "a naked triple",
  hiddenTriple: "a hidden triple",
  xWing: "an X-Wing",
  xyWing: "an XY-Wing",
  xyzWing: "an XYZ-Wing",
  swordfish: "a Swordfish",
};

/** A direct single for one particular cell, if the board offers one. */
function singleForCell(state: LogicState, cell: number): SolveStep | null {
  if (state.values[cell]) return null;
  const mask = state.cands[cell]!;
  if (POPCOUNT[mask] === 1) {
    const digit = digitsOfMask(mask)[0]!;
    return { technique: "nakedSingle", placements: [{ cell, digit }], eliminations: [], cells: [cell], digits: [digit] };
  }
  for (const u of CELL_UNITS[cell]!) {
    for (const digit of digitsOfMask(mask)) {
      let n = 0;
      for (const c of UNITS[u]!) if (state.cands[c]! & BIT[digit]!) n++;
      if (n === 1) {
        return {
          technique: u >= BOX_UNIT_OFFSET ? "hiddenSingleBox" : "hiddenSingleLine",
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

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function errorHint(values: Uint8Array, solution: Uint8Array, wrong: number[], prefer: number | null): Hint {
  const cell = prefer !== null && wrong.includes(prefer) ? prefer : wrong[0]!;
  const digit = values[cell]!;
  const clashes = PEERS[cell]!.filter((p) => values[p] === digit);
  const text = clashes.length
    ? `The ${digit} in ${cellName(cell)} clashes with ${digit} in ${clashes.map(cellName).join(", ")}. Remove it and look again.`
    : `The ${digit} in ${cellName(cell)} is not blocked by a neighbour yet, but it does not lead to a valid solution. It is worth clearing.`;
  const step: HintStep = { technique: "error", title: "Check this number", text, cause: clashes, eliminate: [] };
  return {
    kind: "error",
    technique: "error",
    cell,
    digit: solution[cell]!,
    title: "Check this number",
    nudge: "One of your numbers does not fit. Look at the highlighted cell.",
    steps: [step],
    cause: clashes,
  };
}

function fallbackHint(state: LogicState | null, values: Uint8Array, solution: Uint8Array, prefer: number | null): Hint {
  let cell = prefer !== null && !values[prefer] ? prefer : -1;
  if (cell === -1) {
    let best = 10;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (values[i]) continue;
      const n = state ? POPCOUNT[state.cands[i]!]! : 9;
      if (n < best) {
        best = n;
        cell = i;
      }
    }
  }
  const digit = solution[cell]!;
  return {
    kind: "placement",
    technique: "solution",
    cell,
    digit,
    title: "No simple pattern",
    nudge: "Take a look at the highlighted cell.",
    steps: [
      {
        technique: "solution",
        title: "No simple pattern",
        text: `${cellName(cell)} is ${digit}. No single technique points to it from here, so this one comes straight from the solution.`,
        cause: [],
        eliminate: [],
      },
    ],
    cause: [],
  };
}

/**
 * Produce a hint for the current board. The reasoning is built by solving forward
 * like a person would: any candidate-removal steps needed before a number can be
 * placed are listed first, and the last step names the cell and the digit.
 *
 * Returns null when the board is already complete and correct.
 */
export function getHint(valuesInput: GridInput, solutionInput: GridInput, options: HintOptions = {}): Hint | null {
  const values = parseGrid(valuesInput);
  const solution = parseGrid(solutionInput);
  const prefer = options.prefer ?? null;

  const wrong: number[] = [];
  let empty = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (!values[i]) empty++;
    else if (values[i] !== solution[i]) wrong.push(i);
  }
  if (wrong.length) return errorHint(values, solution, wrong, prefer);
  if (empty === 0) return null;

  const initial = createLogicState(values);
  if (!initial) return fallbackHint(null, values, solution, prefer);

  const state = cloneLogicState(initial);
  const chain: { step: SolveStep; text: HintStep }[] = [];

  const record = (step: SolveStep) => {
    const { title, text } = describeStep(step, state);
    chain.push({
      step,
      text: { technique: step.technique, title, text, cause: step.cells, eliminate: step.eliminations.map((e) => e.cell) },
    });
    applyStep(state, step);
  };

  // Honour the selected cell when it has a plain single available.
  const preferred = prefer !== null ? singleForCell(state, prefer) : null;
  if (preferred) {
    record(preferred);
  } else {
    for (let i = 0; i < MAX_CHAIN; i++) {
      const step = findNextStep(state);
      if (!step) break;
      record(step);
      if (step.placements.length) break;
    }
  }

  const last = chain[chain.length - 1];
  const placement = last?.step.placements[0];
  if (!last || !placement || solution[placement.cell] !== placement.digit) {
    return fallbackHint(initial, values, solution, prefer);
  }

  const hardest = chain.reduce((best, c) =>
    TECHNIQUE_BY_ID[c.step.technique].rating > TECHNIQUE_BY_ID[best.step.technique].rating ? c : best,
  );
  const lastText = last.text;
  const title = lastText.title === "Last empty cell" ? lastText.title : TECHNIQUE_BY_ID[hardest.step.technique].name;
  const cause = uniqueSorted(chain.flatMap((c) => c.step.cells)).filter((c) => c !== placement.cell);
  const unit: UnitRef | undefined = last.step.unit ?? hardest.step.unit;

  return {
    kind: "placement",
    technique: hardest.step.technique,
    cell: placement.cell,
    digit: placement.digit,
    title,
    nudge:
      lastText.title === "Last empty cell"
        ? "Start with the highlighted cell. It is the last empty one in its group."
        : `Start with the highlighted cell. Look for ${NUDGE_NOUN[hardest.step.technique]}${unit ? ` in ${unitName(unit)}` : ""}.`,
    steps: chain.map((c) => c.text),
    cause,
    unit,
  };
}
