import { create } from "zustand";

export type ToastTone = "neutral" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  /** Optional secondary line. */
  detail?: string;
  action?: { label: string; onClick: () => void };
}

export type SyncPhase = "disabled" | "signed_out" | "idle" | "syncing" | "synced" | "offline" | "error";

interface UiStore {
  online: boolean;
  toasts: Toast[];
  syncPhase: SyncPhase;
  syncError: string | null;
  shortcutsOpen: boolean;
  onboardingOpen: boolean;
  /** Increments on every open so the tutorial starts fresh. */
  onboardingSession: number;
  setShortcutsOpen: (open: boolean) => void;
  setOnboardingOpen: (open: boolean) => void;
  setOnline: (online: boolean) => void;
  toast: (message: string, options?: { tone?: ToastTone; detail?: string; duration?: number; action?: Toast["action"] }) => void;
  dismissToast: (id: number) => void;
  setSync: (phase: SyncPhase, error?: string | null) => void;
}

let toastId = 0;

export const useUiStore = create<UiStore>((set, get) => ({
  online: true,
  toasts: [],
  syncPhase: "disabled",
  syncError: null,
  shortcutsOpen: false,
  onboardingOpen: false,
  onboardingSession: 0,

  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setOnboardingOpen: (onboardingOpen) =>
    set((s) => ({
      onboardingOpen,
      onboardingSession: onboardingOpen && !s.onboardingOpen ? s.onboardingSession + 1 : s.onboardingSession,
    })),
  setOnline: (online) => set({ online }),

  toast: (message, options = {}) => {
    const id = ++toastId;
    const toast: Toast = { id, message, tone: options.tone ?? "neutral", detail: options.detail, action: options.action };
    set({ toasts: [...get().toasts.slice(-2), toast] });
    const duration = options.duration ?? 3600;
    if (typeof window !== "undefined") window.setTimeout(() => get().dismissToast(id), duration);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  setSync: (phase, error = null) => set({ syncPhase: phase, syncError: error }),
}));
