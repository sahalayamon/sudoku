import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import { clearAllData } from "@/lib/storage/repository";
import { performSync } from "@/lib/sync/engine";
import type { RemoteGameRow } from "@/lib/sync/mapping";
import { useGameStore } from "@/stores/game";
import { useLibraryStore } from "@/stores/library";
import { useMetaStore } from "@/stores/meta";
import { getSettingsSnapshot, useSettingsStore } from "@/stores/settings";
import { DEFAULT_SETTINGS } from "@/types/settings";
import { makeRecord, samplePuzzle } from "./helpers";

interface FakeOptions {
  games?: RemoteGameRow[];
  settings?: { settings: Record<string, unknown>; updated_at: string } | null;
  achievements?: { achievement_id: string; unlocked_at: string }[];
  rpcError?: (payload: Record<string, unknown>) => { message: string } | null;
}

/** Just enough of the Supabase client surface for performSync. */
function fakeSupabase(options: FakeOptions = {}) {
  const calls = { rpc: [] as { name: string; payload: Record<string, unknown> }[], upserts: [] as { table: string; value: unknown }[] };
  const from = (table: string) => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      gt: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: table === "user_settings" ? (options.settings ?? null) : null, error: null }),
      upsert: async (value: unknown) => {
        calls.upserts.push({ table, value });
        return { error: null };
      },
      then: (resolve: (v: unknown) => void) =>
        resolve({
          data: table === "games" ? (options.games ?? []) : table === "achievements" ? (options.achievements ?? []) : [],
          error: null,
        }),
    };
    return chain;
  };
  const rpc = async (name: string, args: { p: Record<string, unknown> }) => {
    calls.rpc.push({ name, payload: args.p });
    const error = options.rpcError?.(args.p) ?? null;
    return error ? { data: null, error } : { data: { ok: true }, error: null };
  };
  return { client: { from, rpc } as unknown as SupabaseClient, calls };
}

const puzzle = samplePuzzle();

function remoteRow(id: string, over: Partial<RemoteGameRow> = {}): RemoteGameRow {
  return {
    id,
    mode: "standard",
    daily_date: null,
    status: "completed",
    difficulty: "beginner",
    elapsed_ms: 200_000,
    mistakes: 0,
    mistake_limit: 3,
    hints_used: 0,
    moves: 40,
    started_at: "2026-03-10T09:00:00.000Z",
    completed_at: "2026-03-10T09:05:00.000Z",
    updated_at: "2026-03-10T09:05:00.000Z",
    received_at: "2026-03-10T09:05:01.000Z",
    puzzles: { givens: puzzle.givens, score: 10, seed: "s" },
    game_sessions: null,
    ...over,
  };
}

beforeEach(() => {
  clearAllData();
  useLibraryStore.getState().reset();
  useGameStore.getState().reset();
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: true });
  useMetaStore.getState().reset();
});

describe("performSync", () => {
  it("pushes local games the server lacks and marks them synced", async () => {
    const local = makeRecord({ id: "local-1" });
    useLibraryStore.getState().recordFinished(local);
    const { client, calls } = fakeSupabase();
    const summary = await performSync(client, "user-1");
    expect(summary).toMatchObject({ pushed: 1, pulled: 0, rejected: 0 });
    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0]!.name).toBe("sync_game");
    expect(calls.rpc[0]!.payload).toMatchObject({ id: "local-1", status: "completed", device_id: useMetaStore.getState().deviceId });
    const stored = useLibraryStore.getState().finished.find((g) => g.id === "local-1")!;
    expect(stored.syncedAt).toBe(stored.updatedAt);

    // A second pass has nothing left to send.
    const again = await performSync(client, "user-1");
    expect(again.pushed).toBe(0);
  });

  it("adopts games from another device and records the pull cursor", async () => {
    const { client, calls } = fakeSupabase({ games: [remoteRow("11111111-1111-4111-8111-111111111111")] });
    const summary = await performSync(client, "user-1");
    expect(summary.pulled).toBe(1);
    expect(calls.rpc).toHaveLength(0);
    expect(useLibraryStore.getState().finished.map((g) => g.id)).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(useMetaStore.getState().lastPulledAt).toBe("2026-03-10T09:05:01.000Z");
    expect(useMetaStore.getState().lastSyncedAt).not.toBeNull();
  });

  it("a remote solve replaces a local in-progress copy and is not pushed back", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    useLibraryStore.getState().upsertLive(
      makeRecord({
        id,
        status: "in_progress",
        completedAt: null,
        values: puzzle.givens,
        updatedAt: Date.parse("2026-03-10T09:06:00.000Z"),
      }),
    );
    const { client, calls } = fakeSupabase({ games: [remoteRow(id)] });
    await performSync(client, "user-1");
    const lib = useLibraryStore.getState();
    expect(lib.live.find((g) => g.id === id)).toBeUndefined();
    expect(lib.finished.find((g) => g.id === id)?.status).toBe("completed");
    expect(calls.rpc).toHaveLength(0);
  });

  it("leaves the game being played untouched", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const game = useGameStore.getState();
    game.attach();
    game.loadNew(puzzle, "standard");
    const activeId = useGameStore.getState().id;
    const { client } = fakeSupabase({ games: [remoteRow(activeId, { status: "completed" })] });
    await performSync(client, "user-1");
    expect(useGameStore.getState().phase).toBe("playing");
    expect(useLibraryStore.getState().finished.find((g) => g.id === activeId)).toBeUndefined();
    expect(id).toBeTruthy();
    game.detach();
  });

  it("treats server-rejected games as final instead of retrying forever", async () => {
    useLibraryStore.getState().recordFinished(makeRecord({ id: "bad-1" }));
    const { client } = fakeSupabase({ rpcError: () => ({ message: "implausible_time" }) });
    const summary = await performSync(client, "user-1");
    expect(summary.rejected).toBe(1);
    expect(summary.pushed).toBe(0);
    const { client: second, calls } = fakeSupabase();
    await performSync(second, "user-1");
    expect(calls.rpc).toHaveLength(0);
  });

  it("surfaces transient failures and keeps the game queued", async () => {
    useLibraryStore.getState().recordFinished(makeRecord({ id: "retry-1" }));
    const { client } = fakeSupabase({ rpcError: () => ({ message: "fetch failed" }) });
    await expect(performSync(client, "user-1")).rejects.toMatchObject({ message: "fetch failed" });
    const { client: ok, calls } = fakeSupabase();
    await performSync(ok, "user-1");
    expect(calls.rpc).toHaveLength(1);
  });

  it("pushes newer local settings and pulls newer remote ones", async () => {
    useSettingsStore.getState().update({ theme: "dark" });
    const pushed = fakeSupabase({ settings: null });
    await performSync(pushed.client, "user-1");
    expect(pushed.calls.upserts.find((u) => u.table === "user_settings")).toBeTruthy();

    const remoteUpdated = Date.now() + 60_000;
    const pulled = fakeSupabase({
      settings: {
        settings: { ...DEFAULT_SETTINGS, theme: "light", mistakeLimit: 5, updatedAt: remoteUpdated },
        updated_at: new Date(remoteUpdated).toISOString(),
      },
    });
    await performSync(pulled.client, "user-1");
    expect(getSettingsSnapshot()).toMatchObject({ theme: "light", mistakeLimit: 5 });
    expect(pulled.calls.upserts.find((u) => u.table === "user_settings")).toBeUndefined();
  });

  it("unions achievements both ways", async () => {
    useLibraryStore.getState().recordFinished(makeRecord({ id: "ach-1" })); // unlocks first_solve locally
    const { client, calls } = fakeSupabase({
      achievements: [{ achievement_id: "expert_solver", unlocked_at: "2026-01-01T00:00:00.000Z" }],
    });
    await performSync(client, "user-1");
    const ids = useLibraryStore.getState().achievements.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["first_solve", "expert_solver"]));
    const upload = calls.upserts.find((u) => u.table === "achievements")!.value as { achievement_id: string }[];
    expect(upload.map((a) => a.achievement_id)).toContain("first_solve");
    expect(upload.map((a) => a.achievement_id)).not.toContain("expert_solver");
  });
});
