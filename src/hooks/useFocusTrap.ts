import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside `ref` while `active`, closes on Escape, and
 * restores focus to whatever had it before when deactivated.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void): void {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;

    const items = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    const first = items()[0];
    (first ?? node).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onEscape) {
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const list = items();
      if (!list.length) {
        event.preventDefault();
        return;
      }
      const head = list[0]!;
      const tail = list[list.length - 1]!;
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      previous?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
