/**
 * Generates the CSS for the full themes (neutrals + accent) from one table and writes it
 * between the markers in src/app/globals.css. Edit the table, run `npm run themes`.
 *
 * Every value is a token the app already uses, so a theme can never reach for something the
 * rest of the UI does not understand. tests/palettes.test.ts checks contrast for each one.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app", "globals.css");

/** [r g b] of a #rrggbb colour, for the translucent tokens. */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
const a = (hex, alpha) => `rgb(${rgb(hex)} / ${alpha})`;

/**
 * mode defaults: alphas for the translucent accent fills.
 * Each mode lists solid colours; alphas can be overridden per mode with `fills`.
 */
const THEMES = {
  midnight: {
    light: {
      bg: "#eef1f8",
      surface: "#f8f9fd",
      surface2: "#e6eaf5",
      surface3: "#dbe1f0",
      ink: "#121a33",
      ink2: "#4a5473",
      ink3: "#5f6a8c",
      line: "#dde2f0",
      lineStrong: "#c3cbe3",
      boardBg: "#fbfcff",
      gridThin: "#d3d9ec",
      gridStrong: "#1f2a4d",
      peer: "#121a33",
      accent: "#3b5bdb",
      accentHover: "#2f49b3",
      accentInk: "#ffffff",
    },
    dark: {
      bg: "#0a0f1f",
      surface: "#101730",
      surface2: "#172040",
      surface3: "#1f2a52",
      ink: "#e8ecfa",
      ink2: "#a6aed0",
      ink3: "#8089b0",
      line: "#1c2748",
      lineStrong: "#2b3a6a",
      boardBg: "#0d1328",
      gridThin: "#212c52",
      gridStrong: "#7684b8",
      peer: "#b4c3ff",
      accent: "#7aa2ff",
      accentHover: "#99b8ff",
      accentInk: "#0a1233",
    },
  },
  sepia: {
    light: {
      bg: "#f1e8d6",
      surface: "#f8f1e2",
      surface2: "#ebdfc8",
      surface3: "#e0d1b4",
      ink: "#2b2118",
      ink2: "#5a4a37",
      ink3: "#6f5e48",
      line: "#e0d3b9",
      lineStrong: "#cbb998",
      boardBg: "#fbf6e9",
      gridThin: "#dccdae",
      gridStrong: "#3a2d20",
      peer: "#2b2118",
      accent: "#7a5230",
      accentHover: "#63421f",
      accentInk: "#ffffff",
      hint: "#2f6f5e",
    },
    dark: {
      bg: "#1a140d",
      surface: "#231b12",
      surface2: "#2c2217",
      surface3: "#382c1d",
      ink: "#f0e6d2",
      ink2: "#b9a98c",
      ink3: "#9a8a6d",
      line: "#2f2518",
      lineStrong: "#46372a",
      boardBg: "#1e1710",
      gridThin: "#33281b",
      gridStrong: "#9a8668",
      peer: "#f0e6d2",
      accent: "#d7a384",
      accentHover: "#e3b89d",
      accentInk: "#2a1a0e",
      hint: "#7fc4ae",
    },
  },
  sage: {
    light: {
      bg: "#eef0e8",
      surface: "#f7f8f2",
      surface2: "#e4e8dc",
      surface3: "#d9dfce",
      ink: "#1b2118",
      ink2: "#4c5746",
      ink3: "#5f6a58",
      line: "#dde2d3",
      lineStrong: "#c4ccb5",
      boardBg: "#fafbf6",
      gridThin: "#d3dac6",
      gridStrong: "#28321f",
      peer: "#1b2118",
      accent: "#46702a",
      accentHover: "#365a1f",
      accentInk: "#ffffff",
    },
    dark: {
      bg: "#0f140d",
      surface: "#161d13",
      surface2: "#1e271a",
      surface3: "#283323",
      ink: "#e8eddf",
      ink2: "#a7b29a",
      ink3: "#869279",
      line: "#1f291b",
      lineStrong: "#314029",
      boardBg: "#121810",
      gridThin: "#243020",
      gridStrong: "#7a8c6a",
      peer: "#e8eddf",
      accent: "#a3d977",
      accentHover: "#b8e592",
      accentInk: "#12220a",
    },
  },
  slate: {
    light: {
      bg: "#eceef1",
      surface: "#f6f7f9",
      surface2: "#e1e5ea",
      surface3: "#d5dae1",
      ink: "#14181d",
      ink2: "#48505b",
      ink3: "#5c6571",
      line: "#dbdfe5",
      lineStrong: "#c2c8d1",
      boardBg: "#fafbfc",
      gridThin: "#d1d6de",
      gridStrong: "#1d232b",
      peer: "#14181d",
      accent: "#3d5a80",
      accentHover: "#2f4766",
      accentInk: "#ffffff",
    },
    dark: {
      bg: "#101317",
      surface: "#171b21",
      surface2: "#1e242c",
      surface3: "#272e38",
      ink: "#e6e9ee",
      ink2: "#a3abb7",
      ink3: "#808996",
      line: "#222831",
      lineStrong: "#343c48",
      boardBg: "#13171c",
      gridThin: "#262d37",
      gridStrong: "#7b8696",
      peer: "#e6e9ee",
      accent: "#8fb0d4",
      accentHover: "#a8c3e1",
      accentInk: "#0d1824",
    },
  },
  contrast: {
    light: {
      bg: "#ffffff",
      surface: "#ffffff",
      surface2: "#f0f0f0",
      surface3: "#e2e2e2",
      ink: "#000000",
      ink2: "#1f1f1f",
      ink3: "#3d3d3d",
      line: "#767676",
      lineStrong: "#000000",
      boardBg: "#ffffff",
      gridThin: "#8c8c8c",
      gridStrong: "#000000",
      peer: "#000000",
      accent: "#0033cc",
      accentHover: "#00269b",
      accentInk: "#ffffff",
      danger: "#b00020",
      hint: "#6b4500",
      fills: { peer: 0.09, soft: 0.12, softer: 0.07, same: 0.2, selected: 0.32 },
    },
    dark: {
      bg: "#000000",
      surface: "#0a0a0a",
      surface2: "#1a1a1a",
      surface3: "#2a2a2a",
      ink: "#ffffff",
      ink2: "#e6e6e6",
      ink3: "#c4c4c4",
      line: "#8a8a8a",
      lineStrong: "#ffffff",
      boardBg: "#000000",
      gridThin: "#8a8a8a",
      gridStrong: "#ffffff",
      peer: "#ffffff",
      accent: "#7cc4ff",
      accentHover: "#a5d8ff",
      accentInk: "#000000",
      danger: "#ff8a80",
      hint: "#ffd166",
      fills: { peer: 0.13, soft: 0.18, softer: 0.1, same: 0.26, selected: 0.42 },
    },
  },
};

const DEFAULT_FILLS = {
  light: { peer: 0.05, soft: 0.1, softer: 0.06, same: 0.14, selected: 0.22 },
  dark: { peer: 0.07, soft: 0.15, softer: 0.08, same: 0.17, selected: 0.28 },
};

function block(mode, id, t) {
  const f = { ...DEFAULT_FILLS[mode], ...(t.fills ?? {}) };
  const lines = [
    `--bg: ${t.bg};`,
    `--surface: ${t.surface};`,
    `--surface-2: ${t.surface2};`,
    `--surface-3: ${t.surface3};`,
    `--ink: ${t.ink};`,
    `--ink-2: ${t.ink2};`,
    `--ink-3: ${t.ink3};`,
    `--line: ${t.line};`,
    `--line-strong: ${t.lineStrong};`,
    `--accent: ${t.accent};`,
    `--accent-hover: ${t.accentHover};`,
    `--accent-ink: ${t.accentInk};`,
    `--accent-soft: ${a(t.accent, f.soft)};`,
    `--accent-softer: ${a(t.accent, f.softer)};`,
    `--board-bg: ${t.boardBg};`,
    `--grid-thin: ${t.gridThin};`,
    `--grid-strong: ${t.gridStrong};`,
    `--peer-bg: ${a(t.peer, f.peer)};`,
    `--same-bg: ${a(t.accent, f.same)};`,
    `--selected-bg: ${a(t.accent, f.selected)};`,
  ];
  if (t.danger) lines.push(`--danger: ${t.danger};`, `--danger-soft: ${a(t.danger, mode === "dark" ? 0.18 : 0.12)};`);
  if (t.hint) {
    lines.push(
      `--hint: ${t.hint};`,
      `--hint-soft: ${a(t.hint, mode === "dark" ? 0.2 : 0.16)};`,
      `--hint-faint: ${a(t.hint, mode === "dark" ? 0.1 : 0.08)};`,
    );
  }
  const scrim = mode === "dark" ? "rgb(0 0 0 / 0.6)" : "rgb(10 12 20 / 0.36)";
  lines.push(`--scrim: ${scrim};`);
  return `:root[data-theme="${mode}"][data-palette="${id}"] {\n${lines.map((l) => `  ${l}`).join("\n")}\n}\n`;
}

const BEGIN = "/* BEGIN generated themes (scripts/generate-themes.mjs) */";
const END = "/* END generated themes */";

let out = `${BEGIN}\n/* Full themes: neutrals + accent, each for light and dark. */\n\n`;
for (const [id, modes] of Object.entries(THEMES)) {
  out += block("light", id, modes.light) + "\n" + block("dark", id, modes.dark) + "\n";
}
out += END;

let css = readFileSync(file, "utf8");
const start = css.indexOf(BEGIN);
if (start !== -1) {
  css = css.slice(0, start) + out + css.slice(css.indexOf(END) + END.length);
} else {
  css = css.replace("@theme inline {", `${out}\n\n@theme inline {`);
}
writeFileSync(file, css);
console.log(`themes: wrote ${Object.keys(THEMES).length} themes to src/app/globals.css`);
