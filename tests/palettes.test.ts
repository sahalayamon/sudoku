import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { BASE_PALETTE, DEFAULT_PALETTE, PALETTES, PALETTE_GROUPS, isPaletteId, palettesInGroup } from "@/lib/palettes";
import { clearAllData, loadSettings } from "@/lib/storage/repository";
import { sanitizeSettings } from "@/lib/storage/sanitize";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { useSettingsStore } from "@/stores/settings";
import { DEFAULT_SETTINGS } from "@/types/settings";

const css = readFileSync(join(__dirname, "..", "src", "app", "globals.css"), "utf8");

/** Declarations of the rule with exactly this selector, as a token map. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return {};
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const map: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) map[m[1]!] = m[2]!.trim();
  return map;
}

type Mode = "light" | "dark";

/** What the browser computes for a palette in a mode: base tokens, then the palette's overrides. */
function effective(id: string, mode: Mode): Record<string, string> {
  const base = tokens(mode === "light" ? ":root" : ':root[data-theme="dark"]');
  return id === BASE_PALETTE ? base : { ...base, ...tokens(`:root[data-theme="${mode}"][data-palette="${id}"]`) };
}

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("palettes", () => {
  it("has unique ids, a default that exists, and both groups populated", () => {
    const ids = PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_PALETTE);
    for (const g of PALETTE_GROUPS) expect(palettesInGroup(g.id).length).toBeGreaterThanOrEqual(4);
    expect(isPaletteId("midnight")).toBe(true);
    expect(isPaletteId("neon")).toBe(false);
    expect(isPaletteId(3)).toBe(false);
  });

  it("every non-default palette defines light and dark tokens that match its swatches", () => {
    for (const p of PALETTES.filter((x) => x.id !== BASE_PALETTE)) {
      const light = tokens(`:root[data-theme="light"][data-palette="${p.id}"]`);
      const dark = tokens(`:root[data-theme="dark"][data-palette="${p.id}"]`);
      expect(light["--accent"], `${p.id} light accent`).toBe(p.light);
      expect(dark["--accent"], `${p.id} dark accent`).toBe(p.dark);
      for (const token of ["--accent-hover", "--accent-ink", "--accent-soft", "--accent-softer", "--same-bg", "--selected-bg"]) {
        expect(light[token], `${p.id} light ${token}`).toBeTruthy();
        expect(dark[token], `${p.id} dark ${token}`).toBeTruthy();
      }
      if (p.group === "theme") {
        expect(light["--bg"], `${p.id} light bg`).toBe(p.bgLight);
        expect(dark["--bg"], `${p.id} dark bg`).toBe(p.bgDark);
        for (const token of [
          "--surface",
          "--surface-2",
          "--surface-3",
          "--ink",
          "--ink-2",
          "--ink-3",
          "--line",
          "--line-strong",
          "--board-bg",
          "--grid-thin",
          "--grid-strong",
          "--peer-bg",
        ]) {
          expect(light[token], `${p.id} light ${token}`).toBeTruthy();
          expect(dark[token], `${p.id} dark ${token}`).toBeTruthy();
        }
      }
    }
  });

  it("the base palette's swatches match the base accent tokens", () => {
    const base = PALETTES.find((p) => p.id === BASE_PALETTE)!;
    expect(effective(base.id, "light")["--accent"]).toBe(base.light);
    expect(effective(base.id, "dark")["--accent"]).toBe(base.dark);
  });

  it("is applied before first paint by the boot script", () => {
    expect(THEME_BOOT_SCRIPT).toContain("data-palette");
    expect(THEME_BOOT_SCRIPT).toContain(DEFAULT_PALETTE);
    expect(() => new Function(THEME_BOOT_SCRIPT)).not.toThrow();
  });
});

describe.each(PALETTES.map((p) => [p.id, p] as const))("contrast: %s", (id) => {
  for (const mode of ["light", "dark"] as const) {
    it(`${mode} meets WCAG AA for text and controls`, () => {
      const t = effective(id, mode);
      const get = (name: string) => {
        const v = t[name];
        if (!v || !v.startsWith("#")) throw new Error(`${id}/${mode}: ${name} is not a solid colour (${v})`);
        return v;
      };
      const ratio = (fg: string, bg: string) => contrast(get(fg), get(bg));

      // Body text
      for (const surface of ["--bg", "--surface", "--board-bg"])
        expect(ratio("--ink", surface), `ink on ${surface}`).toBeGreaterThanOrEqual(7);
      for (const surface of ["--bg", "--surface"]) {
        expect(ratio("--ink-2", surface), `ink-2 on ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio("--ink-3", surface), `ink-3 on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
      // Your own numbers and accent text
      expect(ratio("--accent", "--board-bg"), "accent digits on the board").toBeGreaterThanOrEqual(4.5);
      expect(ratio("--accent", "--bg"), "accent on page").toBeGreaterThanOrEqual(4.5);
      // Primary buttons
      expect(ratio("--accent-ink", "--accent"), "button label on accent").toBeGreaterThanOrEqual(4.5);
      // Errors and hints
      expect(ratio("--danger", "--board-bg"), "error digits").toBeGreaterThanOrEqual(4.5);
      expect(ratio("--hint", "--surface"), "hint text").toBeGreaterThanOrEqual(4.5);
      // Board structure is visible (non-text contrast)
      expect(ratio("--grid-strong", "--board-bg"), "block lines").toBeGreaterThanOrEqual(3);
    });
  }
});

describe("high contrast theme", () => {
  it("also makes borders and thin grid lines clearly visible", () => {
    for (const mode of ["light", "dark"] as const) {
      const t = effective("contrast", mode);
      expect(contrast(t["--line"]!, t["--bg"]!), `${mode} card border`).toBeGreaterThanOrEqual(3);
      expect(contrast(t["--grid-thin"]!, t["--board-bg"]!), `${mode} thin grid lines`).toBeGreaterThanOrEqual(3);
      expect(contrast(t["--ink-3"]!, t["--bg"]!), `${mode} secondary text`).toBeGreaterThanOrEqual(7);
    }
  });
});

describe("palette setting", () => {
  beforeEach(() => {
    clearAllData();
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: true });
  });

  it("defaults to the default palette and ignores unknown values from disk or other devices", () => {
    expect(DEFAULT_SETTINGS.palette).toBe(DEFAULT_PALETTE);
    expect(sanitizeSettings({ palette: "plum" }).palette).toBe("plum");
    expect(sanitizeSettings({ palette: "midnight" }).palette).toBe("midnight");
    expect(sanitizeSettings({ palette: "neon" }).palette).toBe(DEFAULT_PALETTE);
    expect(sanitizeSettings({}).palette).toBe(DEFAULT_PALETTE);
    expect(sanitizeSettings(null).palette).toBe(DEFAULT_PALETTE);
  });

  it("persists a choice and keeps it when settings are reloaded", () => {
    useSettingsStore.getState().update({ palette: "sepia", theme: "dark" });
    expect(loadSettings()).toMatchObject({ palette: "sepia", theme: "dark" });
    useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().palette).toBe("sepia");
  });

  it("resets to the default palette with the other settings", () => {
    useSettingsStore.getState().update({ palette: "contrast" });
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().palette).toBe(DEFAULT_PALETTE);
  });
});
