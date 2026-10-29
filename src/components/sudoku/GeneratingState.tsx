import { Spinner } from "@/components/ui/Spinner";

/** Placeholder board while a puzzle is being built. Never a blank screen. */
export function GeneratingBoard({ label }: { label: string }) {
  return (
    <div className="board-frame" role="status" aria-live="polite" aria-label={label}>
      <svg className="board-lines" viewBox="0 0 9 9" preserveAspectRatio="none" aria-hidden="true">
        {[1, 2, 4, 5, 7, 8].map((i) => (
          <g key={i} stroke="var(--grid-thin)" strokeWidth={1}>
            <line x1={i} y1={0} x2={i} y2={9} />
            <line x1={0} y1={i} x2={9} y2={i} />
          </g>
        ))}
        {[3, 6].map((i) => (
          <g key={i} stroke="var(--grid-strong)" strokeWidth={2}>
            <line x1={i} y1={0} x2={i} y2={9} />
            <line x1={0} y1={i} x2={9} y2={i} />
          </g>
        ))}
      </svg>
      <div className="absolute inset-0 animate-[shimmer_1.8s_linear_infinite] bg-[linear-gradient(110deg,transparent_30%,var(--accent-softer)_50%,transparent_70%)] bg-[length:200%_100%]" />
      <div className="absolute inset-0 z-[4] flex flex-col items-center justify-center gap-3 bg-[color-mix(in_srgb,var(--board-bg)_70%,transparent)] text-center">
        <Spinner className="size-6 text-accent" />
        <p className="px-6 text-[14px] text-ink-2">{label}…</p>
      </div>
    </div>
  );
}
