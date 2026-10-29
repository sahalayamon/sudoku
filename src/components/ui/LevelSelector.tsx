"use client";

import { AnimatePresence, m } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { DIFFICULTY_LABEL } from "@/lib/format";
import { DIFFICULTIES, type Difficulty } from "@/lib/sudoku";

/** The level name between two arrows; each arrow is hidden at the end of the range. Slides in the direction of travel. */
export function LevelSelector({
  value,
  onChange,
  className,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  className?: string;
}) {
  const index = DIFFICULTIES.indexOf(value);
  const [dir, setDir] = useState<1 | -1>(1);
  const step = (by: 1 | -1) => {
    setDir(by);
    onChange(DIFFICULTIES[index + by] ?? value);
  };

  return (
    <div className={cn("relative flex h-12 w-full items-center justify-center", className)} role="group" aria-label="Level">
      <span className="relative grid h-9 w-40 place-items-center overflow-hidden text-[22px] text-ink" aria-live="polite">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <m.span
            key={value}
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 60, opacity: 0, filter: "blur(6px)" }),
              center: { x: 0, opacity: 1, filter: "blur(0px)" },
              exit: (d: number) => ({ x: d * -60, opacity: 0, filter: "blur(6px)" }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="absolute"
          >
            {DIFFICULTY_LABEL[value]}
          </m.span>
        </AnimatePresence>
      </span>
      {index > 0 ? (
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={`Easier: ${DIFFICULTY_LABEL[DIFFICULTIES[index - 1]!]}`}
          className="absolute left-[12%] flex size-12 items-center justify-center text-ink-2 hover:text-ink"
        >
          <ChevronLeft className="size-7" aria-hidden="true" />
        </button>
      ) : null}
      {index < DIFFICULTIES.length - 1 ? (
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={`Harder: ${DIFFICULTY_LABEL[DIFFICULTIES[index + 1]!]}`}
          className="absolute right-[12%] flex size-12 items-center justify-center text-ink-2 hover:text-ink"
        >
          <ChevronRight className="size-7" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
