import { useSyncExternalStore } from "react";

/** Subscribes to a CSS media query. Server snapshot is `false`. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Matches the CSS layout switch for the side-by-side game screen. */
export const SIDE_LAYOUT_QUERY = "(min-width: 768px) and (orientation: landscape)";
