import { cn } from "@/lib/cn";

/** The mark: a 3x3 grid with one cell resolved. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("size-7", className)}>
      <rect x="2.5" y="2.5" width="27" height="27" rx="8" stroke="currentColor" strokeWidth="2" />
      <path d="M11.5 3v26M20.5 3v26M3 11.5h26M3 20.5h26" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.25" />
      <rect x="12.1" y="12.1" width="8.3" height="8.3" rx="1.6" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-serif text-[26px] leading-none tracking-[-0.01em]", className)}>Sudoku</span>;
}
