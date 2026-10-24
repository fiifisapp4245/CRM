/**
 * Deal import: plan (validate + match, no writes) and apply (pure; the service
 * commits). Contacts and companies are only created when the user ticks
 * "create missing", and every one is listed in the review first.
 */
import { canWriteRecord } from "@/lib/permissions";
import type { User } from "@/lib/types";
import type { Db } from "@/lib/mock-data/db-types";
import { eligibleOwners } from "@/lib/mock-data/users";
import { normalizeEmail, normalizePhone } from "@/lib/utils/normalize";
import { autoMapByAliases, emptyCounts, structuralError, type ImportPlanBase, type ImportRowBase, type RowIssue } from "@/lib/import";
import type { Account } from "@/features/accounts/types";
import type { AuditEvent, Contact, DuplicateMode } from "@/features/contacts/types";
import { DEFAULT_PIPELINE_ID } from "@/lib/mock-data/seed-sales";
import type { Currency, Deal } from "../types";

export const DEAL_IMPORT_FIELDS = [
  { key: "title", label: "Deal name", aliases: ["title", "deal", "dealname", "name", "opportunity"] },
  { key: "amount", label: "Value", aliases: ["amount", "value", "dealvalue", "price", "total"] },
  { key: "currency", label: "Currency (GHS or USD)", aliases: ["currency", "cur"] },
  { key: "stage", label: "Stage", aliases: ["stage", "status", "dealstage"] },
  { key: "expectedClose", label: "Expected close date", aliases: ["expectedclose", "expectedclosedate", "closedate", "closingdate"] },
  { key: "closedOn", label: "Closed on (won/lost)", aliases: ["closedon", "closeddate", "dateclosed", "wonon", "loston"] },
  { key: "reason", label: "Won/lost reason", aliases: ["reason", "wonreason", "lostreason", "outcomereason"] },
  { key: "probability", label: "Chance of winning (%)", aliases: ["probability", "chance", "winprobability"] },
  { key: "ownerEmail", label: "Owner email", aliases: ["owner", "owneremail", "salesperson", "rep"] },
  { key: "contactName", label: "Contact name", aliases: ["contact", "contactname", "customer", "customername"] },
  { key: "contactEmail", label: "Contact email", aliases: ["contactemail", "email", "customeremail"] },
  { key: "contactPhone", label: "Contact phone", aliases: ["contactphone", "phone", "mobile", "customerphone"] },
  { key: "company", label: "Company (account)", aliases: ["company", "account", "accountname", "companyname", "organisation", "organization"] },
  { key: "notes", label: "Notes", aliases: ["notes", "comments", "description"] },
] as const;

export type DealImportKey = (typeof DEAL_IMPORT_FIELDS)[number]["key"];
export const DEAL_TEMPLATE_HEADERS = ["Deal name", "Value", "Currency", "Stage", "Expected close date", "Closed on", "Reason", "Chance", "Owner email", "Contact name", "Contact email", "Contact phone", "Company", "Notes"];

export const autoMapDealColumns = (headers: string[]) => autoMapByAliases(headers, DEAL_IMPORT_FIELDS, "ignore");

type Ref<T> = { kind: "existing"; id: string; name: string } | { kind: "new"; key: string; name: string; data: T } | null;

export interface DealPlannedRow extends ImportRowBase {
  values: Partial<Record<DealImportKey, string>>;
  deal?: { title: string; amount: number; currency: Currency; stageId: string; status: Deal["status"]; expectedClose: string; closedOn?: string; reason?: string; probability?: number; ownerId: string; notes?: string };
  contact: Ref<{ name: string; email?: string; phone?: string }>;
  account: Ref<{ name: string }>;
  matchedDealId?: string;
}

export interface DealImportPlan extends ImportPlanBase<DealPlannedRow> {
  newContacts: { key: string; name: string; detail: string }[];
  newAccounts: { key: string; name: string }[];
  createMissing: boolean;
}

const k = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Accepts YYYY-MM-DD or DD/MM/YYYY (Ghana convention). Returns YYYY-MM-DD or null. */
export function parseDate(v: string): string | null {
  const s = v.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function planDealImport(table: string[][], mapping: string[], db: Db, actor: User, mode: DuplicateMode, opts: { createMissing: boolean; today: string }): DealImportPlan {
  const [headers = [], ...body] = table;
  const plan: DealImportPlan = { headers, mapping, rows: [], counts: emptyCounts(), newContacts: [], newAccounts: [], createMissing: opts.createMissing };
  const structural = structuralError(table, "deals");
  if (structural) return { ...plan, fatal: structural };
  for (const req of ["title", "amount", "stage"] as const) if (!mapping.includes(req)) return { ...plan, fatal: `Map a column to ${DEAL_IMPORT_FIELDS.find((f) => f.key === req)!.label} to continue.` };

  const pipeline = db.pipelines.find((p) => p.id === DEFAULT_PIPELINE_ID) ?? db.pipelines[0];
  const contacts = db.contacts.filter((c) => c.orgId === actor.orgId && c.status === "active");
  const byEmail = new Map<string, Contact[]>();
  const byPhone = new Map<string, Contact[]>();
  for (const c of contacts)
    for (const m of c.methods) {
      if (m.kind === "email") byEmail.set(normalizeEmail(m.value), [...(byEmail.get(normalizeEmail(m.value)) ?? []), c]);
      else byPhone.set(normalizePhone(m.value), [...(byPhone.get(normalizePhone(m.value)) ?? []), c]);
    }
  const accounts = db.accounts.filter((a) => a.orgId === actor.orgId);
  const accByName = new Map<string, Account[]>();
  for (const a of accounts) accByName.set(k(a.name), [...(accByName.get(k(a.name)) ?? []), a]);
  const owners = eligibleOwners(db.users, actor.orgId);
  const newContacts = new Map<string, DealImportPlan["newContacts"][number]>();
  const newAccounts = new Map<string, DealImportPlan["newAccounts"][number]>();
  const seen = new Map<string, number>();

  body.forEach((raw, i) => {
    const rowNumber = i + 2;
    const issues: RowIssue[] = [];
    const err = (field: string, message: string) => issues.push({ field, message, severity: "error" });
    const warn = (field: string, message: string) => issues.push({ field, message, severity: "warning" });
    const values: DealPlannedRow["values"] = {};
    mapping.forEach((target, col) => {
      const v = (raw[col] ?? "").trim();
      if (v && target !== "ignore" && target !== "custom") values[target as DealImportKey] = v;
    });
    const title = values.title ?? "";
    if (!title) err("Deal name", "Missing deal name.");
    const amount = Number((values.amount ?? "").replace(/[, ]|GHS|USD|GH₵|₵|\$/gi, ""));
    if (!values.amount) err("Value", "Missing value.");
    else if (!Number.isFinite(amount) || amount < 0) err("Value", `"${values.amount}" is not a valid amount.`);
    const currency = (values.currency ?? "GHS").toUpperCase().replace("GH₵", "GHS") as Currency;
    if (currency !== "GHS" && currency !== "USD") err("Currency", `"${values.currency}" isn't supported. Use GHS or USD — amounts are never converted.`);

    const stageText = k(values.stage ?? "");
    const stage = pipeline.stages.find((s) => k(s.name) === stageText || s.kind === stageText || (stageText === "proposal" && s.id === "st_proposal"));
    if (!stageText) err("Stage", "Missing stage.");
    else if (!stage) err("Stage", `"${values.stage}" isn't a stage. Use one of: ${pipeline.stages.map((s) => s.name).join(", ")}.`);
    const status: Deal["status"] = stage?.kind === "won" ? "won" : stage?.kind === "lost" ? "lost" : "open";

    const expected = values.expectedClose ? parseDate(values.expectedClose) : null;
    if (values.expectedClose && !expected) err("Expected close", `"${values.expectedClose}" isn't a date. Use YYYY-MM-DD or DD/MM/YYYY.`);
    let closedOn: string | undefined;
    if (status === "open") {
      if (!values.expectedClose) err("Expected close", "Open deals need an expected close date.");
      if (values.closedOn) warn("Closed on", "Ignored — the deal is open.");
    } else {
      const c = values.closedOn ? parseDate(values.closedOn) : expected;
      if (values.closedOn && !c) err("Closed on", `"${values.closedOn}" isn't a date.`);
      else if (!c) err("Closed on", `${status === "won" ? "Won" : "Lost"} deals need the date they closed.`);
      else if (c > opts.today) err("Closed on", "A closed deal can't have a future close date.");
      closedOn = c ?? undefined;
      if (status === "lost" && !values.reason) err("Reason", "Lost deals need a reason, so loss analysis stays useful.");
    }
    let probability: number | undefined;
    if (values.probability) {
      probability = Number(values.probability.replace("%", ""));
      if (!Number.isFinite(probability) || probability < 0 || probability > 100) err("Chance", `"${values.probability}" must be between 0 and 100.`);
      else if (status !== "open") {
        warn("Chance", "Ignored for closed deals.");
        probability = undefined;
      }
    }
    let ownerId = actor.id;
    if (values.ownerEmail) {
      const o = owners.find((u) => u.email.toLowerCase() === values.ownerEmail!.toLowerCase());
      if (o) ownerId = o.id;
      else warn("Owner", `"${values.ownerEmail}" is not an active CRM user — you'll be the owner.`);
    }

    // Contact: email first, then phone. Several matches are flagged, never guessed.
    let contact: DealPlannedRow["contact"] = null;
    const email = values.contactEmail ? normalizeEmail(values.contactEmail) : "";
    const phone = values.contactPhone ? normalizePhone(values.contactPhone) : "";
    const hits = (email && byEmail.get(email)) || (phone && byPhone.get(phone)) || [];
    if (hits.length > 1) err("Contact", `${hits.length} contacts share this ${email && byEmail.get(email) ? "email" : "phone number"}. Merge them first, or leave the column blank.`);
    else if (hits.length === 1) {
      contact = { kind: "existing", id: hits[0].id, name: hits[0].displayName };
      if (values.contactName && k(values.contactName) !== k(hits[0].displayName)) warn("Contact", `Matched ${hits[0].displayName} by ${email && byEmail.get(email) ? "email" : "phone"} (file says "${values.contactName}").`);
    } else if (values.contactName) {
      const key = email || phone || k(values.contactName);
      contact = { kind: "new", key, name: values.contactName, data: { name: values.contactName, email: values.contactEmail, phone: values.contactPhone } };
    } else if (email || phone) err("Contact", "No contact has this email or phone. Add a contact name to create one, or leave it blank.");
    else warn("Contact", "No contact linked — you can add one later.");

    // Company: exact name. An existing contact's own company is used when the column is blank.
    let account: DealPlannedRow["account"] = null;
    if (values.company) {
      const found = accByName.get(k(values.company)) ?? [];
      if (found.length > 1) err("Company", `${found.length} accounts are called "${values.company}".`);
      else if (found.length === 1) account = { kind: "existing", id: found[0].id, name: found[0].name };
      else account = { kind: "new", key: k(values.company), name: values.company, data: { name: values.company } };
    } else if (contact?.kind === "existing") {
      const acc = contacts.find((c) => c.id === contact!.id)?.accountId;
      const a = acc ? accounts.find((x) => x.id === acc) : undefined;
      if (a) account = { kind: "existing", id: a.id, name: a.name };
    }
    if (!opts.createMissing) {
      if (contact?.kind === "new") err("Contact", `"${contact.name}" isn't in the CRM. Tick "Create missing contacts and companies" to add them.`);
      if (account?.kind === "new") err("Company", `"${account.name}" isn't in the CRM. Tick "Create missing contacts and companies" to add it.`);
    }

    let outcome: DealPlannedRow["outcome"] = issues.some((x) => x.severity === "error") ? "error" : "create";
    let matchedDealId: string | undefined;
    if (outcome !== "error") {
      const dupKey = `${k(title)}|${contact?.kind === "existing" ? contact.id : (contact?.key ?? "")}|${account?.kind === "existing" ? account.id : (account?.key ?? "")}`;
      const existing = db.deals.find((d) => d.orgId === actor.orgId && k(d.title) === k(title) && ((contact?.kind === "existing" && d.contactId === contact.id) || (account?.kind === "existing" && d.accountId === account.id)));
      if (seen.has(dupKey)) {
        outcome = "skip";
        warn("Duplicate", `Same deal as row ${seen.get(dupKey)} in this file.`);
      } else if (existing) {
        if (mode === "skip") {
          outcome = "skip";
          warn("Match", `"${existing.title}" already exists for this customer — skipped.`);
        } else if (existing.status !== "open" || status !== "open") {
          outcome = "error";
          err("Match", `Matches "${existing.title}". Won and lost outcomes can't be changed by import — close or reopen deals in the CRM.`);
        } else if (!canWriteRecord(actor, existing, db.users)) {
          outcome = "error";
          err("Match", `Matches "${existing.title}", which you can't edit.`);
        } else {
          outcome = "update";
          matchedDealId = existing.id;
          warn("Match", existing.valuation === "products" ? `Will update "${existing.title}" (stage, close date, chance, notes). Its value comes from its products, so the file's value is ignored.` : `Will update "${existing.title}" (value, stage, close date, chance, notes).`);
        }
      }
      seen.set(dupKey, rowNumber);
    }
    if (outcome === "create" || outcome === "update") {
      if (contact?.kind === "new" && !newContacts.has(contact.key)) newContacts.set(contact.key, { key: contact.key, name: contact.name, detail: [values.contactEmail, values.contactPhone].filter(Boolean).join(" · ") });
      if (account?.kind === "new" && !newAccounts.has(account.key)) newAccounts.set(account.key, { key: account.key, name: account.name });
    }
    plan.counts[outcome]++;
    plan.rows.push({
      rowNumber,
      raw,
      outcome,
      issues,
      values,
      displayName: title || `Row ${rowNumber}`,
      contact,
      account,
      matchedDealId,
      deal: outcome === "error" || !stage ? undefined : { title, amount, currency, stageId: stage.id, status, expectedClose: expected ?? closedOn ?? opts.today, closedOn, reason: values.reason, probability, ownerId, notes: values.notes },
    });
  });
  plan.newContacts = [...newContacts.values()];
  plan.newAccounts = [...newAccounts.values()];
  return plan;
}

export interface AppliedDealImport {
  db: Db;
  created: number;
  updated: number;
  contactsCreated: number;
  accountsCreated: number;
}

/** Pure: returns the next Db. Contacts/accounts listed in the plan are created once and reused across rows. */
export function applyDealImportPlan(db: Db, actor: User, plan: DealImportPlan, now: string, newId: (p: string) => string, audit: (entityType: AuditEvent["entityType"], id: string, action: AuditEvent["action"], summary: string) => AuditEvent): AppliedDealImport {
  const contacts = [...db.contacts];
  const accounts = [...db.accounts];
  let deals = [...db.deals];
  const events: AuditEvent[] = [];
  const accIds = new Map<string, string>();
  const ctIds = new Map<string, string>();
  let created = 0;
  let updated = 0;

  for (const row of plan.rows) {
    if ((row.outcome !== "create" && row.outcome !== "update") || !row.deal) continue;
    const d = row.deal;
    let accountId: string | null = row.account?.kind === "existing" ? row.account.id : null;
    if (row.account?.kind === "new" && plan.createMissing) {
      accountId = accIds.get(row.account.key) ?? null;
      if (!accountId) {
        const a: Account = { id: newId("acc"), orgId: actor.orgId, name: row.account.name, type: "customer", parentId: null, ownerId: d.ownerId, tags: [], createdAt: now, createdBy: actor.id, updatedAt: now };
        accounts.push(a);
        accountId = a.id;
        accIds.set(row.account.key, a.id);
        events.push(audit("account", a.id, "created", `${a.name} (created by deal import)`));
      }
    }
    let contactId: string | null = row.contact?.kind === "existing" ? row.contact.id : null;
    if (row.contact?.kind === "new" && plan.createMissing) {
      contactId = ctIds.get(row.contact.key) ?? null;
      if (!contactId) {
        const n = row.contact.data;
        const [firstName, ...rest] = n.name.trim().split(/\s+/);
        const c: Contact = {
          id: newId("ct"), orgId: actor.orgId, firstName, lastName: rest.join(" ") || undefined, displayName: n.name.trim(), accountId, ownerId: d.ownerId, tags: [], source: "import", status: "active", createdAt: now, createdBy: actor.id, updatedAt: now,
          methods: [...(n.email ? [{ id: newId("cm"), kind: "email" as const, value: n.email, label: "work" as const, isPrimary: true }] : []), ...(n.phone ? [{ id: newId("cm"), kind: "phone" as const, value: n.phone, label: "mobile" as const, isPrimary: true }] : [])],
        };
        contacts.unshift(c);
        contactId = c.id;
        ctIds.set(row.contact.key, c.id);
        events.push(audit("contact", c.id, "created", `${c.displayName} (created by deal import)`));
      }
    }
    if (row.outcome === "update" && row.matchedDealId) {
      deals = deals.map((x) =>
        x.id === row.matchedDealId
          ? { ...x, amount: x.valuation === "products" ? x.amount : d.amount, stageId: d.stageId, stageChangedAt: x.stageId === d.stageId ? x.stageChangedAt : now, expectedClose: d.expectedClose, probability: d.probability ?? x.probability, notes: d.notes ?? x.notes, updatedAt: now }
          : x,
      );
      events.push(audit("deal", row.matchedDealId, "updated", `${d.title} (deal import)`));
      updated++;
      continue;
    }
    const deal: Deal = {
      id: newId("dl"), orgId: actor.orgId, title: d.title, pipelineId: DEFAULT_PIPELINE_ID, stageId: d.stageId, contactId, accountId, ownerId: d.ownerId, currency: d.currency, valuation: "manual", amount: d.amount, lineItems: [],
      probability: d.probability, expectedClose: d.expectedClose, status: d.status, closedAt: d.closedOn ? `${d.closedOn}T12:00:00.000Z` : undefined,
      wonReason: d.status === "won" ? d.reason : undefined, lostReason: d.status === "lost" ? d.reason : undefined, notes: d.notes, stageChangedAt: now, createdAt: now, createdBy: actor.id, updatedAt: now,
    };
    deals.unshift(deal);
    events.push(audit("deal", deal.id, d.status === "open" ? "created" : d.status, `${deal.title} (imported${d.status === "open" ? "" : ` as ${d.status}`})`));
    created++;
  }
  return { db: { ...db, contacts, accounts, deals, audit: [...db.audit, ...events] }, created, updated, contactsCreated: ctIds.size, accountsCreated: accIds.size };
}
