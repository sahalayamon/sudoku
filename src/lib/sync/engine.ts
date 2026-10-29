import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeAchievements, sanitizeSettings } from "@/lib/storage/sanitize";
import { useGameStore } from "@/stores/game";
import { useLibraryStore } from "@/stores/library";
import { useMetaStore } from "@/stores/meta";
import { getSettingsSnapshot, useSettingsStore } from "@/stores/settings";
import type { GameRecord } from "@/types/game";
import { mergeSettings } from "./merge";
import { recordToPayload, rowToRecord, type RemoteGameRow } from "./mapping";

const PAGE_SIZE = 200;
const GAME_COLUMNS =
  "id, mode, daily_date, status, difficulty, elapsed_ms, mistakes, mistake_limit, hints_used, moves, started_at, completed_at, updated_at, received_at, puzzles(givens, score, seed), game_sessions(board, notes, paused)";

/** Errors that will never succeed on retry (the server judged the data itself invalid). */
const PERMANENT = /(invalid_puzzle|invalid_solution|invalid_board|implausible_time|daily_mismatch|invalid_daily|forbidden)/;

export interface SyncSummary {
  pushed: number;
  pulled: number;
  rejected: number;
}

/**
 * One full sync pass: pull remote changes, merge with conflict rules, push what the
 * server lacks, then reconcile settings and achievements. Local data is never
 * overwritten by something older, and a finished game is never replaced by an
 * unfinished copy.
 */
export async function performSync(supabase: SupabaseClient, userId: string): Promise<SyncSummary> {
  const meta = useMetaStore.getState();
  const game = useGameStore.getState();
  const activeId = game.screenActive && game.phase === "playing" ? game.id : null;

  /* ---- pull games ---- */
  let cursor = meta.lastPulledAt ?? "1970-01-01T00:00:00.000Z";
  let newest = cursor;
  const remote: GameRecord[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from("games")
      .select(GAME_COLUMNS)
      .gt("received_at", cursor)
      .order("received_at", { ascending: true })
      .limit(PAGE_SIZE);
    if (error) throw error;
    const rows = (data ?? []) as unknown as RemoteGameRow[];
    for (const row of rows) {
      if (row.received_at > newest) newest = row.received_at;
      const record = rowToRecord(row);
      // Never swap the board out from under a player mid-game.
      if (record && record.id !== activeId) remote.push(record);
    }
    if (rows.length < PAGE_SIZE) break;
    cursor = rows[rows.length - 1]!.received_at;
  }

  const library = useLibraryStore.getState();
  const merged = library.mergeRemote(remote);

  /* ---- push games ---- */
  let pushed = 0;
  let rejected = 0;
  const acknowledged: { id: string; syncedAt: number }[] = [];
  for (const record of merged.toPush) {
    const { error } = await supabase.rpc("sync_game", { p: recordToPayload(record, meta.deviceId) });
    if (error) {
      if (PERMANENT.test(error.message)) {
        rejected++;
        acknowledged.push({ id: record.id, syncedAt: record.updatedAt });
        continue;
      }
      throw error;
    }
    pushed++;
    acknowledged.push({ id: record.id, syncedAt: record.updatedAt });
  }
  useLibraryStore.getState().markSynced(acknowledged);

  /* ---- settings (last write wins) ---- */
  const { data: settingsRow, error: settingsError } = await supabase.from("user_settings").select("settings, updated_at").maybeSingle();
  if (settingsError) throw settingsError;
  const local = getSettingsSnapshot();
  const remoteSettings = settingsRow
    ? sanitizeSettings({
        ...(settingsRow.settings as Record<string, unknown>),
        updatedAt: (settingsRow.settings as { updatedAt?: number })?.updatedAt ?? Date.parse(settingsRow.updated_at as string),
      })
    : null;
  const mergedSettings = mergeSettings(local, remoteSettings);
  if (mergedSettings.remoteIsNewer) {
    useSettingsStore.getState().replace(mergedSettings.settings);
  } else if (local.updatedAt > 0 && (!remoteSettings || local.updatedAt > remoteSettings.updatedAt)) {
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, settings: local, updated_at: new Date(local.updatedAt).toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
  }

  /* ---- achievements (union) ---- */
  const { data: achievementRows, error: achievementError } = await supabase.from("achievements").select("achievement_id, unlocked_at");
  if (achievementError) throw achievementError;
  const remoteAchievements = sanitizeAchievements(
    (achievementRows ?? []).map((r) => ({ id: r.achievement_id as string, unlockedAt: Date.parse(r.unlocked_at as string) })),
  );
  useLibraryStore.getState().mergeAchievementList(remoteAchievements);
  useLibraryStore.getState().reevaluateAchievements();
  const known = new Set(remoteAchievements.map((a) => a.id));
  const missing = useLibraryStore.getState().achievements.filter((a) => !known.has(a.id));
  if (missing.length) {
    const { error } = await supabase.from("achievements").upsert(
      missing.map((a) => ({ user_id: userId, achievement_id: a.id, unlocked_at: new Date(a.unlockedAt).toISOString() })),
      { onConflict: "user_id,achievement_id", ignoreDuplicates: true },
    );
    if (error && !PERMANENT.test(error.message)) throw error;
  }

  useMetaStore.getState().patch({ lastPulledAt: newest, lastSyncedAt: Date.now() });
  return { pushed, pulled: merged.adopted.length, rejected };
}
