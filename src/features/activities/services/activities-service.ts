/** Activities mock service. FUTURE INTEGRATION POINT — see docs/architecture.md. */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import type { Db } from "@/lib/mock-data/db-types";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import type { Result } from "@/lib/types";
import { getCurrentUser } from "@/features/permissions";
import { canViewContact } from "@/features/contacts/lib/access";
import { messageAllowed } from "@/features/contacts/lib/consent";
import { auditEvent } from "@/features/sales/services/helpers";
import { canChangeActivity } from "../lib/access";
import { nextOccurrence, reschedule } from "../lib/activities";
import type { Activity } from "../types";
import type { DuplicateMode, ImportJob } from "@/features/contacts/types";
import { errorReportCsvRows } from "@/lib/import";
import { toCsv } from "@/lib/utils/csv";
import { applyActivityImportPlan, type ActivityImportPlan } from "../lib/import";

export type NewActivityInput = Omit<Activity, "id" | "orgId" | "createdBy" | "createdAt">;

/** Keeps the contact's and deal's "last activity" in step with a logged interaction. */
function touch(db: Db, a: Activity, at: string): Db {
  return {
    ...db,
    contacts: a.contactId ? db.contacts.map((c) => (c.id === a.contactId && (!c.lastActivityAt || at > c.lastActivityAt) ? { ...c, lastActivityAt: at } : c)) : db.contacts,
    deals: a.dealId ? db.deals.map((d) => (d.id === a.dealId ? { ...d, lastActivityAt: at, updatedAt: nowIso() } : d)) : db.deals,
  };
}

/** Timeline composer entry point (notes, calls, messages logged from a contact or deal). */
export async function logActivity(input: NewActivityInput): Promise<Result<Activity>> {
  await latency();
  const actor = getCurrentUser();
  const db = getDb();
  const contact = db.contacts.find((c) => c.id === input.contactId);
  if (!contact || !canViewContact(db, actor, contact)) return notFound();
  if (contact.status !== "active") return invalid("Restore this contact before logging new activity.");
  if (!hasPermission(actor, "activities.create") || !canWriteRecord(actor, contact, db.users)) return forbidden("You can't add activity to this contact.");
  if (!input.subject.trim()) return invalid("Add a short summary.");
  if (input.type === "message") {
    if (!hasPermission(actor, "messages.send")) return forbidden("Your role can't send messages.");
    const check = messageAllowed(db.consents, contact.id, input.channel ?? "sms", input.messagePurpose ?? "operational");
    if (!check.allowed) return forbidden(check.reason);
  }
  const now = nowIso();
  const activity: Activity = { ...input, id: newId("ac"), orgId: contact.orgId, createdBy: actor.id, createdAt: now, updatedAt: now };
  const next = { ...db, activities: [activity, ...db.activities] };
  commitDb(activity.occurredAt ? touch(next, activity, activity.occurredAt) : next);
  return ok(activity);
}

/* ---------------- Tasks & Calls / Calendar ---------------- */

export interface ActivityInput {
  type: Activity["type"];
  /** "plan" = something to do; "log" = it already happened. */
  mode: "plan" | "log";
  subject: string;
  body?: string;
  start?: string; // ISO; plan: due/start, log: when it happened
  end?: string;
  priority: NonNullable<Activity["priority"]>;
  contactId: string | null;
  dealId?: string;
  assigneeId: string | null;
  reminder: NonNullable<Activity["reminder"]>;
  smsReminder: boolean;
  recurrence: NonNullable<Activity["recurrence"]>;
  location?: string;
  attendeeIds: string[];
  callOutcome?: Activity["callOutcome"];
  direction?: Activity["direction"];
  durationMinutes?: number;
}

function validate(db: Db, input: ActivityInput): string | null {
  if (!input.subject.trim()) return "Add a subject.";
  if (input.subject.trim().length > 140) return "Keep the subject under 140 characters.";
  if (input.mode === "log") {
    if (!input.start) return "Say when it happened.";
    if (Date.parse(input.start) > Date.now() + 5 * 60_000) return "A logged activity can't be in the future. Choose To do to plan it instead.";
    if (input.durationMinutes !== undefined && (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 0 || input.durationMinutes > 24 * 60)) return "Minutes must be between 0 and 1440.";
  } else {
    if (input.recurrence !== "none" && !input.start) return "Set a date to repeat this activity.";
    if (input.smsReminder && !db.settings.smsRemindersEnabled) return "SMS reminders aren't enabled for this business.";
    if (input.end && input.start && input.end <= input.start) return "The end time must be after the start.";
  }
  if (input.contactId) {
    const c = db.contacts.find((x) => x.id === input.contactId);
    if (!c || c.status !== "active") return "Choose an active contact.";
  }
  if (input.dealId && !db.deals.some((d) => d.id === input.dealId)) return "That deal no longer exists.";
  if (input.assigneeId && !db.users.some((u) => u.id === input.assigneeId && u.status === "active")) return "Choose an active owner.";
  return null;
}

function fromInput(input: ActivityInput, base: Partial<Activity> = {}): Partial<Activity> {
  const planned = input.mode === "plan";
  return {
    type: input.type,
    subject: input.subject.trim(),
    body: input.body?.trim() || undefined,
    priority: input.priority,
    contactId: input.contactId,
    dealId: input.dealId || undefined,
    assigneeId: input.assigneeId,
    location: input.location?.trim() || undefined,
    attendeeIds: input.attendeeIds.filter((id) => id !== input.assigneeId),
    dueAt: planned ? input.start : undefined,
    endAt: planned ? input.end : undefined,
    occurredAt: planned ? (base.status === "done" ? base.occurredAt : undefined) : input.start,
    status: planned ? (base.status === "done" ? "done" : "open") : undefined,
    completedAt: planned ? base.completedAt : undefined,
    reminder: planned ? input.reminder : undefined,
    smsReminder: planned ? input.smsReminder : undefined,
    recurrence: planned ? input.recurrence : undefined,
    callOutcome: input.type === "call" && !planned ? input.callOutcome : undefined,
    direction: input.type === "call" && !planned ? input.direction : undefined,
    durationMinutes: !planned ? input.durationMinutes : undefined,
  };
}

export async function saveActivity(input: ActivityInput, id?: string): Promise<Result<Activity>> {
  await latency(150);
  const actor = getCurrentUser();
  const db = getDb();
  // A deal brings its customer when no contact was chosen.
  if (input.dealId && !input.contactId) input = { ...input, contactId: db.deals.find((d) => d.id === input.dealId)?.contactId ?? null };
  const err = validate(db, input);
  if (err) return invalid(err);
  const now = nowIso();
  const target = { orgId: actor.orgId, contactId: input.contactId, assigneeId: input.assigneeId };
  if (!canChangeActivity(db, actor, target)) return forbidden(input.contactId ? "You can't add activity to this contact." : "You can only plan work for yourself or your team.");
  const accountId = input.contactId ? (db.contacts.find((c) => c.id === input.contactId)?.accountId ?? undefined) : undefined;

  if (id) {
    const before = db.activities.find((a) => a.id === id);
    if (!before) return notFound();
    if (!canChangeActivity(db, actor, before)) return forbidden("You can't change this activity.");
    const after = { ...before, ...fromInput(input, before), accountId, updatedAt: now } as Activity;
    const moved = before.dueAt !== after.dueAt && !!before.dueAt;
    let next: Db = { ...db, activities: db.activities.map((a) => (a.id === id ? after : a)), audit: [...db.audit, auditEvent(actor.orgId, "activity", id, moved ? "rescheduled" : "updated", actor.id, after.subject)] };
    if (after.occurredAt) next = touch(next, after, after.occurredAt);
    commitDb(next);
    return ok(after);
  }
  const a = { ...fromInput(input), id: newId("ac"), orgId: actor.orgId, accountId, createdBy: actor.id, createdAt: now, updatedAt: now } as Activity;
  let next: Db = { ...db, activities: [a, ...db.activities], audit: [...db.audit, auditEvent(actor.orgId, "activity", a.id, "created", actor.id, a.subject)] };
  if (a.occurredAt) next = touch(next, a, a.occurredAt);
  commitDb(next);
  return ok(a);
}

/**
 * Completing a repeating item records this occurrence as done and plans the
 * next one (prototype rule; the reference's recurrence engine wasn't observable).
 */
export async function setActivityStatus(id: string, status: "open" | "done"): Promise<Result<Activity & { next?: Activity }>> {
  await latency(120);
  const actor = getCurrentUser();
  const db = getDb();
  const activity = db.activities.find((a) => a.id === id);
  if (!activity) return notFound();
  if (!canChangeActivity(db, actor, activity)) return forbidden("You can't update this activity.");
  const now = nowIso();
  const updated: Activity = { ...activity, status, completedAt: status === "done" ? now : undefined, occurredAt: status === "done" ? now : undefined, updatedAt: now };
  let activities = db.activities.map((a) => (a.id === id ? updated : a));
  let nextOcc: Activity | undefined;
  if (status === "done" && activity.recurrence && activity.recurrence !== "none" && activity.dueAt) {
    const start = nextOccurrence(activity.dueAt, activity.recurrence)!;
    nextOcc = { ...activity, id: newId("ac"), status: "open", completedAt: undefined, occurredAt: undefined, ...reschedule(activity, start), createdAt: now, updatedAt: now, createdBy: actor.id };
    activities = [nextOcc, ...activities];
    // The finished occurrence no longer repeats; the new one carries the rule.
    activities = activities.map((a) => (a.id === id ? { ...a, recurrence: "none" } : a));
  }
  let next: Db = { ...db, activities, audit: [...db.audit, auditEvent(actor.orgId, "activity", id, status === "done" ? "completed" : "reopened", actor.id, activity.subject)] };
  if (status === "done") next = touch(next, updated, now);
  commitDb(next);
  return ok({ ...updated, next: nextOcc });
}

/** Calendar drag / quick reschedule. Keeps the duration; returns the previous start for undo. */
export async function rescheduleActivity(id: string, newStart: string): Promise<Result<{ activity: Activity; previous: { dueAt?: string; endAt?: string } }>> {
  await latency(80);
  const actor = getCurrentUser();
  const db = getDb();
  const a = db.activities.find((x) => x.id === id);
  if (!a) return notFound();
  if (a.status !== "open") return invalid("Only planned, unfinished activities can be moved.");
  if (!canChangeActivity(db, actor, a)) return forbidden("You can't move this activity.");
  const after: Activity = { ...a, ...reschedule(a, newStart), updatedAt: nowIso() };
  commitDb({ ...db, activities: db.activities.map((x) => (x.id === id ? after : x)), audit: [...db.audit, auditEvent(actor.orgId, "activity", id, "rescheduled", actor.id, a.subject)] });
  return ok({ activity: after, previous: { dueAt: a.dueAt, endAt: a.endAt } });
}

export async function restoreSchedule(id: string, previous: { dueAt?: string; endAt?: string }): Promise<Result<Activity>> {
  const actor = getCurrentUser();
  const db = getDb();
  const a = db.activities.find((x) => x.id === id);
  if (!a) return notFound();
  if (!canChangeActivity(db, actor, a)) return forbidden("You can't move this activity.");
  const after: Activity = { ...a, dueAt: previous.dueAt, endAt: previous.endAt, updatedAt: nowIso() };
  commitDb({ ...db, activities: db.activities.map((x) => (x.id === id ? after : x)) });
  return ok(after);
}

export async function deleteActivity(id: string): Promise<Result<true>> {
  await latency(120);
  const actor = getCurrentUser();
  const db = getDb();
  const a = db.activities.find((x) => x.id === id);
  if (!a) return notFound();
  if (!canChangeActivity(db, actor, a)) return forbidden("You can't delete this activity.");
  if (db.communications.some((m) => m.activityId === id)) return invalid("This activity records a message that was sent. It can't be deleted.");
  commitDb({ ...db, activities: db.activities.filter((x) => x.id !== id), audit: [...db.audit, auditEvent(actor.orgId, "activity", id, "deleted", actor.id, a.subject)] });
  return ok(true);
}

/* ---------------- Import ---------------- */

export async function runActivityImport(plan: ActivityImportPlan, file: { name: string; size: number }, mode: DuplicateMode): Promise<Result<ImportJob>> {
  await latency(500);
  const actor = getCurrentUser();
  if (!hasPermission(actor, "activities.import")) return forbidden("Your role can't import activities.");
  const now = nowIso();
  const applied = applyActivityImportPlan(getDb(), actor, plan, now, newId, (id, action, summary) => auditEvent(actor.orgId, "activity", id, action, actor.id, summary));
  const report = errorReportCsvRows(plan);
  const job: ImportJob = {
    id: newId("imp"), entityType: "activity", orgId: actor.orgId, fileName: file.name, fileSize: file.size, startedAt: now, actorId: actor.id, duplicateMode: mode, totalRows: plan.rows.length,
    created: applied.created, updated: applied.updated, skipped: plan.counts.skip, failed: plan.counts.error, errorReportCsv: report.rows.length ? toCsv(report.headers, report.rows) : undefined,
  };
  commitDb({ ...applied.db, importJobs: [job, ...applied.db.importJobs] });
  return ok(job);
}
