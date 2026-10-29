"use client";

import { CheckCheck, Lightbulb, Pencil, Redo2, Undo2, type LucideIcon } from "lucide-react";
import { memo } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { useGameStore } from "@/stores/game";

interface ControlButtonProps {
  label: string;
  shortcut: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  active?: boolean;
}

function ControlButton({ label, shortcut, icon: Icon, onClick, disabled, pressed, active }: ControlButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut} className="flex flex-1 justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "flex size-14 items-center justify-center rounded-full text-ink-2",
          "transition-[background-color,color,transform] duration-150 ease-out hover:text-ink active:scale-[0.9]",
          "disabled:pointer-events-none disabled:opacity-35",
          (pressed || active) && "bg-accent-soft text-accent",
        )}
      >
        <Icon className="size-[26px]" strokeWidth={1.9} />
      </button>
    </Tooltip>
  );
}

export const GameControls = memo(function GameControls() {
  const playable = useGameStore((s) => s.phase === "playing" && !s.paused);
  const canUndo = useGameStore((s) => s.history.length > 0);
  const canRedo = useGameStore((s) => s.future.length > 0);
  const notesMode = useGameStore((s) => s.notesMode);
  const hintOpen = useGameStore((s) => s.hint !== null);
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const toggleNotes = useGameStore((s) => s.toggleNotesMode);
  const requestHint = useGameStore((s) => s.requestHint);
  const check = useGameStore((s) => s.check);

  return (
    <div role="toolbar" aria-label="Game controls" className="flex items-center justify-between px-1">
      <ControlButton label="Undo" shortcut="Z" icon={Undo2} onClick={undo} disabled={!playable || !canUndo} />
      <ControlButton label="Redo" shortcut="⇧Z" icon={Redo2} onClick={redo} disabled={!playable || !canRedo} />
      <ControlButton label="Notes" shortcut="N" icon={Pencil} onClick={toggleNotes} disabled={!playable} pressed={notesMode} />
      <ControlButton label="Check" shortcut="C" icon={CheckCheck} onClick={check} disabled={!playable} />
      <ControlButton label="Hint" shortcut="H" icon={Lightbulb} onClick={requestHint} disabled={!playable} active={hintOpen} />
    </div>
  );
});
