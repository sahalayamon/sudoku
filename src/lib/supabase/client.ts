import type { SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sync and accounts are optional. Without these env vars the app is a pure offline guest experience. */
export const isSupabaseConfigured = Boolean(URL && ANON_KEY);

let client: Promise<SupabaseClient | null> | null = null;

/**
 * The Supabase SDK is loaded on demand, so guests who never sign in never download it.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "sudoku-auth",
      },
    }),
  );
  return client;
}
