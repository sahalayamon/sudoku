"use client";

import { AnimatePresence, m } from "framer-motion";
import { Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";
import { useGameStore } from "@/stores/game";

function LevelDots({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span key={n} className={cn("h-1 w-4 rounded-full transition-colors duration-300", n <= level ? "bg-hint" : "bg-line-strong")} />
      ))}
    </span>
  );
}

/**
 * Progressive hints: point at the cell, explain the reasoning, then (only if asked) reveal the number.
 * On phones it floats above the controls; on wide screens it sits in the side panel.
 */
export function HintPanel() {
  const active = useGameStore((s) => s.hint);
  const request = useGameStore((s) => s.requestHint);
  const reveal = useGameStore((s) => s.revealHint);
  const dismiss = useGameStore((s) => s.dismissHint);

  return (
    <AnimatePresence initial={false}>
      {active ? (
        <m.section
          key="hint"
          role="region"
          aria-label="Hint"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.22, 0.8, 0.28, 1] }}
          className={cn(
            "fixed inset-x-3 z-50 rounded-[18px] border border-line bg-surface p-4 shadow-[var(--shadow-pop)]",
            "side:static side:inset-auto side:z-auto side:shadow-none",
          )}
          style={{ bottom: "calc(var(--safe-bottom) + 12px)" }}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-hint-soft text-hint">
              <Lightbulb className="size-4" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="truncate text-[15px] leading-5 font-semibold text-ink">{active.hint.title}</h3>
                <LevelDots level={active.level} />
              </div>

              {active.level === 1 ? (
                <p className="mt-1 text-[14px] leading-[21px] text-ink-2">{active.hint.nudge}</p>
              ) : (
                <ol className="mt-1.5 flex max-h-[34dvh] flex-col gap-2 overflow-y-auto pr-1 side:max-h-[260px]">
                  {active.hint.steps.map((step, i) => (
                    <li key={i} className="text-[14px] leading-[21px] text-ink-2">
                      {active.hint.steps.length > 1 ? <span className="mr-1.5 font-medium text-ink">{step.title}.</span> : null}
                      {step.text}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <IconButton label="Dismiss hint" onClick={dismiss} tooltip={false} className="-mt-1 -mr-2 size-9">
              <X className="size-4" />
            </IconButton>
          </div>

          <div className="mt-3 flex gap-2">
            {active.level === 1 ? (
              <>
                <Button variant="primary" size="sm" className="flex-1" onClick={request}>
                  Explain
                </Button>
                <Button variant="secondary" size="sm" className="flex-1" onClick={reveal}>
                  {active.hint.kind === "error" ? "Fix it" : "Reveal number"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" size="sm" className="flex-1" onClick={reveal}>
                  {active.hint.kind === "error" ? `Fix it · ${active.hint.digit}` : `Reveal ${active.hint.digit}`}
                </Button>
                <Button variant="secondary" size="sm" className="flex-1" onClick={dismiss}>
                  Got it
                </Button>
              </>
            )}
          </div>
        </m.section>
      ) : null}
    </AnimatePresence>
  );
}
