import { useEffect } from "react";
import { useGameStore } from "@/stores/game";
import { useUiStore } from "@/stores/ui";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // Controls that use the arrow keys themselves (radio groups, menus, popovers) keep them.
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest('[role="radiogroup"], [role="menu"], [role="dialog"]') !== null
  );
}

function digitFromEvent(event: KeyboardEvent): number | null {
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
  return match ? Number(match[1]) : null;
}

/** Desktop keyboard control for the game screen. Ignores typing fields and open dialogs. */
export function useGameKeyboard(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;

      const game = useGameStore.getState();
      const mod = event.metaKey || event.ctrlKey;
      const interactive = game.phase === "playing" || game.phase === "failed";
      if (!interactive) return;

      // Space on a focused button should still press it.
      const onButton = event.target instanceof HTMLElement && ["BUTTON", "A", "SUMMARY"].includes(event.target.tagName);

      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault();
        useUiStore.getState().setShortcutsOpen(true);
        return;
      }

      if (mod) {
        const k = event.key.toLowerCase();
        if (k === "z") {
          event.preventDefault();
          if (event.shiftKey) game.redo();
          else game.undo();
        } else if (k === "y") {
          event.preventDefault();
          game.redo();
        }
        return;
      }
      if (event.altKey && digitFromEvent(event) === null) return;

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          game.moveSelection(-1, 0);
          return;
        case "ArrowDown":
          event.preventDefault();
          game.moveSelection(1, 0);
          return;
        case "ArrowLeft":
          event.preventDefault();
          game.moveSelection(0, -1);
          return;
        case "ArrowRight":
          event.preventDefault();
          game.moveSelection(0, 1);
          return;
        case "Backspace":
        case "Delete":
        case "0":
          event.preventDefault();
          game.erase();
          return;
        case "Escape":
          if (game.hint) game.dismissHint();
          else if (game.paused) game.resume();
          else game.select(null);
          return;
        case "Enter":
          if (onButton) return;
          event.preventDefault();
          if (game.hint) {
            if (game.hint.level === 1) game.requestHint();
            else game.dismissHint();
          } else game.selectNextEmpty();
          return;
        case " ":
          if (onButton) return;
          event.preventDefault();
          if (game.paused) game.resume();
          else game.pause("user");
          return;
        default:
          break;
      }

      const digit = digitFromEvent(event);
      if (digit !== null) {
        event.preventDefault();
        game.input(digit, event.shiftKey || event.altKey ? { notes: !game.notesMode } : undefined);
        return;
      }

      switch (event.key.toLowerCase()) {
        case "n":
          game.toggleNotesMode();
          break;
        case "h":
          game.requestHint();
          break;
        case "c":
          game.check();
          break;
        case "z":
          if (event.shiftKey) game.redo();
          else game.undo();
          break;
        case "p":
          if (game.paused) game.resume();
          else game.pause("user");
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
