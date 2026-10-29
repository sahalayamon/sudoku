import { beforeEach, describe, expect, it } from "vitest";
import { evaluateAchievements } from "@/features/achievements/definitions";
import { computeStats, computeStreaks, recentDays } from "@/features/statistics/compute";
import { addDays, dateKey, dayNumber, weekdayOf } from "@/lib/date";
import { formatDuration } from "@/lib/format";
import {
  buildExportBundle,
  clearAllData,
  loadAchievements,
  loadDailyPuzzle,
  loadFinished,
  loadLive,
  loadMeta,
  loadPool,
  loadSettings,
  parseExportBundle,
  saveDailyPuzzle,
  saveFinished,
  saveLive,
  savePool,
  saveSettings,
} from "@/lib/storage/repository";
import { sanitizeGameRecord } from "@/lib/storage/sanitize";
import { mergeAchievements, mergeGameLists, mergeSettings, resolveGameConflict } from "@/lib/sync/merge";
import { dailyDifficulty, dailySeed } from "@/features/puzzle/daily";
import { generatePuzzle } from "@/lib/sudoku";
import { useLibraryStore } from "@/stores/library";
import { DEFAULT_SETTINGS } from "@/types/settings";
import { makeRecord, samplePuzzle } from "./helpers";

const T = (iso: string) => new Date(iso).getTime();

describe("dates", () => {
  it("formats and does arithmetic on local date keys", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(dayNumber("2026-01-02") - dayNumber("2026-01-01")).toBe(1);
    expect(weekdayOf("2026-10-04")).toBe(0); // Sunday
    expect(recentDays("2026-03-10", 3)).toEqual(["2026-03-08", "2026-03-09", "2026-03-10"]);
  });

  it("formats durations", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(18 * 60_000 + 42_000)).toBe("18:42");
    expect(formatDuration(3_723_000)).toBe("1:02:03");
  });
});

describe("daily puzzle", () => {
  it("is deterministic per date and varies in difficulty across the week", () => {
    expect(dailySeed("2026-10-04")).toBe(dailySeed("2026-10-04"));
    expect(dailySeed("2026-10-04")).not.toBe(dailySeed("2026-10-05"));
    expect(dailyDifficulty("2026-10-10")).toBe("expert"); // Saturday
    expect(dailyDifficulty("2026-10-05")).toBe("easy"); // Monday
    const a = generatePuzzle({ difficulty: dailyDifficulty("2026-10-05"), seed: dailySeed("2026-10-05") });
    const b = generatePuzzle({ difficulty: dailyDifficulty("2026-10-05"), seed: dailySeed("2026-10-05") });
    expect(a.givens).toBe(b.givens);
  });
});

describe("streaks", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreaks(["2026-03-08", "2026-03-09", "2026-03-10"], "2026-03-10")).toEqual({ current: 3, best: 3, todayDone: true });
  });

  it("keeps the streak alive until the day ends", () => {
    expect(computeStreaks(["2026-03-08", "2026-03-09"], "2026-03-10")).toEqual({ current: 2, best: 2, todayDone: false });
  });

  it("breaks after a missed day but remembers the best", () => {
    const result = computeStreaks(["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-09"], "2026-03-10");
    expect(result.best).toBe(4);
    expect(result.current).toBe(1);
    expect(computeStreaks(["2026-03-01", "2026-03-02"], "2026-03-10").current).toBe(0);
  });

  it("ignores duplicates and handles empty input", () => {
    expect(computeStreaks(["2026-03-10", "2026-03-10"], "2026-03-10").current).toBe(1);
    expect(computeStreaks([], "2026-03-10")).toEqual({ current: 0, best: 0, todayDone: false });
  });
});

describe("statistics", () => {
  const games = [
    makeRecord({ difficulty: "easy", elapsedMs: 200_000, mistakes: 1, completedAt: T("2026-03-10T09:00:00") }),
    makeRecord({ difficulty: "easy", elapsedMs: 100_000, mistakes: 0, hintsUsed: 2, completedAt: T("2026-03-10T11:00:00") }),
    makeRecord({ difficulty: "easy", elapsedMs: 150_000, mistakes: 0, completedAt: T("2026-03-09T11:00:00") }),
    makeRecord({ difficulty: "hard", status: "failed", mistakes: 3, completedAt: T("2026-03-09T12:00:00") }),
    makeRecord({ difficulty: "hard", status: "abandoned", completedAt: null }),
    makeRecord({ difficulty: "hard", status: "in_progress", moves: 5, completedAt: null }),
    makeRecord({ difficulty: "hard", status: "in_progress", moves: 0, completedAt: null }),
    makeRecord({ mode: "daily", dailyDate: "2026-03-10", difficulty: "medium", elapsedMs: 400_000, completedAt: T("2026-03-10T12:00:00") }),
    makeRecord({ mode: "daily", dailyDate: "2026-03-09", difficulty: "medium", elapsedMs: 500_000, completedAt: T("2026-03-09T12:00:00") }),
  ];
  const stats = computeStats(games, "2026-03-10");

  it("aggregates per difficulty", () => {
    const easy = stats.byDifficulty.easy;
    expect(easy.played).toBe(3);
    expect(easy.completed).toBe(3);
    expect(easy.winRate).toBe(1);
    expect(easy.avgTimeMs).toBe(150_000);
    expect(easy.avgMistakes).toBeCloseTo(1 / 3);
    expect(easy.flawless).toBe(2);
    const hard = stats.byDifficulty.hard;
    expect(hard.failed).toBe(1);
    expect(hard.abandoned).toBe(1);
    expect(hard.inProgress).toBe(1);
    expect(hard.played).toBe(3); // untouched in-progress game is not "played"
    expect(hard.winRate).toBe(0);
  });

  it("excludes assisted solves from best time but not from the average", () => {
    expect(stats.byDifficulty.easy.bestTimeMs).toBe(150_000);
    expect(stats.byDifficulty.easy.avgTimeMs).toBe(150_000);
  });

  it("derives totals, streak and activity", () => {
    expect(stats.completed).toBe(5);
    expect(stats.streak).toEqual({ current: 2, best: 2, todayDone: true });
    expect(stats.dailySolved).toBe(2);
    expect(stats.solvedToday).toBe(3);
    expect(stats.solvesByDate["2026-03-10"]).toBe(3);
    expect(stats.dailyDates).toEqual(["2026-03-09", "2026-03-10"]);
  });

  it("is safe with no games", () => {
    const empty = computeStats([], "2026-03-10");
    expect(empty.played).toBe(0);
    expect(empty.winRate).toBe(0);
    expect(empty.bestTimeMs).toBeNull();
    expect(empty.avgTimeMs).toBeNull();
  });
});

describe("achievements", () => {
  const solved = (n: number) => Array.from({ length: n }, () => makeRecord());
  const ids = (games: ReturnType<typeof solved>) =>
    evaluateAchievements(computeStats(games, "2026-03-10"), games)
      .filter((a) => a.earned)
      .map((a) => a.def.id);

  it("starts empty and unlocks milestones", () => {
    expect(ids([])).toEqual([]);
    expect(ids(solved(1))).toContain("first_solve");
    expect(ids(solved(10))).toEqual(expect.arrayContaining(["first_solve", "ten_games", "no_mistakes"]));
    expect(ids(solved(10))).not.toContain("fifty_games");
  });

  it("rewards skill only for the right kind of solve", () => {
    expect(ids([makeRecord({ difficulty: "easy", elapsedMs: 60_000 })])).not.toContain("under_five");
    expect(ids([makeRecord({ difficulty: "hard", elapsedMs: 240_000 })])).toEqual(expect.arrayContaining(["under_five", "perfect_game"]));
    expect(ids([makeRecord({ difficulty: "hard", elapsedMs: 240_000, hintsUsed: 1 })])).not.toContain("under_five");
    expect(ids([makeRecord({ difficulty: "hard", mistakes: 1 })])).not.toContain("perfect_game");
    expect(ids([makeRecord({ difficulty: "expert" })])).toContain("expert_solver");
  });

  it("tracks progress toward streaks and full range", () => {
    const progress = evaluateAchievements(
      computeStats(
        [
          makeRecord({ mode: "daily", dailyDate: "2026-03-09" }),
          makeRecord({ mode: "daily", dailyDate: "2026-03-10" }),
          makeRecord({ difficulty: "easy" }),
        ],
        "2026-03-10",
      ),
      [],
    );
    const streak7 = progress.find((p) => p.def.id === "streak_7")!;
    expect(streak7.current).toBe(2);
    expect(streak7.earned).toBe(false);
  });
});

describe("storage", () => {
  beforeEach(() => clearAllData());

  it("round-trips games, settings, pool and daily puzzles", () => {
    const a = makeRecord({ id: "a" });
    const b = makeRecord({ id: "b", status: "in_progress", completedAt: null, values: samplePuzzle().givens });
    saveFinished([a]);
    saveLive([b]);
    expect(loadFinished()).toEqual([a]);
    expect(loadLive().map((g) => g.id)).toEqual(["b"]);

    saveSettings({ ...DEFAULT_SETTINGS, theme: "dark", mistakeLimit: 5, updatedAt: 99 });
    expect(loadSettings()).toMatchObject({ theme: "dark", mistakeLimit: 5, updatedAt: 99 });

    const p = samplePuzzle();
    savePool({ beginner: [p] });
    expect(loadPool().beginner?.[0]?.givens).toBe(p.givens);
    saveDailyPuzzle("2026-03-10", p);
    expect(loadDailyPuzzle("2026-03-10")?.solution).toBe(p.solution);
    expect(loadDailyPuzzle("2026-03-11")).toBeNull();
  });

  it("falls back to defaults for missing or malformed settings", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    saveSettings({ ...DEFAULT_SETTINGS, theme: "nonsense" as never, mistakeLimit: 42 as never, sound: "yes" as never });
    const s = loadSettings();
    expect(s.theme).toBe("system");
    expect(s.mistakeLimit).toBe(3);
    expect(s.sound).toBe(false);
  });

  it("drops corrupt game records instead of crashing", () => {
    const good = makeRecord({ id: "good" });
    const wrongGivens = { ...makeRecord({ id: "bad1" }), values: "9".repeat(81) };
    const shortGrid = { ...makeRecord({ id: "bad2" }), givens: "123" };
    const badStatus = { ...makeRecord({ id: "bad3" }), status: "winning" };
    saveFinished([good, wrongGivens, shortGrid, badStatus, null, 7] as never);
    expect(loadFinished().map((g) => g.id)).toEqual(["good"]);
    expect(sanitizeGameRecord("nope")).toBeNull();
  });

  it("repairs recoverable damage (bad notes, negative time)", () => {
    const damaged = { ...makeRecord({ id: "r" }), notes: [1, 2, 3], elapsedMs: -5, mistakes: -1 };
    const fixed = sanitizeGameRecord(damaged)!;
    expect(fixed.notes).toHaveLength(81);
    expect(fixed.elapsedMs).toBe(0);
    expect(fixed.mistakes).toBe(0);
  });

  it("deduplicates records by id", () => {
    const g = makeRecord({ id: "same" });
    saveFinished([g, g]);
    expect(loadFinished()).toHaveLength(1);
  });

  it("generates a stable device id", () => {
    const first = loadMeta();
    expect(first.deviceId.length).toBeGreaterThanOrEqual(8);
  });

  it("exports and re-imports everything", () => {
    const bundle = buildExportBundle({
      settings: { ...DEFAULT_SETTINGS, theme: "light" },
      finished: [makeRecord({ id: "x" })],
      live: [makeRecord({ id: "y", status: "in_progress", completedAt: null, values: samplePuzzle().givens })],
      achievements: [{ id: "first_solve", unlockedAt: 5 }],
    });
    const parsed = parseExportBundle(JSON.stringify(bundle))!;
    expect(parsed.finished.map((g) => g.id)).toEqual(["x"]);
    expect(parsed.live.map((g) => g.id)).toEqual(["y"]);
    expect(parsed.settings.theme).toBe("light");
    expect(parsed.achievements).toEqual([{ id: "first_solve", unlockedAt: 5 }]);
    expect(parseExportBundle("not json")).toBeNull();
    expect(parseExportBundle(JSON.stringify({ app: "other", version: 1 }))).toBeNull();
  });

  it("hydrates the library store from disk and keeps loading achievements", () => {
    saveFinished([makeRecord({ id: "h" })]);
    useLibraryStore.getState().reset();
    useLibraryStore.getState().hydrate();
    expect(useLibraryStore.getState().finished.map((g) => g.id)).toEqual(["h"]);
    expect(loadAchievements()).toEqual([]);
  });
});

describe("sync merge rules", () => {
  const live = (over = {}) => makeRecord({ status: "in_progress", completedAt: null, values: samplePuzzle().givens, ...over });

  it("a finished game always beats one still in progress", () => {
    const local = live({ id: "g", updatedAt: 5000 });
    const remote = makeRecord({ id: "g", status: "completed", updatedAt: 1000 });
    expect(resolveGameConflict(local, remote)).toBe(remote);
    expect(resolveGameConflict(remote, local)).toBe(remote);
  });

  it("completed beats failed beats abandoned", () => {
    const completed = makeRecord({ id: "g", status: "completed" });
    const failed = makeRecord({ id: "g", status: "failed" });
    const abandoned = makeRecord({ id: "g", status: "abandoned" });
    expect(resolveGameConflict(failed, completed)).toBe(completed);
    expect(resolveGameConflict(abandoned, failed)).toBe(failed);
  });

  it("between in-progress sessions the latest edit wins", () => {
    const older = live({ id: "g", updatedAt: 1_000 });
    const newer = live({ id: "g", updatedAt: 60_000 });
    expect(resolveGameConflict(older, newer)).toBe(newer);
    expect(resolveGameConflict(newer, older)).toBe(newer);
  });

  it("near-simultaneous sessions keep the one with more progress", () => {
    const puzzle = samplePuzzle();
    const empty = puzzle.givens.indexOf("0");
    const more = puzzle.givens.slice(0, empty) + puzzle.solution[empty] + puzzle.givens.slice(empty + 1);
    const a = live({ id: "g", updatedAt: 10_000, values: puzzle.givens });
    const b = live({ id: "g", updatedAt: 10_500, values: more });
    expect(resolveGameConflict(a, b)).toBe(b);
    expect(resolveGameConflict(b, a)).toBe(b);
  });

  it("merges lists: adopts new remote games, keeps local-only ones for pushing", () => {
    const localOnly = makeRecord({ id: "local-only" });
    const shared = makeRecord({ id: "shared", syncedAt: 1_700_000_300_000 });
    const remoteOnly = makeRecord({ id: "remote-only" });
    const remoteShared = makeRecord({ id: "shared" });
    const { merged, adopted, toPush } = mergeGameLists([localOnly, shared], [remoteOnly, remoteShared]);
    expect(merged.map((g) => g.id).sort()).toEqual(["local-only", "remote-only", "shared"]);
    expect(adopted.map((g) => g.id)).toEqual(["remote-only"]);
    expect(toPush.map((g) => g.id)).toEqual(["local-only"]);
  });

  it("adopts a newer remote in-progress session and pushes a newer local one", () => {
    const l = live({ id: "g", updatedAt: 1_000 });
    const r = live({ id: "g", updatedAt: 90_000 });
    expect(mergeGameLists([l], [r]).adopted.map((g) => g.id)).toEqual(["g"]);
    const result = mergeGameLists([r], [l]);
    expect(result.adopted).toHaveLength(0);
    expect(result.toPush.map((g) => g.id)).toEqual(["g"]);
  });

  it("never loses a solve: remote completion replaces a local in-progress copy", () => {
    const l = live({ id: "g", updatedAt: 99_000 });
    const r = makeRecord({ id: "g", updatedAt: 1_000 });
    const { merged } = mergeGameLists([l], [r]);
    expect(merged[0]!.status).toBe("completed");
  });

  it("settings: last write wins", () => {
    const local = { ...DEFAULT_SETTINGS, theme: "dark" as const, updatedAt: 10 };
    const remote = { ...DEFAULT_SETTINGS, theme: "light" as const, updatedAt: 20 };
    expect(mergeSettings(local, remote).settings.theme).toBe("light");
    expect(mergeSettings(remote, local).settings.theme).toBe("light");
    expect(mergeSettings(local, null).settings).toBe(local);
  });

  it("achievements: union keeping the earliest unlock", () => {
    const merged = mergeAchievements(
      [{ id: "a", unlockedAt: 50 }],
      [
        { id: "a", unlockedAt: 10 },
        { id: "b", unlockedAt: 20 },
      ],
    );
    expect(merged).toEqual([
      { id: "a", unlockedAt: 10 },
      { id: "b", unlockedAt: 20 },
    ]);
  });
});
