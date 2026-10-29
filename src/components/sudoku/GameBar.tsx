"use client";

import { Check, ChevronLeft, Circle, Eraser, Grid3x3, Keyboard, MoreHorizontal, Pencil, RotateCcw, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { IconButton } from "@/components/ui/IconButton";
import { LogoMark } from "@/components/layout/Logo";
import { ThemePicker } from "@/components/layout/ThemePicker";
import { restartCurrent } from "@/features/game/actions";
import { cn } from "@/lib/cn";
import { formatDateLong } from "@/lib/date";
import { DIFFICULTY_LABEL } from "@/lib/format";
import { useGameStore } from "@/stores/game";
import { useUiStore } from "@/stores/ui";

function SaveIndicator() {
  const status = useGameStore((s) => s.saveStatus);
  return (
    <span
      aria-live="polite"
      className={cn(
        "hidden items-center gap-1.5 px-2 text-[12px] text-ink-3 transition-opacity duration-300 min-[380px]:flex",
        status === "idle" ? "opacity-0" : "opacity-100",
      )}
    >
      {status === "saving" ? (
        <>
          <Circle className="size-2.5 animate-pulse fill-current" /> Saving
        </>
      ) : (
        <>
          <Check className="size-3.5" strokeWidth={2.4} /> Saved
        </>
      )}
    </span>
  );
}

export function GameBar() {
  const router = useRouter();
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);
  const dailyDate = useGameStore((s) => s.dailyDate);
  const phase = useGameStore((s) => s.phase);
  const fillNotes = useGameStore((s) => s.fillNotes);
  const clearNotes = useGameStore((s) => s.clearNotes);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const active = phase === "playing";
  const hasGame = phase === "playing" || phase === "completed" || phase === "failed";

  return (
    <>
      <header className="game-bar">
        <IconButton label="Home" onClick={() => router.push("/")}>
          <ChevronLeft className="size-[22px]" />
        </IconButton>

        {hasGame ? (
          <div className="min-w-0 flex-1 side:hidden">
            <div className="truncate text-[16px] leading-5 font-semibold tracking-[-0.01em] text-ink">{DIFFICULTY_LABEL[difficulty]}</div>
            {mode === "daily" && dailyDate ? (
              <div className="truncate text-[11px] leading-4 font-medium tracking-[0.08em] text-ink-2 uppercase">
                Daily · {formatDateLong(dailyDate)}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <Link href="/" className="hidden flex-1 items-center gap-2 text-ink side:flex" aria-label="Sudoku home">
          <LogoMark className="size-6" />
        </Link>

        <SaveIndicator />

        <ThemePicker />

        <DropdownMenu
          items={[
            { key: "fill", label: "Fill all notes", icon: <Grid3x3 className="size-4" />, disabled: !active, onSelect: fillNotes },
            { key: "clear", label: "Clear all notes", icon: <Eraser className="size-4" />, disabled: !active, onSelect: clearNotes },
            "separator",
            {
              key: "restart",
              label: "Restart puzzle",
              icon: <RotateCcw className="size-4" />,
              disabled: !hasGame,
              onSelect: () => setConfirmRestart(true),
            },
            "separator",
            {
              key: "keys",
              label: "Keyboard shortcuts",
              icon: <Keyboard className="size-4" />,
              hint: "?",
              onSelect: () => useUiStore.getState().setShortcutsOpen(true),
            },
            {
              key: "how",
              label: "How to play",
              icon: <Pencil className="size-4" />,
              onSelect: () => useUiStore.getState().setOnboardingOpen(true),
            },
            { key: "settings", label: "Settings", icon: <Settings className="size-4" />, onSelect: () => router.push("/settings/") },
          ]}
          trigger={({ open, toggle, id, menuId, ref }) => (
            <button
              ref={ref}
              id={id}
              type="button"
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={open ? menuId : undefined}
              onClick={toggle}
              className="inline-flex size-11 items-center justify-center rounded-[10px] text-ink-2 transition-[background-color,color,transform] duration-150 hover:bg-surface-2 hover:text-ink active:scale-[0.94]"
            >
              <MoreHorizontal className="size-5" />
            </button>
          )}
        />
      </header>

      <ConfirmDialog
        open={confirmRestart}
        title="Restart this puzzle?"
        description="Your current progress stays in history as abandoned, and you'll start again from the original numbers."
        confirmLabel="Restart"
        destructive
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          setConfirmRestart(false);
          restartCurrent();
        }}
      />
    </>
  );
}
