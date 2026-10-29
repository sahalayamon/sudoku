import { create } from "zustand";
import { conflictMask, getHint, type Difficulty, type Hint, type Puzzle } from "@/lib/sudoku";
import { feedback } from "@/lib/feedback";
import { newId } from "@/lib/id";
import {
  HISTORY_LIMIT,
  applyMove,
  clearNotesMove,
  completionCells,
  countFilled,
  eraseMove,
  fillNotesMove,
  givenMaskOf,
  isSolved,
  parseDigits,
  placeMove,
  toggleNoteMove,
} from "@/features/game/board";
import { useLibraryStore } from "@/stores/library";
import { useMetaStore } from "@/stores/meta";
import { useUiStore } from "@/stores/ui";
import { useSettingsStore } from "@/stores/settings";
import type { ActiveHint, CellFx, CompletionSummary, GameMode, GameRecord, HintView, Move } from "@/types/game";

export type GamePhase = "idle" | "generating" | "playing" | "completed" | "failed" | "error";
export type SaveStatus = "idle" | "saving" | "saved";

export interface GameState {
  phase: GamePhase;
  loadingLabel: string | null;
  error: string | null;
  /** True while the play screen is mounted. The timer only runs then. */
  screenActive: boolean;

  id: string;
  puzzleId: string;
  givens: string;
  solution: string;
  solutionDigits: number[];
  difficulty: Difficulty;
  score: number;
  seed: string;
  mode: GameMode;
  dailyDate: string | null;
  givenMask: boolean[];
  startedAt: number;
  moves: number;
  syncedAt: number | null;

  values: number[];
  notes: number[];
  conflicts: boolean[];
  /** Cells the last Check found wrong: cell index to the wrong digit that was there. Shown until that cell changes. */
  checked: Record<number, number>;
  filled: number;
  selected: number | null;
  notesMode: boolean;

  paused: boolean;
  pausedBy: "user" | "auto" | null;
  baseElapsedMs: number;
  runningSince: number | null;

  mistakes: number;
  mistakeLimit: number;
  hintsUsed: number;

  history: Move[];
  future: Move[];

  hint: ActiveHint | null;
  fx: Record<number, CellFx>;
  completion: CompletionSummary | null;
  saveStatus: SaveStatus;
  announcement: string;
}

export interface GameActions {
  /** Show the generating state. What was requested is remembered so a failure can be retried exactly. */
  setGenerating: (label: string, request?: { difficulty: Difficulty; mode: GameMode; dailyDate?: string | null }) => void;
  setError: (message: string) => void;
  loadNew: (puzzle: Puzzle, mode: GameMode, dailyDate?: string | null) => void;
  loadRecord: (record: GameRecord) => void;
  attach: () => void;
  detach: () => void;
  onVisibility: (visible: boolean) => void;

  select: (cell: number | null) => void;
  moveSelection: (dRow: number, dCol: number) => void;
  selectNextEmpty: () => void;

  input: (digit: number, options?: { notes?: boolean }) => void;
  erase: () => void;
  undo: () => void;
  redo: () => void;
  toggleNotesMode: () => void;
  fillNotes: () => void;
  clearNotes: () => void;

  /** Compare every entry with the solution; wrong ones are marked and counted as mistakes. */
  check: () => void;
  requestHint: () => void;
  revealHint: () => void;
  dismissHint: () => void;

  pause: (by?: "user" | "auto") => void;
  resume: () => void;

  /** Persist now. A silent save skips the "Saved" indicator (used by the background heartbeat). */
  flushSave: (silent?: boolean) => void;
  toRecord: () => GameRecord;
  reset: () => void;
}

export type GameStore = GameState & GameActions;

const SAVE_DEBOUNCE_MS = 300;
const FX_LIFETIME_MS = 2200;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savedTimer: ReturnType<typeof setTimeout> | null = null;
let fxTimer: ReturnType<typeof setTimeout> | null = null;
let fxNonce = 0;

function blankState(): GameState {
  return {
    phase: "idle",
    loadingLabel: null,
    error: null,
    screenActive: false,

    id: "",
    puzzleId: "",
    givens: "0".repeat(81),
    solution: "1".repeat(81),
    solutionDigits: new Array<number>(81).fill(0),
    difficulty: "easy",
    score: 0,
    seed: "",
    mode: "standard",
    dailyDate: null,
    givenMask: new Array<boolean>(81).fill(false),
    startedAt: 0,
    moves: 0,
    syncedAt: null,

    values: new Array<number>(81).fill(0),
    notes: new Array<number>(81).fill(0),
    conflicts: new Array<boolean>(81).fill(false),
    checked: {},
    filled: 0,
    selected: null,
    notesMode: false,

    paused: false,
    pausedBy: null,
    baseElapsedMs: 0,
    runningSince: null,

    mistakes: 0,
    mistakeLimit: 0,
    hintsUsed: 0,

    history: [],
    future: [],

    hint: null,
    fx: {},
    completion: null,
    saveStatus: "idle",
    announcement: "",
  };
}

export function elapsedOf(s: Pick<GameState, "baseElapsedMs" | "runningSince">, now: number = Date.now()): number {
  return s.baseElapsedMs + (s.runningSince ? Math.max(0, now - s.runningSince) : 0);
}

/** Current elapsed play time in ms. Safe to call on every animation frame. */
export function getElapsedMs(): number {
  return elapsedOf(useGameStore.getState());
}

function buildHintView(hint: Hint): HintView {
  const cause = new Array<boolean>(81).fill(false);
  const eliminate = new Array<boolean>(81).fill(false);
  const unit = new Array<boolean>(81).fill(false);
  for (const c of hint.cause) cause[c] = true;
  for (const step of hint.steps) for (const c of step.eliminate) eliminate[c] = true;
  if (hint.unit) {
    const { kind, index } = hint.unit;
    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
      if ((kind === "row" && row === index) || (kind === "col" && col === index) || (kind === "box" && box === index)) unit[i] = true;
    }
  }
  return { target: hint.cell, cause, eliminate, unit };
}

export const useGameStore = create<GameStore>((set, get) => {
  /* ------------------------------------------------------------------ */
  /* persistence                                                         */
  /* ------------------------------------------------------------------ */

  const persist = (silent = false) => {
    const s = get();
    if (s.phase !== "playing") return;
    const record = s.toRecord();
    useLibraryStore.getState().upsertLive(record);
    if (silent) return;
    set({ saveStatus: "saved" });
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      if (get().saveStatus === "saved") set({ saveStatus: "idle" });
    }, 1400);
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    set({ saveStatus: "saving" });
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persist();
    }, SAVE_DEBOUNCE_MS);
  };

  const flush = (silent = false) => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    persist(silent);
  };

  /* ------------------------------------------------------------------ */
  /* effects                                                             */
  /* ------------------------------------------------------------------ */

  const withFx = (extra: Record<number, CellFx>): Record<number, CellFx> => {
    if (fxTimer) clearTimeout(fxTimer);
    fxTimer = setTimeout(() => set({ fx: {} }), FX_LIFETIME_MS);
    return { ...get().fx, ...extra };
  };

  /* ------------------------------------------------------------------ */
  /* finishing                                                           */
  /* ------------------------------------------------------------------ */

  const finish = (status: "completed" | "failed") => {
    const s = get();
    if (s.phase !== "playing") return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const now = Date.now();
    const elapsed = elapsedOf(s, now);
    const record: GameRecord = {
      ...s.toRecord(),
      status,
      elapsedMs: elapsed,
      completedAt: now,
      updatedAt: now,
      paused: undefined,
      history: undefined,
      future: undefined,
    };
    const info = useLibraryStore.getState().recordFinished(record);
    useMetaStore.getState().patch({ currentGameId: null });
    set({
      phase: status,
      runningSince: null,
      baseElapsedMs: elapsed,
      paused: false,
      pausedBy: null,
      hint: null,
      selected: status === "completed" ? null : s.selected,
      completion: status === "completed" ? { record, elapsedMs: elapsed, ...info } : null,
      saveStatus: "idle",
      announcement: status === "completed" ? "Puzzle solved." : "Mistake limit reached.",
    });
    if (status === "completed") feedback("complete");
  };

  /** Apply a user move: history, derived data, completion and failure checks. */
  const commit = (move: Move, patch: Partial<GameState> = {}) => {
    const s = get();
    const board = applyMove({ values: s.values, notes: s.notes }, move, "do");
    set({
      values: board.values,
      notes: board.notes,
      conflicts: conflictMask(board.values),
      filled: countFilled(board.values),
      history: [...s.history, move].slice(-HISTORY_LIMIT),
      future: [],
      moves: s.moves + 1,
      hint: null,
      ...patch,
    });
    const next = get();
    if (isSolved(next.values, next.solutionDigits)) {
      finish("completed");
      return;
    }
    if (next.mistakeLimit > 0 && next.mistakes >= next.mistakeLimit) {
      finish("failed");
      return;
    }
    scheduleSave();
  };

  const canPlay = (s: GameState) => s.phase === "playing" && !s.paused;

  /* ------------------------------------------------------------------ */
  /* store                                                               */
  /* ------------------------------------------------------------------ */

  return {
    ...blankState(),

    setGenerating: (label, request) =>
      set({
        ...blankState(),
        screenActive: get().screenActive,
        phase: "generating",
        loadingLabel: label,
        ...(request ? { difficulty: request.difficulty, mode: request.mode, dailyDate: request.dailyDate ?? null } : {}),
      }),

    setError: (message) => set({ phase: "error", error: message, loadingLabel: null }),

    loadNew: (puzzle, mode, dailyDate = null) => {
      const now = Date.now();
      const { mistakeLimit } = useSettingsStore.getState();
      const screenActive = get().screenActive;
      const id = newId();
      set({
        ...blankState(),
        screenActive,
        phase: "playing",
        id,
        puzzleId: puzzle.id,
        givens: puzzle.givens,
        solution: puzzle.solution,
        solutionDigits: parseDigits(puzzle.solution),
        difficulty: puzzle.difficulty,
        score: puzzle.score,
        seed: puzzle.seed,
        mode,
        dailyDate: mode === "daily" ? dailyDate : null,
        givenMask: givenMaskOf(puzzle.givens),
        startedAt: now,
        values: parseDigits(puzzle.givens),
        conflicts: new Array<boolean>(81).fill(false),
        checked: {},
        filled: puzzle.clues,
        mistakeLimit,
        paused: !screenActive,
        pausedBy: screenActive ? null : "auto",
        runningSince: screenActive ? now : null,
      });
      useMetaStore.getState().patch({ currentGameId: id });
      flush();
    },

    loadRecord: (record) => {
      const now = Date.now();
      const screenActive = get().screenActive;
      const values = parseDigits(record.values);
      const userPaused = record.paused === true;
      set({
        ...blankState(),
        screenActive,
        phase: "playing",
        id: record.id,
        puzzleId: record.puzzleId,
        givens: record.givens,
        solution: record.solution,
        solutionDigits: parseDigits(record.solution),
        difficulty: record.difficulty,
        score: record.score,
        seed: record.seed,
        mode: record.mode,
        dailyDate: record.dailyDate,
        givenMask: givenMaskOf(record.givens),
        startedAt: record.startedAt,
        moves: record.moves,
        syncedAt: record.syncedAt ?? null,
        values,
        notes: record.notes.slice(),
        conflicts: conflictMask(values),
        checked: {},
        filled: countFilled(values),
        mistakes: record.mistakes,
        mistakeLimit: record.mistakeLimit,
        hintsUsed: record.hintsUsed,
        baseElapsedMs: record.elapsedMs,
        history: record.history ?? [],
        future: record.future ?? [],
        paused: userPaused || !screenActive,
        pausedBy: userPaused ? "user" : screenActive ? null : "auto",
        runningSince: !userPaused && screenActive ? now : null,
      });
      useMetaStore.getState().patch({ currentGameId: record.id });
    },

    attach: () => {
      set({ screenActive: true });
      // A fresh page load: bring back the game that was open, if any.
      if (get().phase === "idle") {
        const { live } = useLibraryStore.getState();
        const { currentGameId } = useMetaStore.getState();
        const record = (currentGameId && live.find((g) => g.id === currentGameId)) || live[0];
        if (record) get().loadRecord(record);
      }
      const s = get();
      if (s.phase === "playing" && s.paused && s.pausedBy !== "user") get().resume();
    },

    detach: () => {
      get().pause("auto");
      set({ screenActive: false });
    },

    onVisibility: (visible) => {
      const s = get();
      if (!s.screenActive) return;
      if (!visible) get().pause("auto");
      else if (s.paused && s.pausedBy === "auto") get().resume();
    },

    select: (cell) => {
      const s = get();
      if (s.selected === cell) return;
      if (s.phase === "idle" || s.phase === "generating") return;
      set({ selected: cell });
      if (cell !== null) feedback("select");
    },

    moveSelection: (dRow, dCol) => {
      const s = get();
      if (s.phase !== "playing" && s.phase !== "failed") return;
      if (s.selected === null) {
        set({ selected: 40 });
        return;
      }
      const row = Math.min(8, Math.max(0, Math.floor(s.selected / 9) + dRow));
      const col = Math.min(8, Math.max(0, (s.selected % 9) + dCol));
      const next = row * 9 + col;
      if (next !== s.selected) set({ selected: next });
    },

    selectNextEmpty: () => {
      const s = get();
      if (s.phase !== "playing") return;
      const start = s.selected ?? -1;
      for (let step = 1; step <= 81; step++) {
        const i = (start + step) % 81;
        if (!s.values[i]) {
          set({ selected: i });
          return;
        }
      }
    },

    input: (digit, options) => {
      const s = get();
      if (!canPlay(s) || s.selected === null || digit < 1 || digit > 9) return;
      const cell = s.selected;
      if (s.givenMask[cell]) return;

      const asNotes = options?.notes ?? s.notesMode;
      if (asNotes) {
        if (s.values[cell]) return;
        const move = toggleNoteMove(s.values, s.notes, cell, digit);
        if (!move.length) return;
        commit(move);
        feedback("select");
        return;
      }

      if (s.values[cell] === digit) return;
      const settings = useSettingsStore.getState();
      const move = placeMove(s.values, s.notes, cell, digit, settings.autoNotes);
      const nonce = ++fxNonce;
      // Entries are never judged as they are placed: right or wrong looks the same until Check.

      const board = applyMove({ values: s.values, notes: s.notes }, move, "do");
      const extra: Record<number, CellFx> = { [cell]: { kind: "pop", nonce } };
      if (settings.completionAnimation) {
        for (const { cell: c, delay } of completionCells(board.values, s.solutionDigits, cell, digit)) {
          if (c !== cell) extra[c] = { kind: "ripple", nonce, delay };
        }
      }
      feedback("place");
      commit(move, { fx: withFx(extra), announcement: "" });
    },

    erase: () => {
      const s = get();
      if (!canPlay(s) || s.selected === null || s.givenMask[s.selected]) return;
      const move = eraseMove(s.values, s.notes, s.selected);
      if (!move.length) return;
      feedback("erase");
      commit(move);
    },

    undo: () => {
      const s = get();
      if (!canPlay(s) || !s.history.length) return;
      const move = s.history[s.history.length - 1]!;
      const board = applyMove({ values: s.values, notes: s.notes }, move, "undo");
      set({
        values: board.values,
        notes: board.notes,
        conflicts: conflictMask(board.values),
        filled: countFilled(board.values),
        history: s.history.slice(0, -1),
        future: [...s.future, move],
        selected: move[0]?.i ?? s.selected,
        hint: null,
      });
      feedback("undo");
      scheduleSave();
    },

    redo: () => {
      const s = get();
      if (!canPlay(s) || !s.future.length) return;
      const move = s.future[s.future.length - 1]!;
      const board = applyMove({ values: s.values, notes: s.notes }, move, "do");
      set({
        values: board.values,
        notes: board.notes,
        conflicts: conflictMask(board.values),
        filled: countFilled(board.values),
        history: [...s.history, move],
        future: s.future.slice(0, -1),
        selected: move[0]?.i ?? s.selected,
        hint: null,
      });
      feedback("undo");
      const next = get();
      if (isSolved(next.values, next.solutionDigits)) finish("completed");
      else scheduleSave();
    },

    toggleNotesMode: () => {
      if (get().phase !== "playing") return;
      set({ notesMode: !get().notesMode });
      feedback("select");
    },

    fillNotes: () => {
      const s = get();
      if (!canPlay(s)) return;
      const move = fillNotesMove(s.values, s.notes);
      if (move.length) commit(move);
    },

    clearNotes: () => {
      const s = get();
      if (!canPlay(s)) return;
      const move = clearNotesMove(s.values, s.notes);
      if (move.length) commit(move);
    },

    check: () => {
      const s = get();
      if (!canPlay(s)) return;
      const found: Record<number, number> = {};
      const nonce = ++fxNonce;
      const shake: Record<number, CellFx> = {};
      let fresh = 0;
      let wrong = 0;
      let empty = 0;
      for (let i = 0; i < 81; i++) {
        if (s.givenMask[i]) continue;
        const v = s.values[i]!;
        if (!v) {
          empty++;
          continue;
        }
        if (v === s.solutionDigits[i]) continue;
        wrong++;
        found[i] = v;
        shake[i] = { kind: "shake", nonce };
        if (s.checked[i] !== v) fresh++;
      }
      const mistakes = s.mistakes + fresh;
      const toast = useUiStore.getState().toast;
      let message: string;
      if (wrong === 0) {
        message = empty ? "No mistakes so far." : "No mistakes.";
        feedback("place");
        toast(message, { tone: "success" });
      } else {
        const limit = s.mistakeLimit;
        message = wrong === 1 ? "1 wrong number." : `${wrong} wrong numbers.`;
        feedback("error");
        toast(message, {
          tone: "error",
          detail: fresh && limit > 0 ? `Mistakes: ${mistakes} of ${limit}.` : fresh ? `Mistakes: ${mistakes}.` : undefined,
        });
      }
      set({ checked: found, mistakes, fx: wrong ? withFx(shake) : s.fx, announcement: message });
      const next = get();
      if (next.mistakeLimit > 0 && next.mistakes >= next.mistakeLimit) {
        finish("failed");
        return;
      }
      scheduleSave();
    },

    requestHint: () => {
      const s = get();
      if (!canPlay(s)) return;
      if (s.hint) {
        if (s.hint.level === 1) set({ hint: { ...s.hint, level: 2 } });
        else get().revealHint();
        return;
      }
      const hint = getHint(s.values.join(""), s.solution, { prefer: s.selected });
      if (!hint) return;
      feedback("hint");
      set({
        hint: { hint, level: 1, view: buildHintView(hint) },
        hintsUsed: s.hintsUsed + 1,
        selected: hint.cell,
        announcement: hint.nudge,
      });
      scheduleSave();
    },

    revealHint: () => {
      const s = get();
      if (!canPlay(s) || !s.hint) return;
      const { cell, digit } = s.hint.hint;
      const settings = useSettingsStore.getState();
      const move = placeMove(s.values, s.notes, cell, digit, settings.autoNotes);
      const nonce = ++fxNonce;
      const board = applyMove({ values: s.values, notes: s.notes }, move, "do");
      const extra: Record<number, CellFx> = { [cell]: { kind: "hint", nonce } };
      if (settings.completionAnimation) {
        for (const { cell: c, delay } of completionCells(board.values, s.solutionDigits, cell, digit)) {
          if (c !== cell) extra[c] = { kind: "ripple", nonce, delay };
        }
      }
      feedback("place");
      commit(move, { selected: cell, fx: withFx(extra), announcement: `${digit} placed.` });
    },

    dismissHint: () => {
      if (get().hint) set({ hint: null });
    },

    pause: (by = "user") => {
      const s = get();
      if (s.phase !== "playing" || s.paused) return;
      const now = Date.now();
      set({
        paused: true,
        pausedBy: by,
        baseElapsedMs: s.baseElapsedMs + (s.runningSince ? Math.max(0, now - s.runningSince) : 0),
        runningSince: null,
      });
      flush();
    },

    resume: () => {
      const s = get();
      if (s.phase !== "playing" || !s.paused) return;
      set({ paused: false, pausedBy: null, runningSince: Date.now() });
    },

    flushSave: (silent = false) => flush(silent),

    toRecord: () => {
      const s = get();
      const now = Date.now();
      return {
        id: s.id,
        puzzleId: s.puzzleId,
        givens: s.givens,
        solution: s.solution,
        difficulty: s.difficulty,
        score: s.score,
        seed: s.seed,
        mode: s.mode,
        dailyDate: s.dailyDate,
        status: "in_progress",
        values: s.values.join(""),
        notes: s.notes.slice(),
        elapsedMs: elapsedOf(s, now),
        mistakes: s.mistakes,
        mistakeLimit: s.mistakeLimit,
        hintsUsed: s.hintsUsed,
        moves: s.moves,
        startedAt: s.startedAt,
        updatedAt: now,
        completedAt: null,
        history: s.history.slice(-150),
        future: s.future.slice(-50),
        paused: s.pausedBy === "user" ? true : undefined,
        syncedAt: s.syncedAt,
      };
    },

    reset: () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      set({ ...blankState(), screenActive: get().screenActive });
    },
  };
});
