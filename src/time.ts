import { env } from "./config.js";

/** "YYYY-MM-DD" of `d` in the configured timezone. */
export function localDateKey(d = new Date(), tz = env.TZ_NAME): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Local date as a Date at 00:00 UTC (stable DB key). */
export function localDay(d = new Date()): Date {
  return new Date(`${localDateKey(d)}T00:00:00Z`);
}

export function daysUntilExam(d = new Date()): number {
  const today = localDay(d).getTime();
  const exam = new Date(`${env.EXAM_DATE}T00:00:00Z`).getTime();
  return Math.round((exam - today) / 86_400_000);
}

export function dDayLabel(d = new Date()): string {
  const n = daysUntilExam(d);
  return n > 0 ? `D-${n}` : n === 0 ? "D-DAY" : `D+${-n}`;
}

export function dayIndex(d = new Date()): number {
  return Math.floor(localDay(d).getTime() / 86_400_000);
}

/** Minutes after local midnight, for HH:MM compare. */
export function localHHMM(d = new Date(), tz = env.TZ_NAME): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function isSunday(d = new Date(), tz = env.TZ_NAME): boolean {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d) === "Sun";
}
