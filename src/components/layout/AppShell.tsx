"use client";

import { ChartNoAxesColumn, History, House, Settings, Trophy, UserRound, type LucideIcon } from "lucide-react";
import { m } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth";
import { SyncStatus } from "./SyncStatus";
import { ThemePicker } from "./ThemePicker";
import { useRubberBand } from "./useRubberBand";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: readonly NavItem[] = [
  { href: "/", label: "Play", icon: House },
  { href: "/history/", label: "History", icon: History },
  { href: "/stats/", label: "Statistics", icon: ChartNoAxesColumn },
  { href: "/achievements/", label: "Achievements", icon: Trophy },
  { href: "/settings/", label: "Settings", icon: Settings },
];

const TITLES: Record<string, string> = {
  "/history": "Times",
  "/stats": "Statistics",
  "/achievements": "Achievements",
  "/settings": "Settings",
  "/account": "Account",
};

function titleFor(pathname: string): string | null {
  const key = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return TITLES[key] ?? null;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href.replace(/\/$/, ""));
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const status = useAuthStore((s) => s.status);
  const title = titleFor(pathname);
  const scroller = useRef<HTMLDivElement>(null);
  useRubberBand(scroller);

  return (
    <div className="fixed inset-0 flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] focus:rounded-[10px] focus:bg-ink focus:px-4 focus:py-2.5 focus:text-[14px] focus:font-medium focus:text-bg"
      >
        Skip to content
      </a>
      <header className="z-40 shrink-0 bg-bg" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-6 px-4 md:h-16 md:px-8">
          {title ? (
            <m.div
              key={title}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              aria-hidden="true"
              className="font-serif text-[28px] leading-none text-ink md:hidden"
            >
              {title}
            </m.div>
          ) : null}

          <nav aria-label="Primary" className="-ml-3 hidden items-center gap-1 md:flex">
            {NAV.filter((n) => n.href !== "/settings/").map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-lg px-3 py-2 text-[14px] font-medium transition-colors duration-150",
                    active ? "text-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {item.label}
                  {active ? (
                    <m.span
                      layoutId="nav-underline"
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                      className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-accent"
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <SyncStatus className="mr-1" />
            <ThemePicker />
            <Link
              href="/settings/"
              aria-label="Settings"
              className="hidden size-11 items-center justify-center rounded-[10px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink md:inline-flex"
            >
              <Settings className="size-[19px]" />
            </Link>
            <Link
              href="/account/"
              aria-label={status === "signed_in" ? "Account" : "Sign in"}
              className="relative inline-flex size-11 items-center justify-center rounded-[10px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <UserRound className="size-[19px]" />
              {status === "signed_in" ? <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-accent ring-2 ring-bg" /> : null}
            </Link>
          </div>
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-y-none">
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex min-h-full w-full max-w-[1200px] flex-col px-4 pt-2 pb-[calc(88px+var(--safe-bottom))] outline-none md:px-8 md:pb-16"
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Primary"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-bg from-55% to-transparent pt-6 md:hidden"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <ul className="pointer-events-auto mx-auto grid max-w-[420px] grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={cn(
                    "relative flex h-[60px] items-center justify-center transition-colors duration-150",
                    active ? "text-accent" : "text-ink-3 active:text-ink",
                  )}
                >
                  {active ? (
                    <m.span
                      layoutId="tab-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute h-11 w-11 rounded-full bg-accent/15"
                    />
                  ) : null}
                  <m.span
                    animate={{ y: active ? -2 : 0, scale: active ? 1.12 : 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="relative"
                  >
                    <Icon className="size-[25px]" strokeWidth={active ? 2.2 : 1.8} />
                  </m.span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
