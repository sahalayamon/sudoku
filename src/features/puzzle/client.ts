import type { Difficulty, Puzzle } from "@/lib/sudoku";
import type { WorkerRequest, WorkerResponse } from "./generator.worker";

/**
 * Runs the puzzle generator off the main thread so the UI never stalls while an
 * Expert puzzle is being searched for. Falls back to the main thread (deferred
 * with a timeout) where workers are unavailable.
 */
/** Built by scripts/build-worker.mjs (runs before dev and build) into public/workers. */
const WORKER_URL = "/workers/generator.worker.js";

export class PuzzleClient {
  private worker: Worker | null = null;
  private broken = false;
  private nextId = 1;
  private pending = new Map<number, { resolve: (p: Puzzle) => void; reject: (e: Error) => void; request: WorkerRequest }>();

  private ensureWorker(): Worker | null {
    if (this.broken || typeof Worker === "undefined") return null;
    if (this.worker) return this.worker;
    try {
      const worker = new Worker(WORKER_URL);
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;
        const entry = this.pending.get(data.id);
        if (!entry) return;
        this.pending.delete(data.id);
        if ("error" in data) entry.reject(new Error(data.error));
        else entry.resolve(data.puzzle);
      };
      worker.onerror = () => this.failOver();
      this.worker = worker;
      return worker;
    } catch {
      this.broken = true;
      return null;
    }
  }

  /** The worker died: answer everything still waiting on the main thread. */
  private failOver(): void {
    this.broken = true;
    this.worker?.terminate();
    this.worker = null;
    const waiting = [...this.pending.values()];
    this.pending.clear();
    for (const { request, resolve, reject } of waiting) this.generateOnMainThread(request.difficulty, request.seed).then(resolve, reject);
  }

  private async generateOnMainThread(difficulty: Difficulty, seed?: string): Promise<Puzzle> {
    // Only reached where Web Workers are unavailable; the generator is loaded on demand.
    const { generatePuzzle } = await import("@/lib/sudoku/generator");
    await new Promise((resolve) => setTimeout(resolve, 16)); // let the loading state paint first
    return generatePuzzle({ difficulty, seed });
  }

  generate(difficulty: Difficulty, seed?: string): Promise<Puzzle> {
    const worker = this.ensureWorker();
    if (!worker) return this.generateOnMainThread(difficulty, seed);
    return new Promise<Puzzle>((resolve, reject) => {
      const id = this.nextId++;
      const request: WorkerRequest = { id, difficulty, seed };
      this.pending.set(id, { resolve, reject, request });
      worker.postMessage(request);
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
