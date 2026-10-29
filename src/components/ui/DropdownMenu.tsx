"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
}

interface DropdownMenuProps {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    id: string;
    menuId: string;
    ref: React.RefObject<HTMLButtonElement | null>;
  }) => ReactNode;
  items: readonly (MenuItem | "separator")[];
  align?: "start" | "end";
}

/** Small accessible menu: arrow keys, Home/End, type-away closing, focus returns to the trigger. */
export function DropdownMenu({ trigger, items, align = "end" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const menuId = `${id}-menu`;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [open]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const nodes = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nodes[(index + 1) % nodes.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      nodes[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      nodes[nodes.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative" onKeyDown={open ? onKeyDown : undefined}>
      {trigger({ open, toggle: () => setOpen((o) => !o), id, menuId, ref: triggerRef })}
      <AnimatePresence>
        {open ? (
          <m.div
            ref={menu}
            id={menuId}
            role="menu"
            aria-labelledby={id}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 0.8, 0.28, 1] }}
            style={{ transformOrigin: align === "end" ? "top right" : "top left" }}
            className={cn(
              "absolute top-full z-50 mt-1.5 min-w-[220px] rounded-[14px] border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]",
              align === "end" ? "right-0" : "left-0",
            )}
          >
            {items.map((item, i) =>
              item === "separator" ? (
                <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    close(false);
                    item.onSelect();
                  }}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-3 rounded-[9px] px-3 text-left text-[14px] outline-none transition-colors",
                    "hover:bg-surface-2 focus-visible:bg-surface-2 disabled:pointer-events-none disabled:opacity-40",
                    item.destructive ? "text-danger" : "text-ink",
                  )}
                >
                  {item.icon ? <span className="grid size-5 place-items-center text-ink-2">{item.icon}</span> : null}
                  <span className="flex-1">{item.label}</span>
                  {item.hint ? <span className="text-[12px] text-ink-3">{item.hint}</span> : null}
                </button>
              ),
            )}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
