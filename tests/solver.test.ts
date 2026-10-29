import { describe, expect, it } from "vitest";
import {
  GridFormatError,
  calculateDifficulty,
  checkMove,
  countSolutions,
  findConflictCells,
  generateCandidates,
  hasUniqueSolution,
  isValidSolution,
  parseGrid,
  solvePuzzle,
  validatePuzzle,
} from "@/lib/sudoku";
import { createRng, randomInt, shuffleInPlace } from "@/lib/sudoku/rng";
import { randomSolvedGrid } from "@/lib/sudoku/solver";
import { CLASSIC, CLASSIC_SOLUTION } from "./helpers";

const EMPTY = "0".repeat(81);

describe("rng", () => {
  it("is deterministic for a seed and differs across seeds", () => {
    const a = createRng("seed");
    const b = createRng("seed");
    const c = createRng("other");
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    const seqC = Array.from({ length: 5 }, () => c());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("shuffles into a permutation", () => {
    const rng = createRng("shuffle");
    const items = Array.from({ length: 20 }, (_, i) => i);
    const shuffled = shuffleInPlace([...items], rng);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(items);
    expect(randomInt(rng, 5)).toBeLessThan(5);
  });
});

describe("parseGrid", () => {
  it("accepts digits and dots", () => {
    const grid = parseGrid("." + "0".repeat(79) + "5");
    expect(grid[0]).toBe(0);
    expect(grid[80]).toBe(5);
  });

  it("rejects wrong length and bad characters", () => {
    expect(() => parseGrid("123")).toThrow(GridFormatError);
    expect(() => parseGrid("x".repeat(81))).toThrow(GridFormatError);
    expect(() => parseGrid(new Array(81).fill(12))).toThrow(GridFormatError);
  });
});

describe("solver", () => {
  it("solves a known puzzle", () => {
    expect(solvePuzzle(CLASSIC)).toBe(CLASSIC_SOLUTION);
  });

  it("returns a valid complete grid for an empty board", () => {
    const solved = solvePuzzle(EMPTY);
    expect(solved).not.toBeNull();
    expect(findConflictCells(solved!)).toHaveLength(0);
    expect(solved!.includes("0")).toBe(false);
  });

  it("returns null for contradictory givens", () => {
    const bad = "55" + "0".repeat(79);
    expect(solvePuzzle(bad)).toBeNull();
    expect(countSolutions(bad)).toBe(0);
  });

  it("returns null for a grid with no solution", () => {
    // Row 1 holds 1-8, and a 9 sits below the last cell of that row: R1C9 has no candidate.
    const row = "123456780";
    const grid = row + "00000000" + "9" + "0".repeat(63);
    expect(findConflictCells(grid)).toHaveLength(0);
    expect(solvePuzzle(grid)).toBeNull();
  });
});

describe("uniqueness", () => {
  it("accepts a known unique puzzle", () => {
    expect(hasUniqueSolution(CLASSIC)).toBe(true);
    expect(countSolutions(CLASSIC, 5)).toBe(1);
  });

  it("rejects under-constrained puzzles", () => {
    expect(hasUniqueSolution(EMPTY)).toBe(false);
    expect(countSolutions(EMPTY, 3)).toBe(3);
  });

  it("detects a deadly rectangle (two solutions that differ by a swap)", () => {
    let found: { grid: Uint8Array; cells: number[] } | null = null;
    for (let seed = 0; seed < 300 && !found; seed++) {
      const g = randomSolvedGrid(createRng(`deadly-${seed}`));
      for (let band = 0; band < 3 && !found; band++) {
        for (let a = 0; a < 3 && !found; a++) {
          for (let b = a + 1; b < 3 && !found; b++) {
            const r1 = band * 3 + a;
            const r2 = band * 3 + b;
            for (let c1 = 0; c1 < 9 && !found; c1++) {
              for (let c2 = c1 + 1; c2 < 9 && !found; c2++) {
                if (Math.floor(c1 / 3) === Math.floor(c2 / 3)) continue;
                const [p, q, r, s] = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
                if (g[p] === g[s] && g[q] === g[r]) found = { grid: g, cells: [p!, q!, r!, s!] };
              }
            }
          }
        }
      }
    }
    expect(found).not.toBeNull();
    const puzzle = Uint8Array.from(found!.grid);
    for (const c of found!.cells) puzzle[c] = 0;
    expect(countSolutions(puzzle, 5)).toBe(2);
    expect(hasUniqueSolution(puzzle)).toBe(false);
    expect(validatePuzzle(puzzle).errors[0]?.code).toBe("multiple_solutions");
  });

  it("a complete valid grid is trivially unique", () => {
    expect(hasUniqueSolution(CLASSIC_SOLUTION)).toBe(true);
  });
});

describe("validatePuzzle", () => {
  it("passes a valid unique puzzle", () => {
    const result = validatePuzzle(CLASSIC);
    expect(result.valid).toBe(true);
    expect(result.unique).toBe(true);
    expect(result.solutions).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.clues).toBe(30);
  });

  it("reports malformed input", () => {
    expect(validatePuzzle("12").errors[0]?.code).toBe("length");
    expect(validatePuzzle("a".repeat(81)).errors[0]?.code).toBe("characters");
  });

  it("reports duplicate givens with the offending cells", () => {
    const result = validatePuzzle("11" + "0".repeat(79));
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("duplicate");
    expect(result.errors[0]?.cells).toEqual([0, 1]);
  });

  it("reports multiple solutions and no solution", () => {
    expect(validatePuzzle(EMPTY).errors[0]?.code).toBe("multiple_solutions");
    const unsolvable = "123456780" + "00000000" + "9" + "0".repeat(63);
    expect(validatePuzzle(unsolvable).errors[0]?.code).toBe("no_solution");
  });
});

describe("isValidSolution", () => {
  it("accepts the real solution and rejects tampering", () => {
    expect(isValidSolution(CLASSIC, CLASSIC_SOLUTION)).toBe(true);
    const tampered = "9" + CLASSIC_SOLUTION.slice(1);
    expect(isValidSolution(CLASSIC, tampered)).toBe(false);
    expect(isValidSolution(CLASSIC, CLASSIC)).toBe(false);
    expect(isValidSolution(CLASSIC, "short")).toBe(false);
  });
});

describe("generateCandidates", () => {
  it("returns row/column/box legal digits and 0 for filled cells", () => {
    const cands = generateCandidates(CLASSIC);
    expect(cands[0]).toBe(0); // filled with 5
    // R1C3: row has 5,3,7 - column has 8 - box has 5,3,6,9,8 => {1,2,4}
    expect(cands[2]).toBe(0b000001011);
    expect(cands).toHaveLength(81);
  });

  it("gives every digit for an empty board", () => {
    expect(generateCandidates(EMPTY).every((m) => m === 0x1ff)).toBe(true);
  });
});

describe("checkMove", () => {
  it("separates rule conflicts from correctness", () => {
    // R1C3 is 4 in the solution. 5 clashes with R1C1 in the row.
    expect(checkMove(CLASSIC, CLASSIC_SOLUTION, 2, 4)).toEqual({ valid: true, correct: true, conflicts: [] });
    const wrong = checkMove(CLASSIC, CLASSIC_SOLUTION, 2, 5);
    expect(wrong.valid).toBe(true);
    expect(wrong.correct).toBe(false);
    expect(wrong.conflicts).toContain(0);
  });

  it("flags a legal-looking but wrong digit as incorrect", () => {
    // 1 does not clash with anything at R1C3 yet it is not the solution's digit.
    const move = checkMove(CLASSIC, CLASSIC_SOLUTION, 2, 1);
    expect(move.conflicts).toEqual([]);
    expect(move.correct).toBe(false);
  });

  it("rejects out-of-range input", () => {
    expect(checkMove(CLASSIC, CLASSIC_SOLUTION, -1, 3).valid).toBe(false);
    expect(checkMove(CLASSIC, CLASSIC_SOLUTION, 81, 3).valid).toBe(false);
    expect(checkMove(CLASSIC, CLASSIC_SOLUTION, 2, 0).valid).toBe(false);
    expect(checkMove(CLASSIC, CLASSIC_SOLUTION, 2, 10).valid).toBe(false);
  });
});

describe("calculateDifficulty", () => {
  it("rates a gentle classic as solvable by singles", () => {
    const report = calculateDifficulty(CLASSIC);
    expect(report.valid).toBe(true);
    expect(report.unique).toBe(true);
    expect(report.solvedLogically).toBe(true);
    expect(report.requiresSearch).toBe(false);
    expect(["beginner", "easy", "medium"]).toContain(report.level);
    expect(report.clues).toBe(30);
  });

  it("flags invalid puzzles", () => {
    expect(calculateDifficulty("11" + "0".repeat(79)).valid).toBe(false);
    expect(calculateDifficulty("123456780" + "00000000" + "9" + "0".repeat(63)).valid).toBe(false);
  });

  it("reports non-unique puzzles as valid but not unique", () => {
    const report = calculateDifficulty(EMPTY);
    expect(report.valid).toBe(true);
    expect(report.unique).toBe(false);
  });

  it("is a complete-grid no-op", () => {
    const report = calculateDifficulty(CLASSIC_SOLUTION);
    expect(report.valid).toBe(true);
    expect(report.level).toBe("beginner");
    expect(report.steps).toBe(0);
  });
});
