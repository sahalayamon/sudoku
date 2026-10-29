"use client";

import { Kbd } from "@/components/ui/Kbd";
import { Modal } from "@/components/ui/Modal";
import { useUiStore } from "@/stores/ui";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["1", "–", "9"], label: "Enter a number" },
  { keys: ["⇧", "1–9"], label: "Toggle a note (opposite of notes mode)" },
  { keys: ["←", "↑", "↓", "→"], label: "Move between cells" },
  { keys: ["⌫"], label: "Erase the selected cell" },
  { keys: ["N"], label: "Switch notes mode" },
  { keys: ["C"], label: "Check for mistakes" },
  { keys: ["H"], label: "Hint (press again to go deeper)" },
  { keys: ["Z"], label: "Undo" },
  { keys: ["⇧", "Z"], label: "Redo" },
  { keys: ["Space"], label: "Pause or resume" },
  { keys: ["Enter"], label: "Next empty cell, or next hint step" },
  { keys: ["Esc"], label: "Clear selection or close a hint" },
  { keys: ["?"], label: "Show this list" },
];

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Keyboard shortcuts"
      description="Everything works from the keyboard."
      size="md"
    >
      <ul className="flex flex-col divide-y divide-line">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4 py-2.5 text-[14px]">
            <span className="text-ink-2">{s.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {s.keys.map((k, i) =>
                k === "–" ? (
                  <span key={i} className="text-ink-3">
                    –
                  </span>
                ) : (
                  <Kbd key={i}>{k}</Kbd>
                ),
              )}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
