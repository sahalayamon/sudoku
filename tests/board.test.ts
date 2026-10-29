import { describe, expect, it } from "vitest";
import {
  applyMove,
  clearNotesMove,
  completionCells,
  countDigit,
  eraseMove,
  fillNotesMove,
  isSolved,
  parseDigits,
  placeMove,
  toggleNoteMove,
  usedInContext,
} from "@/features/game/board";
import { cellFlags, describeCell, FLAG } from "@/features/game/cellView";
import { useGameStore } from "@/stores/game";
import { CLASSIC, CLASSIC_SOLUTION } from "./helpers";

const values = parseDigits(CLASSIC);
const solution = parseDigits(CLASSIC_SOLUTION);
const zeros = new Array<number>(81).fill(0);

describe("board moves", () => {
  it("places a digit, clears the cell's notes and removes the digit from related notes", () => {
    const notes = zeros.slice();
    notes[1] = 0b000001000; // R1C2 notes "4"
    notes[2] = 0b000001011; // R1C3 notes 1,2,4
    const move = placeMove(values, notes, 2, 4, true);
    expect(move[0]).toEqual({ i: 2, v0: 0, n0: 0b000001011, v1: 4, n1: 0 });
    const board = applyMove({ values, notes }, move, "do");
    expect(board.values[2]).toBe(4);
    expect(board.notes[2]).toBe(0);
    // R1C2 is a given here (3), so it is not touched; empty relatives lose the "4".
    const undone = applyMove(board, move, "undo");
    expect(undone.values).toEqual(values);
    expect(undone.notes).toEqual(notes);
  });

  it("does not touch notes of related cells when asked not to", () => {
    const notes = zeros.slice();
    notes[3] = 0b000001000;
    expect(placeMove(values, notes, 2, 4, false)).toHaveLength(1);
  });

  it("toggles a note and refuses on filled cells", () => {
    expect(toggleNoteMove(values, zeros, 2, 5)[0]).toMatchObject({ i: 2, n1: 1 << 4 });
    expect(toggleNoteMove(values, zeros, 0, 5)).toEqual([]);
  });

  it("erases values and notes, and is a no-op on an empty cell", () => {
    expect(eraseMove(values, zeros, 2)).toEqual([]);
    const notes = zeros.slice();
    notes[2] = 3;
    expect(eraseMove(values, notes, 2)[0]).toMatchObject({ n0: 3, n1: 0 });
  });

  it("fills notes with exactly the legal candidates and clears them again", () => {
    const fill = fillNotesMove(values, zeros);
    const filled = applyMove({ values, notes: zeros }, fill, "do");
    expect(filled.notes[2]).toBe(0b000001011);
    expect(filled.notes[0]).toBe(0); // filled cells never get notes
    expect(clearNotesMove(values, filled.notes).length).toBe(fill.length);
    expect(fillNotesMove(values, filled.notes)).toEqual([]);
  });
});

describe("board queries", () => {
  it("counts digits and detects a solved board", () => {
    expect(countDigit(values, 5)).toBe(CLASSIC.split("5").length - 1);
    expect(isSolved(values, solution)).toBe(false);
    expect(isSolved(solution, solution)).toBe(true);
  });

  it("reports digits already used around a cell", () => {
    // R1C3 sees 5,3,7 (row), 8 (column) and 6,9,8 (box).
    for (const d of [3, 5, 6, 7, 8, 9]) expect(usedInContext(values, 2) & (1 << (d - 1))).not.toBe(0);
    for (const d of [1, 2, 4]) expect(usedInContext(values, 2) & (1 << (d - 1))).toBe(0);
  });

  it("celebrates finished units and finished digits only", () => {
    const sparse = zeros.slice();
    sparse[1] = solution[1]!;
    expect(completionCells(sparse, solution, 1, solution[1]!)).toEqual([]);
    // A board that is complete except one cell still celebrates a digit that has all nine homes.
    const almost = solution.slice();
    almost[0] = 0;
    const digitDone = completionCells(almost, solution, 1, solution[1]!).map((c) => c.cell);
    expect(digitDone.filter((c) => solution[c] === solution[1]).length).toBe(9);
    const full = completionCells(solution, solution, 0, solution[0]!);
    const cells = full.map((c) => c.cell);
    expect(cells).toEqual(expect.arrayContaining([0, 1, 8, 9, 72])); // row, column, box and digit cells
    expect(full.find((c) => c.cell === 0)?.delay).toBeDefined();
  });
});

describe("cell view", () => {
  it("describes cells for screen readers", () => {
    expect(describeCell(0, 5, 0, true, 0)).toBe("Row 1, column 1. 5, given.");
    expect(describeCell(10, 0, 0b101, false, 0)).toBe("Row 2, column 2. Empty. Notes: 1, 3.");
    expect(describeCell(80, 3, 0, false, FLAG.INVALID)).toBe("Row 9, column 9. 3. Incorrect.");
    expect(describeCell(5, 0, 0, false, 0)).toBe("Row 1, column 6. Empty.");
  });

  it("derives highlight flags from the store state", () => {
    const state = useGameStore.getState();
    const base = {
      ...state,
      phase: "playing" as const,
      values: values.slice(),
      givenMask: values.map((v) => v > 0),
      conflicts: new Array<boolean>(81).fill(false),
      solutionDigits: solution,
      hint: null,
    };
    const opts = { related: true, same: true, conflicts: true };
    const selected = cellFlags({ ...base, selected: 2 }, 2, opts);
    expect(selected & FLAG.SELECTED).toBeTruthy();
    expect(cellFlags({ ...base, selected: 2 }, 3, opts) & FLAG.PEER).toBeTruthy(); // same row
    expect(cellFlags({ ...base, selected: 2 }, 80, opts) & FLAG.PEER).toBeFalsy();
    // Selecting a given 5 highlights the other 5s.
    const same = cellFlags({ ...base, selected: 0 }, values.indexOf(5, 1), opts);
    expect(same & FLAG.SAME).toBeTruthy();
    // A wrong entry looks like any other until Check has found it, and clears once the cell changes.
    const wrong = values.slice();
    wrong[2] = 1;
    expect(cellFlags({ ...base, values: wrong, selected: null }, 2, opts) & FLAG.INVALID).toBeFalsy();
    expect(cellFlags({ ...base, values: wrong, checked: { 2: 1 }, selected: null }, 2, opts) & FLAG.INVALID).toBeTruthy();
    expect(cellFlags({ ...base, values: wrong, checked: { 2: 4 }, selected: null }, 2, opts) & FLAG.INVALID).toBeFalsy();
    // Exactly one cell is a keyboard tab stop.
    expect(cellFlags({ ...base, selected: null }, 0, opts) & FLAG.TAB_STOP).toBeTruthy();
  });
});
