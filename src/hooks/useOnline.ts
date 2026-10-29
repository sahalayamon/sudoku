import { useUiStore } from "@/stores/ui";

export function useOnline(): boolean {
  return useUiStore((s) => s.online);
}
