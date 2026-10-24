import { isPlausiblePhone, normalizeEmail, normalizePhone } from "@/lib/utils/normalize";
import { canWriteRecord } from "@/lib/permissions";
import type { User } from "@/lib/types";
import type { Db } from "@/lib/mock-data/db-types";
import { eligibleOwners } from "@/lib/mock-data/users";
import type { Contact, ContactMethod, DuplicateMode } from "../types";
import { autoMapByAliases, emptyCounts, structuralError, type ImportPlanBase, type ImportRowBase, type RowIssue, type RowOutcome } from "@/lib/import";
export type { RowIssue, RowOutcome };
import { buildDisplayName } from "./display-name";

export { IMPORT_LIMITS, validateFileMeta } from "@/lib/import";

export const IMPORT_FIELDS = [
  { key: "title", label: "Title", aliases: ["title", "salutation"] },
  { key: "firstName", label: "First name", aliases: ["firstname", "first", "givenname", "forename"] },
  { key: "middleName", label: "Middle name", aliases: ["middlename", "middle", "othernames"] },
  { key: "lastName", label: "Last name", aliases: ["lastname", "surname", "familyname", "last"] },
  { key: "fullName", label: "Full name (split automatically)", aliases: ["name", "fullname", "contactname", "customername"] },
  { key: "displayName", label: "Display name", aliases: ["displayname"] },
  { key: "email", label: "Email", aliases: ["email", "emailaddress", "workemail", "primaryemail"] },
  { key: "email2", label: "Email (additional)", aliases: ["email2", "secondaryemail", "personalemail", "otheremail"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phonenumber", "mobile", "mobilenumber", "telephone", "tel", "primaryphone"] },
  { key: "phone2", label: "Phone (additional)", aliases: ["phone2", "workphone", "otherphone", "secondaryphone", "homephone"] },
  { key: "whatsapp", label: "WhatsApp", aliases: ["whatsapp", "whatsappnumber", "wa"] },
  { key: "company", label: "Account / company", aliases: ["company", "account", "accountname", "organisation", "organization", "business"] },
  { key: "jobTitle", label: "Job title", aliases: ["jobtitle", "position", "role", "designation"] },
  { key: "ownerEmail", label: "Owner email", aliases: ["owner", "owneremail", "assignedto", "accountowner"] },
  { key: "gender", label: "Gender", aliases: ["gender", "sex"] },
  { key: "dateOfBirth", label: "Date of birth", aliases: ["dateofbirth", "dob", "birthday", "birthdate"] },
  { key: "address", label: "Address", aliases: ["address", "streetaddress", "address1"] },
  { key: "city", label: "City / town", aliases: ["city", "town", "citytown"] },
  { key: "region", label: "Region", aliases: ["region", "state", "province"] },
  { key: "country", label: "Country", aliases: ["country"] },
  { key: "tags", label: "Tags (separate with ;)", aliases: ["tags", "labels"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "comments"] },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
/** Column mapping: header index -> standard field, "custom" (keep as custom field) or "ignore". */
export type ColumnTarget = ImportFieldKey | "custom" | "ignore";

export const TEMPLATE_HEADERS = ["Title", "First name", "Middle name", "Last name", "Email", "Phone", "WhatsApp", "Company", "Job title", "Owner email", "Gender", "Date of birth", "Address", "City", "Region", "Country", "Tags", "Notes"];

export function autoMapColumns(headers: string[]): ColumnTarget[] {
  return autoMapByAliases(headers, IMPORT_FIELDS) as ColumnTarget[];
}

export interface PlannedRow extends ImportRowBase {
  values: Partial<Record<ImportFieldKey, string>>;
  custom: Record<string, string>;
  matchedContactId?: string;
}

export interface ImportPlan extends ImportPlanBase<PlannedRow> {
  mapping: ColumnTarget[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseDate(value: string): string | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3]]; // DD/MM/YYYY (Ghana/UK convention)
  else return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (y < 1900 || date.getTime() > Date.now()) return null;
  return date.toISOString().slice(0, 10);
}

/** Validate rows, match against existing contacts (same org only) and decide what happens to each. */
export function planImport(
  table: string[][],
  mapping: ColumnTarget[],
  db: Db,
  actor: User,
  mode: DuplicateMode,
): ImportPlan {
  const [headers = [], ...body] = table;
  const counts = emptyCounts();
  const plan: ImportPlan = { headers, mapping, rows: [], counts };
  const structural = structuralError(table, "contacts");
  if (structural) return { ...plan, fatal: structural };
  const mapped = new Set(mapping);
  if (!mapped.has("firstName") && !mapped.has("lastName") && !mapped.has("fullName") && !mapped.has("displayName"))
    return { ...plan, fatal: "Map at least one name column (First name, Last name or Full name) to continue." };

  // Index existing contacts in the actor's organisation only.
  const orgContacts = db.contacts.filter((c) => c.orgId === actor.orgId && c.status !== "merged");
  const byKey = new Map<string, Contact[]>();
  for (const c of orgContacts)
    for (const m of c.methods) {
      const k = m.kind === "email" ? `e:${normalizeEmail(m.value)}` : `p:${normalizePhone(m.value)}`;
      byKey.set(k, [...(byKey.get(k) ?? []), c]);
    }
  const owners = eligibleOwners(db.users, actor.orgId);
  const accountsByName = new Map(db.accounts.filter((a) => a.orgId === actor.orgId).map((a) => [a.name.toLowerCase(), a.id]));
  const seenInFile = new Map<string, number>();

  body.forEach((raw, i) => {
    const rowNumber = i + 2;
    const issues: RowIssue[] = [];
    const values: Partial<Record<ImportFieldKey, string>> = {};
    const custom: Record<string, string> = {};
    if (raw.length > headers.length && raw.slice(headers.length).some((v) => v.trim()))
      issues.push({ field: "Row", message: `Row has ${raw.length} values but the header has ${headers.length} columns.`, severity: "error" });
    mapping.forEach((target, col) => {
      const v = (raw[col] ?? "").trim();
      if (!v || target === "ignore") return;
      if (target === "custom") custom[headers[col]] = v;
      else values[target] = v;
    });
    if (values.fullName && !values.firstName && !values.lastName) {
      const parts = values.fullName.split(/\s+/);
      values.firstName = parts[0];
      if (parts.length > 1) values.lastName = parts.slice(1).join(" ");
    }
    const displayName = values.displayName || buildDisplayName(values) || values.fullName || "";
    if (!displayName) issues.push({ field: "Name", message: "Missing name — add a first name, last name or full name.", severity: "error" });
    for (const k of ["email", "email2"] as const)
      if (values[k] && !EMAIL_RE.test(values[k]!)) issues.push({ field: "Email", message: `"${values[k]}" is not a valid email address.`, severity: "error" });
    for (const k of ["phone", "phone2", "whatsapp"] as const)
      if (values[k] && !isPlausiblePhone(values[k]!)) issues.push({ field: k === "whatsapp" ? "WhatsApp" : "Phone", message: `"${values[k]}" is not a valid phone number.`, severity: "error" });
    if (values.dateOfBirth) {
      const d = parseDate(values.dateOfBirth);
      if (!d) issues.push({ field: "Date of birth", message: `"${values.dateOfBirth}" is not a valid date (use YYYY-MM-DD or DD/MM/YYYY).`, severity: "error" });
      else values.dateOfBirth = d;
    }
    if (values.gender) {
      const g = values.gender.toLowerCase();
      const mappedG = g.startsWith("f") ? "female" : g.startsWith("m") ? "male" : g ? "other" : "";
      values.gender = mappedG;
    }
    if (values.company && !accountsByName.has(values.company.toLowerCase()))
      issues.push({ field: "Company", message: `No account named "${values.company}" — the contact will be imported without an account.`, severity: "warning" });
    if (values.ownerEmail) {
      const owner = owners.find((o) => o.email.toLowerCase() === values.ownerEmail!.toLowerCase());
      if (!owner) issues.push({ field: "Owner", message: `"${values.ownerEmail}" is not an active CRM user — owner will be left blank.`, severity: "warning" });
      else if (!canWriteRecord(actor, { orgId: actor.orgId, ownerId: owner.id }, db.users))
        issues.push({ field: "Owner", message: `You can't assign contacts to ${owner.name} — you will be the owner.`, severity: "warning" });
    }

    const keys = [
      ...[values.email, values.email2].filter(Boolean).map((e) => `e:${normalizeEmail(e)}`),
      ...[values.phone, values.phone2, values.whatsapp].filter((p) => p && isPlausiblePhone(p)).map((p) => `p:${normalizePhone(p)}`),
    ];
    let outcome: RowOutcome = "create";
    let matchedContactId: string | undefined;

    if (issues.some((x) => x.severity === "error")) outcome = "error";
    else {
      const dupRow = keys.map((k) => seenInFile.get(k)).find(Boolean);
      if (dupRow) {
        outcome = "skip";
        issues.push({ field: "Duplicate", message: `Same email or phone as row ${dupRow} in this file.`, severity: "warning" });
      } else {
        const matches = new Map<string, Contact>();
        for (const k of keys) for (const c of byKey.get(k) ?? []) matches.set(c.id, c);
        if (matches.size > 1) {
          outcome = "error";
          issues.push({ field: "Duplicate", message: "Matches more than one existing contact. Review duplicates before importing this row.", severity: "error" });
        } else if (matches.size === 1) {
          const match = [...matches.values()][0];
          matchedContactId = match.id;
          if (!canWriteRecord(actor, match, db.users)) {
            outcome = "error";
            matchedContactId = undefined;
            issues.push({ field: "Duplicate", message: "Matches an existing contact you don't have access to. Ask its owner or an admin.", severity: "error" });
          } else if (match.status === "archived") {
            outcome = "skip";
            issues.push({ field: "Duplicate", message: `Matches archived contact ${match.displayName}. Restore it first to update it.`, severity: "warning" });
          } else if (mode === "skip") {
            outcome = "skip";
            issues.push({ field: "Duplicate", message: `Matches existing contact ${match.displayName} — skipped.`, severity: "warning" });
          } else {
            outcome = "update";
            issues.push({ field: "Duplicate", message: `Will update existing contact ${match.displayName}.`, severity: "warning" });
          }
        }
      }
      keys.forEach((k) => seenInFile.has(k) || seenInFile.set(k, rowNumber));
    }
    counts[outcome]++;
    plan.rows.push({ rowNumber, raw, outcome, issues, values, custom, matchedContactId, displayName });
  });
  return plan;
}

function methodsFromValues(values: PlannedRow["values"], newId: (p: string) => string): ContactMethod[] {
  const out: ContactMethod[] = [];
  const push = (kind: ContactMethod["kind"], v: string | undefined, label: ContactMethod["label"]) => {
    if (!v) return;
    out.push({ id: newId("cm"), kind, value: v, label, isPrimary: !out.some((m) => m.kind === kind) });
  };
  push("email", values.email, "work");
  push("email", values.email2, "personal");
  push("phone", values.phone, "mobile");
  push("phone", values.phone2, "work");
  push("whatsapp", values.whatsapp, "mobile");
  return out;
}

/** Apply a reviewed plan to the db. Returns the new db and the ids touched. */
export function applyImportPlan(db: Db, actor: User, plan: ImportPlan, now: string, newId: (p: string) => string) {
  const owners = eligibleOwners(db.users, actor.orgId);
  const accountsByName = new Map(db.accounts.filter((a) => a.orgId === actor.orgId).map((a) => [a.name.toLowerCase(), a.id]));
  const contacts = [...db.contacts];
  const audit = [...db.audit];
  let created = 0;
  let updated = 0;

  const resolveOwner = (email?: string): string | null => {
    const fallback = actor.role === "crm_user" ? actor.id : null;
    if (!email) return fallback;
    const owner = owners.find((o) => o.email.toLowerCase() === email.toLowerCase());
    if (!owner) return fallback;
    return canWriteRecord(actor, { orgId: actor.orgId, ownerId: owner.id }, db.users) ? owner.id : actor.id;
  };

  for (const row of plan.rows) {
    const v = row.values;
    if (row.outcome === "create") {
      const contact: Contact = {
        id: newId("ct"),
        orgId: actor.orgId,
        title: v.title,
        firstName: v.firstName ?? "",
        middleName: v.middleName,
        lastName: v.lastName,
        displayName: row.displayName,
        methods: methodsFromValues(v, newId),
        accountId: v.company ? (accountsByName.get(v.company.toLowerCase()) ?? null) : null,
        jobTitle: v.jobTitle,
        ownerId: resolveOwner(v.ownerEmail),
        gender: (v.gender as Contact["gender"]) || undefined,
        dateOfBirth: v.dateOfBirth,
        address: v.address,
        city: v.city,
        region: v.region,
        country: v.country,
        tags: v.tags ? v.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [],
        notes: v.notes,
        customFields: Object.keys(row.custom).length ? row.custom : undefined,
        source: "import",
        status: "active",
        createdAt: now,
        createdBy: actor.id,
        updatedAt: now,
      };
      contacts.push(contact);
      audit.push({ id: newId("au"), orgId: actor.orgId, entityType: "contact", entityId: contact.id, action: "imported", actorId: actor.id, at: now, summary: `Imported from ${plan.headers.length ? "file" : "import"}` });
      created++;
    } else if (row.outcome === "update" && row.matchedContactId) {
      const idx = contacts.findIndex((c) => c.id === row.matchedContactId);
      if (idx < 0) continue;
      const before = contacts[idx];
      const changes: { field: string; from: string; to: string }[] = [];
      const next: Contact = { ...before, updatedAt: now };
      const setIf = (key: "title" | "middleName" | "jobTitle" | "address" | "city" | "region" | "country" | "dateOfBirth" | "notes", label: string) => {
        const val = v[key];
        if (val && val !== before[key]) {
          changes.push({ field: label, from: before[key] ?? "", to: val });
          next[key] = val;
        }
      };
      setIf("title", "Title");
      setIf("middleName", "Middle name");
      setIf("jobTitle", "Job title");
      setIf("address", "Address");
      setIf("city", "City / town");
      setIf("region", "Region");
      setIf("country", "Country");
      setIf("dateOfBirth", "Date of birth");
      const existingKeys = new Set(before.methods.map((m) => (m.kind === "email" ? `e:${normalizeEmail(m.value)}` : `${m.kind}:${normalizePhone(m.value)}`)));
      const added = methodsFromValues(v, newId).filter((m) => !existingKeys.has(m.kind === "email" ? `e:${normalizeEmail(m.value)}` : `${m.kind}:${normalizePhone(m.value)}`));
      if (added.length) {
        next.methods = [...before.methods, ...added.map((m) => ({ ...m, isPrimary: !before.methods.some((x) => x.kind === m.kind) && m.isPrimary }))];
        changes.push({ field: "Contact methods", from: "", to: `Added ${added.map((m) => m.value).join(", ")}` });
      }
      if (v.tags) {
        const tags = [...new Set([...before.tags, ...v.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean)])];
        if (tags.length !== before.tags.length) {
          changes.push({ field: "Tags", from: before.tags.join(", "), to: tags.join(", ") });
          next.tags = tags;
        }
      }
      if (Object.keys(row.custom).length) next.customFields = { ...before.customFields, ...row.custom };
      contacts[idx] = next;
      audit.push({ id: newId("au"), orgId: actor.orgId, entityType: "contact", entityId: before.id, action: "import_updated", actorId: actor.id, at: now, changes, summary: "Updated by import" });
      updated++;
    }
  }
  return { db: { ...db, contacts, audit }, created, updated };
}
