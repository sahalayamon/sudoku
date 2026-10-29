"use client";

import { Download, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/primitives";
import { downloadBackup, restoreBackup } from "./backup";

/** Real, working data portability for people who play as a guest. */
export function BackupCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <Card className="p-5 md:p-6">
      <div className="eyebrow">Back up</div>
      <h2 className="mt-0.5 text-[17px] leading-6 font-semibold tracking-[-0.01em] text-ink">Take your games with you</h2>
      <p className="mt-1.5 text-[14px] leading-[22px] text-ink-2">
        Save your games, statistics and settings to a file, and restore it on any device or after clearing this one.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button icon={<Download className="size-4" />} onClick={downloadBackup}>
          Export backup
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Choose a backup file"
          onChange={(e) => {
            void restoreBackup(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button icon={<Upload className="size-4" />} onClick={() => fileInput.current?.click()}>
          Import backup
        </Button>
      </div>
    </Card>
  );
}
