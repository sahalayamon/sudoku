import { create } from "zustand";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useUiStore } from "@/stores/ui";

export interface AuthUser {
  id: string;
  email: string | null;
}

export type AuthStatus = "unavailable" | "loading" | "signed_out" | "signed_in";

interface AuthStore {
  status: AuthStatus;
  user: AuthUser | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  sendMagicLink: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

let initialized = false;

const friendly = (message: string): string => {
  if (/invalid login/i.test(message)) return "That email and password don't match.";
  if (/already registered/i.test(message)) return "An account with that email already exists.";
  if (/password/i.test(message) && /(short|least|weak)/i.test(message)) return "Choose a longer password (at least 8 characters).";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Try again in a minute.";
  if (/network|fetch/i.test(message)) return "Can't reach the server. Check your connection.";
  return message;
};

export const useAuthStore = create<AuthStore>((set) => ({
  status: isSupabaseConfigured ? "loading" : "unavailable",
  user: null,

  init: async () => {
    if (initialized || !isSupabaseConfigured) return;
    initialized = true;
    const supabase = await getSupabase();
    if (!supabase) return;
    const apply = (session: { user: { id: string; email?: string | null } } | null) => {
      if (session?.user) {
        set({ status: "signed_in", user: { id: session.user.id, email: session.user.email ?? null } });
      } else {
        set({ status: "signed_out", user: null });
        useUiStore.getState().setSync("signed_out");
      }
    };
    try {
      const { data } = await supabase.auth.getSession();
      apply(data.session);
    } catch {
      // Offline at start: stay usable as a guest, retry on the next auth event.
      set({ status: "signed_out", user: null });
    }
    supabase.auth.onAuthStateChange((_event, session) => apply(session));
  },

  signIn: async (email, password) => {
    const supabase = await getSupabase();
    if (!supabase) return "Accounts are not available.";
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? friendly(error.message) : null;
    } catch (error) {
      return friendly(error instanceof Error ? error.message : "Something went wrong.");
    }
  },

  signUp: async (email, password) => {
    const supabase = await getSupabase();
    if (!supabase) return { error: "Accounts are not available.", needsConfirmation: false };
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
      });
      if (error) return { error: friendly(error.message), needsConfirmation: false };
      return { error: null, needsConfirmation: !data.session };
    } catch (error) {
      return { error: friendly(error instanceof Error ? error.message : "Something went wrong."), needsConfirmation: false };
    }
  },

  sendMagicLink: async (email) => {
    const supabase = await getSupabase();
    if (!supabase) return "Accounts are not available.";
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
      });
      return error ? friendly(error.message) : null;
    } catch (error) {
      return friendly(error instanceof Error ? error.message : "Something went wrong.");
    }
  },

  signOut: async () => {
    const supabase = await getSupabase();
    try {
      await supabase?.auth.signOut();
    } finally {
      set({ status: "signed_out", user: null });
      useUiStore.getState().setSync("signed_out");
    }
  },
}));
