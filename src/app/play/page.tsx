import type { Metadata } from "next";
import { GameScreen } from "@/components/sudoku/GameScreen";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return <GameScreen />;
}
