"use client";

import { CalendarCheck, Cloud, CloudOff, Flame, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AsideLayout } from "@/components/layout/AsideLayout";
import { Segmented } from "@/components/ui/Segmented";
import { TextField } from "@/components/ui/TextField";
import { Card, Skeleton } from "@/components/ui/primitives";
import { BackupCard } from "@/features/settings/BackupCard";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/date";
import { runSync } from "@/lib/sync/controller";
import { useAuthStore } from "@/stores/auth";
import { useMetaStore } from "@/stores/meta";
import { useUiStore } from "@/stores/ui";

type Mode = "signin" | "signup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GuestNote({ unavailable }: { unavailable?: boolean }) {
  return (
    <Card className="flex gap-4 p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
        {unavailable ? <CloudOff className="size-5" /> : <ShieldCheck className="size-5" />}
      </span>
      <div>
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Playing as a guest</h2>
        <p className="mt-1 text-[14px] leading-[21px] text-ink-2">
          {unavailable
            ? "Accounts aren't enabled for this install, so your games, streaks and settings live on this device only. Export a backup from Settings any time."
            : "Everything works without an account. Sign in to keep your streak, history and settings in sync across devices."}
        </p>
      </div>
    </Card>
  );
}

function AuthForm() {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const sendMagicLink = useAuthStore((s) => s.sendMagicLink);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"submit" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const validEmail = () => {
    if (EMAIL_RE.test(email.trim())) return true;
    setError("Enter a valid email address.");
    return false;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!validEmail()) return;
    if (mode === "signup" && password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy("submit");
    if (mode === "signin") {
      const message = await signIn(email.trim(), password);
      if (message) setError(message);
    } else {
      const result = await signUp(email.trim(), password);
      if (result.error) setError(result.error);
      else if (result.needsConfirmation) setNotice("Check your inbox to confirm your email, then sign in.");
    }
    setBusy(null);
  };

  const magic = async () => {
    setError(null);
    setNotice(null);
    if (!validEmail()) return;
    setBusy("link");
    const message = await sendMagicLink(email.trim());
    if (message) setError(message);
    else setNotice("Sign-in link sent. Open it on this device to continue.");
    setBusy(null);
  };

  return (
    <Card className="p-5 md:p-6">
      <Segmented<Mode>
        label="Sign in or create an account"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
          setNotice(null);
        }}
        options={[
          { value: "signin", label: "Sign in" },
          { value: "signup", label: "Create account" },
        ]}
      />
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={mode === "signup" ? "At least 8 characters." : undefined}
        />
        {error ? (
          <p role="alert" className="rounded-[10px] bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-[10px] bg-accent-soft px-3 py-2 text-[13px] text-accent">
            {notice}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={busy === "submit"}>
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
        <div className="relative my-1 text-center text-[12px] text-ink-3 before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-line">
          <span className="relative bg-surface px-3">or</span>
        </div>
        <Button type="button" icon={<Mail className="size-4" />} loading={busy === "link"} onClick={magic}>
          Email me a sign-in link
        </Button>
      </form>
    </Card>
  );
}

function AccountPanel() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const phase = useUiStore((s) => s.syncPhase);
  const syncError = useUiStore((s) => s.syncError);
  const lastSyncedAt = useMetaStore((s) => s.lastSyncedAt);
  const [confirmOut, setConfirmOut] = useState(false);

  const status =
    phase === "syncing"
      ? "Syncing…"
      : phase === "offline"
        ? "Offline. Changes will sync when you reconnect."
        : phase === "error"
          ? `Sync failed${syncError ? `: ${syncError}` : "."}`
          : lastSyncedAt
            ? `Up to date · ${formatDateTime(lastSyncedAt)}`
            : "Ready to sync";

  return (
    <>
      <Card className="p-5 md:p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
            <Cloud className="size-6" />
          </span>
          <div className="min-w-0">
            <div className="eyebrow">Signed in</div>
            <div className="truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">{user?.email ?? "Your account"}</div>
          </div>
        </div>
        <p role="status" className={cn("mt-5 text-[14px]", phase === "error" ? "text-danger" : "text-ink-2")}>
          {status}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={<RefreshCw className={cn("size-4", phase === "syncing" && "animate-[spin_1.2s_linear_infinite]")} />}
            disabled={phase === "syncing"}
            onClick={() => void runSync()}
          >
            Sync now
          </Button>
          <Button onClick={() => setConfirmOut(true)}>Sign out</Button>
        </div>
      </Card>
      <ConfirmDialog
        open={confirmOut}
        title="Sign out?"
        description="Your games stay on this device. They will sync again the next time you sign in."
        confirmLabel="Sign out"
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          void signOut();
        }}
      />
    </>
  );
}

function Benefits() {
  const items = [
    { icon: RefreshCw, title: "Pick up anywhere", text: "Start on your phone, finish on your laptop. Unfinished games follow you." },
    { icon: Flame, title: "Keep your streak safe", text: "Your daily streak and history are backed up, even if you clear this device." },
    { icon: CalendarCheck, title: "The same Daily everywhere", text: "Solve once, and it counts on every device you use." },
  ];
  return (
    <Card className="p-5 md:p-6">
      <div className="eyebrow">Why sign in</div>
      <ul className="mt-4 flex flex-col gap-4">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <Icon className="size-[18px]" />
            </span>
            <div>
              <div className="text-[14px] leading-5 font-semibold text-ink">{title}</div>
              <p className="text-[13px] leading-5 text-ink-2">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AccountView() {
  const status = useAuthStore((s) => s.status);
  return (
    <AsideLayout
      eyebrow="Account"
      title={status === "signed_in" ? "Synced" : "Your account"}
      description="Optional. Guests can play everything."
    >
      <div className="flex max-w-[620px] flex-col gap-4">
        {status === "loading" ? (
          <Skeleton className="h-56" />
        ) : status === "unavailable" ? (
          <>
            <GuestNote unavailable />
            <BackupCard />
          </>
        ) : status === "signed_in" ? (
          <AccountPanel />
        ) : (
          <>
            <AuthForm />
            <Benefits />
            <GuestNote />
          </>
        )}
      </div>
    </AsideLayout>
  );
}
