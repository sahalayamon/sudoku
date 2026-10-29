import { isNativePlatform } from "@/lib/native/platform";
import { STORAGE_PREFIX, listKeys, prefixedKey, readRaw, setStorageListener, writeRaw } from "./safe-storage";

/**
 * Durable copy of everything the app stores, kept in the phone's own key-value store
 * (Android SharedPreferences) in addition to the web view's localStorage.
 *
 *  - Every write is mirrored (coalesced, so a burst of moves is one native write).
 *  - On start, anything the web view has lost is restored from the mirror before the app reads its data.
 *
 * Native keys carry the same prefix as localStorage keys, so the app only ever restores what it wrote.
 * localStorage stays the working copy, so the game keeps its synchronous, instant storage.
 * On the web (or if the plugin is unavailable) this module does nothing.
 */

interface PreferencesLike {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
  keys(): Promise<{ keys: string[] }>;
}

const FLUSH_DELAY_MS = 400;

let prefs: PreferencesLike | null = null;
const pending = new Map<string, string | null>();
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> = Promise.resolve();

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushNativeMirror();
  }, FLUSH_DELAY_MS);
}

/** Write everything queued to native storage now (also called when the app goes to the background). */
export function flushNativeMirror(): Promise<void> {
  const store = prefs;
  if (!store || pending.size === 0) return flushing;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const batch = [...pending];
  pending.clear();
  flushing = flushing.then(async () => {
    for (const [key, value] of batch) {
      try {
        if (value === null) await store.remove({ key: prefixedKey(key) });
        else await store.set({ key: prefixedKey(key), value });
      } catch {
        // Put it back so the next flush retries; localStorage still has the data meanwhile.
        if (!pending.has(key)) pending.set(key, value);
      }
    }
    if (pending.size) schedule();
  });
  return flushing;
}

/**
 * Call once at startup, before any store reads its data.
 * Restores keys the web view no longer has, seeds the mirror with keys it does not have yet,
 * then starts mirroring every future write.
 */
export function initNativeMirror(): Promise<void> {
  return (initPromise ??= start());
}

let initPromise: Promise<void> | null = null;

async function start(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    prefs = Preferences as PreferencesLike;

    const { keys } = await prefs.keys();
    const mirrored = new Set(keys.filter((k) => k.startsWith(STORAGE_PREFIX)).map((k) => k.slice(STORAGE_PREFIX.length)));

    // 1. Restore what the web view lost. Where both copies exist, the web view's wins: every write
    //    goes there first, so a difference means a flush to native storage never happened.
    for (const key of mirrored) {
      const local = readRaw(key);
      const { value } = await prefs.get({ key: prefixedKey(key) });
      if (local === null) {
        if (value !== null) writeRaw(key, value);
      } else if (local !== value) {
        pending.set(key, local);
      }
    }

    // 2. Seed the mirror with anything it has not seen (first launch after an update, or after a failed flush).
    for (const key of listKeys()) {
      if (mirrored.has(key)) continue;
      const local = readRaw(key);
      if (local !== null) pending.set(key, local);
    }

    setStorageListener((key, value) => {
      pending.set(key, value);
      schedule();
    });
    if (pending.size) schedule();
  } catch {
    // The plugin is missing or failed: carry on with localStorage alone.
    prefs = null;
    setStorageListener(null);
  }
}
