import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/** False during server rendering and the first client render, true afterwards. No effect needed. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
