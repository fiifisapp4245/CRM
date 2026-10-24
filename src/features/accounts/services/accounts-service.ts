/** Accounts mock service. FUTURE INTEGRATION POINT — each function maps to an API endpoint and enforces permissions itself. */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { eligibleOwners } from "@/lib/mock-data/users";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import type { Result } from "@/lib/types";
import { errorReportCsvRows } from "@/lib/import";
import { toCsv } from "@/lib/utils/csv";
import { formatMoney } from "@/lib/utils/format";
import { getCurrentUser } from "@/features/permissions";
import type { AuditEvent, DuplicateMode, FieldChange, ImportJob } from "@/features/contacts/types";
import { wouldCreateCycle } from "../lib/hierarchy";
import { applyAccountImportPlan, type AccountImportPlan } from "../lib/import";
import type { AccountFormValues } from "../schemas/account-form";
import { ACCOUNT_RATING_LABELS, ACCOUNT_SIZE_LABELS, ACCOUNT_TYPE_LABELS, ACCOUNT_OWNERSHIP_LABELS, type Account, type Address } from "../types";

const cleanAddress = (a: AccountFormValues["billingAddress"]): Address | undefined => {
  const out = Object.fromEntries(Object.entries(a).filter(([, v]) => v)) as Address;
  return Object.keys(out).length ? out : undefined;
};

function fromForm(v: AccountFormValues) {
  return {
    name: v.name,
    type: v.type,
    ownerId: v.ownerId || null,
    rating: v.rating || undefined,
    parentId: v.parentId || null,
    phone: v.phone || undefined,
    email: v.email || undefined,
    website: v.website || undefined,
    industry: v.industry || undefined,
    ownership: v.ownership || undefined,
    employees: v.employees ? Number(v.employees.replace(/,/g, "")) : undefined,
    size: v.size || undefined,
    annualRevenue: v.annualRevenue ? Number(v.annualRevenue.replace(/,/g, "")) : undefined,
    accountNumber: v.accountNumber || undefined,
    billingAddress: cleanAddress(v.billingAddress),
    shippingAddress: v.shippingSame ? undefined : cleanAddress(v.shippingAddress),
    tags: v.tags,
    notes: v.notes || undefined,
  } satisfies Partial<Account>;
}

function validate(data: ReturnType<typeof fromForm>, orgId: string, id?: string): string | null {
  const db = getDb();
  const accounts = db.accounts.filter((a) => a.orgId === orgId);
  if (data.ownerId && !eligibleOwners(db.users, orgId).some((u) => u.id === data.ownerId)) return "Choose an active owner from your organisation.";
  if (data.parentId) {
    if (!accounts.some((a) => a.id === data.parentId)) return "The parent account no longer exists.";
    if (id && wouldCreateCycle(accounts, id, data.parentId)) return "That parent is already a branch of this account. Choose another parent.";
  }
  if (data.accountNumber && accounts.some((a) => a.id !== id && a.accountNumber?.toLowerCase() === data.accountNumber!.toLowerCase()))
    return `Account number ${data.accountNumber} is already used by another account.`;
  return null;
}

export async function createAccount(values: AccountFormValues): Promise<Result<Account>> {
  await latency();
  const actor = getCurrentUser();
  if (!hasPermission(actor, "accounts.create")) return forbidden("Your role can't create accounts.");
  const data = fromForm(values);
  const err = validate(data, actor.orgId);
  if (err) return invalid(err);
  if (!canWriteRecord(actor, { orgId: actor.orgId, ownerId: data.ownerId }, getDb().users)) return forbidden("You can only create accounts that you or your team own.");
  const now = nowIso();
  const account: Account = { ...data, id: newId("acc"), orgId: actor.orgId, createdAt: now, createdBy: actor.id, updatedAt: now };
  const db = getDb();
  commitDb({
    ...db,
    accounts: [...db.accounts, account],
    audit: [...db.audit, { id: newId("au"), orgId: actor.orgId, entityType: "account", entityId: account.id, action: "created", actorId: actor.id, at: now, summary: account.parentId ? "Created as a branch" : undefined }],
  });
  return ok(account);
}

const DIFF: Array<[keyof Account, string, (v: unknown, db: ReturnType<typeof getDb>) => string]> = [
  ["name", "Name", String],
  ["type", "Type", (v) => ACCOUNT_TYPE_LABELS[v as Account["type"]] ?? String(v)],
  ["rating", "Rating", (v) => ACCOUNT_RATING_LABELS[v as NonNullable<Account["rating"]>] ?? String(v)],
  ["parentId", "Parent account", (v, db) => db.accounts.find((a) => a.id === v)?.name ?? ""],
  ["ownerId", "Owner", (v, db) => db.users.find((u) => u.id === v)?.name ?? ""],
  ["accountNumber", "Account number", String],
  ["phone", "Phone", String],
  ["email", "Email", String],
  ["website", "Website", String],
  ["industry", "Industry", String],
  ["ownership", "Ownership", (v) => ACCOUNT_OWNERSHIP_LABELS[v as NonNullable<Account["ownership"]>] ?? String(v)],
  ["employees", "Employees", String],
  ["size", "Size", (v) => ACCOUNT_SIZE_LABELS[v as NonNullable<Account["size"]>] ?? String(v)],
  ["annualRevenue", "Annual revenue", (v) => formatMoney(Number(v))],
  ["notes", "Notes", String],
];

export async function updateAccount(id: string, values: AccountFormValues): Promise<Result<Account>> {
  await latency();
  const actor = getCurrentUser();
  const db = getDb();
  const before = db.accounts.find((a) => a.id === id && a.orgId === actor.orgId);
  if (!before) return notFound();
  if (!hasPermission(actor, "accounts.edit") || !canWriteRecord(actor, before, db.users)) return forbidden("You can't edit this account.");
  const data = fromForm(values);
  if (data.ownerId !== before.ownerId && !hasPermission(actor, "contacts.reassign")) return forbidden("Your role can't change account owners.");
  if (!canWriteRecord(actor, { orgId: actor.orgId, ownerId: data.ownerId }, db.users)) return forbidden("You can't assign accounts to that person.");
  const err = validate(data, actor.orgId, id);
  if (err) return invalid(err);
  const changes: FieldChange[] = [];
  for (const [k, label, fmt] of DIFF) {
    const a = before[k] ?? "";
    const b = (data as Record<string, unknown>)[k] ?? "";
    if (String(a) !== String(b)) changes.push({ field: label, from: a ? fmt(a, db) : "", to: b ? fmt(b, db) : "" });
  }
  const addr = (x?: Address) => [x?.line1, x?.city, x?.region, x?.country, x?.postalCode].filter(Boolean).join(", ");
  if (addr(before.billingAddress) !== addr(data.billingAddress)) changes.push({ field: "Billing address", from: addr(before.billingAddress), to: addr(data.billingAddress) });
  if (addr(before.shippingAddress) !== addr(data.shippingAddress)) changes.push({ field: "Shipping address", from: addr(before.shippingAddress) || "Same as billing", to: addr(data.shippingAddress) || "Same as billing" });
  if (before.tags.join("|") !== data.tags.join("|")) changes.push({ field: "Tags", from: before.tags.join(", "), to: data.tags.join(", ") });
  const after: Account = { ...before, ...data, updatedAt: nowIso() };
  const events: AuditEvent[] = changes.length ? [{ id: newId("au"), orgId: actor.orgId, entityType: "account", entityId: id, action: "updated", actorId: actor.id, at: nowIso(), changes }] : [];
  commitDb({ ...db, accounts: db.accounts.map((a) => (a.id === id ? after : a)), audit: [...db.audit, ...events] });
  return ok(after);
}

export async function runAccountImport(plan: AccountImportPlan, file: { name: string; size: number }, mode: DuplicateMode): Promise<Result<ImportJob>> {
  await latency(600);
  const actor = getCurrentUser();
  if (!hasPermission(actor, "accounts.import")) return forbidden("Your role can't import accounts.");
  const now = nowIso();
  const applied = applyAccountImportPlan(getDb(), actor, plan, now, newId);
  const report = errorReportCsvRows(plan);
  const job: ImportJob = {
    id: newId("imp"),
    entityType: "account",
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
