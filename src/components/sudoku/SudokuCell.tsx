"use client";

import { memo, type CSSProperties } from "react";
import { FLAG, cellFlags, describeCell, type HighlightOptions } from "@/features/game/cellView";
import { useGameStore } from "@/stores/game";

interface SudokuCellProps {
  index: number;
  highlight: HighlightOptions;
}

const NOTE_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * One cell. It subscribes to only its own slice of the store (value, notes, a
 * flag bitmask, an effect), so entering a number re-renders a handful of cells,
 * never the whole board.
 */
export const SudokuCell = memo(function SudokuCell({ index, highlight }: SudokuCellProps) {
  const value = useGameStore((s) => s.values[index]!);
  const notes = useGameStore((s) => s.notes[index]!);
  const given = useGameStore((s) => s.givenMask[index]!);
  const fx = useGameStore((s) => s.fx[index]);
  const flags = useGameStore((s) => cellFlags(s, index, highlight));
  // Notes matching the selected number are emphasised. Cells without notes never subscribe to it.
  const noteMatch = useGameStore((s) => (s.notes[index] && highlight.same && s.selected !== null ? s.values[s.selected]! : 0));

  const row = Math.floor(index / 9);
  const col = index % 9;
  const hint =
    flags & FLAG.HINT_TARGET ? "target" : flags & FLAG.HINT_CAUSE ? "cause" : flags & FLAG.HINT_ELIMINATE ? "eliminate" : undefined;

  return (
    <div
      role="gridcell"
      id={`cell-${index}`}
      data-cell={index}
      tabIndex={flags & FLAG.TAB_STOP ? 0 : -1}
      aria-selected={Boolean(flags & FLAG.SELECTED)}
      aria-label={describeCell(index, value, notes, given, flags)}
      aria-invalid={flags & FLAG.INVALID ? true : undefined}
      className="cell"
      data-given={given || undefined}
      data-selected={flags & FLAG.SELECTED ? "true" : undefined}
      data-peer={flags & FLAG.PEER ? "true" : undefined}
      data-same={flags & FLAG.SAME ? "true" : undefined}
      data-invalid={flags & FLAG.INVALID ? "true" : undefined}
      data-hint={hint}
      data-hint-unit={flags & FLAG.HINT_UNIT ? "true" : undefined}
      style={{ "--r": row, "--c": col } as CSSProperties}
    >
      {value ? (
        <span
          key={fx?.nonce ?? 0}
          className="cell-value"
          data-fx={fx?.kind}
          style={fx?.delay ? ({ "--fx-delay": `${fx.delay}ms` } as CSSProperties) : undefined}
        >
          {value}
        </span>
      ) : notes ? (
        <div className="cell-notes" aria-hidden="true">
          {NOTE_DIGITS.map((d) => (
            <span key={d} data-match={noteMatch === d ? "true" : undefined}>
              {notes & (1 << (d - 1)) ? d : ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
});
