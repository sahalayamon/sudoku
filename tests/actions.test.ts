import { beforeEach, describe, expect, it } from "vitest";
import { continueGame, replayGame, restartCurrent, startDailyGame, startNewGame } from "@/features/game/actions";
import { dailyDifficulty, dailySeed } from "@/features/puzzle/daily";
import { clearAllData } from "@/lib/storage/repository";
import { generatePuzzle } from "@/lib/sudoku";
import { useGameStore } from "@/stores/game";
import { useLibraryStore } from "@/stores/library";
import { useMetaStore } from "@/stores/meta";
import { useSettingsStore } from "@/stores/settings";
import { DEFAULT_SETTINGS } from "@/types/settings";
import { makeRecord } from "./helpers";

const game = () => useGameStore.getState();
const lib = () => useLibraryStore.getState();

function makeOneMove() {
  const cell = game().values.findIndex((v) => v === 0);
  game().select(cell);
  game().input(game().solutionDigits[cell]!);
}

beforeEach(() => {
  clearAllData();
  useLibraryStore.getState().reset();
  useGameStore.getState().reset();
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: true });
  useMetaStore.getState().reset();
  game().attach();
});

describe("startNewGame", () => {
  it("shows the generating state, then plays the requested difficulty", async () => {
    const pending = startNewGame("beginner");
    expect(game().phase).toBe("generating");
    expect(game().loadingLabel).toMatch(/beginner/i);
    await pending;
    expect(game().phase).toBe("playing");
    expect(game().difficulty).toBe("beginner");
    expect(game().mode).toBe("standard");
    expect(lib().live).toHaveLength(1);
  });

  it("deletes the unfinished game at that level when a new one starts, leaving no trace in history", async () => {
    await startNewGame("beginner");
    makeOneMove();
    game().flushSave();
    const first = game().id;
    await startNewGame("beginner");
    expect(lib().live.find((g) => g.id === first)).toBeUndefined();
    expect(lib().finished.find((g) => g.id === first)).toBeUndefined();
  });

  it("keeps an unfinished game at a different level", async () => {
    await startNewGame("beginner");
    makeOneMove();
    game().flushSave();
    const beginner = game().id;
    await startNewGame("easy");
    expect(lib().live.find((g) => g.id === beginner)).toBeDefined();
  });

  it("drops an untouched game instead of recording it as played", async () => {
    await startNewGame("beginner");
    const untouched = game().id;
    await startNewGame("easy");
    await startNewGame("easy");
    await startNewGame("easy");
    expect(lib().finished.find((g) => g.id === untouched)).toBeUndefined();
  });

  it("remembers what was asked for so a failed generation can be retried exactly", () => {
    game().setGenerating("Preparing today's puzzle", { difficulty: "hard", mode: "daily", dailyDate: "2026-04-01" });
    game().setError("nope");
    expect(game()).toMatchObject({ phase: "error", difficulty: "hard", mode: "daily", dailyDate: "2026-04-01" });
  });
});

describe("startDailyGame", () => {
  it("plays the deterministic puzzle for the date and resumes the same game later", async () => {
    const date = "2026-05-12";
    await startDailyGame(date);
    expect(game().mode).toBe("daily");
    expect(game().dailyDate).toBe(date);
    expect(game().difficulty).toBe(dailyDifficulty(date));
    expect(game().givens).toBe(generatePuzzle({ difficulty: dailyDifficulty(date), seed: dailySeed(date) }).givens);

    makeOneMove();
    const id = game().id;
    game().detach();
    game().reset();
    await startDailyGame(date);
    expect(game().id).toBe(id);
    expect(game().moves).toBe(1);
  });
});

describe("continue, replay and restart", () => {
  it("continues the most recent game, or a specific one", async () => {
    await startNewGame("beginner");
    makeOneMove();
    game().flushSave();
    const first = game().id;
    await startNewGame("easy");
    makeOneMove();
    game().flushSave();
    expect(continueGame()).toBe(true);
    expect(game().difficulty).toBe("easy");
    expect(continueGame(first)).toBe(true);
    expect(game().id).toBe(first);
    expect(continueGame("missing")).toBe(false);
  });

  it("replays any past puzzle from the start as a fresh standard game", () => {
    const finished = makeRecord({ id: "old", mode: "daily", dailyDate: "2026-01-01" });
    replayGame(finished);
    expect(game().phase).toBe("playing");
    expect(game().id).not.toBe("old");
    expect(game().mode).toBe("standard");
    expect(game().givens).toBe(finished.givens);
    expect(game().values.join("")).toBe(finished.givens);
  });

  it("restarting keeps the attempt in history as abandoned and starts over on the same puzzle", async () => {
    await startNewGame("beginner");
    makeOneMove();
    const { id, givens } = game();
    restartCurrent();
    expect(game().id).not.toBe(id);
    expect(game().givens).toBe(givens);
    expect(game().moves).toBe(0);
    expect(lib().finished.find((g) => g.id === id)?.status).toBe("abandoned");
    expect(lib().live.find((g) => g.id === id)).toBeUndefined();
  });
});
