/**
 * localStorage that never throws. Private windows, blocked site data and full
 * quotas fall back to an in-memory map so the game keeps working for the session.
 */

export const STORAGE_PREFIX = "sudoku:v1:";

const memory = new Map<string, string>();

/**
 * Observer for every write and removal (value `null` = removed). The native app uses it to
 * mirror data into the phone's own storage, so history survives even if the web view's
 * storage is ever cleared. Keys are reported without the app prefix.
 */
export type StorageListener = (key: string, value: string | null) => void;
let listener: StorageListener | null = null;

export function setStorageListener(next: StorageListener | null): void {
  listener = next;
}

/** The full key as it appears in localStorage. */
export function prefixedKey(key: string): string {
  return STORAGE_PREFIX + key;
}

function backend(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readRaw(key: string): string | null {
  const store = backend();
  if (store) {
    try {
      const value = store.getItem(STORAGE_PREFIX + key);
      if (value !== null) return value;
    } catch {
      /* fall through to memory */
    }
  }
  return memory.get(key) ?? null;
}

/** Returns true when the value reached durable storage. */
export function writeRaw(key: string, value: string): boolean {
  const store = backend();
  if (store) {
    try {
      store.setItem(STORAGE_PREFIX + key, value);
      memory.delete(key);
      listener?.(key, value);
      return true;
    } catch {
      /* quota or blocked: keep in memory */
    }
  }
  memory.set(key, value);
  listener?.(key, value);
  return false;
}

export function removeRaw(key: string): void {
  memory.delete(key);
  listener?.(key, null);
  const store = backend();
  if (!store) return;
  try {
    store.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function listKeys(): string[] {
  const keys = new Set<string>(memory.keys());
  const store = backend();
  if (store) {
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k?.startsWith(STORAGE_PREFIX)) keys.add(k.slice(STORAGE_PREFIX.length));
      }
    } catch {
      /* ignore */
    }
  }
  return [...keys];
}

export function clearAllKeys(): void {
  for (const key of listKeys()) removeRaw(key);
  memory.clear();
}

interface Envelope<T> {
  v: number;
  d: T;
}

export function readEnvelope<T>(key: string, version: number): T | null {
  const raw = readRaw(key);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Envelope<T> | null;
    if (!parsed || typeof parsed !== "object" || parsed.v !== version) return null;
    return parsed.d;
  } catch {
    return null;
  }
}

export function writeEnvelope<T>(key: string, version: number, data: T): boolean {
  return writeRaw(key, JSON.stringify({ v: version, d: data } satisfies Envelope<T>));
}
