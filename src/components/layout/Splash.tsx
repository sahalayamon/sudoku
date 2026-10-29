import { cn } from "@/lib/cn";
import { LogoMark } from "./Logo";

/**
 * Shown while local data loads. It is also the first thing in the static HTML, so installs
 * feel instant. Fading is plain CSS so it never depends on a JS animation loop.
 */
export function Splash({ leaving }: { leaving: boolean }) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] grid place-items-center bg-bg transition-opacity duration-300 ease-out",
        leaving ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      role="status"
      aria-label="Loading"
      aria-hidden={leaving || undefined}
    >
      <div className="flex flex-col items-center gap-4 text-ink">
        <LogoMark className="size-14" />
        <div className="mt-2 h-[3px] w-24 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full w-1/3 animate-[splash-slide_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
        </div>
      </div>
      <noscript>
        <p className="absolute bottom-10 text-sm text-ink-2">Sudoku needs JavaScript to run.</p>
      </noscript>
    </div>
  );
}
