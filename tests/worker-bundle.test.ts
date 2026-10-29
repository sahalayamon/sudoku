import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { beforeAll, describe, expect, it } from "vitest";
import { validatePuzzle } from "@/lib/sudoku";

/**
 * The puzzle worker is bundled by esbuild into a classic script served from a fixed URL.
 * These tests run that exact artifact, the same file the browser and the Android app load.
 */

const root = join(__dirname, "..");
const bundle = join(root, "public", "workers", "generator.worker.js");

interface FakeWorkerScope {
  postMessage(message: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

function loadWorker() {
  const messages: unknown[] = [];
  const scope: FakeWorkerScope = { postMessage: (m) => void messages.push(m), onmessage: null };
  runInNewContext(readFileSync(bundle, "utf8"), { self: scope });
  return { scope, messages };
}

beforeAll(() => {
  execFileSync(process.execPath, [join(root, "scripts", "build-worker.mjs")], { cwd: root, stdio: "pipe" });
});

describe("generator worker bundle", () => {
  it("is a self-contained script (no imports or requires left to resolve)", () => {
    const code = readFileSync(bundle, "utf8");
    expect(code.length).toBeGreaterThan(5_000);
    expect(code).not.toMatch(/\brequire\(/);
    expect(code).not.toMatch(/^import\s/m);
  });

  it("answers a request with a validated puzzle for the requested level and seed", () => {
    const { scope, messages } = loadWorker();
    expect(typeof scope.onmessage).toBe("function");
    scope.onmessage!({ data: { id: 7, difficulty: "easy", seed: "bundle-seed" } });
    expect(messages).toHaveLength(1);
    const reply = messages[0] as { id: number; puzzle: { givens: string; difficulty: string; seed: string } };
    expect(reply.id).toBe(7);
    expect(reply.puzzle.difficulty).toBe("easy");
    expect(reply.puzzle.seed).toBe("bundle-seed");
    expect(validatePuzzle(reply.puzzle.givens)).toMatchObject({ valid: true, unique: true });
  });

  it("is deterministic: the same seed gives the same puzzle as the main-thread engine", async () => {
    const { generatePuzzle } = await import("@/lib/sudoku");
    const { scope, messages } = loadWorker();
    scope.onmessage!({ data: { id: 1, difficulty: "medium", seed: "same" } });
    const reply = messages[0] as { puzzle: { givens: string } };
    expect(reply.puzzle.givens).toBe(generatePuzzle({ difficulty: "medium", seed: "same" }).givens);
  });

  it("reports a failure to the caller instead of crashing", () => {
    const { scope, messages } = loadWorker();
    scope.onmessage!({ data: { id: 3, difficulty: "impossible" } });
    expect(messages[0]).toMatchObject({ id: 3 });
    expect(typeof (messages[0] as { error: string }).error).toBe("string");
  });
});
