/** Leads mock service. FUTURE INTEGRATION POINT — permission checks live here, not in the UI. */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { eligibleOwners } from "@/lib/mock-data/users";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import type { Result, User } from "@/lib/types";
import type { Db } from "@/lib/mock-data/db-types";
import { getCurrentUser } from "@/features/permissions";
import type { Account } from "@/features/accounts/types";
import type { Contact, ContactMethod } from "@/features/contacts/types";
import { DEFAULT_PIPELINE_ID } from "@/lib/mock-data/seed-sales";
import { LEAD_STATUS_LABELS, type Currency, type Deal, type Lead, type LeadStatus } from "../types";
import type { LeadFormValues } from "../schemas/lead-form";
import { auditEvent } from "./helpers";

/** Prototype auto-assignment: the eligible owner (within the creator's reach) with the fewest open leads; ties by name. Not verified TroveSuite logic. */
export function autoAssignOwner(db: Db, actor: User): string | null {
  const candidates = eligibleOwners(db.users, actor.orgId).filter((u) => u.role !== "crm_admin" && canWriteRecord(actor, { orgId: actor.orgId, ownerId: u.id }, db.users));
  if (!candidates.length) return null;
  const load = (id: string) => db.leads.filter((l) => l.ownerId === id && (l.status === "new" || l.status === "contacted" || l.status === "qualified")).length;
  return [...candidates].sort((a, b) => load(a.id) - load(b.id) || a.name.localeCompare(b.name))[0].id;
}

function fromForm(v: LeadFormValues, db: Db, actor: User) {
  return {
    name: v.name.trim(),
    phone: v.phone || undefined,
    email: v.email || undefined,
    city: v.city || undefined,
    company: v.company || undefined,
    jobTitle: v.jobTitle || undefined,
    need: v.need || undefined,
    estimatedValue: v.estimatedValue ? Number(v.estimatedValue.replace(/,/g, "")) : undefined,
    currency: v.currency,
    source: v.source,
    sourceDetail: v.sourceDetail || undefined,
    rating: v.rating || undefined,
    ownerId: v.ownerId === "auto" ? autoAssignOwner(db, actor) : v.ownerId || null,
    notes: v.notes || undefined,
  } satisfies Partial<Lead>;
}

export async function createLead(values: LeadFormValues): Promise<Result<Lead>> {
  await latency();
  const actor = getCurrentUser();
  if (!hasPermission(actor, "leads.manage")) return forbidden("Your role can't add leads.");
  const db = getDb();
  const data = fromForm(values, db, actor);
  if (!canWriteRecord(actor, { orgId: actor.orgId, ownerId: data.ownerId }, db.users)) return forbidden("You can't assign leads to that person.");
  const now = nowIso();
  const lead: Lead = { ...data, id: newId("ld"), orgId: actor.orgId, status: "new", events: [{ id: newId("le"), kind: "status", status: "new", at: now, by: actor.id }], createdAt: now, createdBy: actor.id, updatedAt: now };
  commitDb({ ...db, leads: [lead, ...db.leads], audit: [...db.audit, auditEvent(actor.orgId, "lead", lead.id, "created", actor.id, lead.name)] });
  return ok(lead);
}

function loadWritable(id: string) {
  const actor = getCurrentUser();
  const db = getDb();
  const lead = db.leads.find((l) => l.id === id && l.orgId === actor.orgId);
  if (!lead) return { error: notFound() };
  if (!hasPermission(actor, "leads.manage") || !canWriteRecord(actor, lead, db.users)) return { error: forbidden("You can't change this lead.") };
  return { actor, db, lead };
}

export async function updateLead(id: string, values: LeadFormValues): Promise<Result<Lead>> {
  await latency();
  const r = loadWritable(id);
  if ("error" in r) return r.error!;
  const { actor, db, lead } = r;
  if (lead.status === "converted") return invalid("Converted leads can't be edited. Update the contact or deal instead.");
  const data = fromForm(values, db, actor);
  if (!canWriteRecord(actor, { orgId: actor.orgId, ownerId: data.ownerId }, db.users)) return forbidden("You can't assign leads to that person.");
  const after: Lead = { ...lead, ...data, updatedAt: nowIso() };
  commitDb({ ...db, leads: db.leads.map((l) => (l.id === id ? after : l)), audit: [...db.audit, auditEvent(actor.orgId, "lead", id, "updated", actor.id, lead.name)] });
  return ok(after);
}

const ALLOWED: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "qualified", "disqualified"],
  contacted: ["qualified", "disqualified"],
  qualified: ["contacted", "disqualified"],
  disqualified: ["new"],
  converted: [],
};

export async function setLeadStatus(id: string, status: LeadStatus, note?: string): Promise<Result<Lead>> {
  await latency(120);
  const r = loadWritable(id);
  if ("error" in r) return r.error!;
  const { actor, db, lead } = r;
  if (!ALLOWED[lead.status].includes(status)) return invalid(`A ${LEAD_STATUS_LABELS[lead.status].toLowerCase()} lead can't move to ${LEAD_STATUS_LABELS[status].toLowerCase()}.`);
  if (status === "disqualified" && !note?.trim()) return invalid("Say why this lead is disqualified.");
  const now = nowIso();
  const after: Lead = {
    ...lead,
    status,
    disqualifyReason: status === "disqualified" ? note!.trim() : status === "new" ? undefined : lead.disqualifyReason,
    nextAction: status === "disqualified" ? undefined : lead.nextAction,
    lastInteractionAt: status === "contacted" ? now : lead.lastInteractionAt,
    events: [...lead.events, { id: newId("le"), kind: "status", status, at: now, by: actor.id, text: note?.trim() || undefined }],
    updatedAt: now,
  };
  commitDb({ ...db, leads: db.leads.map((l) => (l.id === id ? after : l)), audit: [...db.audit, auditEvent(actor.orgId, "lead", id, "status_changed", actor.id, lead.name, [{ field: "Status", from: LEAD_STATUS_LABELS[lead.status], to: LEAD_STATUS_LABELS[status] }])] });
  return ok(after);
}

export async function logLeadInteraction(id: string, kind: "note" | "call", text: string): Promise<Result<Lead>> {
  await latency(120);
  const r = loadWritable(id);
  if ("error" in r) return r.error!;
  const { db, lead, actor } = r;
  if (!text.trim()) return invalid(kind === "note" ? "Write the note first." : "Add a short summary of the call.");
  const now = nowIso();
  const after: Lead = { ...lead, events: [...lead.events, { id: newId("le"), kind, at: now, by: actor.id, text: text.trim() }], lastInteractionAt: now, updatedAt: now };
  commitDb({ ...db, leads: db.leads.map((l) => (l.id === id ? after : l)) });
  return ok(after);
}

export async function setNextAction(id: string, next: { label: string; dueAt: string } | null): Promise<Result<Lead>> {
  await latency(100);
  const r = loadWritable(id);
  if ("error" in r) return r.error!;
  const { db, lead } = r;
  if (next && !next.label.trim()) return invalid("Describe the next action.");
  const after: Lead = { ...lead, nextAction: next ?? undefined, updatedAt: nowIso() };
  commitDb({ ...db, leads: db.leads.map((l) => (l.id === id ? after : l)) });
  return ok(after);
}

export interface ConvertInput {
  contact: { mode: "existing"; id: string } | { mode: "new"; firstName: string; lastName: string; email?: string; phone?: string; jobTitle?: string; city?: string };
  account: { mode: "existing"; id: string } | { mode: "new"; name: string } | { mode: "none" };
  deal: { create: false } | { create: true; title: string; amount: number; currency: Currency; stageId: string; expectedClose: string };
}

/** Converts in one step so a failure never leaves half-created records. */
export async function convertLead(id: string, input: ConvertInput): Promise<Result<{ contactId: string; accountId?: string; dealId?: string }>> {
  await latency(400);
  const r = loadWritable(id);
  if ("error" in r) return r.error!;
  const { actor, db, lead } = r;
  if (lead.status === "converted" || lead.status === "disqualified") return invalid("Only open leads can be converted.");
  if (!hasPermission(actor, "contacts.create") && input.contact.mode === "new") return forbidden("Your role can't create contacts.");
  if (input.deal.create && !hasPermission(actor, "deals.manage")) return forbidden("Your role can't create deals.");
  const now = nowIso();
  const owner = lead.ownerId ?? actor.id;
  let contacts = db.contacts;
  let accounts = db.accounts;
  const deals = [...db.deals];
  const audit = [...db.audit];

  let accountId: string | undefined;
  if (input.account.mode === "existing") {
    if (!accounts.some((a) => a.id === (input.account as { id: string }).id && a.orgId === actor.orgId)) return invalid("That account no longer exists.");
    accountId = input.account.id;
  } else if (input.account.mode === "new") {
    if (!input.account.name.trim()) return invalid("Give the new account a name.");
    const acc: Account = { id: newId("acc"), orgId: actor.orgId, name: input.account.name.trim(), type: "customer", parentId: null, ownerId: owner, tags: [], createdAt: now, createdBy: actor.id, updatedAt: now };
    accounts = [...accounts, acc];
    accountId = acc.id;
    audit.push(auditEvent(actor.orgId, "account", acc.id, "created", actor.id, `Created from lead ${lead.name}`));
  }

  let contactId: string;
  if (input.contact.mode === "existing") {
    const existing = contacts.find((c) => c.id === (input.contact as { id: string }).id && c.orgId === actor.orgId && c.status === "active");
    if (!existing) return invalid("That contact is no longer available.");
    contactId = existing.id;
    if (accountId && !existing.accountId) contacts = contacts.map((c) => (c.id === existing.id ? { ...c, accountId, updatedAt: now } : c));
  } else {
    const n = input.contact;
    if (!n.firstName.trim() && !n.lastName.trim()) return invalid("The new contact needs a name.");
    const methods: ContactMethod[] = [];
    if (n.phone) methods.push({ id: newId("cm"), kind: "phone", value: n.phone, label: "mobile", isPrimary: true });
    if (n.email) methods.push({ id: newId("cm"), kind: "email", value: n.email, label: "work", isPrimary: true });
    const c: Contact = {
      id: newId("ct"), orgId: actor.orgId, firstName: n.firstName.trim(), lastName: n.lastName.trim() || undefined, displayName: [n.firstName.trim(), n.lastName.trim()].filter(Boolean).join(" "),
      methods, accountId: accountId ?? null, jobTitle: n.jobTitle || undefined, ownerId: owner, city: n.city || undefined, tags: [], source: "manual", status: "active", createdAt: now, createdBy: actor.id, updatedAt: now,
      notes: lead.need ? `From lead: ${lead.need}` : undefined,
    };
    contacts = [c, ...contacts];
    contactId = c.id;
    audit.push(auditEvent(actor.orgId, "contact", c.id, "created", actor.id, `Created by converting lead ${lead.name}`));
  }

  let dealId: string | undefined;
  if (input.deal.create) {
    const d = input.deal;
    if (!d.title.trim()) return invalid("Give the deal a title.");
    const deal: Deal = {
      id: newId("dl"), orgId: actor.orgId, title: d.title.trim(), pipelineId: DEFAULT_PIPELINE_ID, stageId: d.stageId, contactId, accountId: accountId ?? null, leadId: lead.id, ownerId: owner,
      currency: d.currency, valuation: "manual", amount: Math.max(0, d.amount), lineItems: [], expectedClose: d.expectedClose, status: "open", notes: lead.need,
      stageChangedAt: now, createdAt: now, createdBy: actor.id, updatedAt: now,
    };
    deals.unshift(deal);
    dealId = deal.id;
    audit.push(auditEvent(actor.orgId, "deal", deal.id, "created", actor.id, `${deal.title} (from lead ${lead.name})`));
  }

  const after: Lead = {
    ...lead,
    status: "converted",
    nextAction: undefined,
    converted: { at: now, by: actor.id, contactId, accountId, dealId },
    events: [...lead.events, { id: newId("le"), kind: "status", status: "converted", at: now, by: actor.id }],
    updatedAt: now,
  };
  audit.push(auditEvent(actor.orgId, "lead", lead.id, "converted", actor.id, lead.name));
  commitDb({ ...db, contacts, accounts, deals, leads: db.leads.map((l) => (l.id === id ? after : l)), audit });
  return ok({ contactId, accountId, dealId });
}
