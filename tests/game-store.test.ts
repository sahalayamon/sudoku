import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllData, loadFinished, loadLive } from "@/lib/storage/repository";
import { useGameStore } from "@/stores/game";
import { useLibraryStore } from "@/stores/library";
import { useMetaStore } from "@/stores/meta";
import { useSettingsStore } from "@/stores/settings";
import { DEFAULT_SETTINGS } from "@/types/settings";
import { samplePuzzle } from "./helpers";

const game = () => useGameStore.getState();

function emptyCells(): number[] {
  return game()
    .values.map((v, i) => (v === 0 ? i : -1))
    .filter((i) => i >= 0);
}
const solutionAt = (cell: number) => game().solutionDigits[cell]!;
const wrongDigitFor = (cell: number) => (solutionAt(cell) % 9) + 1;
const sameRow = (a: number, b: number) => Math.floor(a / 9) === Math.floor(b / 9);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T10:00:00"));
  clearAllData();
  useLibraryStore.getState().reset();
  useGameStore.getState().reset();
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: true });
  useMetaStore.getState().reset();
  game().attach();
  game().loadNew(samplePuzzle(), "standard");
});

afterEach(() => {
  game().detach();
  vi.useRealTimers();
});

describe("starting a game", () => {
  it("loads the puzzle, persists it immediately and remembers it as current", () => {
    expect(game().phase).toBe("playing");
    expect(game().values.join("")).toBe(samplePuzzle().givens);
    expect(game().filled).toBe(samplePuzzle().clues);
    expect(game().paused).toBe(false);
    expect(loadLive()).toHaveLength(1);
    expect(loadLive()[0]!.id).toBe(game().id);
    expect(useMetaStore.getState().currentGameId).toBe(game().id);
  });

  it("snapshots the mistake limit from settings", () => {
    useSettingsStore.getState().update({ mistakeLimit: 5 });
    game().loadNew(samplePuzzle(), "standard");
    expect(game().mistakeLimit).toBe(5);
  });
});

describe("entering numbers", () => {
  it("places a correct digit, records history and counts a move", () => {
    const cell = emptyCells()[0]!;
    game().select(cell);
    game().input(solutionAt(cell));
    expect(game().values[cell]).toBe(solutionAt(cell));
    expect(game().mistakes).toBe(0);
    expect(game().moves).toBe(1);
    expect(game().history).toHaveLength(1);
  });

  it("places a wrong digit freely: no mistake, no marking, until Check", () => {
    const cell = emptyCells()[0]!;
    game().select(cell);
    game().input(wrongDigitFor(cell));
    expect(game().values[cell]).toBe(wrongDigitFor(cell));
    expect(game().mistakes).toBe(0);
    expect(game().checked).toEqual({});
    expect(game().fx[cell]?.kind).not.toBe("shake");
  });

  it("Check marks wrong entries and counts each one as a mistake", () => {
    const [a, b, c] = emptyCells() as [number, number, number];
    game().select(a);
    game().input(wrongDigitFor(a));
    game().select(b);
    game().input(wrongDigitFor(b));
    game().select(c);
    game().input(solutionAt(c));
    game().check();
    expect(game().checked).toEqual({ [a]: wrongDigitFor(a), [b]: wrongDigitFor(b) });
    expect(game().mistakes).toBe(2);
    expect(game().fx[a]?.kind).toBe("shake");
  });

  it("checking again does not count the same wrong entry twice", () => {
    const cell = emptyCells()[0]!;
    game().select(cell);
    game().input(wrongDigitFor(cell));
    game().check();
    game().check();
    expect(game().mistakes).toBe(1);
  });

  it("Check with nothing wrong costs nothing and clears old marks once fixed", () => {
    const cell = emptyCells()[0]!;
    game().select(cell);
    game().input(wrongDigitFor(cell));
    game().check();
    game().input(solutionAt(cell));
    game().check();
    expect(game().checked).toEqual({});
    expect(game().mistakes).toBe(1);
  });

  it("ignores input on givens, with no selection, or while paused", () => {
    const given = game().values.findIndex((v) => v !== 0);
    game().select(given);
    game().input(5);
    expect(game().history).toHaveLength(0);

    game().select(null);
    game().input(5);
    expect(game().history).toHaveLength(0);

    const cell = emptyCells()[0]!;
    game().select(cell);
    game().pause();
    game().input(solutionAt(cell));
    expect(game().values[cell]).toBe(0);
  });

  it("erases a user entry but never a given", () => {
    const cell = emptyCells()[0]!;
    game().select(cell);
    game().input(solutionAt(cell));
    game().erase();
    expect(game().values[cell]).toBe(0);
    const given = game().values.findIndex((v) => v !== 0);
    game().select(given);
    game().erase();
    expect(game().values[given]).not.toBe(0);
  });

  it("marks duplicates as conflicts", () => {
    const a = emptyCells()[0]!;
    const peer = emptyCells().find((c) => c !== a && sameRow(c, a))!;
    game().select(a);
    game().input(wrongDigitFor(a));
    game().select(peer);
    game().input(wrongDigitFor(a));
    expect(game().conflicts[a] || game().conflicts[peer]).toBe(true);
  });
});

describe("notes", () => {
  it("toggles candidates in notes mode and never on filled cells", () => {
    const cell = emptyCells()[0]!;
    game().select(cell);
    game().toggleNotesMode();
    game().input(3);
    game().input(7);
    expect(game().notes[cell]).toBe((1 << 2) | (1 << 6));
    game().input(3);
    expect(game().notes[cell]).toBe(1 << 6);
    expect(game().mistakes).toBe(0);
  });

  it("supports forced notes without switching mode", () => {
    const cell = emptyCells()[0]!;
    game().select(cell);
    game().input(4, { notes: true });
    expect(game().notes[cell]).toBe(1 << 3);
    expect(game().notesMode).toBe(false);
  });

  it("removes the placed digit from related notes (auto notes) and undo restores them", () => {
    const a = emptyCells()[0]!;
    const digit = solutionAt(a);
    const peer = emptyCells().find((c) => c !== a && sameRow(c, a))!;
    game().select(peer);
    game().input(digit, { notes: true });
    expect(game().notes[peer]! & (1 << (digit - 1))).not.toBe(0);

    game().select(a);
    game().input(digit);
    expect(game().notes[peer]! & (1 << (digit - 1))).toBe(0);

    game().undo();
    expect(game().values[a]).toBe(0);
    expect(game().notes[peer]! & (1 << (digit - 1))).not.toBe(0);
  });

  it("keeps notes when auto notes is off", () => {
    useSettingsStore.getState().update({ autoNotes: false });
    const a = emptyCells()[0]!;
    const digit = solutionAt(a);
    const peer = emptyCells().find((c) => c !== a && sameRow(c, a))!;
    game().select(peer);
    game().input(digit, { notes: true });
    game().select(a);
    game().input(digit);
    expect(game().notes[peer]! & (1 << (digit - 1))).not.toBe(0);
  });

  it("fills and clears all notes as single undoable moves", () => {
    game().fillNotes();
    const cell = emptyCells()[0]!;
    expect(game().notes[cell]).not.toBe(0);
    expect(game().notes[cell]! & (1 << (solutionAt(cell) - 1))).not.toBe(0);
    const before = game().history.length;
    game().clearNotes();
    expect(game().notes.every((n) => n === 0)).toBe(true);
    expect(game().history).toHaveLength(before + 1);
    game().undo();
    expect(game().notes[cell]).not.toBe(0);
  });
});

describe("undo / redo", () => {
  it("round-trips and clears redo after a new move", () => {
    const [a, b] = emptyCells() as [number, number];
    game().select(a);
    game().input(solutionAt(a));
    game().select(b);
    game().input(solutionAt(b));
    game().undo();
    expect(game().values[b]).toBe(0);
    expect(game().future).toHaveLength(1);
    game().redo();
    expect(game().values[b]).toBe(solutionAt(b));
    game().undo();
    game().select(b);
    game().input(solutionAt(b), { notes: true });
    expect(game().future).toHaveLength(0);
  });

  it("does not refund a mistake when undone", () => {
    const cell = emptyCells()[0]!;
    game().select(cell);
    game().input(wrongDigitFor(cell));
    game().check();
    game().undo();
    expect(game().mistakes).toBe(1);
  });

  it("does nothing with empty stacks", () => {
    game().undo();
    game().redo();
    expect(game().history).toHaveLength(0);
  });
});

describe("mistake limit", () => {
  it("fails the game at the limit and records it", () => {
    const cells = emptyCells();
    for (let i = 0; i < 3; i++) {
      game().select(cells[i]!);
      game().input(wrongDigitFor(cells[i]!));
    }
    expect(game().phase).toBe("playing");
    game().check();
    expect(game().phase).toBe("failed");
    expect(loadLive()).toHaveLength(0);
    const finished = loadFinished();
    expect(finished).toHaveLength(1);
    expect(finished[0]!.status).toBe("failed");
    expect(finished[0]!.mistakes).toBe(3);
  });

  it("never fails when the limit is off", () => {
    useSettingsStore.getState().update({ mistakeLimit: 0 });
    game().loadNew(samplePuzzle(), "standard");
    const cells = emptyCells();
    for (let i = 0; i < 6; i++) {
      game().select(cells[i]!);
      game().input(wrongDigitFor(cells[i]!));
    }
    game().check();
    expect(game().phase).toBe("playing");
    expect(game().mistakes).toBe(6);
  });
});

describe("completion", () => {
  it("completes on the final correct digit and records the result", () => {
    const cells = emptyCells();
    vi.advanceTimersByTime(65_000);
    for (const cell of cells) {
      game().select(cell);
      game().input(solutionAt(cell));
    }
    expect(game().phase).toBe("completed");
    const summary = game().completion!;
    expect(summary.elapsedMs).toBeGreaterThanOrEqual(65_000);
    expect(summary.isFirstAtDifficulty).toBe(true);
    expect(summary.isPersonalBest).toBe(false);
    expect(summary.newAchievements).toContain("first_solve");
    expect(loadLive()).toHaveLength(0);
    expect(loadFinished()[0]!.status).toBe("completed");
    expect(useMetaStore.getState().currentGameId).toBeNull();
  });

  it("does not complete while a wrong digit sits on the board", () => {
    useSettingsStore.getState().update({ mistakeLimit: 0 });
    game().loadNew(samplePuzzle(), "standard");
    const cells = emptyCells();
    game().select(cells[0]!);
    game().input(wrongDigitFor(cells[0]!));
    for (const cell of cells.slice(1)) {
      game().select(cell);
      game().input(solutionAt(cell));
    }
    expect(game().filled).toBe(81);
    expect(game().phase).toBe("playing");
    game().select(cells[0]!);
    game().input(solutionAt(cells[0]!));
    expect(game().phase).toBe("completed");
  });

  it("flags a personal best only when it beats a clean previous solve", () => {
    const solveAfter = (ms: number) => {
      game().loadNew(samplePuzzle(), "standard");
      vi.advanceTimersByTime(ms);
      for (const cell of emptyCells()) {
        game().select(cell);
        game().input(solutionAt(cell));
      }
      return game().completion!;
    };
    expect(solveAfter(120_000).isPersonalBest).toBe(false);
    expect(solveAfter(90_000).isPersonalBest).toBe(true);
    expect(solveAfter(150_000).isPersonalBest).toBe(false);
  });
});

describe("timer", () => {
  it("stops while paused and resumes where it left off", () => {
    vi.advanceTimersByTime(10_000);
    game().pause();
    const atPause = Math.round(game().baseElapsedMs / 1000);
    vi.advanceTimersByTime(60_000);
    game().resume();
    vi.advanceTimersByTime(5_000);
    const total = Math.round(game().toRecord().elapsedMs / 1000);
    expect(atPause).toBe(10);
    expect(total).toBe(15);
  });

  it("auto-pauses when the page is hidden and auto-resumes when it returns", () => {
    game().onVisibility(false);
    expect(game().paused).toBe(true);
    game().onVisibility(true);
    expect(game().paused).toBe(false);
  });

  it("keeps a user pause through visibility changes", () => {
    game().pause("user");
    game().onVisibility(false);
    game().onVisibility(true);
    expect(game().paused).toBe(true);
  });
});

describe("persistence", () => {
  it("saves after a debounce and restores an identical game", () => {
    const [a, b] = emptyCells() as [number, number];
    game().select(a);
    game().input(solutionAt(a));
    game().select(b);
    game().input(wrongDigitFor(b));
    game().input(5, { notes: true });
    game().check();
    vi.advanceTimersByTime(12_000);
    game().flushSave();

    const stored = loadLive()[0]!;
    expect(stored.values[a]).toBe(String(solutionAt(a)));
    expect(stored.mistakes).toBe(1);

    const snapshot = {
      values: game().values.slice(),
      notes: game().notes.slice(),
      mistakes: game().mistakes,
      history: game().history.length,
    };
    game().detach();
    useGameStore.getState().reset();
    useLibraryStore.getState().hydrate();
    game().attach();
    game().loadRecord(useLibraryStore.getState().live[0]!);

    expect(game().values).toEqual(snapshot.values);
    expect(game().notes).toEqual(snapshot.notes);
    expect(game().mistakes).toBe(snapshot.mistakes);
    expect(game().history).toHaveLength(snapshot.history);
    expect(Math.round(game().toRecord().elapsedMs / 1000)).toBe(12);

    // Undo still works after a reload.
    game().undo();
    expect(game().history).toHaveLength(snapshot.history - 1);
  });
});

describe("hints", () => {
  it("walks pointer -> explanation -> reveal and counts one hint", () => {
    game().requestHint();
    expect(game().hint?.level).toBe(1);
    expect(game().hintsUsed).toBe(1);
    const { cell, digit } = game().hint!.hint;
    expect(game().selected).toBe(cell);

    game().requestHint();
    expect(game().hint?.level).toBe(2);
    expect(game().hintsUsed).toBe(1);

    game().requestHint();
    expect(game().hint).toBeNull();
    expect(game().values[cell]).toBe(digit);
    expect(game().mistakes).toBe(0);
  });

  it("closes the hint when the board changes", () => {
    game().requestHint();
    const other = emptyCells().find((c) => c !== game().hint!.hint.cell)!;
    game().select(other);
    game().input(solutionAt(other));
    expect(game().hint).toBeNull();
  });

  it("flags a wrong entry first and reveal repairs it", () => {
    useSettingsStore.getState().update({ mistakeLimit: 0 });
    game().loadNew(samplePuzzle(), "standard");
    const cell = emptyCells()[3]!;
    game().select(cell);
    game().input(wrongDigitFor(cell));
    game().requestHint();
    expect(game().hint!.hint.kind).toBe("error");
    expect(game().hint!.hint.cell).toBe(cell);
    game().requestHint();
    game().requestHint();
    expect(game().values[cell]).toBe(solutionAt(cell));
  });
});
