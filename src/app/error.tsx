"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="eyebrow text-danger">Something went wrong</p>
        <h1 className="mt-2 font-serif text-[44px] leading-[1.05] text-ink">That didn&apos;t work.</h1>
        <p className="mt-3 text-ink-2">
          An unexpected error interrupted the app. Your saved games are stored on this device and are unaffected.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <ButtonLink href="/">Home</ButtonLink>
        </div>
      </div>
    </main>
  );
}
