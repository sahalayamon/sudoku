import { describe, expect, it } from "vitest";
import { describeStep } from "@/lib/sudoku/explain";
import { applyStep, createLogicState, findNextStep, solveLogically } from "@/lib/sudoku/logic";
import { CLASSIC, CLASSIC_SOLUTION, blankState, range, removeDigit, setCands } from "./helpers";

const elimCells = (step: { eliminations: { cell: number }[] }) => step.eliminations.map((e) => e.cell).sort((a, b) => a - b);

describe("logic state", () => {
  it("rejects contradictory givens and dead cells", () => {
    expect(createLogicState(new Uint8Array(81).fill(1))).toBeNull();
    const dead = new Uint8Array(81);
    dead.set([1, 2, 3, 4, 5, 6, 7, 8], 0); // row needs a 9 ...
    dead[17] = 9; // ... but column 9 already has one
    expect(createLogicState(dead)).toBeNull();
  });

  it("derives candidates from the board", () => {
    const state = createLogicState(Uint8Array.from(CLASSIC, Number))!;
    expect(state.cands[0]).toBe(0);
    expect(state.cands[2]).toBe(0b000001011);
  });
});

describe("singles", () => {
  it("finds a naked single", () => {
    const state = blankState();
    setCands(state, 10, [6]);
    const step = findNextStep(state, ["nakedSingle"])!;
    expect(step.technique).toBe("nakedSingle");
    expect(step.placements).toEqual([{ cell: 10, digit: 6 }]);
  });

  it("finds a hidden single in a box before a row", () => {
    const state = blankState();
    removeDigit(state, range(1, 8), 4); // only cell 0 keeps a 4 in row 0 and box 0 (cells 9-11, 18-20 do too)
    removeDigit(state, [9, 10, 11, 18, 19, 20], 4);
    const step = findNextStep(state, ["hiddenSingleBox", "hiddenSingleLine"])!;
    expect(step.technique).toBe("hiddenSingleBox");
    expect(step.placements).toEqual([{ cell: 0, digit: 4 }]);
  });

  it("finds a hidden single in a line when no box has one", () => {
    const state = blankState();
    // Row 0: only cell 0 keeps a 4. Box 0 still has 4 in other rows, so it is not a box single.
    removeDigit(state, range(1, 8), 4);
    const step = findNextStep(state, ["hiddenSingleBox", "hiddenSingleLine"])!;
    expect(step.technique).toBe("hiddenSingleLine");
    expect(step.unit).toEqual({ kind: "row", index: 0 });
  });

  it("solves the classic with singles alone", () => {
    const result = solveLogically(Uint8Array.from(CLASSIC, Number), {
      techniques: ["nakedSingle", "hiddenSingleBox", "hiddenSingleLine"],
    });
    expect(result.solved).toBe(true);
    expect(Array.from(result.state!.values).join("")).toBe(CLASSIC_SOLUTION);
  });
});

describe("locked candidates", () => {
  it("pointing: a digit confined to a row inside a box leaves the rest of the row", () => {
    const state = blankState();
    removeDigit(state, [9, 10, 11, 18, 19, 20], 7);
    const step = findNextStep(state, ["lockedCandidates"])!;
    expect(step.variant).toBe("pointing");
    expect(step.digits).toEqual([7]);
    expect(step.unit).toEqual({ kind: "box", index: 0 });
    expect(elimCells(step)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("claiming: a digit confined to one box inside a row leaves the rest of the box", () => {
    const state = blankState();
    removeDigit(state, range(3, 8), 7);
    const step = findNextStep(state, ["lockedCandidates"])!;
    expect(step.variant).toBe("claiming");
    expect(step.unit).toEqual({ kind: "row", index: 0 });
    expect(elimCells(step)).toEqual([9, 10, 11, 18, 19, 20]);
  });
});

describe("subsets", () => {
  it("naked pair", () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 1, [1, 2]);
    const step = findNextStep(state, ["nakedPair"])!;
    expect(step.technique).toBe("nakedPair");
    expect(step.cells).toEqual([0, 1]);
    expect(step.digits).toEqual([1, 2]);
    expect(step.unit).toEqual({ kind: "row", index: 0 });
    expect(step.eliminations.every((e) => e.digit === 1 || e.digit === 2)).toBe(true);
    expect(elimCells(step)).toEqual(expect.arrayContaining([2, 3, 4, 5, 6, 7, 8]));
  });

  it("naked triple", () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 1, [2, 3]);
    setCands(state, 2, [1, 3]);
    const step = findNextStep(state, ["nakedTriple"])!;
    expect(step.technique).toBe("nakedTriple");
    expect(step.cells).toEqual([0, 1, 2]);
    expect(step.digits).toEqual([1, 2, 3]);
  });

  it("hidden pair strips the extra candidates", () => {
    const state = blankState();
    removeDigit(state, range(2, 8), 1);
    removeDigit(state, range(2, 8), 2);
    const step = findNextStep(state, ["hiddenPair"])!;
    expect(step.technique).toBe("hiddenPair");
    expect(step.cells).toEqual([0, 1]);
    expect(step.digits).toEqual([1, 2]);
    expect(step.eliminations.every((e) => e.digit !== 1 && e.digit !== 2)).toBe(true);
    expect(step.eliminations).toHaveLength(14);
  });

  it("hidden triple", () => {
    const state = blankState();
    for (const d of [1, 2, 3]) removeDigit(state, range(3, 8), d);
    const step = findNextStep(state, ["hiddenTriple"])!;
    expect(step.technique).toBe("hiddenTriple");
    expect(step.cells).toEqual([0, 1, 2]);
    expect(step.digits).toEqual([1, 2, 3]);
  });

  it("does not report a pair that eliminates nothing", () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 1, [1, 2]);
    for (const c of range(2, 8)) setCands(state, c, [3, 4, 5, 6, 7, 8, 9]);
    for (const c of [9, 10, 11, 18, 19, 20]) setCands(state, c, [3, 4, 5, 6, 7, 8, 9]);
    expect(findNextStep(state, ["nakedPair"])).toBeNull();
  });
});

describe("fish & wings", () => {
  it("X-Wing eliminates along the cover lines", () => {
    const state = blankState();
    const digit = 5;
    const keep = new Set([1, 6, 45 + 1, 45 + 6, 27 + 1, 63 + 6]); // rows 0 and 5 on columns 1 and 6, plus two outsiders
    for (let c = 0; c < 81; c++) if (!keep.has(c)) removeDigit(state, [c], digit);
    const step = findNextStep(state, ["xWing"])!;
    expect(step.technique).toBe("xWing");
    expect(step.variant).toBe("rows");
    expect(step.digits).toEqual([digit]);
    expect(step.units).toEqual([
      { kind: "row", index: 0 },
      { kind: "row", index: 5 },
    ]);
    expect(step.coverUnits).toEqual([
      { kind: "col", index: 1 },
      { kind: "col", index: 6 },
    ]);
    expect(elimCells(step)).toEqual([27 + 1, 63 + 6]);
  });

  it("Swordfish needs three rows spread over exactly three columns", () => {
    const state = blankState();
    const digit = 4;
    const pattern: [number, number[]][] = [
      [0, [0, 3]],
      [3, [3, 6]],
      [6, [0, 6]],
    ];
    const keep = new Set<number>();
    for (const [r, cols] of pattern) for (const c of cols) keep.add(r * 9 + c);
    keep.add(1 * 9 + 0); // outsider in column 0
    keep.add(2 * 9 + 6); // outsider in column 6
    for (let c = 0; c < 81; c++) if (!keep.has(c)) removeDigit(state, [c], digit);
    expect(findNextStep(state, ["xWing"])).toBeNull();
    const step = findNextStep(state, ["swordfish"])!;
    expect(step.technique).toBe("swordfish");
    expect(elimCells(step)).toEqual([9, 24]);
  });

  it("XY-Wing removes the shared digit from cells that see both pincers", () => {
    const state = blankState();
    setCands(state, 0, [1, 2]); // pivot
    setCands(state, 1, [1, 3]); // pincer in the row
    setCands(state, 9, [2, 3]); // pincer in the column
    const step = findNextStep(state, ["xyWing"])!;
    expect(step.technique).toBe("xyWing");
    expect(step.cells).toEqual([0, 1, 9]);
    expect(step.eliminations.every((e) => e.digit === 3)).toBe(true);
    expect(elimCells(step)).toEqual([2, 10, 11, 18, 19, 20]);
  });

  it("XYZ-Wing removes the shared digit from cells that see all three", () => {
    const state = blankState();
    setCands(state, 0, [1, 2, 3]);
    setCands(state, 1, [1, 3]);
    setCands(state, 9, [2, 3]);
    const step = findNextStep(state, ["xyzWing"])!;
    expect(step.technique).toBe("xyzWing");
    expect(step.eliminations.every((e) => e.digit === 3)).toBe(true);
    expect(elimCells(step)).toEqual([2, 10, 11, 18, 19, 20]);
  });
});

describe("applyStep / explanations", () => {
  it("placements propagate to peers", () => {
    const state = blankState();
    setCands(state, 0, [7]);
    const step = findNextStep(state, ["nakedSingle"])!;
    applyStep(state, step);
    expect(state.values[0]).toBe(7);
    expect(state.cands[1]! & 0b001000000).toBe(0);
    expect(state.cands[80]! & 0b001000000).not.toBe(0);
  });

  it("describes a naked single the way a person would", () => {
    const grid = Uint8Array.from(CLASSIC, Number);
    const state = createLogicState(grid)!;
    // R5C5 is 5 and is a naked single early on in this puzzle.
    const step = findNextStep(state, ["nakedSingle"])!;
    const { title, text } = describeStep(step, state);
    expect(title.length).toBeGreaterThan(0);
    expect(text).toMatch(/can fit here|empty cell left/);
    expect(text).toMatch(/\b[1-9]\b/);
  });

  it("every technique has readable text", () => {
    const state = blankState();
    setCands(state, 0, [1, 2]);
    setCands(state, 1, [1, 2]);
    const step = findNextStep(state, ["nakedPair"])!;
    expect(describeStep(step, state).text).toContain("R1C1 and R1C2");
  });
});
