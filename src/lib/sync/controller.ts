import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth";
import { useGameStore } from "@/stores/game";
import { useLibraryStore } from "@/stores/library";
import { useMetaStore } from "@/stores/meta";
import { useUiStore } from "@/stores/ui";
import { performSync } from "./engine";

/**
 * Decides *when* to sync. The engine decides *what*. Sync never blocks play:
 * it runs in the background, backs off when offline, and every trigger is
 * debounced into a single pass.
 */

let inFlight: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let syncedBadge: ReturnType<typeof setTimeout> | null = null;

const STALE_AFTER_MS = 60_000;

export function scheduleSync(delay = 1500): void {
  if (typeof window === "undefined" || !isSupabaseConfigured) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void runSync(), delay);
}

export function runSync(): Promise<void> {
  if (inFlight) return inFlight;
  const auth = useAuthStore.getState();
  const ui = useUiStore.getState();
  if (!isSupabaseConfigured || auth.status !== "signed_in" || !auth.user) return Promise.resolve();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    ui.setSync("offline");
    return Promise.resolve();
  }

  const userId = auth.user.id;
  inFlight = (async () => {
    useUiStore.getState().setSync("syncing");
    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      await performSync(supabase, userId);
      useUiStore.getState().setSync("synced");
      if (syncedBadge) clearTimeout(syncedBadge);
      syncedBadge = setTimeout(() => {
        if (useUiStore.getState().syncPhase === "synced") useUiStore.getState().setSync("idle");
      }, 2800);
    } catch (error) {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      useUiStore.getState().setSync(offline ? "offline" : "error", offline ? null : error instanceof Error ? error.message : "Sync failed");
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Hook everything up once, after the stores have been hydrated. */
export function startSyncController(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  if (!isSupabaseConfigured) {
    useUiStore.getState().setSync("disabled");
    return;
  }
  useUiStore.getState().setSync("signed_out");
  void useAuthStore.getState().init();

  useAuthStore.subscribe((state, prev) => {
    if (state.status === "signed_in" && prev.status !== "signed_in") scheduleSync(0);
  });

  window.addEventListener("online", () => {
    useUiStore.getState().setOnline(true);
    scheduleSync(600);
  });
  window.addEventListener("offline", () => {
    useUiStore.getState().setOnline(false);
    if (useAuthStore.getState().status === "signed_in") useUiStore.getState().setSync("offline");
  });

  document.addEventListener("visibilitychange", () => {
    if (useAuthStore.getState().status !== "signed_in") return;
    if (document.hidden) {
      scheduleSync(0); // push the latest board before the page may be frozen
    } else {
      const last = useMetaStore.getState().lastSyncedAt ?? 0;
      if (Date.now() - last > STALE_AFTER_MS) scheduleSync(800);
    }
  });

  // A finished game is worth syncing promptly.
  useLibraryStore.subscribe((state, prev) => {
    if (state.finished !== prev.finished && useAuthStore.getState().status === "signed_in") scheduleSync(2000);
  });
  // Leaving the play screen: push the paused board so another device can pick it up.
  useGameStore.subscribe((state, prev) => {
    if (prev.screenActive && !state.screenActive && useAuthStore.getState().status === "signed_in") scheduleSync(1500);
  });
}
