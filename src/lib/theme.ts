import { DEFAULT_PALETTE, type PaletteId } from "@/lib/palettes";
import type { ThemePreference } from "@/types/settings";

export type ResolvedTheme = "light" | "dark";

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#eef0e8",
  dark: "#0f140d",
};

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return systemPrefersDark() ? "dark" : "light";
  return preference;
}

/** The page colour of the active theme, so the browser UI (status bar, address bar) matches it. */
export function syncThemeColor(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const computed = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  const color = /^#[0-9a-f]{3,8}$/i.test(computed) ? computed : THEME_COLORS[resolved];
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length) {
    metas.forEach((meta) => {
      meta.removeAttribute("media");
      meta.setAttribute("content", color);
    });
  } else {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = color;
    document.head.appendChild(meta);
  }
}

/** Apply light/dark to the document. */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  if (typeof document === "undefined") return resolved;
  document.documentElement.setAttribute("data-theme", resolved);
  syncThemeColor(resolved);
  return resolved;
}

/** Apply the accent palette. Colours come from CSS tokens keyed on `data-palette`. */
export function applyPalette(palette: PaletteId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-palette", palette);
  const theme = document.documentElement.getAttribute("data-theme");
  syncThemeColor(theme === "dark" ? "dark" : "light");
}

/**
 * Runs before first paint (inlined into <head>) so there is never a flash of the wrong theme.
 * Keep in sync with the settings storage key and envelope shape.
 */
export const THEME_BOOT_SCRIPT = `(function(){var h=document.documentElement;try{var t="system",a="${DEFAULT_PALETTE}";var raw=localStorage.getItem("sudoku:v1:settings");if(raw){var p=JSON.parse(raw);if(p&&p.d){if(p.d.theme)t=p.d.theme;if(p.d.palette)a=p.d.palette}}var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);h.setAttribute("data-theme",d?"dark":"light");h.setAttribute("data-palette",a)}catch(e){h.setAttribute("data-theme","light");h.setAttribute("data-palette","${DEFAULT_PALETTE}")}})();`;
