import { create } from "zustand";
import { defaultMeta, loadMeta, saveMeta } from "@/lib/storage/repository";
import type { Meta } from "@/types/settings";

interface MetaStore extends Meta {
  hydrated: boolean;
  hydrate: () => void;
  patch: (patch: Partial<Meta>) => void;
  reset: () => void;
}

function pick(s: Meta): Meta {
  return {
    onboardingSeen: s.onboardingSeen,
    lastDifficulty: s.lastDifficulty,
    currentGameId: s.currentGameId,
    deviceId: s.deviceId,
    lastSyncedAt: s.lastSyncedAt,
    lastPulledAt: s.lastPulledAt,
  };
}

export const useMetaStore = create<MetaStore>((set, get) => ({
  ...defaultMeta(),
  hydrated: false,

  hydrate: () => {
    const meta = loadMeta();
    set({ ...meta, hydrated: true });
    saveMeta(meta); // persists a freshly generated device id
  },

  patch: (patch) => {
    set(patch);
    saveMeta(pick(get()));
  },

  reset: () => {
    const keepDevice = get().deviceId;
    set({ ...defaultMeta(), deviceId: keepDevice });
    saveMeta(pick(get()));
  },
}));
