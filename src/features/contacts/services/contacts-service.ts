/**
 * Contacts mock service.
 *
 * FUTURE INTEGRATION POINT: every exported function here maps 1:1 to a
 * backend endpoint. Keep the signatures and swap the bodies for fetch calls.
 * Each function enforces permissions itself — never rely on hidden buttons.
 */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { eligibleOwners } from "@/lib/mock-data/users";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import type { Result } from "@/lib/types";
import { normalizeEmail, normalizePhone } from "@/lib/utils/normalize";
import { getCurrentUser } from "@/features/permissions";
import { canViewContact } from "../lib/access";
import { applyImportPlan, type ImportPlan } from "../lib/import";
import { errorReportCsvRows } from "@/lib/import";
import { applyMerge, type MergeInput } from "../lib/merge";
import { toCsv } from "@/lib/utils/csv";
import { normalizePrimaries, type ContactFormValues } from "../schemas/contact-form";
import { pairKey } from "../lib/duplicates";
import type {
  AuditEvent,
  ConsentChannel,
  ConsentDecision,
  ConsentMethod,
  ConsentPurpose,
  ConsentRecord,
  Contact,
  ContactFilters,
  FieldChange,
  ImportJob,
  SavedView,
} from "../types";
import { CONSENT_METHODS_BY_DECISION, METHOD_KIND_LABELS } from "../types";

function audit(e: Omit<AuditEvent, "id" | "at" | "entityType">): AuditEvent {
  return { id: newId("au"), at: nowIso(), entityType: "contact", ...e };
}

function userName(id: string | null | undefined) {
  if (!id) return "Unassigned";
  return getDb().users.find((u) => u.id === id)?.name ?? "Unknown user";
}

function accountName(id: string | null | undefined) {
  if (!id) return "";
  return getDb().accounts.find((a) => a.id === id)?.name ?? "";
}

function validOwner(ownerId: string | null, orgId: string): boolean {
  if (ownerId === null) return true;
  return eligibleOwners(getDb().users, orgId).some((u) => u.id === ownerId);
}

function fromForm(values: ContactFormValues) {
  return {
    title: values.title || undefined,
    firstName: values.firstName,
    middleName: values.middleName || undefined,
    lastName: values.lastName || undefined,
    displayName: values.displayName,
    methods: normalizePrimaries(values.methods).map((m) => ({ ...m, value: m.value.trim() })),
    accountId: values.accountId || null,
    jobTitle: values.jobTitle || undefined,
    ownerId: values.ownerId || null,
    gender: values.gender || undefined,
    dateOfBirth: values.dateOfBirth || undefined,
    address: values.address || undefined,
    city: values.city || undefined,
    region: values.region || undefined,
    country: values.country || undefined,
    tags: values.tags,
    notes: values.notes || undefined,
  } satisfies Partial<Contact>;
}

/** Existing contacts (in the actor's org) sharing an email or phone with the given values. */
export function findPossibleDuplicates(methods: { kind: string; value: string }[], excludeId?: string): Contact[] {
  const actor = getCurrentUser();
  const db = getDb();
  const keys = new Set(
    methods
      .filter((m) => m.value.trim())
      .map((m) => (m.kind === "email" ? `e:${normalizeEmail(m.value)}` : `p:${normalizePhone(m.value)}`)),
  );
  if (!keys.size) return [];
  return db.contacts.filter(
    (c) =>
      c.id !== excludeId &&
      c.orgId === actor.orgId &&
      c.status !== "merged" &&
      c.methods.some((m) => keys.has(m.kind === "email" ? `e:${normalizeEmail(m.value)}` : `p:${normalizePhone(m.value)}`)),
  );
}

export async function createContact(values: ContactFormValues): Promise<Result<Contact>> {
  await latency();
  const actor = getCurrentUser();
  if (!hasPermission(actor, "contacts.create")) return forbidden("Your role can't create contacts.");
  const data = fromForm(values);
  if (!validOwner(data.ownerId, actor.orgId)) return invalid("Choose an active owner from your organisation.");
  if (!canWriteRecord(actor, { orgId: actor.orgId, ownerId: data.ownerId }, getDb().users))
    return forbidden("You can only create contacts that you or your team own.");
  const now = nowIso();
  const contact: Contact = { ...data, id: newId("ct"), orgId: actor.orgId, source: "manual", status: "active", createdAt: now, createdBy: actor.id, updatedAt: now };
  const db = getDb();
  commitDb({ ...db, contacts: [contact, ...db.contacts], audit: [...db.audit, audit({ orgId: actor.orgId, entityId: contact.id, action: "created", actorId: actor.id })] });
  return ok(contact);
}

const describeMethods = (ms: Contact["methods"]) => ms.map((m) => `${METHOD_KIND_LABELS[m.kind]}: ${m.value}`).join(", ");

const DIFF_FIELDS: Array<[keyof ReturnType<typeof fromForm>, string, (v: unknown) => string]> = [
  ["title", "Title", String],
  ["firstName", "First name", String],
  ["middleName", "Middle name", String],
  ["lastName", "Last name", String],
  ["displayName", "Display name", String],
  ["accountId", "Account", (v) => accountName(v as string)],
  ["jobTitle", "Job title", String],
  ["gender", "Gender", String],
  ["dateOfBirth", "Date of birth", String],
  ["address", "Address", String],
  ["city", "City / town", String],
  ["region", "Region", String],
  ["country", "Country", String],
  ["notes", "Notes", String],
];

export async function updateContact(id: string, values: ContactFormValues): Promise<Result<Contact>> {
  await latency();
  const actor = getCurrentUser();
  const db = getDb();
  const before = db.contacts.find((c) => c.id === id);
  if (!before || !canViewContact(db, actor, before)) return notFound();
  if (before.status !== "active") return invalid("Restore this contact before editing it.");
  if (!hasPermission(actor, "contacts.edit") || !canWriteRecord(actor, before, db.users)) return forbidden("You can't edit this contact.");
  const data = fromForm(values);
  const ownerChanged = data.ownerId !== before.ownerId;
  if (ownerChanged) {
    if (!hasPermission(actor, "contacts.reassign")) return forbidden("Your role can't change the contact owner.");
    if (!validOwner(data.ownerId, actor.orgId)) return invalid("Choose an active owner from your organisation.");
    if (!canWriteRecord(actor, { orgId: actor.orgId, ownerId: data.ownerId }, db.users)) return forbidden("You can't assign contacts to that person.");
  }
  const changes: FieldChange[] = [];
  for (const [key, label, fmt] of DIFF_FIELDS) {
    const a = before[key] ?? "";
    const b = data[key] ?? "";
    if (String(a) !== String(b)) changes.push({ field: label, from: a ? fmt(a) : "", to: b ? fmt(b) : "" });
  }
  const fmtMethods = (ms: Contact["methods"]) => ms.map((m) => `${m.kind}:${m.value}${m.isPrimary ? "*" : ""}`).sort().join(", ");
  if (fmtMethods(before.methods) !== fmtMethods(data.methods))
    changes.push({ field: "Contact methods", from: describeMethods(before.methods), to: describeMethods(data.methods) });
  if (before.tags.join("|") !== data.tags.join("|")) changes.push({ field: "Tags", from: before.tags.join(", "), to: data.tags.join(", ") });

  const after: Contact = { ...before, ...data, updatedAt: nowIso() };
  const events: AuditEvent[] = [];
  if (changes.length) events.push(audit({ orgId: actor.orgId, entityId: id, action: "updated", actorId: actor.id, changes }));
  if (ownerChanged)
    events.push(audit({ orgId: actor.orgId, entityId: id, action: "reassigned", actorId: actor.id, changes: [{ field: "Owner", from: userName(before.ownerId), to: userName(data.ownerId) }] }));
  commitDb({
    ...db,
    contacts: db.contacts.map((c) => (c.id === id ? after : c)),
    audit: [...db.audit, ...events],
    notifications: ownerChanged && data.ownerId && data.ownerId !== actor.id
      ? [{ id: newId("nt"), userId: data.ownerId, title: "Contact assigned to you", body: `${actor.name} assigned ${after.displayName} to you.`, href: `/contacts/${id}`, at: nowIso(), read: false }, ...db.notifications]
      : db.notifications,
  });
  return ok(after);
}

type BulkResult = { changed: number; skipped: number };

async function bulkStatus(ids: string[], to: "archived" | "active"): Promise<Result<BulkResult>> {
  await latency();
  const actor = getCurrentUser();
  const perm = to === "archived" ? "contacts.archive" : "contacts.restore";
  if (!hasPermission(actor, perm)) return forbidden(to === "archived" ? "Your role can't archive contacts." : "Your role can't restore contacts.");
  const db = getDb();
  const now = nowIso();
  const events: AuditEvent[] = [];
  let changed = 0;
  const contacts = db.contacts.map((c) => {
    if (!ids.includes(c.id)) return c;
    const from = to === "archived" ? "active" : "archived";
    if (c.status !== from || !canWriteRecord(actor, c, db.users)) return c;
    changed++;
    events.push(audit({ orgId: c.orgId, entityId: c.id, action: to === "archived" ? "archived" : "restored", actorId: actor.id }));
    return to === "archived" ? { ...c, status: "archived" as const, archivedAt: now, archivedBy: actor.id, updatedAt: now } : { ...c, status: "active" as const, archivedAt: undefined, archivedBy: undefined, updatedAt: now };
  });
  if (!changed) return forbidden("None of the selected contacts could be changed. You may not have access to them.");
  commitDb({ ...db, contacts, audit: [...db.audit, ...events] });
  return ok({ changed, skipped: ids.length - changed });
}

export const archiveContacts = (ids: string[]) => bulkStatus(ids, "archived");
export const restoreContacts = (ids: string[]) => bulkStatus(ids, "active");

export async function reassignContacts(ids: string[], ownerId: string | null): Promise<Result<BulkResult>> {
  await latency();
  const actor = getCurrentUser();
  const db = getDb();
  if (!hasPermission(actor, "contacts.reassign")) return forbidden("Your role can't reassign contacts.");
  if (!validOwner(ownerId, actor.orgId)) return invalid("Choose an active owner from your organisation.");
  if (!canWriteRecord(actor, { orgId: actor.orgId, ownerId }, db.users)) return forbidden("You can't assign contacts to that person.");
  const now = nowIso();
  const events: AuditEvent[] = [];
  let changed = 0;
  const contacts = db.contacts.map((c) => {
    if (!ids.includes(c.id) || c.status !== "active" || c.ownerId === ownerId || !canWriteRecord(actor, c, db.users)) return c;
    changed++;
    events.push(audit({ orgId: c.orgId, entityId: c.id, action: "reassigned", actorId: actor.id, changes: [{ field: "Owner", from: userName(c.ownerId), to: userName(ownerId) }] }));
    return { ...c, ownerId, updatedAt: now };
  });
  const notifications = ownerId && ownerId !== actor.id && changed
    ? [{ id: newId("nt"), userId: ownerId, title: "Contacts assigned to you", body: `${actor.name} assigned ${changed} contact${changed === 1 ? "" : "s"} to you.`, href: "/contacts?view=mine", at: now, read: false }, ...db.notifications]
    : db.notifications;
  commitDb({ ...db, contacts, audit: [...db.audit, ...events], notifications });
  return ok({ changed, skipped: ids.length - changed });
}

export interface RecordConsentInput {
  contactId: string;
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  decision: ConsentDecision;
  method: ConsentMethod;
  note?: string;
  evidenceRef?: string;
}

export async function recordConsent(input: RecordConsentInput): Promise<Result<ConsentRecord>> {
  await latency();
  const actor = getCurrentUser();
  const db = getDb();
  const contact = db.contacts.find((c) => c.id === input.contactId);
  if (!contact || !canViewContact(db, actor, contact)) return notFound();
  if (!hasPermission(actor, "consent.record") || !canWriteRecord(actor, contact, db.users)) return forbidden("You can't record communication preferences for this contact.");
  if (!CONSENT_METHODS_BY_DECISION[input.decision].includes(input.method)) return invalid("That method doesn't match the decision you selected.");
  const record: ConsentRecord = { id: newId("cs"), orgId: contact.orgId, recordedAt: nowIso(), recordedBy: actor.id, ...input, note: input.note || undefined, evidenceRef: input.evidenceRef || undefined };
  commitDb({
    ...db,
    consents: [...db.consents, record],
    audit: [...db.audit, audit({ orgId: contact.orgId, entityId: contact.id, action: "consent_recorded", actorId: actor.id, summary: `${input.channel.toUpperCase()} (${input.purpose === "marketing" ? "marketing" : "service updates"}): ${input.decision}` })],
  });
  return ok(record);
}

export async function mergeContacts(input: MergeInput): Promise<Result<Contact>> {
  await latency(400);
  const actor = getCurrentUser();
  const db = getDb();
  if (!hasPermission(actor, "contacts.merge")) return forbidden("Your role can't merge contacts.");
  const records = input.contactIds.map((id) => db.contacts.find((c) => c.id === id));
  if (records.some((c) => !c || c.status !== "active")) return invalid("One of these contacts was changed or archived. Refresh and try again.");
  if (records.some((c) => !canWriteRecord(actor, c!, db.users))) return forbidden("You need access to every contact in the group to merge it.");
  if (!input.contactIds.includes(input.primaryId)) return invalid("Choose which record to keep.");
  try {
    const next = applyMerge(db, actor.id, input, nowIso(), newId);
    commitDb(next);
    return ok(next.contacts.find((c) => c.id === input.primaryId)!);
  } catch (e) {
    return invalid((e as Error).message);
  }
}

export async function dismissDuplicatePair(ids: string[]): Promise<Result<true>> {
  await latency(120);
  const actor = getCurrentUser();
  if (!hasPermission(actor, "contacts.merge")) return forbidden();
  const db = getDb();
  const pairs: string[] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push(pairKey(ids[i], ids[j]));
  commitDb({ ...db, dismissedDuplicatePairs: [...new Set([...db.dismissedDuplicatePairs, ...pairs])] });
  return ok(true);
}

export async function runImport(plan: ImportPlan, file: { name: string; size: number }, mode: ImportJob["duplicateMode"]): Promise<Result<ImportJob>> {
  await latency(700);
  const actor = getCurrentUser();
  if (!hasPermission(actor, "contacts.import")) return forbidden("Your role can't import contacts.");
  const db = getDb();
  const now = nowIso();
  const applied = applyImportPlan(db, actor, plan, now, newId);
  const report = errorReportCsvRows(plan);
  const job: ImportJob = {
    id: newId("imp"),
    entityType: "contact",
    orgId: actor.orgId,
    fileName: file.name,
    fileSize: file.size,
    startedAt: now,
    actorId: actor.id,
    duplicateMode: mode,
    totalRows: plan.rows.length,
    created: applied.created,
    updated: applied.updated,
    skipped: plan.counts.skip,
    failed: plan.counts.error,
    errorReportCsv: report.rows.length ? toCsv(report.headers, report.rows) : undefined,
  };
  commitDb({ ...applied.db, importJobs: [job, ...applied.db.importJobs] });
  return ok(job);
}

export function canExport(): boolean {
  return hasPermission(getCurrentUser(), "contacts.export");
}

export async function saveView(name: string, filters: ContactFilters): Promise<Result<SavedView>> {
  const actor = getCurrentUser();
  const trimmed = name.trim();
  if (!trimmed) return invalid("Give the view a name.");
  const db = getDb();
  const view: SavedView = { id: newId("view"), name: trimmed.slice(0, 40), ownerUserId: actor.id, filters };
  commitDb({ ...db, savedViews: [...db.savedViews, view] });
  return ok(view);
}

export async function deleteView(id: string): Promise<Result<true>> {
  const actor = getCurrentUser();
  const db = getDb();
  const view = db.savedViews.find((v) => v.id === id);
  if (!view || view.ownerUserId !== actor.id) return forbidden("You can only delete your own views.");
  commitDb({ ...db, savedViews: db.savedViews.filter((v) => v.id !== id) });
  return ok(true);
}
