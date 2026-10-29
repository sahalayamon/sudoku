import type { ReactNode } from "react";

interface AsideLayoutProps {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Controls that belong with the title: filters, a section menu. Shown beneath it. */
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * Page shell for list and form pages. On wide screens the title and its controls sit in a
 * sticky left column and the content in a readable right column, so the page uses the whole
 * width instead of leaving one side empty. On phones it simply stacks.
 */
export function AsideLayout({ eyebrow, title, description, aside, children }: AsideLayoutProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 pt-1 pb-4 md:gap-6 md:pt-6 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] lg:gap-x-12 lg:pt-8">
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        {eyebrow ? <div className="eyebrow hidden md:block">{eyebrow}</div> : null}
        <h1 className="sr-only font-serif md:not-sr-only md:mt-1 md:text-[52px] md:leading-[1.02] md:text-ink lg:text-[56px]">{title}</h1>
        {description ? <p className="max-w-[34ch] md:mt-3 text-[15px] leading-6 text-ink-2">{description}</p> : null}
        {aside ? <div className="mt-4 md:mt-6">{aside}</div> : null}
      </div>
      <div className="min-w-0 lg:max-w-[780px]">{children}</div>
    </div>
  );
}
