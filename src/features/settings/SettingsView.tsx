"use client";

import { ChevronRight, Download, Keyboard, Monitor, Moon, Sun, Upload, UserRound } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AsideLayout } from "@/components/layout/AsideLayout";
import { PaletteSections } from "@/components/layout/ThemePicker";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { Card, SectionHeading } from "@/components/ui/primitives";
import { isHapticsSupported } from "@/lib/feedback/haptics";
import { flushNativeMirror } from "@/lib/storage/native-mirror";
import { clearAllData } from "@/lib/storage/repository";
import { downloadBackup, restoreBackup } from "./backup";
import { useAuthStore } from "@/stores/auth";
import { useGameStore } from "@/stores/game";
import { useLibraryStore } from "@/stores/library";
import { useMetaStore } from "@/stores/meta";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { MISTAKE_LIMIT_OPTIONS, type MistakeLimit, type ThemePreference } from "@/types/settings";

function Row({ title, description, control, htmlFor }: { title: string; description?: string; control: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center justify-between gap-6 p-4 md:px-5 md:py-4">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-[15px] leading-5 font-medium text-ink">
          {title}
        </label>
        {description ? <p className="mt-0.5 text-[13px] leading-[19px] text-ink-2">{description}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

const SECTIONS = [
  { id: "appearance", label: "Appearance" },
  { id: "gameplay", label: "Gameplay" },
  { id: "feedback", label: "Feedback" },
  { id: "data", label: "Account and data" },
  { id: "help", label: "Help" },
] as const;

/** Jump links for the sections. Only shown beside the content on wide screens. */
function SettingsNav() {
  return (
    <nav aria-label="Settings sections" className="hidden lg:block">
      <ul className="flex flex-col gap-0.5">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="flex h-10 items-center rounded-[10px] px-3 text-[14px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-label={title} className="scroll-mt-24">
      <SectionHeading title={title} />
      <Card className="divide-y divide-line">{children}</Card>
    </section>
  );
}

const THEMES = [
  { value: "system" as const, label: <Monitor className="mx-auto size-[17px]" />, ariaLabel: "System" },
  { value: "light" as const, label: <Sun className="mx-auto size-[17px]" />, ariaLabel: "Light" },
  { value: "dark" as const, label: <Moon className="mx-auto size-[17px]" />, ariaLabel: "Dark" },
];

const LIMITS = MISTAKE_LIMIT_OPTIONS.map((v) => ({ value: v, label: v === 0 ? "Off" : String(v) }));

export function SettingsView() {
  const s = useSettingsStore();
  const update = useSettingsStore((x) => x.update);
  const toast = useUiStore((x) => x.toast);
  const authStatus = useAuthStore((x) => x.status);
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<"reset" | "clear" | null>(null);
  const canVibrate = isHapticsSupported();

  const clearLocal = () => {
    useGameStore.getState().reset();
    clearAllData();
    useLibraryStore.getState().reset();
    useMetaStore.getState().reset();
    useSettingsStore.getState().reset();
    void flushNativeMirror(); // the phone's native copy must forget it too, or it would be restored
    setConfirm(null);
    toast("Local data cleared", { tone: "success" });
  };

  return (
    <>
      <AsideLayout
        eyebrow="Settings"
        title="Preferences"
        description="Changes apply immediately and are saved on this device."
        aside={<SettingsNav />}
      >
        <div className="flex flex-col gap-10 pb-4">
          <Section id="appearance" title="Appearance">
            <Row
              title="Appearance"
              description="System follows your device."
              control={
                <Segmented<ThemePreference>
                  label="Theme"
                  value={s.theme}
                  onChange={(theme) => update({ theme })}
                  options={THEMES}
                  className="w-[156px]"
                />
              }
            />
            <div className="p-4 md:px-5 md:py-4">
              <div className="text-[15px] leading-5 font-medium text-ink">Colour and themes</div>
              <p className="mt-0.5 text-[13px] leading-[19px] text-ink-2">
                An accent colour, or a complete theme with its own surfaces. Each has a light and a dark version.
              </p>
              <PaletteSections className="mt-4 max-w-[320px]" />
            </div>
          </Section>

          <Section id="gameplay" title="Gameplay">
            <Row
              title="Mistake limit"
              description="Applies to new games."
              control={
                <Segmented<MistakeLimit>
                  label="Mistake limit"
                  value={s.mistakeLimit}
                  onChange={(mistakeLimit) => update({ mistakeLimit })}
                  options={LIMITS}
                  className="w-[188px]"
                />
              }
            />
            <Row
              title="Timer"
              description="Show the clock while you play. It always keeps time."
              htmlFor="set-timer"
              control={<Switch id="set-timer" label="Show timer" checked={s.showTimer} onChange={(showTimer) => update({ showTimer })} />}
            />
            <Row
              title="Auto notes"
              description="Remove a note from related cells when you place its number."
              htmlFor="set-auto"
              control={<Switch id="set-auto" label="Auto notes" checked={s.autoNotes} onChange={(autoNotes) => update({ autoNotes })} />}
            />
            <Row
              title="Highlight same numbers"
              description="Tint every cell that matches the selected number."
              htmlFor="set-same"
              control={
                <Switch
                  id="set-same"
                  label="Highlight same numbers"
                  checked={s.highlightSameNumbers}
                  onChange={(highlightSameNumbers) => update({ highlightSameNumbers })}
                />
              }
            />
            <Row
              title="Highlight row, column and box"
              description="A soft tint across the selected cell's groups."
              htmlFor="set-related"
              control={
                <Switch
                  id="set-related"
                  label="Highlight related cells"
                  checked={s.highlightRelated}
                  onChange={(highlightRelated) => update({ highlightRelated })}
                />
              }
            />
            <Row
              title="Completion animation"
              description="A gentle wave across the board when you solve it."
              htmlFor="set-anim"
              control={
                <Switch
                  id="set-anim"
                  label="Show completion animation"
                  checked={s.completionAnimation}
                  onChange={(completionAnimation) => update({ completionAnimation })}
                />
              }
            />
          </Section>

          <Section id="feedback" title="Feedback">
            <Row
              title="Sound effects"
              description="Soft, short, and off by default."
              htmlFor="set-sound"
              control={<Switch id="set-sound" label="Sound effects" checked={s.sound} onChange={(sound) => update({ sound })} />}
            />
            <Row
              title="Haptics"
              description={canVibrate ? "A light tap when you place a number." : "Not supported by this browser."}
              htmlFor="set-haptics"
              control={
                <Switch
                  id="set-haptics"
                  label="Haptics"
                  checked={s.haptics && canVibrate}
                  disabled={!canVibrate}
                  onChange={(haptics) => update({ haptics })}
                />
              }
            />
          </Section>

          <Section id="data" title="Account and data">
            <Link href="/account/" className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-2 md:px-5">
              <span className="flex items-center gap-3">
                <UserRound className="size-[18px] text-ink-2" />
                <span>
                  <span className="block text-[15px] leading-5 font-medium text-ink">
                    {authStatus === "signed_in" ? "Account and sync" : "Account"}
                  </span>
                  <span className="block text-[13px] text-ink-2">
                    {authStatus === "signed_in" ? "Signed in. Progress syncs across devices." : "Playing as a guest."}
                  </span>
                </span>
              </span>
              <ChevronRight className="size-4 text-ink-3" />
            </Link>
            <Row
              title="Export data"
              description="Download a backup of your games and settings."
              control={
                <Button size="sm" icon={<Download className="size-4" />} onClick={downloadBackup}>
                  Export
                </Button>
              }
            />
            <Row
              title="Import data"
              description="Merge a backup into this device."
              control={
                <>
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
                  <Button size="sm" icon={<Upload className="size-4" />} onClick={() => fileInput.current?.click()}>
                    Import
                  </Button>
                </>
              }
            />
            <Row
              title="Reset settings"
              description="Restore every preference above to its default."
              control={
                <Button size="sm" onClick={() => setConfirm("reset")}>
                  Reset
                </Button>
              }
            />
            <Row
              title="Clear local data"
              description="Delete all games, statistics and settings on this device."
              control={
                <Button size="sm" variant="danger" onClick={() => setConfirm("clear")}>
                  Clear
                </Button>
              }
            />
          </Section>

          <Section id="help" title="Help">
            <Row
              title="How to play"
              description="The three-step tutorial."
              control={
                <Button size="sm" onClick={() => useUiStore.getState().setOnboardingOpen(true)}>
                  Replay
                </Button>
              }
            />
            <Row
              title="Keyboard shortcuts"
              description="For desktop players."
              control={
                <Button size="sm" icon={<Keyboard className="size-4" />} onClick={() => useUiStore.getState().setShortcutsOpen(true)}>
                  View
                </Button>
              }
            />
          </Section>

          <p className="text-center text-[12px] text-ink-3">
            Sudoku · Puzzles are generated on your device and verified before you see them.
          </p>
        </div>
      </AsideLayout>

      <ConfirmDialog
        open={confirm === "reset"}
        title="Reset settings?"
        description="Your games and statistics are not affected."
        confirmLabel="Reset"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          useSettingsStore.getState().reset();
          setConfirm(null);
          toast("Settings reset", { tone: "success" });
        }}
      />
      <ConfirmDialog
        open={confirm === "clear"}
        title="Clear all local data?"
        description="This permanently deletes every game, streak, achievement and setting stored on this device. If you are signed in, data already synced stays in your account."
        confirmLabel="Delete everything"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={clearLocal}
      />
    </>
  );
}
