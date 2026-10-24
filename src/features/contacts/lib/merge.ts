import { normalizeEmail, normalizePhone } from "@/lib/utils/normalize";
import type { Db } from "@/lib/mock-data/db-types";
import type { AuditEvent, ConsentChannel, ConsentPurpose, Contact, ContactMethod } from "../types";
import { latestConsent } from "./consent";

export const MERGE_FIELDS = [
  { key: "title", label: "Title" },
  { key: "firstName", label: "First name" },
  { key: "middleName", label: "Middle name" },
  { key: "lastName", label: "Last name" },
  { key: "displayName", label: "Display name" },
  { key: "accountId", label: "Account" },
  { key: "jobTitle", label: "Job title" },
  { key: "ownerId", label: "Owner" },
  { key: "gender", label: "Gender" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "address", label: "Address" },
  { key: "city", label: "City / town" },
  { key: "region", label: "Region" },
  { key: "country", label: "Country" },
] as const satisfies ReadonlyArray<{ key: keyof Contact; label: string }>;

export type MergeFieldKey = (typeof MERGE_FIELDS)[number]["key"];
/** For each field: the id of the contact whose value wins. */
export type MergeChoices = Partial<Record<MergeFieldKey, string>>;

const isEmpty = (v: unknown) => v === undefined || v === null || v === "";

/** Fields where at least two records hold different non-empty values. */
export function conflictingFields(contacts: Contact[]): MergeFieldKey[] {
  return MERGE_FIELDS.filter(({ key }) => {
    const values = new Set(contacts.map((c) => c[key]).filter((v) => !isEmpty(v)).map(String));
    return values.size > 1;
  }).map((f) => f.key);
}

/** Primary's value wins; empty primary fields are filled from the first record that has a value. */
export function defaultChoices(contacts: Contact[], primaryId: string): MergeChoices {
  const primary = contacts.find((c) => c.id === primaryId)!;
  const choices: MergeChoices = {};
  for (const { key } of MERGE_FIELDS) {
    if (!isEmpty(primary[key])) choices[key] = primary.id;
    else choices[key] = contacts.find((c) => !isEmpty(c[key]))?.id ?? primary.id;
  }
  return choices;
}

function methodKey(m: ContactMethod) {
  return `${m.kind === "email" ? "email" : m.kind}:${m.kind === "email" ? normalizeEmail(m.value) : normalizePhone(m.value)}`;
}

/** Union of contact methods, de-duplicated by normalised value; one primary per kind. */
export function mergeMethods(primary: Contact, others: Contact[]): ContactMethod[] {
  const seen = new Set<string>();
  const out: ContactMethod[] = [];
  for (const c of [primary, ...others]) {
    for (const m of c.methods) {
      const k = methodKey(m);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ...m, isPrimary: c.id === primary.id ? m.isPrimary : false });
    }
  }
  for (const kind of ["phone", "email", "whatsapp"] as const) {
    const ofKind = out.filter((m) => m.kind === kind);
    if (ofKind.length && !ofKind.some((m) => m.isPrimary)) ofKind[0].isPrimary = true;
  }
  return out;
}

export function buildMergedContact(contacts: Contact[], primaryId: string, choices: MergeChoices): Contact {
  const primary = contacts.find((c) => c.id === primaryId)!;
  const others = contacts.filter((c) => c.id !== primaryId);
  const merged: Contact = { ...primary };
  for (const { key } of MERGE_FIELDS) {
    const source = contacts.find((c) => c.id === choices[key]) ?? primary;
    (merged as unknown as Record<string, unknown>)[key] = source[key];
  }
  merged.methods = mergeMethods(primary, others);
  merged.tags = [...new Set(contacts.flatMap((c) => c.tags))];
  const notes = [...new Set(contacts.map((c) => c.notes?.trim()).filter(Boolean))];
  merged.notes = notes.length ? notes.join("\n\n— ") : undefined;
  merged.createdAt = contacts.map((c) => c.createdAt).sort()[0];
  merged.lastActivityAt = contacts.map((c) => c.lastActivityAt).filter(Boolean).sort().at(-1);
  merged.status = "active";
  return merged;
}

export interface ConsentConflict {
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  values: Array<{ contactId: string; decision: string; recordedAt: string }>;
  /** The decision that will be current after merging: the most recent record. */
  resulting: string;
}

export function consentConflicts(db: Db, contactIds: string[]): ConsentConflict[] {
  const out: ConsentConflict[] = [];
  for (const channel of ["sms", "whatsapp", "email", "phone"] as const) {
    for (const purpose of ["marketing", "service_updates"] as const) {
      const values = contactIds
        .map((id) => ({ id, rec: latestConsent(db.consents, id, channel, purpose) }))
        .filter((v) => v.rec)
        .map((v) => ({ contactId: v.id, decision: v.rec!.decision, recordedAt: v.rec!.recordedAt }));
      if (new Set(values.map((v) => v.decision)).size > 1) {
        const resulting = [...values].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0].decision;
        out.push({ channel, purpose, values, resulting });
      }
    }
  }
  return out;
}

export function relationCounts(db: Db, contactIds: string[]) {
  const ids = new Set(contactIds);
  return {
    activities: db.activities.filter((a) => !!a.contactId && ids.has(a.contactId)).length,
    consents: db.consents.filter((r) => ids.has(r.contactId)).length,
    deals: db.deals.filter((d) => d.contactId && ids.has(d.contactId)).length,
    leads: db.leads.filter((l) => l.converted && ids.has(l.converted.contactId)).length,
    quotes: db.quotes.filter((q) => q.contactId && ids.has(q.contactId)).length,
    tickets: db.tickets.filter((t) => ids.has(t.contactId)).length,
    documents: db.documents.filter((d) => d.links.some((l) => l.kind === "contact" && ids.has(l.id))).length,
    communications: db.communications.filter((m) => ids.has(m.contactId)).length,
  };
}

export interface MergeInput {
  primaryId: string;
  contactIds: string[];
  choices: MergeChoices;
}

/**
 * Pure merge. Re-points every related record to the primary contact, keeps
 * ALL consent history (tagged with where it came from), marks secondaries
 * as merged (soft) and writes audit events. Permission checks happen in the
 * service layer before calling this.
 */
export function applyMerge(db: Db, actorId: string, input: MergeInput, now: string, newId: (p: string) => string): Db {
  const contacts = input.contactIds.map((id) => db.contacts.find((c) => c.id === id)).filter(Boolean) as Contact[];
  if (contacts.length < 2) throw new Error("Select at least two contacts to merge.");
  if (new Set(contacts.map((c) => c.orgId)).size > 1) throw new Error("Contacts from different organisations cannot be merged.");
  const secondaryIds = new Set(input.contactIds.filter((id) => id !== input.primaryId));
  const merged = { ...buildMergedContact(contacts, input.primaryId, input.choices), updatedAt: now };
  const primary = contacts.find((c) => c.id === input.primaryId)!;
  const repoint = <T extends { contactId: string | null }>(rows: T[]) => rows.map((r) => (r.contactId && secondaryIds.has(r.contactId) ? { ...r, contactId: input.primaryId } : r));

  const changes = MERGE_FIELDS.filter(({ key }) => String(primary[key] ?? "") !== String(merged[key] ?? "")).map(({ key, label }) => ({
    field: label,
    from: String(primary[key] ?? ""),
    to: String(merged[key] ?? ""),
  }));
  const secondaryNames = contacts.filter((c) => secondaryIds.has(c.id)).map((c) => c.displayName);
  const auditEvents: AuditEvent[] = [
    {
      id: newId("au"),
      orgId: primary.orgId,
      entityType: "contact",
      entityId: input.primaryId,
      action: "merged",
      actorId,
      at: now,
      changes,
      summary: `Merged ${secondaryNames.join(", ")} into this contact. Activities, consent history and related records were kept.`,
    },
    ...[...secondaryIds].map((id) => ({
      id: newId("au"),
      orgId: primary.orgId,
      entityType: "contact" as const,
      entityId: id,
      action: "merged_into" as const,
      actorId,
      at: now,
      summary: `Merged into ${merged.displayName}`,
    })),
  ];

  return {
    ...db,
    contacts: db.contacts.map((c) => {
      if (c.id === input.primaryId) return merged;
      if (secondaryIds.has(c.id)) return { ...c, status: "merged", mergedIntoId: input.primaryId, updatedAt: now };
      return c;
    }),
    activities: repoint(db.activities),
    consents: db.consents.map((r) => (secondaryIds.has(r.contactId) ? { ...r, contactId: input.primaryId, carriedFromContactId: r.contactId } : r)),
    deals: repoint(db.deals),
    quotes: repoint(db.quotes),
    leads: db.leads.map((l) => (l.converted && secondaryIds.has(l.converted.contactId) ? { ...l, converted: { ...l.converted, contactId: input.primaryId } } : l)),
    tickets: repoint(db.tickets),
    documents: db.documents.map((d) => (d.links.some((l) => l.kind === "contact" && secondaryIds.has(l.id)) ? { ...d, links: dedupeLinks(d.links.map((l) => (l.kind === "contact" && secondaryIds.has(l.id) ? { ...l, id: input.primaryId } : l))) } : d)),
    communications: db.communications.map((m) => (secondaryIds.has(m.contactId) ? { ...m, contactId: input.primaryId } : m)),
    audit: [...db.audit.map((a) => a), ...auditEvents],
  };
}

function dedupeLinks<T extends { kind: string; id: string }>(links: T[]): T[] {
  const seen = new Set<string>();
  return links.filter((l) => !seen.has(`${l.kind}:${l.id}`) && !!seen.add(`${l.kind}:${l.id}`));
}
