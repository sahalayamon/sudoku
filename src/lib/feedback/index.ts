import { useSettingsStore } from "@/stores/settings";
import { haptic, type HapticName } from "./haptics";
import { playSound, type SoundName } from "./sound";

export type FeedbackEvent = "select" | "place" | "erase" | "undo" | "error" | "hint" | "complete";

const HAPTIC_FOR: Partial<Record<FeedbackEvent, HapticName>> = {
  place: "light",
  error: "error",
  complete: "success",
  hint: "light",
};

/** Sound and haptics for a game event, honouring the user's settings. */
export function feedback(event: FeedbackEvent): void {
  const { sound, haptics } = useSettingsStore.getState();
  if (sound) playSound(event as SoundName);
  if (haptics) {
    const h = HAPTIC_FOR[event];
    if (h) haptic(h);
  }
}
