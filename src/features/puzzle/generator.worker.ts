/// <reference lib="webworker" />
import { generatePuzzle } from "../../lib/sudoku/generator";
import type { Difficulty, Puzzle } from "../../lib/sudoku/types";

export interface WorkerRequest {
  id: number;
  difficulty: Difficulty;
  seed?: string;
}

export type WorkerResponse = { id: number; puzzle: Puzzle } | { id: number; error: string };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, difficulty, seed } = event.data;
  try {
    const puzzle = generatePuzzle({ difficulty, seed });
    (self as DedicatedWorkerGlobalScope).postMessage({ id, puzzle } satisfies WorkerResponse);
  } catch (error) {
    (self as DedicatedWorkerGlobalScope).postMessage({
      id,
      error: error instanceof Error ? error.message : "Generation failed",
    } satisfies WorkerResponse);
  }
};
