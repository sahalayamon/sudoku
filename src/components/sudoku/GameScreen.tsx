"use client";

import { Grid3x3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/primitives";
import { startDailyGame, startNewGame } from "@/features/game/actions";
import { useGameKeyboard } from "@/features/game/useGameKeyboard";
import { useGameStore } from "@/stores/game";
import { useMetaStore } from "@/stores/meta";
import { CompletionPanel } from "./CompletionPanel";
import { FailedPanel } from "./FailedPanel";
import { GameBar } from "./GameBar";
import { GameControls } from "./GameControls";
import { GeneratingBoard } from "./GeneratingState";
import { HintPanel } from "./HintPanel";
import { NumberPad } from "./NumberPad";
import { PuzzleInfo } from "./PuzzleInfo";
import { SudokuBoard } from "./SudokuBoard";

/** The play screen. Owns the timer attachment: the clock only runs while this is mounted and visible. */
export function GameScreen() {
  const router = useRouter();
  const phase = useGameStore((s) => s.phase);
  const loadingLabel = useGameStore((s) => s.loadingLabel);
  const error = useGameStore((s) => s.error);
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);
  const dailyDate = useGameStore((s) => s.dailyDate);
  const announcement = useGameStore((s) => s.announcement);
  const attached = useGameStore((s) => s.screenActive);

  useGameKeyboard();

  useLayoutEffect(() => {
    useGameStore.getState().attach();
    return () => useGameStore.getState().detach();
  }, []);

  // A finished game should not linger as "current" once the player leaves.
  useEffect(() => {
    return () => {
      const g = useGameStore.getState();
      if (g.phase === "completed" || g.phase === "failed") {
        g.reset();
        useMetaStore.getState().patch({ currentGameId: null });
      }
    };
  }, []);

  const showBoard = phase === "playing" || phase === "completed" || phase === "failed";

  return (
    <div className="game-shell">
      <h1 className="sr-only">Sudoku puzzle</h1>
      <GameBar />

      {phase === "generating" || (!attached && phase === "idle") ? (
        <div className="game-layout">
          <div className="area-board">
            <GeneratingBoard label={loadingLabel ?? "Loading your puzzle"} />
          </div>
        </div>
      ) : phase === "error" ? (
        <div className="mx-auto flex w-full max-w-md flex-1 items-center">
          <EmptyState
            icon={<Grid3x3 className="size-5" />}
            title="Couldn't build a puzzle"
            description={error ?? "Something went wrong while generating."}
            action={
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => void (mode === "daily" && dailyDate ? startDailyGame(dailyDate) : startNewGame(difficulty))}
                >
                  Try again
                </Button>
                <Button onClick={() => router.push("/")}>Home</Button>
              </div>
            }
          />
        </div>
      ) : !showBoard ? (
        <div className="mx-auto flex w-full max-w-md flex-1 items-center">
          <EmptyState
            icon={<Grid3x3 className="size-5" />}
            title="No game in progress"
            description="Start a new puzzle or play today's Daily."
            action={
              <Button variant="primary" onClick={() => router.push("/")}>
                Choose a puzzle
              </Button>
            }
          />
        </div>
      ) : (
        <div className="game-layout">
          <div className="area-info">
            <PuzzleInfo />
          </div>
          <div className="area-board">
            <SudokuBoard />
          </div>
          <div className="area-controls">
            {phase === "completed" ? (
              <CompletionPanel />
            ) : phase === "failed" ? (
              <FailedPanel />
            ) : (
              <>
                <HintPanel />
                <NumberPad />
                <GameControls />
              </>
            )}
          </div>
        </div>
      )}

      <p className="sr-only-live" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
