"use client";

import { memo, useCallback, useEffect, useMemo, useRef, type PointerEvent } from "react";
import { useGameStore } from "@/stores/game";
import { useSettingsStore } from "@/stores/settings";
import { SudokuCell } from "./SudokuCell";
import { PauseOverlay } from "./PauseOverlay";

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

const THIN = [1, 2, 4, 5, 7, 8];
const THICK = [3, 6];

function cellFromPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
  if (!el) return null;
  const i = Number(el.dataset.cell);
  return Number.isInteger(i) ? i : null;
}

export const SudokuBoard = memo(function SudokuBoard() {
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const paused = useGameStore((s) => s.paused && s.pausedBy === "user");
  const phase = useGameStore((s) => s.phase);
  const selected = useGameStore((s) => s.selected);
  const select = useGameStore((s) => s.select);

  const related = useSettingsStore((s) => s.highlightRelated);
  const same = useSettingsStore((s) => s.highlightSameNumbers);
  const conflicts = useSettingsStore((s) => s.highlightConflicts);
  const wave = useSettingsStore((s) => s.completionAnimation);
  const highlight = useMemo(() => ({ related, same, conflicts }), [related, same, conflicts]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      const cell = cellFromPoint(event.clientX, event.clientY);
      if (cell === null) return;
      dragging.current = true;
      select(cell);
    },
    [select],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const cell = cellFromPoint(event.clientX, event.clientY);
      if (cell !== null) select(cell);
    },
    [select],
  );

  const stopDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  // Keep DOM focus on the selected cell (so screen readers follow) unless the player is using another control.
  useEffect(() => {
    if (selected === null || paused) return;
    const active = document.activeElement;
    if (active && active !== document.body && !frame.current?.contains(active)) return;
    document.getElementById(`cell-${selected}`)?.focus({ preventScroll: true });
  }, [selected, paused]);

  const hidden = paused && phase === "playing";
  const row = selected === null ? 0 : Math.floor(selected / 9);
  const col = selected === null ? 0 : selected % 9;

  return (
    <div
      ref={frame}
      className="board-frame"
      data-solved={phase === "completed" ? "true" : undefined}
      data-wave={phase === "completed" && wave ? "true" : undefined}
    >
      <div
        role="grid"
        aria-label="Sudoku board"
        aria-rowcount={9}
        aria-colcount={9}
        aria-readonly="true"
        className="board-grid touch-none"
        data-hidden={hidden ? "true" : undefined}
        inert={hidden || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onPointerLeave={stopDrag}
      >
        {ROWS.map((r) => (
          <div key={r} role="row" aria-rowindex={r + 1} className="board-row">
            {ROWS.map((c) => (
              <SudokuCell key={c} index={r * 9 + c} highlight={highlight} />
            ))}
          </div>
        ))}
      </div>

      <svg className="board-lines" viewBox="0 0 9 9" preserveAspectRatio="none" aria-hidden="true">
        {THIN.map((i) => (
          <g key={i} stroke="var(--grid-thin)" strokeWidth={1}>
            <line x1={i} y1={0} x2={i} y2={9} />
            <line x1={0} y1={i} x2={9} y2={i} />
          </g>
        ))}
        {THICK.map((i) => (
          <g key={i} stroke="var(--grid-strong)" strokeWidth={2}>
            <line x1={i} y1={0} x2={i} y2={9} />
            <line x1={0} y1={i} x2={9} y2={i} />
          </g>
        ))}
      </svg>

      <div
        className="board-selection"
        aria-hidden="true"
        style={{ transform: `translate(${col * 100}%, ${row * 100}%)`, opacity: selected === null || hidden ? 0 : 1 }}
      />

      {hidden ? <PauseOverlay /> : null}
    </div>
  );
});
