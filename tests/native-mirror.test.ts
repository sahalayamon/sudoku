import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Android app keeps a durable copy of all app data in the phone's native key-value store
 * (Capacitor Preferences). These tests play the part of the phone: the "native" map and the web
 * view's localStorage are separate, and a restart re-imports the modules from scratch.
 */

const native = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock("@/lib/native/platform", () => ({ isNativePlatform: () => true, nativePlatform: () => "android" }));
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: native.store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void native.store.set(key, value),
    remove: async ({ key }: { key: string }) => void native.store.delete(key),
    keys: async () => ({ keys: [...native.store.keys()] }),
  },
}));

class FakeLocalStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}

const PREFIX = "sudoku:v1:";

async function startApp() {
  vi.resetModules();
  const storage = await import("@/lib/storage/safe-storage");
  const mirror = await import("@/lib/storage/native-mirror");
  await mirror.initNativeMirror();
  return { ...storage, flush: mirror.flushNativeMirror };
}

/** What Android does when it clears the web view's data. */
function wipeWebView() {
  vi.stubGlobal("localStorage", new FakeLocalStorage());
}

beforeEach(() => {
  native.store.clear();
  vi.stubGlobal("localStorage", new FakeLocalStorage());
});

describe("native storage mirror", () => {
  it("copies every write to native storage under the app's key prefix", async () => {
    const app = await startApp();
    app.writeRaw("live", "game-1");
    app.writeRaw("meta", "m");
    await app.flush();
    expect(native.store.get(PREFIX + "live")).toBe("game-1");
    expect(native.store.get(PREFIX + "meta")).toBe("m");
    expect([...native.store.keys()].every((k) => k.startsWith(PREFIX))).toBe(true);
  });

  it("restores everything after the web view's storage is wiped", async () => {
    const first = await startApp();
    first.writeRaw("live", "in-progress game");
    first.writeRaw("history", "ten finished games");
    first.writeRaw("daily:2026-10-05", "today");
    await first.flush();

    wipeWebView();
    expect(localStorage.length).toBe(0);

    const second = await startApp();
    expect(second.readRaw("live")).toBe("in-progress game");
    expect(second.readRaw("history")).toBe("ten finished games");
    expect(second.readRaw("daily:2026-10-05")).toBe("today");
  });

  it("restores nothing that was deleted before the wipe", async () => {
    const first = await startApp();
    first.writeRaw("keep", "yes");
    first.writeRaw("gone", "no");
    await first.flush();
    first.removeRaw("gone");
    await first.flush();

    wipeWebView();
    const second = await startApp();
    expect(second.readRaw("keep")).toBe("yes");
    expect(second.readRaw("gone")).toBeNull();
  });

  it("keeps the newer web view copy when the last flush never reached native storage", async () => {
    const first = await startApp();
    first.writeRaw("live", "move 1");
    await first.flush();
    first.writeRaw("live", "move 2"); // the app is killed before this one is flushed

    const second = await startApp();
    expect(second.readRaw("live")).toBe("move 2");
    await second.flush();
    expect(native.store.get(PREFIX + "live")).toBe("move 2");

    wipeWebView();
    const third = await startApp();
    expect(third.readRaw("live")).toBe("move 2");
  });

  it("seeds native storage with data that predates the mirror", async () => {
    localStorage.setItem(PREFIX + "history", "old games");
    const app = await startApp();
    await app.flush();
    expect(native.store.get(PREFIX + "history")).toBe("old games");
  });

  it("ignores native keys it does not own", async () => {
    native.store.set("someOtherPlugin", "x");
    const app = await startApp();
    await app.flush();
    expect(app.listKeys()).toEqual([]);
  });
});
