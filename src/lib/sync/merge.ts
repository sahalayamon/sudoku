import type { AchievementUnlock, Settings } from "@/types/settings";
import type { GameRecord, GameStatus } from "@/types/game";

/**
 * Pure conflict-resolution rules used when local and remote copies of the same
 * data meet (sync, import). Nothing here touches the network or storage.
 */

const STATUS_RANK: Record<GameStatus, number> = {
  in_progress: 0,
  abandoned: 1,
  failed: 2,
  completed: 3,
};

export function filledCells(record: GameRecord): number {
  let n = 0;
  for (let i = 0; i < 81; i++) if (record.values[i] !== "0") n++;
  return n;
}

/** Two sessions edited within this window are treated as "at the same time". */
const TIE_WINDOW_MS = 2000;

/**
 * Pick the version of one game that should survive.
 * - A finished game always beats one still in progress (a solve is never lost).
 * - Between finished states: completed > failed > abandoned.
 * - Between two in-progress sessions: the most recently updated wins; if they are
 *   within a couple of seconds, the one with more progress wins.
 */
export function resolveGameConflict(local: GameRecord, remote: GameRecord): GameRecord {
  const lr = STATUS_RANK[local.status];
  const rr = STATUS_RANK[remote.status];
  if (lr !== rr) return lr > rr ? local : remote;

  if (local.status !== "in_progress") {
    // Same terminal status: keep the earlier completion, it is the original record.
    const lt = local.completedAt ?? local.updatedAt;
    const rt = remote.completedAt ?? remote.updatedAt;
    return lt <= rt ? local : remote;
  }

  const delta = local.updatedAt - remote.updatedAt;
  if (Math.abs(delta) > TIE_WINDOW_MS) return delta > 0 ? local : remote;
  const lf = filledCells(local);
  const rf = filledCells(remote);
  if (lf !== rf) return lf > rf ? local : remote;
  return local.elapsedMs >= remote.elapsedMs ? local : remote;
}

export interface GameMergeResult {
  merged: GameRecord[];
  /** Records whose content came from the remote side (new or replaced). */
  adopted: GameRecord[];
  /** Local records that are newer than what the server has and need pushing. */
  toPush: GameRecord[];
}

export function mergeGameLists(local: readonly GameRecord[], remote: readonly GameRecord[]): GameMergeResult {
  const byId = new Map<string, GameRecord>(local.map((g) => [g.id, g]));
  const adoptedIds = new Set<string>();

  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l) {
      byId.set(r.id, { ...r, syncedAt: r.updatedAt });
      adoptedIds.add(r.id);
      continue;
    }
    const winner = resolveGameConflict(l, r);
    const sameVersion = l.status === r.status && l.updatedAt === r.updatedAt;
    if (winner === r && !sameVersion) {
      byId.set(r.id, { ...r, syncedAt: r.updatedAt });
      adoptedIds.add(r.id);
    } else if (r.status === l.status && r.updatedAt >= l.updatedAt) {
      // The server already holds this exact (or a newer-stamped identical) version.
      byId.set(l.id, { ...l, syncedAt: Math.max(l.syncedAt ?? 0, l.updatedAt) });
    }
  }

  const merged = [...byId.values()];
  return {
    merged,
    adopted: merged.filter((g) => adoptedIds.has(g.id)),
    toPush: merged.filter((g) => !adoptedIds.has(g.id) && (g.syncedAt ?? -1) < g.updatedAt),
  };
}

/** Last write wins for settings. */
export function mergeSettings(local: Settings, remote: Settings | null): { settings: Settings; remoteIsNewer: boolean } {
  if (!remote) return { settings: local, remoteIsNewer: false };
  const remoteIsNewer = remote.updatedAt > local.updatedAt;
  return { settings: remoteIsNewer ? remote : local, remoteIsNewer };
}

/** Union by id, keeping the earliest unlock time. */
export function mergeAchievements(a: readonly AchievementUnlock[], b: readonly AchievementUnlock[]): AchievementUnlock[] {
  const map = new Map<string, AchievementUnlock>();
  for (const item of [...a, ...b]) {
    const existing = map.get(item.id);
    if (!existing || item.unlockedAt < existing.unlockedAt) map.set(item.id, item);
  }
  return [...map.values()].sort((x, y) => x.unlockedAt - y.unlockedAt);
}
