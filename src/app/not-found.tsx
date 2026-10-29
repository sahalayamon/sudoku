import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="mt-2 font-serif text-[56px] leading-none text-ink">Nothing here.</h1>
        <p className="mt-3 text-ink-2">That page doesn&apos;t exist. Your puzzles are safe.</p>
        <Link href="/" className={buttonClasses("primary", "md", "mt-6")}>
          Back to Sudoku
        </Link>
      </div>
    </main>
  );
}
