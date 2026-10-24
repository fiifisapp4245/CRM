/** Pure activity rules shared by Tasks & Calls, Calendar, contact/deal timelines and the dashboard. */
import { addDaysKey, dayKey } from "@/lib/business/time";
import type { Activity, ActivityKind, Recurrence } from "../types";

export function activityKind(a: Pick<Activity, "type" | "channel">): ActivityKind {
  if (a.type === "message") return a.channel === "whatsapp" ? "whatsapp" : a.channel === "email" ? "email" : "sms";
  return a.type;
}

/** Planned = something to do (has a status). Logged = something that already happened. */
export const isPlanned = (a: Activity) => a.status === "open" || a.status === "done" || a.status === "cancelled";
export const isOpen = (a: Activity) => a.status === "open";
export const isDone = (a: Activity) => a.status === "done" || (!a.status && !!a.occurredAt);

export type Bucket = "late" | "today" | "upcoming" | "no_date" | "done";

/** Which date view an activity belongs to, in the business timezone. Cancelled items are in none. */
export function bucketOf(a: Activity, now: number, tz: string): Bucket | null {
  if (a.status === "cancelled") return null;
  if (isDone(a)) return "done";
  if (!isOpen(a)) return null;
  if (!a.dueAt) return "no_date";
  const today = dayKey(now, tz);
  const due = dayKey(a.dueAt, tz);
  if (due < today) return "late";
  if (due === today) return "today";
  return "upcoming";
}

/** Overdue = an open item whose start/due time has passed (also within today). */
export const isOverdue = (a: Activity, now: number) => isOpen(a) && !!a.dueAt && Date.parse(a.dueAt) < now;

export const DEFAULT_MINUTES: Record<Activity["type"], number> = { task: 30, call: 15, meeting: 60, visit: 60, note: 15, email: 15, message: 15 };

export function plannedMinutes(a: Activity): number {
  if (a.dueAt && a.endAt) return Math.max(5, Math.round((Date.parse(a.endAt) - Date.parse(a.dueAt)) / 60_000));
  return a.durationMinutes ?? DEFAULT_MINUTES[a.type];
}

/** Move a planned item to a new start, keeping its duration. */
export function reschedule(a: Activity, newStartIso: string): Pick<Activity, "dueAt" | "endAt"> {
  const mins = plannedMinutes(a);
  return { dueAt: newStartIso, endAt: a.endAt || a.type === "meeting" || a.type === "visit" ? new Date(Date.parse(newStartIso) + mins * 60_000).toISOString() : undefined };
}

/** Minutes before the start the reminder fires; null when there is none. */
export function reminderMinutes(a: Pick<Activity, "reminder">, businessDefault: number): number | null {
  if (a.reminder === undefined || a.reminder === "default") return businessDefault;
  if (a.reminder === "none") return null;
  return a.reminder;
}

export function reminderAt(a: Activity, businessDefault: number): string | null {
  const m = reminderMinutes(a, businessDefault);
  if (m === null || !a.dueAt || !isOpen(a)) return null;
  return new Date(Date.parse(a.dueAt) - m * 60_000).toISOString();
}

/** Next start for a recurring item (same wall-clock time; monthly clamps to month end). */
export function nextOccurrence(startIso: string, recurrence: Recurrence): string | null {
  if (recurrence === "none") return null;
  const d = new Date(startIso);
  if (recurrence === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d.toISOString();
}

export type Whose = "mine" | "everyone" | "nobody" | string; // or a user id

export interface ActivityFilters {
  view: Bucket | "team";
  whose: Whose;
  kind: ActivityKind | "all";
  search: string;
}

export function matchesFilters(a: Activity, f: Omit<ActivityFilters, "view">, ctx: { userId: string; contactName: (id: string | null) => string; dealTitle: (id?: string) => string }): boolean {
  if (f.whose === "mine" && a.assigneeId !== ctx.userId) return false;
  if (f.whose === "nobody" && a.assigneeId !== null) return false;
  if (f.whose !== "mine" && f.whose !== "nobody" && f.whose !== "everyone" && a.assigneeId !== f.whose) return false;
  if (f.kind !== "all" && activityKind(a) !== f.kind) return false;
  const q = f.search.trim().toLowerCase();
  if (q && ![a.subject, a.body, ctx.contactName(a.contactId), ctx.dealTitle(a.dealId), a.location].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
  return true;
}

/** Sort: late/today/upcoming by due time ascending; done newest first. */
export function sortForView(list: Activity[], view: Bucket): Activity[] {
  if (view === "done") return [...list].sort((a, b) => (b.completedAt ?? b.occurredAt ?? "").localeCompare(a.completedAt ?? a.occurredAt ?? ""));
  if (view === "no_date") return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pr = { high: 0, normal: 1, low: 2 } as const;
  return [...list].sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "") || pr[a.priority ?? "normal"] - pr[b.priority ?? "normal"]);
}

/** Calendar helper: the business-local days a week view shows. */
export const weekDays = (startKey: string) => Array.from({ length: 7 }, (_, i) => addDaysKey(startKey, i));
