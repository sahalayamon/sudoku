/**
 * Haptics behind one small interface. The web implementation uses the Vibration
 * API (Android browsers). Inside the native app the shell registers the Capacitor
 * Haptics plugin here (see NativeBridge), and nothing else needs to change.
 */

export type HapticName = "light" | "success" | "error";

type NativeHaptics = (name: HapticName) => void;
let native: NativeHaptics | null = null;

export function registerNativeHaptics(impl: NativeHaptics): void {
  native = impl;
}

/** Whether this device can give haptic feedback at all (native engine or the web Vibration API). */
export function isHapticsSupported(): boolean {
  if (native) return true;
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

const PATTERNS: Record<HapticName, number | number[]> = {
  light: 8,
  success: [10, 40, 16],
  error: [24, 50, 24],
};

export function haptic(name: HapticName): void {
  if (native) {
    native(name);
    return;
  }
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[name]);
  } catch {
    /* unsupported or blocked */
  }
}
