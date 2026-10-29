interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/**
 * True inside the Android/iOS app shell (Capacitor). Read from the global the shell injects,
 * so the browser build never has to load any Capacitor code.
 */
export function isNativePlatform(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

export function nativePlatform(): string {
  return capacitor()?.getPlatform?.() ?? "web";
}
