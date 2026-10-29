import { create } from "zustand";
import { dateKey } from "@/lib/date";
import { loadAchievements, loadFinished, loadLive, saveAchievements, saveFinished, saveLive } from "@/lib/storage/repository";
import { mergeAchievements, mergeGameLists, type GameMergeResult } from "@/lib/sync/merge";
import { evaluateAchievements } from "@/features/achievements/definitions";
import { computeStats, computeStreaks } from "@/features/statistics/compute";
import type { AchievementUnlock } from "@/types/settings";
import type { CompletionSummary, GameRecord } from "@/types/game";

export type FinishInfo = Pick<CompletionSummary, "isPersonalBest" | "isFirstAtDifficulty" | "previousBestMs" | "daily" | "newAchievements">;

interface LibraryStore {
  hydrated: boolean;
  /** Completed, failed and abandoned games, newest first. */
  finished: GameRecord[];
  /** Games still in progress, most recently played first. */
  live: GameRecord[];
  achievements: AchievementUnlock[];

  hydrate: () => void;
  upsertLive: (record: GameRecord) => void;
  removeLive: (id: string) => void;
  /** Delete a finished game from this device's history. */
  removeFinished: (id: string) => void;
  /** Move a game out of `live` into history with its final state. */
  recordFinished: (record: GameRecord) => FinishInfo;
  /** Leave a started game behind: kept in history as abandoned. Untouched games are simply dropped. */
  abandonLive: (id: string) => void;
  /** Merge records from sync or import, resolving conflicts. */
  mergeRemote: (remote: GameRecord[]) => GameMergeResult;
  mergeAchievementList: (remote: AchievementUnlock[]) => void;
  /** Unlock anything the current history already qualifies for (after sync/import). */
  reevaluateAchievements: () => string[];
  markSynced: (items: { id: string; syncedAt: number }[]) => void;
  reset: () => void;
}

const finishedSort = (a: GameRecord, b: GameRecord) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt);
const liveSort = (a: GameRecord, b: GameRecord) => b.updatedAt - a.updatedAt;

function stripLive(record: GameRecord): GameRecord {
  const { history: _h, future: _f, paused: _p, ...rest } = record;
  void [_h, _f, _p];
  return rest;
}

function partition(records: GameRecord[]): { finished: GameRecord[]; live: GameRecord[] } {
  const finished: GameRecord[] = [];
  const live: GameRecord[] = [];
  for (const r of records) (r.status === "in_progress" ? live : finished).push(r.status === "in_progress" ? r : stripLive(r));
  return { finished: finished.sort(finishedSort), live: live.sort(liveSort) };
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  hydrated: false,
  finished: [],
  live: [],
  achievements: [],

  hydrate: () => {
    set({
      finished: loadFinished().sort(finishedSort),
      live: loadLive().sort(liveSort),
      achievements: loadAchievements(),
      hydrated: true,
    });
  },

  upsertLive: (record) => {
    const live = [record, ...get().live.filter((g) => g.id !== record.id)].sort(liveSort);
    set({ live });
    saveLive(live);
  },

  removeLive: (id) => {
    const live = get().live.filter((g) => g.id !== id);
    set({ live });
    saveLive(live);
  },

  removeFinished: (id) => {
    const finished = get().finished.filter((g) => g.id !== id);
    set({ finished });
    saveFinished(finished);
  },

  recordFinished: (incoming) => {
    const record = stripLive(incoming);
    const { finished, live, achievements } = get();
    const today = dateKey();
    const prior = [...finished, ...live].filter((g) => g.id !== record.id);

    const info: FinishInfo = {
      isPersonalBest: false,
      isFirstAtDifficulty: false,
      previousBestMs: null,
      daily: null,
      newAchievements: [],
    };

    const nextFinished = [record, ...finished.filter((g) => g.id !== record.id)].sort(finishedSort);
    const nextLive = live.filter((g) => g.id !== record.id);

    let nextAchievements = achievements;
    if (record.status === "completed") {
      const sameLevel = prior.filter((g) => g.status === "completed" && g.difficulty === record.difficulty);
      const clean = sameLevel.filter((g) => g.hintsUsed === 0);
      const previousBest = clean.length ? Math.min(...clean.map((g) => g.elapsedMs)) : null;
      info.previousBestMs = previousBest;
      info.isFirstAtDifficulty = sameLevel.length === 0;
      info.isPersonalBest = record.hintsUsed === 0 && previousBest !== null && record.elapsedMs < previousBest;

      if (record.mode === "daily" && record.dailyDate) {
        const before = computeStreaks(
          prior.filter((g) => g.status === "completed" && g.mode === "daily" && g.dailyDate).map((g) => g.dailyDate as string),
          today,
        );
        const after = computeStreaks(
          [...prior, record].filter((g) => g.status === "completed" && g.mode === "daily" && g.dailyDate).map((g) => g.dailyDate as string),
          today,
        );
        info.daily = {
          date: record.dailyDate,
          streak: after.current,
          bestStreak: after.best,
          streakIncreased: after.current > before.current,
        };
      }

      const all = [...nextFinished, ...nextLive];
      const earned = evaluateAchievements(computeStats(all, today), all).filter((a) => a.earned);
      const known = new Set(achievements.map((a) => a.id));
      const fresh = earned.filter((a) => !known.has(a.def.id));
      if (fresh.length) {
        const now = Date.now();
        nextAchievements = [...achievements, ...fresh.map((a) => ({ id: a.def.id, unlockedAt: now }))];
        info.newAchievements = fresh.map((a) => a.def.id);
      }
    }

    set({ finished: nextFinished, live: nextLive, achievements: nextAchievements });
    saveFinished(nextFinished);
    saveLive(nextLive);
    if (nextAchievements !== achievements) saveAchievements(nextAchievements);
    return info;
  },

  abandonLive: (id) => {
    const { finished, live } = get();
    const record = live.find((g) => g.id === id);
    if (!record) return;
    const nextLive = live.filter((g) => g.id !== id);
    let nextFinished = finished;
    if (record.moves > 0) {
      nextFinished = [stripLive({ ...record, status: "abandoned", updatedAt: Date.now() }), ...finished].sort(finishedSort);
    }
    set({ finished: nextFinished, live: nextLive });
    saveLive(nextLive);
    if (nextFinished !== finished) saveFinished(nextFinished);
  },

  mergeRemote: (remote) => {
    const { finished, live } = get();
    const result = mergeGameLists([...finished, ...live], remote);
    const next = partition(result.merged);
    set(next);
    saveFinished(next.finished);
    saveLive(next.live);
    return result;
  },

  mergeAchievementList: (remote) => {
    const merged = mergeAchievements(get().achievements, remote);
    set({ achievements: merged });
    saveAchievements(merged);
  },

  reevaluateAchievements: () => {
    const { finished, live, achievements } = get();
    const all = [...finished, ...live];
    const earned = evaluateAchievements(computeStats(all, dateKey()), all).filter((a) => a.earned);
    const known = new Set(achievements.map((a) => a.id));
    const fresh = earned.filter((a) => !known.has(a.def.id));
    if (!fresh.length) return [];
    const now = Date.now();
    const next = [...achievements, ...fresh.map((a) => ({ id: a.def.id, unlockedAt: now }))];
    set({ achievements: next });
    saveAchievements(next);
    return fresh.map((a) => a.def.id);
  },

  markSynced: (items) => {
    if (!items.length) return;
    const map = new Map(items.map((i) => [i.id, i.syncedAt]));
    const patch = (g: GameRecord): GameRecord => (map.has(g.id) ? { ...g, syncedAt: map.get(g.id)! } : g);
    const { finished, live } = get();
    const nextFinished = finished.map(patch);
    const nextLive = live.map(patch);
    set({ finished: nextFinished, live: nextLive });
    saveFinished(nextFinished);
    saveLive(nextLive);
  },

  reset: () => {
    set({ finished: [], live: [], achievements: [] });
  },
}));
