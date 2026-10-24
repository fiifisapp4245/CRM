import { canWriteRecord } from "@/lib/permissions";
import type { User } from "@/lib/types";
import type { Db } from "@/lib/mock-data/db-types";
import { eligibleOwners } from "@/lib/mock-data/users";
import { autoMapByAliases, emptyCounts, structuralError, type ImportPlanBase, type ImportRowBase, type RowIssue } from "@/lib/import";
import type { AuditEvent, DuplicateMode, FieldChange } from "@/features/contacts/types";
import { ACCOUNT_RATING_LABELS, ACCOUNT_SIZE_LABELS, ACCOUNT_TYPE_LABELS, type Account, type AccountRating, type AccountSize, type AccountType } from "../types";
import { wouldCreateCycle } from "./hierarchy";

export const ACCOUNT_IMPORT_FIELDS = [
  { key: "name", label: "Account name", aliases: ["name", "accountname", "company", "companyname", "organisation", "organization", "business"] },
  { key: "accountNumber", label: "Account number", aliases: ["accountnumber", "accountno", "accno", "number", "customernumber"] },
  { key: "type", label: "Type", aliases: ["type", "accounttype"] },
  { key: "parent", label: "Parent account (name or number)", aliases: ["parent", "parentaccount", "headoffice", "parentcompany"] },
  { key: "rating", label: "Rating", aliases: ["rating", "relationshiprating"] },
  { key: "ownerEmail", label: "Owner email", aliases: ["owner", "owneremail", "accountowner"] },
  { key: "phone", label: "Phone", aliases: ["phone", "telephone", "phonenumber"] },
  { key: "email", label: "Email", aliases: ["email", "emailaddress"] },
  { key: "website", label: "Website", aliases: ["website", "web", "url"] },
  { key: "industry", label: "Industry", aliases: ["industry", "sector"] },
  { key: "employees", label: "Employees", aliases: ["employees", "staff", "headcount", "numberofemployees"] },
  { key: "size", label: "Size", aliases: ["size", "companysize"] },
  { key: "annualRevenue", label: "Annual revenue (GHS)", aliases: ["annualrevenue", "revenue", "turnover"] },
  { key: "city", label: "Billing city / town", aliases: ["city", "town", "billingcity"] },
  { key: "region", label: "Billing region", aliases: ["region", "billingregion"] },
  { key: "country", label: "Billing country", aliases: ["country", "billingcountry"] },
  { key: "tags", label: "Tags (separate with ;)", aliases: ["tags"] },
  { key: "notes", label: "Notes", aliases: ["notes", "comments"] },
] as const;

export type AccountImportKey = (typeof ACCOUNT_IMPORT_FIELDS)[number]["key"];

export const ACCOUNT_TEMPLATE_HEADERS = ["Account name", "Account number", "Type", "Parent account", "Rating", "Owner email", "Phone", "Email", "Website", "Industry", "Employees", "Size", "Annual revenue", "City", "Region", "Country", "Tags", "Notes"];

export function autoMapAccountColumns(headers: string[]): string[] {
  return autoMapByAliases(headers, ACCOUNT_IMPORT_FIELDS, "ignore");
}

export interface AccountPlannedRow extends ImportRowBase {
  values: Partial<Record<AccountImportKey, string>>;
  matchedAccountId?: string;
  /** Resolution of the parent column. */
  parent?: { kind: "existing"; id: string; name: string } | { kind: "in_file"; name: string } | { kind: "create"; name: string };
}

export interface AccountImportPlan extends ImportPlanBase<AccountPlannedRow> {
  /** Parent accounts that don't exist yet and will be created. */
  parentsToCreate: string[];
}

const keyName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

function parseEnum<T extends string>(value: string | undefined, labels: Record<T, string>): T | null | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  const hit = (Object.keys(labels) as T[]).find((k) => k === v || labels[k].toLowerCase().startsWith(v));
  return hit ?? null;
}

/**
 * Matching rules (from the existing CRM): account number first, otherwise
 * name. A name shared by more than one existing account is ambiguous and is
 * rejected rather than merged. A parent that doesn't exist is created —
 * listed in the review before confirmation.
 */
export function planAccountImport(table: string[][], mapping: string[], db: Db, actor: User, mode: DuplicateMode): AccountImportPlan {
  const [headers = [], ...body] = table;
  const plan: AccountImportPlan = { headers, mapping, rows: [], counts: emptyCounts(), parentsToCreate: [] };
  const structural = structuralError(table, "accounts");
  if (structural) return { ...plan, fatal: structural };
  if (!mapping.includes("name")) return { ...plan, fatal: "Map a column to Account name to continue." };

  const orgAccounts = db.accounts.filter((a) => a.orgId === actor.orgId);
  const byNumber = new Map(orgAccounts.filter((a) => a.accountNumber).map((a) => [a.accountNumber!.toLowerCase(), a]));
  const byName = new Map<string, Account[]>();
  for (const a of orgAccounts) byName.set(keyName(a.name), [...(byName.get(keyName(a.name)) ?? []), a]);
  const owners = eligibleOwners(db.users, actor.orgId);
  const fileNames = new Set<string>();
  const fileNumbers = new Map<string, string>(); // account number -> name, for rows in this file
  const seen = new Map<string, number>();
  const toCreate = new Set<string>();

  // First pass: names that the file itself creates (so branches can point at them).
  body.forEach((raw) => {
    const n = raw[mapping.indexOf("name")]?.trim();
    const num = mapping.includes("accountNumber") ? raw[mapping.indexOf("accountNumber")]?.trim() : "";
    if (n) fileNames.add(keyName(n));
    if (n && num) fileNumbers.set(num.toLowerCase(), n);
  });

  body.forEach((raw, i) => {
    const rowNumber = i + 2;
    const issues: RowIssue[] = [];
    const values: AccountPlannedRow["values"] = {};
    mapping.forEach((target, col) => {
      const v = (raw[col] ?? "").trim();
      if (v && target !== "ignore" && target !== "custom") values[target as AccountImportKey] = v;
    });
    const displayName = values.name ?? "";
    if (!displayName) issues.push({ field: "Name", message: "Missing account name.", severity: "error" });
    if (values.type && parseEnum(values.type, ACCOUNT_TYPE_LABELS) === null) issues.push({ field: "Type", message: `"${values.type}" isn't a known type — it will be set to Other.`, severity: "warning" });
    if (values.rating && parseEnum(values.rating, ACCOUNT_RATING_LABELS) === null) issues.push({ field: "Rating", message: `"${values.rating}" isn't Hot, Warm or Cold — rating left blank.`, severity: "warning" });
    if (values.size && parseEnum(values.size, ACCOUNT_SIZE_LABELS) === null) issues.push({ field: "Size", message: `"${values.size}" isn't a known size — left blank.`, severity: "warning" });
    if (values.employees && !/^\d+$/.test(values.employees.replace(/[, ]/g, ""))) issues.push({ field: "Employees", message: `"${values.employees}" is not a whole number.`, severity: "error" });
    if (values.annualRevenue && Number.isNaN(Number(values.annualRevenue.replace(/[, ]|GHS|₵/gi, "")))) issues.push({ field: "Annual revenue", message: `"${values.annualRevenue}" is not a number.`, severity: "error" });
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) issues.push({ field: "Email", message: `"${values.email}" is not a valid email address.`, severity: "error" });
    if (values.ownerEmail && !owners.some((o) => o.email.toLowerCase() === values.ownerEmail!.toLowerCase()))
      issues.push({ field: "Owner", message: `"${values.ownerEmail}" is not an active CRM user — owner will be left blank.`, severity: "warning" });

    // Match
    let matched: Account | undefined;
    let matchError: string | undefined;
    if (displayName) {
      if (values.accountNumber) matched = byNumber.get(values.accountNumber.toLowerCase());
      if (!matched) {
        const sameName = byName.get(keyName(displayName)) ?? [];
        if (sameName.length > 1 && !values.accountNumber) matchError = `${sameName.length} existing accounts are called "${displayName}". Add an account number to say which one.`;
        else if (sameName.length > 1 && values.accountNumber) {
          // Number given but unknown: a new account that shares a name. Flag it.
          issues.push({ field: "Name", message: `Shares a name with ${sameName.length} existing accounts; a new account will be created with number ${values.accountNumber}.`, severity: "warning" });
        } else if (sameName.length === 1 && !(values.accountNumber && sameName[0].accountNumber && sameName[0].accountNumber.toLowerCase() !== values.accountNumber.toLowerCase())) matched = sameName[0];
      }
    }
    if (matchError) issues.push({ field: "Match", message: matchError, severity: "error" });

    // Parent
    let parent: AccountPlannedRow["parent"];
    if (values.parent) {
      const p = values.parent;
      const existing = byNumber.get(p.toLowerCase()) ?? (byName.get(keyName(p))?.length === 1 ? byName.get(keyName(p))![0] : undefined);
      const ambiguous = !existing && (byName.get(keyName(p))?.length ?? 0) > 1;
      if (ambiguous) issues.push({ field: "Parent", message: `More than one account is called "${p}". Use its account number.`, severity: "error" });
      else if (existing) {
        if (matched && wouldCreateCycle(orgAccounts, matched.id, existing.id)) issues.push({ field: "Parent", message: `${existing.name} is already below ${matched.name}; this would create a loop.`, severity: "error" });
        else if (keyName(existing.name) === keyName(displayName)) issues.push({ field: "Parent", message: "An account can't be its own parent.", severity: "error" });
        else parent = { kind: "existing", id: existing.id, name: existing.name };
      } else if (keyName(p) === keyName(displayName)) issues.push({ field: "Parent", message: "An account can't be its own parent.", severity: "error" });
      else if (fileNumbers.has(p.toLowerCase())) parent = { kind: "in_file", name: fileNumbers.get(p.toLowerCase())! };
      else if (fileNames.has(keyName(p))) parent = { kind: "in_file", name: p };
      else parent = { kind: "create", name: p };
    }

    let outcome: AccountPlannedRow["outcome"] = "create";
    if (issues.some((x) => x.severity === "error")) outcome = "error";
    else {
      const dedupeKey = (values.accountNumber ?? "").toLowerCase() || keyName(displayName);
      if (seen.has(dedupeKey)) {
        outcome = "skip";
        issues.push({ field: "Duplicate", message: `Same account as row ${seen.get(dedupeKey)} in this file.`, severity: "warning" });
      } else if (matched) {
        if (!canWriteRecord(actor, matched, db.users)) {
          outcome = "error";
          issues.push({ field: "Match", message: `Matches ${matched.name}, which you can't edit.`, severity: "error" });
        } else if (mode === "skip") {
          outcome = "skip";
          issues.push({ field: "Match", message: `Matches existing account ${matched.name}${matched.accountNumber ? ` (${matched.accountNumber})` : ""} — skipped.`, severity: "warning" });
        } else {
          outcome = "update";
          issues.push({ field: "Match", message: `Will update ${matched.name}. Empty cells won't erase existing details.`, severity: "warning" });
        }
      }
      seen.set(dedupeKey, rowNumber);
      if (outcome !== "skip" && parent?.kind === "create") {
        toCreate.add(parent.name);
        issues.push({ field: "Parent", message: `Parent "${parent.name}" doesn't exist yet and will be created.`, severity: "warning" });
      }
    }
    plan.counts[outcome]++;
    plan.rows.push({ rowNumber, raw, outcome, issues, values, displayName, matchedAccountId: outcome === "update" ? matched?.id : undefined, parent });
  });
  plan.parentsToCreate = [...toCreate];
  return plan;
}

function toNumber(v?: string) {
  if (!v) return undefined;
  const n = Number(v.replace(/[, ]|GHS|₵/gi, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function applyAccountImportPlan(db: Db, actor: User, plan: AccountImportPlan, now: string, newId: (p: string) => string) {
  const owners = eligibleOwners(db.users, actor.orgId);
  const accounts = [...db.accounts];
  const audit: AuditEvent[] = [...db.audit];
  const fallbackOwner = actor.role === "crm_user" ? actor.id : null;
  const resolveOwner = (email?: string) => {
    const o = email ? owners.find((x) => x.email.toLowerCase() === email.toLowerCase()) : undefined;
    if (!o) return fallbackOwner;
    return canWriteRecord(actor, { orgId: actor.orgId, ownerId: o.id }, db.users) ? o.id : actor.id;
  };
  const nameIndex = new Map<string, string>(); // lowercased name -> id for accounts created in this run
  let created = 0;
  let updated = 0;

  const createParent = (name: string) => {
    const key = keyName(name);
    if (nameIndex.has(key)) return nameIndex.get(key)!;
    const a: Account = { id: newId("acc"), orgId: actor.orgId, name, type: "customer", parentId: null, ownerId: fallbackOwner, tags: [], createdAt: now, createdBy: actor.id, updatedAt: now };
    accounts.push(a);
    nameIndex.set(key, a.id);
    audit.push({ id: newId("au"), orgId: actor.orgId, entityType: "account", entityId: a.id, action: "imported", actorId: actor.id, at: now, summary: "Created as a parent referenced by an imported branch" });
    created++;
    return a.id;
  };

  const fields = (v: AccountPlannedRow["values"]) => ({
    accountNumber: v.accountNumber,
    type: (parseEnum(v.type, ACCOUNT_TYPE_LABELS) ?? undefined) as AccountType | undefined,
    rating: (parseEnum(v.rating, ACCOUNT_RATING_LABELS) ?? undefined) as AccountRating | undefined,
    size: (parseEnum(v.size, ACCOUNT_SIZE_LABELS) ?? undefined) as AccountSize | undefined,
    phone: v.phone,
    email: v.email,
    website: v.website,
    industry: v.industry,
    employees: toNumber(v.employees),
    annualRevenue: toNumber(v.annualRevenue),
    notes: v.notes,
  });

  // Creates and updates first, so in-file parents exist before branches link to them.
  const pendingParents: Array<{ id: string; parent: NonNullable<AccountPlannedRow["parent"]> }> = [];
  for (const row of plan.rows) {
    const v = row.values;
    if (row.outcome === "create") {
      const f = fields(v);
      const a: Account = {
        id: newId("acc"),
        orgId: actor.orgId,
        name: v.name!,
        ...f,
        type: f.type ?? "other",
        parentId: null,
        ownerId: resolveOwner(v.ownerEmail),
        billingAddress: v.city || v.region || v.country ? { city: v.city, region: v.region, country: v.country } : undefined,
        tags: v.tags ? v.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [],
        createdAt: now,
        createdBy: actor.id,
        updatedAt: now,
      };
      accounts.push(a);
      nameIndex.set(keyName(a.name), a.id);
      audit.push({ id: newId("au"), orgId: actor.orgId, entityType: "account", entityId: a.id, action: "imported", actorId: actor.id, at: now, summary: "Imported from file" });
      created++;
      if (row.parent) pendingParents.push({ id: a.id, parent: row.parent });
    } else if (row.outcome === "update" && row.matchedAccountId) {
      const idx = accounts.findIndex((a) => a.id === row.matchedAccountId);
      if (idx < 0) continue;
      const before = accounts[idx];
      const f = fields(v);
      const next: Account = { ...before, updatedAt: now };
      const changes: FieldChange[] = [];
      const labels: Record<string, string> = { accountNumber: "Account number", type: "Type", rating: "Rating", size: "Size", phone: "Phone", email: "Email", website: "Website", industry: "Industry", employees: "Employees", annualRevenue: "Annual revenue", notes: "Notes" };
      for (const [k, val] of Object.entries(f)) {
        if (val === undefined || val === "") continue; // never erase populated values
        const key = k as keyof typeof f;
        if (String(before[key] ?? "") !== String(val)) {
          changes.push({ field: labels[k], from: String(before[key] ?? ""), to: String(val) });
          (next as unknown as Record<string, unknown>)[key] = val;
        }
      }
      if (v.city || v.region || v.country) next.billingAddress = { ...before.billingAddress, ...(v.city && { city: v.city }), ...(v.region && { region: v.region }), ...(v.country && { country: v.country }) };
      if (v.tags) next.tags = [...new Set([...before.tags, ...v.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean)])];
      accounts[idx] = next;
      audit.push({ id: newId("au"), orgId: actor.orgId, entityType: "account", entityId: before.id, action: "import_updated", actorId: actor.id, at: now, changes, summary: "Updated by import" });
      updated++;
      if (row.parent) pendingParents.push({ id: before.id, parent: row.parent });
    }
  }

  for (const { id, parent } of pendingParents) {
    const parentId = parent.kind === "existing" ? parent.id : nameIndex.get(keyName(parent.name)) ?? createParent(parent.name);
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx < 0 || wouldCreateCycle(accounts, id, parentId)) continue;
    accounts[idx] = { ...accounts[idx], parentId };
  }

  return { db: { ...db, accounts, audit }, created, updated };
}
