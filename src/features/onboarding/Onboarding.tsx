"use client";

import { Pencil } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { useMetaStore } from "@/stores/meta";
import { useUiStore } from "@/stores/ui";

/** The tiny practice block: a 3x3 box with one empty cell in the middle. */
const BLOCK = [1, 2, 3, 4, 0, 6, 7, 8, 9];
const BLOCK_NOTES = [0, 0, 3, 4, 0, 6, 7, 8, 0];
const CENTER = 4;
const ANSWER = 5;

const STEPS = [
  { title: "Select a cell.", body: "Tap any empty cell to select it. The row, column and box light up so you can see what it must avoid." },
  {
    title: "Choose a number.",
    body: "Each digit 1–9 appears once in every row, column and 3×3 box. Eight are here. Which one is missing?",
  },
  {
    title: "Use notes when needed.",
    body: "Not sure yet? Switch on notes and pencil in the numbers that could fit. Tap a note again to remove it.",
  },
] as const;

function MiniBlock({
  cells,
  selected,
  value,
  notes,
  pulse,
  shake,
  onSelect,
}: {
  cells: readonly number[];
  selected: boolean;
  value: number;
  notes: number;
  pulse: boolean;
  shake: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Practice block"
      className="mx-auto grid w-[204px] grid-cols-3 overflow-hidden rounded-[12px] border-2 border-[var(--grid-strong)] bg-[var(--board-bg)] sm:w-[222px]"
    >
      {cells.map((digit, i) => {
        const isTarget = i === CENTER;
        const shown = isTarget ? value : digit;
        return (
          <button
            key={i}
            type="button"
            disabled={!isTarget}
            onClick={isTarget ? onSelect : undefined}
            aria-label={isTarget ? (value ? `Cell with ${value}` : "Empty cell. Tap to select") : `Given ${digit}`}
            className={cn(
              "relative grid aspect-square place-items-center border-[var(--grid-thin)] text-[28px] font-semibold text-ink",
              i % 3 !== 2 && "border-r",
              i < 6 && "border-b",
              isTarget && "cursor-pointer",
              isTarget && selected && "bg-[var(--selected-bg)]",
              !isTarget && selected && "bg-[var(--peer-bg)]",
            )}
          >
            {shown ? (
              <span className={cn(isTarget ? "font-[440] text-accent animate-[cell-pop_240ms_var(--ease-spring)]" : "")} key={shown}>
                {shown}
              </span>
            ) : null}
            {isTarget && !value && notes ? (
              <span
                className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-[7%] text-[11px] leading-none font-medium text-ink-2"
                aria-hidden="true"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <span key={d} className="grid place-items-center">
                    {notes & (1 << (d - 1)) ? d : ""}
                  </span>
                ))}
              </span>
            ) : null}
            {isTarget && selected ? (
              <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_2.5px_var(--accent)]" />
            ) : null}
            {isTarget && pulse && !selected ? (
              <span className="pointer-events-none absolute inset-1 animate-[hint-breathe_1.6s_ease-in-out_infinite] rounded-[6px] border-2 border-dashed border-accent" />
            ) : null}
            {isTarget && shake ? <span className="absolute inset-0 animate-[cell-shake_320ms_ease-out]" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function MiniKeypad({ onPick, notesMode, disabled }: { onPick: (d: number) => void; notesMode: boolean; disabled: boolean }) {
  return (
    <div className="mx-auto grid max-w-[320px] grid-cols-9 gap-1" role="group" aria-label="Practice keypad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          onClick={() => onPick(d)}
          className={cn(
            "h-11 rounded-[9px] border border-line bg-surface text-[18px] font-medium transition-[background-color,transform] duration-100 hover:bg-surface-2 active:scale-95 disabled:opacity-40",
            notesMode ? "text-accent" : "text-ink",
          )}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

function OnboardingFlow({ open }: { open: boolean }) {
  const setOpen = useUiStore((s) => s.setOnboardingOpen);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(false);
  const [value, setValue] = useState(0);
  const [shake, setShake] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [notesOn, setNotesOn] = useState(false);
  const [notes, setNotes] = useState(0);

  const close = () => {
    setOpen(false);
    useMetaStore.getState().patch({ onboardingSeen: true });
  };

  const pick = (d: number) => {
    if (step === 1) {
      if (!selected) {
        setMessage("Tap the highlighted cell first.");
        return;
      }
      if (d === ANSWER) {
        setValue(ANSWER);
        setMessage("Right. 5 is the only number this box is missing.");
      } else {
        setShake((n) => n + 1);
        setMessage("Not quite. Look for the digit that isn't in the box yet.");
      }
    } else if (step === 2) {
      if (!notesOn) {
        setMessage("Turn on notes first.");
        return;
      }
      setNotes((n) => n ^ (1 << (d - 1)));
      setMessage(null);
    }
  };

  const last = step === STEPS.length - 1;
  const current = STEPS[step]!;
  const cells = step === 2 ? BLOCK_NOTES : BLOCK;

  return (
    <Modal
      open={open}
      onClose={close}
      title={current.title}
      description={current.body}
      size="sm"
      footer={
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`} role="img">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn("h-1.5 rounded-full transition-all duration-300", i === step ? "w-6 bg-accent" : "w-1.5 bg-line-strong")}
              />
            ))}
          </div>
          {!last ? (
            <Button variant="ghost" onClick={close}>
              Skip
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={() => {
              if (last) close();
              else {
                setStep(step + 1);
                setMessage(null);
                if (step === 1) {
                  setSelected(true);
                  setValue(0);
                }
              }
            }}
          >
            {last ? "Start playing" : "Next"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2 pb-2">
        <MiniBlock
          key={shake}
          cells={cells}
          selected={selected}
          value={step === 2 ? 0 : value}
          notes={step === 2 ? notes : 0}
          pulse={step === 0}
          shake={shake > 0 && step === 1 && !value}
          onSelect={() => {
            setSelected(true);
            if (step === 0) setMessage("Selected. Related cells are tinted.");
          }}
        />

        {step === 2 ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setNotesOn((v) => !v)}
              aria-pressed={notesOn}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors",
                notesOn ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2 hover:bg-surface-2",
              )}
            >
              <Pencil className="size-4" /> Notes {notesOn ? "on" : "off"}
            </button>
          </div>
        ) : null}

        {step > 0 ? <MiniKeypad onPick={pick} notesMode={step === 2 && notesOn} disabled={false} /> : null}

        <p role="status" aria-live="polite" className="min-h-[20px] text-center text-[13px] text-ink-2">
          {message ?? (step === 0 ? "Tap the dashed cell." : step === 1 ? "Tap a number below." : "Turn on notes, then tap a few numbers.")}
        </p>
      </div>
    </Modal>
  );
}

/** Shows once on the home screen for first-time players; reopenable from Settings and the game menu. */
export function Onboarding() {
  const open = useUiStore((s) => s.onboardingOpen);
  const session = useUiStore((s) => s.onboardingSession);
  const setOpen = useUiStore((s) => s.setOnboardingOpen);
  const hydrated = useMetaStore((s) => s.hydrated);
  const seen = useMetaStore((s) => s.onboardingSeen);
  const pathname = usePathname();

  useEffect(() => {
    if (hydrated && !seen && pathname === "/") setOpen(true);
  }, [hydrated, seen, pathname, setOpen]);

  return <OnboardingFlow key={session} open={open} />;
}
