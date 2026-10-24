/**
 * Activity import (calls, meetings, tasks, visits, notes). Plan = validate +
 * match, no writes. Contacts are only MATCHED (email, then phone) — never created.
 */
import type { User } from "@/lib/types";
import type { Db } from "@/lib/mock-data/db-types";
import { eligibleOwners } from "@/lib/mock-data/users";
import { canWriteRecord } from "@/lib/permissions";
import { normalizeEmail, normalizePhone } from "@/lib/utils/normalize";
import { dayKey, zonedIso } from "@/lib/business/time";
import { autoMapByAliases, emptyCounts, structuralError, type ImportPlanBase, type ImportRowBase, type RowIssue } from "@/lib/import";
import type { AuditEvent, Contact, DuplicateMode } from "@/features/contacts/types";
import { parseDate } from "@/features/sales/lib/deal-import";
import type { Activity, CallOutcome, Priority } from "../types";

export type ImportAs = "each" | "call" | "meeting" | "task" | "visit" | "note";
export const IMPORT_AS_LABELS: Record<ImportAs, string> = { each: "Each row specifies its type", call: "Calls", meeting: "Meetings", task: "Tasks", visit: "Visits", note: "Notes" };

export const ACTIVITY_IMPORT_FIELDS = [
  { key: "type", label: "Type (call, meeting, task, visit, note)", aliases: ["type", "kind", "activitytype"] },
  { key: "subject", label: "Subject", aliases: ["subject", "title", "summary", "activity"] },
  { key: "date", label: "Date", aliases: ["date", "when", "duedate", "day"] },
  { key: "time", label: "Time", aliases: ["time", "start", "starttime"] },
  { key: "status", label: "Done? (yes/no)", aliases: ["done", "status", "completed", "state"] },
  { key: "minutes", label: "Minutes", aliases: ["minutes", "duration", "mins", "length"] },
  { key: "outcome", label: "What happened (calls)", aliases: ["outcome", "result", "whathappened", "callresult"] },
  { key: "direction", label: "Direction (calls)", aliases: ["direction", "inout"] },
  { key: "priority", label: "Priority", aliases: ["priority"] },
  { key: "contactEmail", label: "Contact email", aliases: ["email", "contactemail"] },
  { key: "contactPhone", label: "Contact phone", aliases: ["phone", "contactphone", "mobile"] },
  { key: "ownerEmail", label: "Owner email", aliases: ["owner", "owneremail", "assignee", "assignedto"] },
  { key: "notes", label: "Notes", aliases: ["notes", "description", "details", "comments"] },
] as const;
export type ActivityImportKey = (typeof ACTIVITY_IMPORT_FIELDS)[number]["key"];
export const ACTIVITY_TEMPLATE_HEADERS = ["Type", "Subject", "Date", "Time", "Done", "Minutes", "Outcome", "Direction", "Priority", "Email", "Phone", "Owner", "Notes"];
export const autoMapActivityColumns = (h: string[]) => autoMapByAliases(h, ACTIVITY_IMPORT_FIELDS, "ignore");

const OUTCOMES: Record<string, CallOutcome> = { answered: "connected", connected: "connected", "no answer": "no_answer", busy: "busy", "left a message": "left_voicemail", voicemail: "left_voicemail", "left message": "left_voicemail", "wrong number": "wrong_number" };
const TYPES = ["call", "meeting", "task", "visit", "note"] as const;

export interface ActivityPlannedRow extends ImportRowBase {
  values: Partial<Record<ActivityImportKey, string>>;
  /** "logged" = saved as done history; "scheduled" = an open to-do. */
  state?: "logged" | "scheduled";
  activity?: Omit<Activity, "id" | "orgId" | "createdBy" | "createdAt">;
  contactName?: string;
  matchedId?: string;
}

export interface ActivityImportPlan extends ImportPlanBase<ActivityPlannedRow> {
  importAs: ImportAs;
  logged: number;
  scheduled: number;
}

export function planActivityImport(table: string[][], mapping: string[], db: Db, actor: User, mode: DuplicateMode, opts: { importAs: ImportAs; now: number }): ActivityImportPlan {
  const [headers = [], ...body] = table;
  const plan: ActivityImportPlan = { headers, mapping, rows: [], counts: emptyCounts(), importAs: opts.importAs, logged: 0, scheduled: 0 };
  const structural = structuralError(table, "activities");
  if (structural) return { ...plan, fatal: structural };
  if (!mapping.includes("subject")) return { ...plan, fatal: "Map a column to Subject to continue." };
  if (opts.importAs === "each" && !mapping.includes("type")) return { ...plan, fatal: 'Map a column to Type, or choose one kind under "Import as".' };
  const tz = db.settings.timezone;
  const today = dayKey(opts.now, tz);
  const contacts = db.contacts.filter((c) => c.orgId === actor.orgId && c.status === "active");
  const byEmail = new Map<string, Contact[]>();
  const byPhone = new Map<string, Contact[]>();
  for (const c of contacts)
    for (const m of c.methods) {
      const k = m.kind === "email" ? normalizeEmail(m.value) : normalizePhone(m.value);
      const map = m.kind === "email" ? byEmail : byPhone;
      if (!map.get(k)?.includes(c)) map.set(k, [...(map.get(k) ?? []), c]);
    }
  const owners = eligibleOwners(db.users, actor.orgId).filter((u) => canWriteRecord(actor, { orgId: actor.orgId, ownerId: u.id }, db.users));
  const seen = new Map<string, number>();

  body.forEach((raw, i) => {
    const rowNumber = i + 2;
    const issues: RowIssue[] = [];
    const err = (field: string, message: string) => issues.push({ field, message, severity: "error" });
    const warn = (field: string, message: string) => issues.push({ field, message, severity: "warning" });
    const values: ActivityPlannedRow["values"] = {};
    mapping.forEach((t, col) => {
      const v = (raw[col] ?? "").trim();
      if (v && t !== "ignore" && t !== "custom") values[t as ActivityImportKey] = v;
    });
    const subject = values.subject ?? "";
    if (!subject) err("Subject", "Missing subject.");
    const typeText = (values.type ?? "").toLowerCase().replace(/s$/, "");
    const type = opts.importAs === "each" ? (TYPES as readonly string[]).includes(typeText) ? (typeText as (typeof TYPES)[number]) : null : opts.importAs;
    if (!type) err("Type", values.type ? `"${values.type}" isn't a type. Use call, meeting, task, visit or note.` : "Missing type.");

    const date = values.date ? parseDate(values.date) : null;
    if (values.date && !date) err("Date", `"${values.date}" isn't a date. Use YYYY-MM-DD or DD/MM/YYYY.`);
    const time = values.time ? /^([01]?\d|2[0-3])[:.]([0-5]\d)$/.exec(values.time) : null;
    if (values.time && !time) err("Time", `"${values.time}" isn't a time. Use HH:MM (24-hour).`);
    const hhmm = time ? `${time[1].padStart(2, "0")}:${time[2]}` : null;
    const doneText = values.status?.toLowerCase();
    const doneFlag = doneText ? ["yes", "y", "done", "completed", "true", "1"].includes(doneText) ? true : ["no", "n", "open", "to do", "todo", "false", "0", "planned"].includes(doneText) ? false : null : undefined;
    if (doneFlag === null) err("Done", `"${values.status}" should be yes or no.`);
    // Logged vs scheduled: explicit Done wins; notes are always history; otherwise past = happened, today/future/no date = to do.
    const logged = type === "note" ? true : doneFlag ?? (date ? date < today : false);
    if (logged && !date) err("Date", "Activities that already happened need a date.");
    if (logged && date && date > today) err("Date", "A completed activity can't be in the future.");
    if (type === "note" && doneFlag === false) warn("Done", "Notes are always saved as history.");
    const minutes = values.minutes ? Number(values.minutes) : undefined;
    if (values.minutes && (!Number.isFinite(minutes) || minutes! < 0 || minutes! > 1440)) err("Minutes", `"${values.minutes}" isn't a number of minutes.`);
    let outcome: CallOutcome | undefined;
    if (values.outcome) {
      outcome = OUTCOMES[values.outcome.toLowerCase()];
      if (!outcome) warn("Outcome", `"${values.outcome}" isn't a known outcome — left blank.`);
      if (type !== "call") warn("Outcome", "Only used for calls.");
    }
    const priority = (values.priority?.toLowerCase() ?? "normal") as Priority;
    if (!["low", "normal", "high"].includes(priority)) warn("Priority", `"${values.priority}" isn't Low, Normal or High — set to Normal.`);

    let contact: Contact | undefined;
    const email = values.contactEmail ? normalizeEmail(values.contactEmail) : "";
    const phone = values.contactPhone ? normalizePhone(values.contactPhone) : "";
    const hits = (email && byEmail.get(email)) || (phone && byPhone.get(phone)) || [];
    if (hits.length > 1) err("Contact", `${hits.length} contacts share this ${email && byEmail.get(email) ? "email" : "phone number"}. Merge them first.`);
    else if (hits.length === 1) contact = hits[0];
    else if (email || phone) err("Contact", "No contact has this email or phone. Activities are never imported with new contacts — add the contact first.");
    else warn("Contact", "No contact — imported as internal work.");
    if (contact && !canWriteRecord(actor, contact, db.users)) err("Contact", `You can't add activity to ${contact.displayName}.`);

    let ownerId: string | null = actor.id;
    if (values.ownerEmail) {
      const o = owners.find((u) => u.email.toLowerCase() === values.ownerEmail!.toLowerCase());
      if (o) ownerId = o.id;
      else warn("Owner", `"${values.ownerEmail}" isn't someone you can assign to — you'll be the owner.`);
    }

    let outcomeRow: ActivityPlannedRow["outcome"] = issues.some((x) => x.severity === "error") ? "error" : "create";
    let matchedId: string | undefined;
    let activity: ActivityPlannedRow["activity"];
    if (outcomeRow !== "error" && type) {
      const at = date ? zonedIso(date, hhmm ?? (logged ? "12:00" : "09:00"), tz) : undefined;
      activity = {
        type, subject, body: values.notes, contactId: contact?.id ?? null, accountId: contact?.accountId ?? undefined, assigneeId: ownerId, priority: ["low", "normal", "high"].includes(priority) ? priority : "normal",
        ...(logged ? { occurredAt: at, durationMinutes: minutes, callOutcome: type === "call" ? outcome : undefined, direction: type === "call" ? (values.direction?.toLowerCase().startsWith("they") || values.direction?.toLowerCase() === "inbound" ? "inbound" : "outbound") : undefined } : { dueAt: at, status: "open", reminder: "default", recurrence: "none" }),
      } as ActivityPlannedRow["activity"];
      const key = `${type}|${subject.toLowerCase()}|${contact?.id ?? ""}|${date ?? ""}`;
      const existing = db.activities.find((a) => a.orgId === actor.orgId && a.type === type && a.subject.toLowerCase() === subject.toLowerCase() && (a.contactId ?? "") === (contact?.id ?? "") && (a.dueAt ?? a.occurredAt ?? "").slice(0, 10) === (date ?? ""));
      if (seen.has(key)) {
        outcomeRow = "skip";
        warn("Duplicate", `Same activity as row ${seen.get(key)} in this file.`);
      } else if (existing) {
        if (mode === "skip") {
          outcomeRow = "skip";
          warn("Match", `"${existing.subject}" already exists on that date — skipped.`);
        } else {
          outcomeRow = "update";
          matchedId = existing.id;
          warn("Match", `Will update "${existing.subject}" (notes, owner, time, priority).`);
        }
      }
      seen.set(key, rowNumber);
      if (outcomeRow === "create" || outcomeRow === "update") plan[logged ? "logged" : "scheduled"]++;
    }
    plan.counts[outcomeRow]++;
    plan.rows.push({ rowNumber, raw, outcome: outcomeRow, issues, values, displayName: subject || `Row ${rowNumber}`, state: type ? (logged ? "logged" : "scheduled") : undefined, activity, contactName: contact?.displayName, matchedId });
  });
  return plan;
}

export function applyActivityImportPlan(db: Db, actor: User, plan: ActivityImportPlan, now: string, newId: (p: string) => string, audit: (id: string, action: AuditEvent["action"], summary: string) => AuditEvent) {
  let activities = [...db.activities];
  const events: AuditEvent[] = [];
  let created = 0;
  let updated = 0;
  for (const r of plan.rows) {
    if (!r.activity) continue;
    if (r.outcome === "update" && r.matchedId) {
      activities = activities.map((a) => (a.id === r.matchedId ? { ...a, body: r.activity!.body ?? a.body, assigneeId: r.activity!.assigneeId, priority: r.activity!.priority, dueAt: r.activity!.dueAt ?? a.dueAt, occurredAt: r.activity!.occurredAt ?? a.occurredAt, updatedAt: now } : a));
      events.push(audit(r.matchedId, "import_updated", r.activity.subject));
      updated++;
    } else if (r.outcome === "create") {
      const a = { ...r.activity, id: newId("ac"), orgId: actor.orgId, createdBy: actor.id, createdAt: now, updatedAt: now } as Activity;
      activities = [a, ...activities];
      events.push(audit(a.id, "imported", a.subject));
      created++;
    }
  }
  return { db: { ...db, activities, audit: [...db.audit, ...events] }, created, updated };
}
