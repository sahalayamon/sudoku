import { useEffect, type RefObject } from "react";

/**
 * Rubber-band overscroll for one scroll container, on touch screens.
 * Only the container's content moves; anything outside it (header, tab bar) stays put,
 * unlike the web view's own bounce which drags the whole screen.
 */
export function useRubberBand(scroller: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = scroller.current;
    const content = el?.firstElementChild as HTMLElement | null | undefined;
    if (!el || !content) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let startY = 0;
    let edge: "top" | "bottom" | null = null;

    const atTop = () => el.scrollTop <= 0;
    const atBottom = () => el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    const resist = (dy: number) => Math.sign(dy) * Math.min(Math.abs(dy) ** 0.85 * 0.6, 140);

    const onStart = (e: TouchEvent) => {
      startY = e.touches[0]!.clientY;
      edge = null;
      content.style.transition = "none";
    };

    const onMove = (e: TouchEvent) => {
      const y = e.touches[0]!.clientY;
      const dy = y - startY;
      if (!edge) {
        if (dy > 0 && atTop()) edge = "top";
        else if (dy < 0 && atBottom()) edge = "bottom";
        else return;
        startY = y; // measure from where the overscroll began
        return;
      }
      const pull = edge === "top" ? Math.max(0, y - startY) : Math.min(0, y - startY);
      if (e.cancelable) e.preventDefault();
      content.style.transform = pull === 0 ? "" : `translateY(${resist(pull)}px)`;
    };

    const onEnd = () => {
      if (!content.style.transform) {
        edge = null;
        return;
      }
      edge = null;
      content.style.transition = "transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)";
      content.style.transform = "translateY(0px)";
      window.setTimeout(() => {
        content.style.transition = "";
        content.style.transform = "";
      }, 600);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [scroller]);
}
