import { create } from "zustand";
import { loadSettings, saveSettings } from "@/lib/storage/repository";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";

type SettingsPatch = Partial<Omit<Settings, "updatedAt">>;

interface SettingsStore extends Settings {
  hydrated: boolean;
  hydrate: () => void;
  update: (patch: SettingsPatch) => void;
  /** Used by sync and import: take a whole settings object as-is. */
  replace: (settings: Settings) => void;
  reset: () => void;
}

function pick(state: Settings): Settings {
  return {
    theme: state.theme,
    palette: state.palette,
    sound: state.sound,
    haptics: state.haptics,
    showTimer: state.showTimer,
    mistakeLimit: state.mistakeLimit,
    autoNotes: state.autoNotes,
    highlightConflicts: state.highlightConflicts,
    highlightSameNumbers: state.highlightSameNumbers,
    highlightRelated: state.highlightRelated,
    completionAnimation: state.completionAnimation,
    updatedAt: state.updatedAt,
  };
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,

  hydrate: () => {
    set({ ...loadSettings(), hydrated: true });
  },

  update: (patch) => {
    set({ ...patch, updatedAt: Date.now() });
    saveSettings(pick(get()));
  },

  replace: (settings) => {
    set({ ...settings });
    saveSettings(pick(get()));
  },

  reset: () => {
    set({ ...DEFAULT_SETTINGS, updatedAt: Date.now() });
    saveSettings(pick(get()));
  },
}));

export function getSettingsSnapshot(): Settings {
  return pick(useSettingsStore.getState());
}
