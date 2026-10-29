import { describe, expect, it } from "vitest";
import { recordToPayload, rowToRecord, type RemoteGameRow } from "@/lib/sync/mapping";
import { makeRecord, samplePuzzle } from "./helpers";

const puzzle = samplePuzzle();

function row(over: Partial<RemoteGameRow> = {}): RemoteGameRow {
  return {
    id: "6f1f5d2e-8d52-4c8e-9f3e-0a1b2c3d4e5f",
    mode: "standard",
    daily_date: null,
    status: "completed",
    difficulty: "beginner",
    elapsed_ms: 123_000,
    mistakes: 1,
    mistake_limit: 3,
    hints_used: 0,
    moves: 44,
    started_at: "2026-03-10T09:00:00.000Z",
    completed_at: "2026-03-10T09:02:03.000Z",
    updated_at: "2026-03-10T09:02:03.000Z",
    received_at: "2026-03-10T09:02:04.000Z",
    puzzles: { givens: puzzle.givens, score: puzzle.score, seed: "abc" },
    game_sessions: null,
    ...over,
  };
}

describe("recordToPayload", () => {
  it("serialises a record for the sync_game RPC", () => {
    const record = makeRecord({ id: "g1", mode: "daily", dailyDate: "2026-03-10", mistakes: 2, hintsUsed: 1 });
    const payload = recordToPayload(record, "dev-1");
    expect(payload).toMatchObject({
      id: "g1",
      givens: record.givens,
      board: record.values,
      mode: "daily",
      daily_date: "2026-03-10",
      status: "completed",
      mistakes: 2,
      hints_used: 1,
      device_id: "dev-1",
    });
    expect(payload.updated_at).toBe(new Date(record.updatedAt).toISOString());
    expect(payload.completed_at).toBe(new Date(record.completedAt!).toISOString());
    expect(payload.notes).toHaveLength(81);
  });

  it("sends null completion for unfinished games and rounds fractional times", () => {
    const payload = recordToPayload(makeRecord({ status: "in_progress", completedAt: null, elapsedMs: 1234.7, paused: true }), "d");
    expect(payload.completed_at).toBeNull();
    expect(payload.elapsed_ms).toBe(1235);
    expect(payload.paused).toBe(true);
  });
});

describe("rowToRecord", () => {
  it("rebuilds a completed game; the solution is recomputed rather than trusted", () => {
    const record = rowToRecord(row())!;
    expect(record.status).toBe("completed");
    expect(record.values).toBe(puzzle.solution);
    expect(record.solution).toBe(puzzle.solution);
    expect(record.elapsedMs).toBe(123_000);
    expect(record.syncedAt).toBe(Date.parse("2026-03-10T09:02:03.000Z"));
    expect(record.completedAt).toBe(Date.parse("2026-03-10T09:02:03.000Z"));
  });

  it("restores an in-progress board, notes and pause state from the session (object or array embed)", () => {
    const empty = puzzle.givens.indexOf("0");
    const board = puzzle.givens.slice(0, empty) + puzzle.solution[empty] + puzzle.givens.slice(empty + 1);
    const notes = new Array(81).fill(0);
    notes[empty + 1] = 5;
    const base = { status: "in_progress", completed_at: null };
    const asObject = rowToRecord(row({ ...base, game_sessions: { board, notes, paused: true } }))!;
    expect(asObject.values).toBe(board);
    expect(asObject.notes[empty + 1]).toBe(5);
    expect(asObject.paused).toBe(true);
    const asArray = rowToRecord(
      row({ ...base, puzzles: [{ givens: puzzle.givens, score: 1, seed: null }], game_sessions: [{ board, notes, paused: false }] }),
    )!;
    expect(asArray.values).toBe(board);
    expect(asArray.paused).toBeUndefined();
  });

  it("falls back to the givens when an in-progress session is missing", () => {
    const record = rowToRecord(row({ status: "in_progress", completed_at: null }))!;
    expect(record.values).toBe(puzzle.givens);
  });

  it("drops rows that cannot be trusted", () => {
    expect(rowToRecord(row({ puzzles: null }))).toBeNull();
    expect(rowToRecord(row({ puzzles: { givens: "11" + "0".repeat(79), score: 0, seed: null } }))).toBeNull();
    expect(rowToRecord(row({ puzzles: { givens: "x".repeat(81), score: 0, seed: null } }))).toBeNull();
    expect(rowToRecord(row({ status: "bogus" }))).toBeNull();
  });
});
