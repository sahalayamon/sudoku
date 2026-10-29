"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { ShortcutsDialog } from "@/components/sudoku/ShortcutsDialog";
import { Toaster } from "@/components/ui/Toaster";
import { Onboarding } from "@/features/onboarding/Onboarding";
import { isNativePlatform } from "@/lib/native/platform";
import { initNativeMirror } from "@/lib/storage/native-mirror";
import { scheduleRefill } from "@/features/puzzle/service";
import { startSyncController } from "@/lib/sync/controller";
import { applyPalette, applyTheme } from "@/lib/theme";
import { useGameStore } from "@/stores/game";
import { useLibraryStore } from "@/stores/library";
import { useMetaStore } from "@/stores/meta";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { NativeBridge } from "./NativeBridge";
import { OfflineBanner } from "./OfflineBanner";
import { Splash } from "./Splash";

const loadMotionFeatures = () => import("./motionFeatures").then((m) => m.default);

/**
 * Boots the client: loads local data, applies the theme, wires page lifecycle
 * (auto-pause, flush on hide), registers the service worker and starts sync.
 * Children render only once local data is available, behind a branded splash.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  // Ready once every persisted store has been loaded from disk.
  const settingsReady = useSettingsStore((s) => s.hydrated);
  const metaReady = useMetaStore((s) => s.hydrated);
  const libraryReady = useLibraryStore((s) => s.hydrated);
  const ready = settingsReady && metaReady && libraryReady;
  const [splashGone, setSplashGone] = useState(false);
  const theme = useSettingsStore((s) => s.theme);
  const palette = useSettingsStore((s) => s.palette);

  // 1. Hydrate local data.
  useEffect(() => {
    let alive = true;
    void (async () => {
      // In the native app, first restore anything the web view lost from the phone's own storage.
      await initNativeMirror();
      if (!alive) return;
      useSettingsStore.getState().hydrate();
      useMetaStore.getState().hydrate();
      useLibraryStore.getState().hydrate();
      useUiStore.getState().setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Ask the browser not to evict our data under storage pressure (the native app has its own copy).
  useEffect(() => {
    if (!isNativePlatform()) void navigator.storage?.persist?.();
  }, []);

  // Fade the splash out with CSS, then unmount it.
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setSplashGone(true), 360);
    return () => window.clearTimeout(t);
  }, [ready]);

  // Visual-QA helpers exist only in development builds.
  useEffect(() => {
    if (process.env.NODE_ENV === "development") void import("@/lib/dev").then((m) => m.installDevTools());
  }, []);

  // Accent palette.
  useEffect(() => {
    if (ready) applyPalette(palette);
  }, [ready, palette]);

  // 2. Theme (and follow the OS when set to "system").
  useEffect(() => {
    if (!ready) return;
    applyTheme(theme);
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [ready, theme]);

  // 3. Page lifecycle: pause when hidden, never lose the last moves.
  useEffect(() => {
    if (!ready) return;
    const onVisibility = () => useGameStore.getState().onVisibility(!document.hidden);
    const onHide = () => useGameStore.getState().flushSave();
    const heartbeat = window.setInterval(() => {
      const g = useGameStore.getState();
      if (g.phase === "playing" && !g.paused) g.flushSave(true);
    }, 10_000);
    const onOnline = () => useUiStore.getState().setOnline(true);
    const onOffline = () => useUiStore.getState().setOnline(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(heartbeat);
    };
  }, [ready]);

  // 4. Background work: sync and puzzle pre-generation.
  useEffect(() => {
    if (!ready) return;
    startSyncController();
    scheduleRefill();
  }, [ready]);

  // 5. Offline support.
  useEffect(() => {
    // Inside a Capacitor shell the assets are already bundled in the app, so no service worker is needed.
    const native = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
    if (!ready || native || process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reloading = false;
    let userRequested = false;
    const onControllerChange = () => {
      if (userRequested && !reloading) {
        reloading = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        const offerUpdate = (worker: ServiceWorker) =>
          useUiStore.getState().toast("A new version is ready", {
            duration: 12_000,
            action: {
              label: "Update",
              onClick: () => {
                userRequested = true;
                worker.postMessage({ type: "SKIP_WAITING" });
              },
            },
          });
        if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
          });
        });
      })
      .catch(() => undefined);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, [ready]);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
        {ready ? children : null}
        {!splashGone ? <Splash leaving={ready} /> : null}
        {ready ? (
          <>
            <Onboarding />
            <ShortcutsDialog />
          </>
        ) : null}
        {ready && isNativePlatform() ? <NativeBridge /> : null}
        <Toaster />
        <OfflineBanner />
      </LazyMotion>
    </MotionConfig>
  );
}
