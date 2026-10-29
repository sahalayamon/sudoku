/**
 * Colour options.
 *
 *  - "accent" palettes re-colour only the accent family (selection, your numbers, primary
 *    buttons, progress) on top of the default neutrals.
 *  - "theme" palettes are complete looks: they also change the page, card and board neutrals
 *    (and sometimes the hint colour), each defined for light and dark.
 *
 * The tokens live in globals.css under `[data-theme][data-palette]`. The swatch colours here
 * only feed the picker; tests keep them in sync with the CSS and check contrast.
 */

export type PaletteGroup = "accent" | "theme";

export type PaletteId = "verdigris" | "indigo" | "ocean" | "plum" | "graphite" | "midnight" | "sepia" | "sage" | "slate" | "contrast";

export interface Palette {
  id: PaletteId;
  name: string;
  group: PaletteGroup;
  /** One-line description for assistive tech. */
  description: string;
  /** Accent colour in light and dark (matches --accent). */
  light: string;
  dark: string;
  /** Page background in light and dark (matches --bg). Only set for full themes. */
  bgLight?: string;
  bgDark?: string;
}

export const PALETTES: readonly Palette[] = [
  { id: "verdigris", name: "Verdigris", group: "accent", description: "Calm teal-green.", light: "#2a7468", dark: "#62c7b0" },
  { id: "indigo", name: "Indigo", group: "accent", description: "Deep, focused blue-violet.", light: "#4651c7", dark: "#9aa4ff" },
  { id: "ocean", name: "Ocean", group: "accent", description: "Clear, open blue.", light: "#1f6fb2", dark: "#7cc0f5" },
  { id: "plum", name: "Plum", group: "accent", description: "Quiet, rich purple.", light: "#8a3f8f", dark: "#d8a2de" },
  { id: "graphite", name: "Graphite", group: "accent", description: "Monochrome. Ink on paper.", light: "#2b2e33", dark: "#e8e5df" },

  {
    id: "sage",
    name: "Sage",
    group: "theme",
    description: "Soft green-grey neutrals with a leaf-green accent. The default.",
    light: "#46702a",
    dark: "#a3d977",
    bgLight: "#eef0e8",
    bgDark: "#0f140d",
  },
  {
    id: "midnight",
    name: "Midnight",
    group: "theme",
    description: "Deep navy surfaces with a soft blue accent.",
    light: "#3b5bdb",
    dark: "#7aa2ff",
    bgLight: "#eef1f8",
    bgDark: "#0a0f1f",
  },
  {
    id: "sepia",
    name: "Sepia",
    group: "theme",
    description: "Warm parchment with brown ink, like an old puzzle book.",
    light: "#7a5230",
    dark: "#d7a384",
    bgLight: "#f1e8d6",
    bgDark: "#1a140d",
  },
  {
    id: "slate",
    name: "Slate",
    group: "theme",
    description: "Cool, quiet greys with a muted steel blue.",
    light: "#3d5a80",
    dark: "#8fb0d4",
    bgLight: "#eceef1",
    bgDark: "#101317",
  },
  {
    id: "contrast",
    name: "Contrast",
    group: "theme",
    description: "Maximum contrast: pure black and white with strong borders.",
    light: "#0033cc",
    dark: "#7cc4ff",
    bgLight: "#ffffff",
    bgDark: "#000000",
  },
];

/** The palette the base tokens in globals.css describe. It needs no override block. */
export const BASE_PALETTE: PaletteId = "verdigris";

/** What a new install starts with. */
export const DEFAULT_PALETTE: PaletteId = "sage";

export const PALETTE_GROUPS: readonly { id: PaletteGroup; label: string }[] = [
  { id: "accent", label: "Colour" },
  { id: "theme", label: "Themes" },
];

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === "string" && PALETTES.some((p) => p.id === value);
}

export function palettesInGroup(group: PaletteGroup): readonly Palette[] {
  return PALETTES.filter((p) => p.group === group);
}
