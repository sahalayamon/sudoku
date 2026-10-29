import { beforeEach, describe, expect, it } from "vitest";
import { PuzzleClient } from "@/features/puzzle/client";
import { requestDailyPuzzle, requestPuzzle } from "@/features/puzzle/service";
import { clearAllData, loadDailyPuzzle, loadPool, savePool } from "@/lib/storage/repository";
import { dailyDifficulty, dailySeed, generatePuzzle, validatePuzzle } from "@/lib/sudoku";
import { samplePuzzle } from "./helpers";

beforeEach(() => clearAllData());

describe("PuzzleClient (main-thread fallback, as used where Workers are unavailable)", () => {
  it("generates a validated puzzle", async () => {
    const client = new PuzzleClient();
    const puzzle = await client.generate("easy", "client-seed");
    expect(puzzle.difficulty).toBe("easy");
    expect(validatePuzzle(puzzle.givens)).toMatchObject({ valid: true, unique: true });
    // Same seed, same puzzle: the worker and the fallback are interchangeable.
    expect((await client.generate("easy", "client-seed")).givens).toBe(puzzle.givens);
  });
});

describe("requestPuzzle", () => {
  it("serves a pre-generated puzzle instantly and consumes it from the pool", async () => {
    const pooled = samplePuzzle();
    savePool({ beginner: [pooled] });
    const got = await requestPuzzle("beginner");
    expect(got.givens).toBe(pooled.givens);
    expect(loadPool().beginner ?? []).toHaveLength(0);
  });

  it("generates on demand when the pool is empty", async () => {
    const puzzle = await requestPuzzle("medium");
    expect(puzzle.difficulty).toBe("medium");
    expect(validatePuzzle(puzzle.givens).valid).toBe(true);
  });
});

describe("requestDailyPuzzle", () => {
  it("is the deterministic puzzle for the date, and is cached for offline use", async () => {
    const date = "2026-10-06";
    const daily = await requestDailyPuzzle(date);
    const expected = generatePuzzle({ difficulty: dailyDifficulty(date), seed: dailySeed(date) });
    expect(daily.givens).toBe(expected.givens);
    expect(daily.difficulty).toBe(dailyDifficulty(date));
    expect(loadDailyPuzzle(date)?.givens).toBe(expected.givens);
    // Served from the cache the second time.
    expect((await requestDailyPuzzle(date)).givens).toBe(expected.givens);
  });

  it("ignores a cached puzzle made by a different generator version", async () => {
    const date = "2026-10-07";
    const stale = { ...samplePuzzle(), seed: "daily-v0:2026-10-07" };
    const { saveDailyPuzzle } = await import("@/lib/storage/repository");
    saveDailyPuzzle(date, stale);
    const fresh = await requestDailyPuzzle(date);
    expect(fresh.seed).toBe(dailySeed(date));
  });
});
