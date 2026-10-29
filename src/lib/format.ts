import type { Difficulty } from "@/lib/sudoku";

/** 18:42 under an hour, 1:02:03 beyond. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${String(m).padStart(2, "0")}:${ss}`;
}

/** "12 min", "1 h 4 min" - for prose. */
export function formatDurationWords(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60000));
  if (total < 1) return "under a minute";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Beginner",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

export const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  beginner: "Gentle and spacious. Every step is a single clear answer.",
  easy: "A few more empty cells. Scan boxes for numbers with one home.",
  medium: "Tighter grids. Hidden singles across rows and columns.",
  hard: "Candidate interactions: locked sets, pairs and triples.",
  expert: "Wings and fish. Patterns that span the whole board.",
};

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The techniques that define each level (what you will actually reach for). */
export const DIFFICULTY_SKILLS: Record<Difficulty, readonly string[]> = {
  beginner: ["Naked single"],
  easy: ["Naked single", "Hidden single in a box"],
  medium: ["Hidden single in a row or column"],
  hard: ["Locked candidates", "Pairs", "Triples"],
  expert: ["X-Wing", "XY-Wing", "XYZ-Wing", "Swordfish"],
};

/** Roughly how many numbers a puzzle of this level starts with. */
export const DIFFICULTY_GIVENS: Record<Difficulty, string> = {
  beginner: "39 – 46",
  easy: "33 – 38",
  medium: "28 – 33",
  hard: "25 – 30",
  expert: "24 – 32",
};
