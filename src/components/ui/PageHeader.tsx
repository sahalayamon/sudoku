import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pt-1 pb-4 md:pt-6 md:pb-6">
      <div>
        {eyebrow ? <div className="eyebrow hidden md:block">{eyebrow}</div> : null}
        <h1 className="sr-only font-serif md:not-sr-only md:mt-1 md:text-[60px] md:leading-[1.02] md:text-ink">{title}</h1>
        {description ? <p className="max-w-[48ch] md:mt-2 text-[16px] leading-6 text-ink-2">{description}</p> : null}
      </div>
      {aside}
    </header>
  );
}
