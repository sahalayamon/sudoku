"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { registerNativeHaptics } from "@/lib/feedback/haptics";
import { isNativePlatform } from "@/lib/native/platform";
import { flushNativeMirror } from "@/lib/storage/native-mirror";
import { resolveTheme } from "@/lib/theme";
import { useGameStore } from "@/stores/game";
import { useSettingsStore } from "@/stores/settings";

/**
 * Everything that only makes sense inside the Android/iOS app: the hardware back button,
 * app lifecycle (save and pause when the app is sent to the background), native haptics,
 * system-bar icon colours and the launch splash. It renders nothing and is only mounted
 * inside the native shell, so none of the native plugins load in the browser build.
 */
export function NativeBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  // Lifecycle, back button, haptics, splash.
  useEffect(() => {
    if (!isNativePlatform()) return;
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    const closeOverlay = (): boolean => {
      const overlay = document.querySelector<HTMLElement>('[role="dialog"], [role="menu"]');
      if (!overlay) return false;
      overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      return true;
    };

    void (async () => {
      const [{ App }, { Haptics, ImpactStyle, NotificationType }, { SplashScreen }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/haptics"),
        import("@capacitor/splash-screen"),
      ]);
      if (cancelled) return;

      registerNativeHaptics((name) => {
        if (name === "light") void Haptics.impact({ style: ImpactStyle.Light });
        else void Haptics.notification({ type: name === "success" ? NotificationType.Success : NotificationType.Error });
      });

      const state = await App.addListener("appStateChange", ({ isActive }) => {
        const game = useGameStore.getState();
        game.onVisibility(isActive);
        if (!isActive) {
          // Going to the background: make sure nothing is lost if the system then stops the app.
          game.flushSave();
          void flushNativeMirror();
        }
      });
      const back = await App.addListener("backButton", () => {
        if (closeOverlay()) return;
        if (pathRef.current === "/" || pathRef.current === "") {
          void App.exitApp();
        } else if (window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      });
      if (cancelled) {
        void state.remove();
        void back.remove();
        return;
      }
      cleanups.push(
        () => void state.remove(),
        () => void back.remove(),
      );

      await SplashScreen.hide({ fadeOutDuration: 200 });
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [router]);

  // Status and navigation bar icons follow the theme (dark icons on a light page, light icons on a dark one).
  useEffect(() => {
    if (!isNativePlatform()) return;
    let cancelled = false;
    const apply = async () => {
      const { SystemBars, SystemBarsStyle } = await import("@capacitor/core");
      if (cancelled) return;
      await SystemBars.setStyle({ style: resolveTheme(theme) === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
    };
    void apply();
    if (theme !== "system") return () => void (cancelled = true);
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => void apply();
    query.addEventListener("change", onChange);
    return () => {
      cancelled = true;
      query.removeEventListener("change", onChange);
    };
  }, [theme]);

  return null;
}
