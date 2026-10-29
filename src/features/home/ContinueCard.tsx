"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/primitives";
import { BoardThumbnail } from "@/components/sudoku/BoardThumbnail";
import { continueGame } from "@/features/game/actions";
import { filledCells } from "@/lib/sync/merge";
import { DIFFICULTY_LABEL, formatDuration, formatPercent, plural } from "@/lib/format";
import { relativeDay } from "@/lib/date";
import { useLibraryStore } from "@/stores/library";

export function ContinueCard() {
  const router = useRouter();
  const record = useLibraryStore((s) => s.live[0]);
  if (!record) return null;

  const progress = filledCells(record) / 81;
  const go = () => {
    if (continueGame(record.id)) router.push("/play/");
  };

  return (
    <Card className="flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
      <BoardThumbnail
        values={record.values}
        givens={record.givens}
        className="size-[92px] shrink-0 sm:size-[108px]"
        label={`Your ${DIFFICULTY_LABEL[record.difficulty]} puzzle, ${formatPercent(progress)} complete`}
      />
      <div className="min-w-0 flex-1">
        <div className="eyebrow">
          {record.mode === "daily" ? "Daily · " : ""}
          {DIFFICULTY_LABEL[record.difficulty]}
        </div>
        <h2 className="mt-0.5 text-[19px] leading-6 font-semibold tracking-[-0.01em] text-ink">Continue game</h2>
        <p className="tabular mt-0.5 truncate text-[13px] text-ink-2">
          {formatPercent(progress)} · {formatDuration(record.elapsedMs)} · {plural(record.mistakes, "mistake")}
        </p>
        <p className="text-[12px] text-ink-3">Last played {relativeDay(record.updatedAt).toLowerCase()}</p>
        <Button variant="primary" size="sm" className="mt-3" onClick={go} icon={<ArrowRight className="order-last size-4" />}>
          Continue
        </Button>
      </div>
    </Card>
  );
}
