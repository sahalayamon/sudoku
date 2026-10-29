"use client";

import { Check, Monitor, Moon, Palette as PaletteIcon, Sun } from "lucide-react";
import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import { Popover } from "@/components/ui/Popover";
import { Segmented } from "@/components/ui/Segmented";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { PALETTES, PALETTE_GROUPS, palettesInGroup, type Palette, type PaletteGroup } from "@/lib/palettes";
import { useSettingsStore } from "@/stores/settings";
import type { ThemePreference } from "@/types/settings";

const APPEARANCE = [
  {
    value: "system" as const,
    label: (
      <span className="flex items-center justify-center gap-1.5">
        <Monitor className="size-[15px]" /> System
      </span>
    ),
    ariaLabel: "System",
  },
  {
    value: "light" as const,
    label: (
      <span className="flex items-center justify-center gap-1.5">
        <Sun className="size-[15px]" /> Light
      </span>
    ),
    ariaLabel: "Light",
  },
  {
    value: "dark" as const,
    label: (
      <span className="flex items-center justify-center gap-1.5">
        <Moon className="size-[15px]" /> Dark
      </span>
    ),
    ariaLabel: "Dark",
  },
];

/** Appearance (system / light / dark). Applies to whichever colour or theme is chosen. */
export function AppearanceControl({ className }: { className?: string }) {
  const theme = useSettingsStore((s) => s.theme);
  const update = useSettingsStore((s) => s.update);
  return (
    <Segmented<ThemePreference>
      label="Appearance"
      value={theme}
      onChange={(next) => update({ theme: next })}
      options={APPEARANCE}
      className={className}
    />
  );
}

function Swatch({ palette, selected }: { palette: Palette; selected: boolean }) {
  const style = {
    "--sw-l": palette.light,
    "--sw-d": palette.dark,
    "--bg-l": palette.bgLight ?? palette.light,
    "--bg-d": palette.bgDark ?? palette.dark,
  } as CSSProperties;
  const ring = selected ? "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--ink)]" : "shadow-[inset_0_0_0_1px_rgb(127_127_127/0.4)]";
  const base = "grid size-[34px] place-items-center rounded-full transition-[transform,box-shadow] duration-150 ease-out";
  const motion = "group-hover:scale-105 group-active:scale-90";

  // Accent palettes are a solid dot of colour.
  if (palette.group === "accent") {
    return (
      <span style={style} className={cn(base, motion, ring, "bg-[var(--sw-l)] dark:bg-[var(--sw-d)]")}>
        {selected ? <Check className="size-4 text-white dark:text-[#0b0e11]" strokeWidth={3} /> : null}
      </span>
    );
  }
  // Full themes show their page colour with the accent set into it.
  return (
    <span style={style} className={cn(base, motion, ring, "bg-[var(--bg-l)] dark:bg-[var(--bg-d)]")}>
      <span className="grid size-[18px] place-items-center rounded-full bg-[var(--sw-l)] dark:bg-[var(--sw-d)]">
        {selected ? <Check className="size-2.5 text-white dark:text-[#0b0e11]" strokeWidth={3.5} /> : null}
      </span>
    </span>
  );
}

/** One group of choices as a radio group. Arrow keys move and select within the group. */
export function PaletteGroupSwatches({
  group,
  showNames = true,
  className,
}: {
  group: PaletteGroup;
  showNames?: boolean;
  className?: string;
}) {
  const palette = useSettingsStore((s) => s.palette);
  const update = useSettingsStore((s) => s.update);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const items = palettesInGroup(group);
  const label = PALETTE_GROUPS.find((g) => g.id === group)?.label ?? group;
  const selectedIndex = items.findIndex((p) => p.id === palette);
  // A group with no selection still needs one Tab stop.
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const dir = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    event.preventDefault();
    const from = selectedIndex === -1 ? (dir === 1 ? -1 : 0) : selectedIndex;
    const next = (from + dir + items.length) % items.length;
    update({ palette: items[next]!.id });
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={cn("flex items-start justify-between gap-1", className)}>
      {items.map((p, i) => {
        const selected = p.id === palette;
        return (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${p.name}. ${p.description}`}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => update({ palette: p.id })}
            className="group flex w-[52px] flex-col items-center gap-1.5 rounded-[12px] py-1 outline-offset-0"
          >
            <Swatch palette={p} selected={selected} />
            {showNames ? (
              <span className={cn("text-[11px] leading-none font-medium transition-colors", selected ? "text-ink" : "text-ink-3")}>
                {p.name}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Every group, each under its own heading. Used by the picker and by Settings. */
export function PaletteSections({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {PALETTE_GROUPS.map((g) => (
        <div key={g.id}>
          <div className="eyebrow mb-1.5">{g.label}</div>
          <PaletteGroupSwatches group={g.id} />
        </div>
      ))}
    </div>
  );
}

/** Header control: pick light/dark, an accent colour or a full theme without leaving the page. */
export function ThemePicker() {
  const palette = useSettingsStore((s) => s.palette);
  const current = PALETTES.find((p) => p.id === palette) ?? PALETTES[0]!;

  return (
    <Popover
      label="Theme"
      trigger={({ open, toggle, id, panelId, ref }) => (
        <Tooltip label="Theme">
          <button
            ref={ref}
            id={id}
            type="button"
            aria-label="Theme"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={toggle}
            className={cn(
              "relative inline-flex size-11 items-center justify-center rounded-[10px] text-ink-2 transition-[background-color,color,transform] duration-150 ease-out",
              "hover:bg-surface-2 hover:text-ink active:scale-[0.94]",
              open && "bg-surface-2 text-ink",
            )}
          >
            <PaletteIcon className="size-[19px]" />
            <span
              aria-hidden="true"
              style={{ "--sw-l": current.light, "--sw-d": current.dark } as CSSProperties}
              className="absolute right-2 bottom-2 size-[9px] rounded-full bg-[var(--sw-l)] ring-2 ring-bg dark:bg-[var(--sw-d)]"
            />
          </button>
        </Tooltip>
      )}
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="eyebrow mb-2">Appearance</div>
          <AppearanceControl />
        </div>
        <PaletteSections />
      </div>
    </Popover>
  );
}
