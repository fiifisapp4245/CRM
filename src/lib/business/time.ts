/**
 * Wall-clock helpers in the business timezone, so the calendar and "today"
 * mean the same thing for everyone regardless of the viewer's device zone.
 */
export interface WallTime {
  y: number;
  m: number; // 1-12
  d: number;
  h: number;
  min: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    fmtCache.set(tz, f);
  }
  return f;
}

export function toWall(at: string | number | Date, tz: string): WallTime {
  const parts = Object.fromEntries(fmt(tz).formatToParts(new Date(at)).map((p) => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), h: Number(parts.hour) % 24, min: Number(parts.minute) };
}

/** Inverse of toWall: the instant at which the business clock shows `w`. */
export function fromWall(w: WallTime, tz: string): Date {
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min);
  const back = toWall(guess, tz);
  const offset = Date.UTC(back.y, back.m - 1, back.d, back.h, back.min) - guess;
  return new Date(guess - offset);
}

export const pad = (n: number) => String(n).padStart(2, "0");
/** YYYY-MM-DD of an instant in the business timezone. */
export const dayKey = (at: string | number | Date, tz: string) => {
  const w = toWall(at, tz);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}`;
};
export const timeKey = (at: string | number | Date, tz: string) => {
  const w = toWall(at, tz);
  return `${pad(w.h)}:${pad(w.min)}`;
};

/** Instant for a business-local date ("YYYY-MM-DD") and time ("HH:mm"). */
export function zonedIso(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return fromWall({ y, m, d, h, min }, tz).toISOString();
}

export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** ISO weekday (1 = Monday) of a YYYY-MM-DD key. */
export function weekday(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

export const startOfWeekKey = (key: string) => addDaysKey(key, 1 - weekday(key));

export function inBusinessHours(at: string, tz: string, hours: { days: number[]; start: string; end: string }): boolean {
  const key = dayKey(at, tz);
  const t = timeKey(at, tz);
  return hours.days.includes(weekday(key)) && t >= hours.start && t < hours.end;
}

/** Next instant at or after `at` that falls inside business hours. */
export function nextBusinessSlot(at: string, tz: string, hours: { days: number[]; start: string; end: string }): string {
  if (inBusinessHours(at, tz, hours)) return at;
  let key = dayKey(at, tz);
  const t = timeKey(at, tz);
  if (!(hours.days.includes(weekday(key)) && t < hours.start)) key = addDaysKey(key, 1);
  for (let i = 0; i < 8 && !hours.days.includes(weekday(key)); i++) key = addDaysKey(key, 1);
  return zonedIso(key, hours.start, tz);
}

export const formatInTz = (at: string, tz: string, opts: Intl.DateTimeFormatOptions) => new Date(at).toLocaleString("en-GB", { ...opts, timeZone: tz });
