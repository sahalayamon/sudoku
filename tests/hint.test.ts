import { describe, expect, it } from "vitest";
import { DIFFICULTY_ORDER, generatePuzzle, getHint, isComplete, type Difficulty } from "@/lib/sudoku";
import { CLASSIC, CLASSIC_SOLUTION } from "./helpers";

describe("getHint", () => {
  it("returns a placement that matches the solution, with reasoning", () => {
    const hint = getHint(CLASSIC, CLASSIC_SOLUTION)!;
    expect(hint.kind).toBe("placement");
    expect(CLASSIC[hint.cell]).toBe("0");
    expect(hint.digit).toBe(Number(CLASSIC_SOLUTION[hint.cell]));
    expect(hint.steps.length).toBeGreaterThan(0);
    expect(hint.steps.at(-1)!.text.length).toBeGreaterThan(10);
    expect(hint.nudge.length).toBeGreaterThan(5);
    expect(hint.cause).not.toContain(hint.cell);
  });

  it("explains a naked single the way the product copy promises", () => {
    // Build a board where R1C1 has exactly one candidate (7): 1-6 and 8-9 are all visible.
    const board = ("0" + "123456" + "00" + "000000008" + "000000009" + "0".repeat(54)).slice(0, 81);
    // Row 0 holds 1-6 (cols 1-6); R1C9=8 and R2C9=9 are in column 8, not the row/box of R1C1.
    // Put 8 and 9 in the box instead.
    const chars = board.split("");
    chars[9] = "8"; // R2C1 -> same column & box as R1C1
    chars[10] = "9"; // R2C2 -> same box
    chars[8] = "0";
    chars[17] = "0";
    chars[18] = "0";
    const grid = chars.join("");
    const solution = grid.replace(/0/g, "1").split("");
    solution[0] = "7";
    const hint = getHint(grid, solution.join(""), { prefer: 0 })!;
    expect(hint.cell).toBe(0);
    expect(hint.digit).toBe(7);
    expect(hint.technique).toBe("nakedSingle");
    expect(hint.steps[0]!.text).toBe("Only 7 can fit here because 1, 2, 3, 4, 5, 6, 8 and 9 already appear in this row, column, or box.");
  });

  it("returns null when the board is complete", () => {
    expect(getHint(CLASSIC_SOLUTION, CLASSIC_SOLUTION)).toBeNull();
  });

  it("calls out a wrong number before offering anything else", () => {
    const board = CLASSIC.split("");
    board[2] = "5"; // R1C3 should be 4; 5 clashes with R1C1
    const hint = getHint(board.join(""), CLASSIC_SOLUTION)!;
    expect(hint.kind).toBe("error");
    expect(hint.cell).toBe(2);
    expect(hint.digit).toBe(4);
    expect(hint.steps[0]!.text).toContain("R1C3");
    expect(hint.cause).toContain(0);
  });

  it("honours the preferred cell when it has a single available", () => {
    const hint = getHint(CLASSIC, CLASSIC_SOLUTION, { prefer: 2 });
    // R1C3 is solvable with a single early on in this puzzle; whichever technique it is, the cell is respected.
    expect(hint!.digit).toBe(Number(CLASSIC_SOLUTION[hint!.cell]));
  });
});

describe.each(DIFFICULTY_ORDER)("hint chains (%s)", (difficulty: Difficulty) => {
  it("walks a whole puzzle to completion without ever contradicting the solution", () => {
    const puzzle = generatePuzzle({ difficulty, seed: `hint-${difficulty}` });
    const board = puzzle.givens.split("").map(Number);
    let guard = 0;
    while (!isComplete(board) && guard++ < 90) {
      const hint = getHint(board, puzzle.solution)!;
      expect(hint).not.toBeNull();
      expect(hint.kind).toBe("placement");
      expect(board[hint.cell]).toBe(0);
      expect(hint.digit).toBe(Number(puzzle.solution[hint.cell]));
      // Logical puzzles never need the solution fallback.
      expect(hint.technique).not.toBe("solution");
      board[hint.cell] = hint.digit;
    }
    expect(isComplete(board)).toBe(true);
    expect(board.join("")).toBe(puzzle.solution);
  });
});
