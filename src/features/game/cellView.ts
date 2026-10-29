import { ARE_PEERS } from "@/lib/sudoku/constants";
import type { GameState } from "@/stores/game";

/**
 * A compact bitmask describing how one cell should look. Cells subscribe to this
 * single number, so a selection change only re-renders the cells whose flags changed.
 */
export const FLAG = {
  SELECTED: 1,
  PEER: 2,
  SAME: 4,
  INVALID: 8,
  HINT_TARGET: 16,
  HINT_CAUSE: 32,
  HINT_ELIMINATE: 64,
  HINT_UNIT: 128,
  TAB_STOP: 256,
} as const;

export interface HighlightOptions {
  related: boolean;
  same: boolean;
  conflicts: boolean;
}

export function cellFlags(s: GameState, i: number, o: HighlightOptions): number {
  let f = 0;
  const sel = s.selected;
  const interactive = s.phase === "playing" || s.phase === "failed";

  if (sel === null) {
    if (i === 0) f |= FLAG.TAB_STOP;
  } else if (interactive) {
    if (i === sel) {
      f |= FLAG.SELECTED | FLAG.TAB_STOP;
    } else {
      if (o.related && ARE_PEERS[sel * 81 + i]) f |= FLAG.PEER;
      const selectedValue = s.values[sel]!;
      if (o.same && selectedValue && s.values[i] === selectedValue) f |= FLAG.SAME;
    }
  }

  const v = s.values[i]!;
  // Only what the last Check found wrong is marked; entries are never judged while placing.
  if (v && !s.givenMask[i] && s.checked[i] === v) f |= FLAG.INVALID;

  const hint = s.hint;
  if (hint) {
    const view = hint.view;
    if (i === view.target) f |= FLAG.HINT_TARGET;
    else if (hint.level === 2 && view.cause[i]) f |= FLAG.HINT_CAUSE;
    else if (hint.level === 2 && view.eliminate[i]) f |= FLAG.HINT_ELIMINATE;
    if (view.unit[i]) f |= FLAG.HINT_UNIT;
  }
  return f;
}

/** Screen-reader description of one cell. */
export function describeCell(index: number, value: number, notes: number, given: boolean, flags: number): string {
  const row = Math.floor(index / 9) + 1;
  const col = (index % 9) + 1;
  let text = `Row ${row}, column ${col}. `;
  if (value) {
    text += given ? `${value}, given.` : `${value}.`;
    if (flags & FLAG.INVALID) text += " Incorrect.";
  } else if (notes) {
    const list: number[] = [];
    for (let d = 1; d <= 9; d++) if (notes & (1 << (d - 1))) list.push(d);
    text += `Empty. Notes: ${list.join(", ")}.`;
  } else {
    text += "Empty.";
  }
  if (flags & FLAG.HINT_TARGET) text += " Hint.";
  return text;
}
