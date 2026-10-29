/** Local calendar date as YYYY-MM-DD. */
export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Day number since the epoch for a date key. Timezone independent. */
export function dayNumber(key: string): number {
  const p = parseDateKey(key);
  if (!p) return NaN;
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000);
}

export function addDays(key: string, days: number): string {
  const p = parseDateKey(key);
  if (!p) return key;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** 0 = Sunday ... 6 = Saturday for a date key. */
export function weekdayOf(key: string): number {
  const p = parseDateKey(key);
  if (!p) return 0;
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

export function formatDateLong(key: string): string {
  const p = parseDateKey(key);
  if (!p) return key;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(p.y, p.m - 1, p.d)));
}

export function formatDateShort(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(timestamp));
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(timestamp),
  );
}

/** Relative day label used in history lists. */
export function relativeDay(timestamp: number, now: number = Date.now()): string {
  const today = dateKey(new Date(now));
  const that = dateKey(new Date(timestamp));
  const diff = dayNumber(today) - dayNumber(that);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatDateShort(timestamp);
}
