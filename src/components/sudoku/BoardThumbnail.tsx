import { memo } from "react";
import { cn } from "@/lib/cn";

interface BoardThumbnailProps {
  /** 81 chars, 0 = empty. */
  values: string;
  /** 81 chars; positions that are not "0" are drawn as givens. */
  givens: string;
  className?: string;
  label?: string;
}

/** A tiny, static rendering of a board. Real data, used on the home screen and in history. */
export const BoardThumbnail = memo(function BoardThumbnail({ values, givens, className, label }: BoardThumbnailProps) {
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < 81; i++) {
    const v = values[i];
    if (!v || v === "0") continue;
    const given = givens[i] !== "0";
    cells.push(
      <text
        key={i}
        x={(i % 9) + 0.5}
        y={Math.floor(i / 9) + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={0.62}
        fontWeight={given ? 650 : 450}
        fill={given ? "var(--ink)" : "var(--accent)"}
      >
        {v}
      </text>,
    );
  }
  return (
    <svg
      viewBox="-0.15 -0.15 9.3 9.3"
      className={cn("block aspect-square rounded-[10px] border border-line bg-[var(--board-bg)]", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g stroke="var(--grid-thin)" strokeWidth={0.04}>
        {[1, 2, 4, 5, 7, 8].map((i) => (
          <g key={i}>
            <line x1={i} y1={0} x2={i} y2={9} />
            <line x1={0} y1={i} x2={9} y2={i} />
          </g>
        ))}
      </g>
      <g stroke="var(--grid-strong)" strokeWidth={0.09}>
        {[3, 6].map((i) => (
          <g key={i}>
            <line x1={i} y1={0} x2={i} y2={9} />
            <line x1={0} y1={i} x2={9} y2={i} />
          </g>
        ))}
      </g>
      {cells}
    </svg>
  );
});
