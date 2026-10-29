import { useMemo } from "react";
import { computeStats, type Stats } from "@/features/statistics/compute";
import { useLibraryStore } from "@/stores/library";
import { useToday } from "./useToday";

/** Statistics derived from the full game history. Recomputed only when the history changes. */
export function useStats(): Stats {
  const finished = useLibraryStore((s) => s.finished);
  const live = useLibraryStore((s) => s.live);
  const today = useToday();
  return useMemo(() => computeStats([...finished, ...live], today), [finished, live, today]);
}
