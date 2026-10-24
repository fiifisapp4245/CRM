/**
 * Messaging mock service. NOTHING is delivered: no SMS, WhatsApp or email
 * provider is connected. Each send creates a demo Communication whose
 * delivery status is simulated in this browser. FUTURE INTEGRATION POINT.
 */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import type { Db } from "@/lib/mock-data/db-types";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import type { Result } from "@/lib/types";
import { getCurrentUser, requireFeature } from "@/features/permissions";
import { canViewContact } from "@/features/contacts/lib/access";
import { messageAllowed, type MessagePurpose } from "@/features/contacts/lib/consent";
import { auditEvent } from "@/features/sales/services/helpers";
import type { Activity } from "@/features/activities/types";
import { addressFor, messageCost, unknownVariables } from "../lib/messaging";
import type { Channel, Communication, CommStatus, MessageTemplate } from "../types";

const SIM_DELAY_MS = 2500;

/** Moves a demo message along its simulated status path. Runs only while the app is open. */
export function setCommStatus(db: Db, id: string, status: CommStatus, note?: string): Db {
  const at = nowIso();
  return { ...db, communications: db.communications.map((m) => (m.id === id && m.status !== status ? { ...m, status, updatedAt: at, failureReason: status === "failed" ? note : m.failureReason, history: [...m.history, { status, at, note }] } : m)) };
}

export function simulateDelivery(ids: string[], failEvery = 0) {
  setTimeout(() => {
    let db = getDb();
    ids.forEach((id, i) => {
      const m = db.communications.find((x) => x.id === id);
      if (!m || m.status !== "sent") return;
      db = failEvery && i % failEvery === failEvery - 1 ? setCommStatus(db, id, "failed", "Recipient unreachable (simulated)") : setCommStatus(db, id, "delivered", "Simulated delivery receipt");
    });
    commitDb(db);
  }, SIM_DELAY_MS);
}

export interface SendInput {
  contactId: string;
  channel: Channel;
  purpose: MessagePurpose;
  subject?: string;
  body: string;
  templateId?: string;
  dealId?: string;
  leadId?: string;
  ticketId?: string;
}

/**
 * One-to-one message: checks plan, role, record access and the contact's
 * preferences, then records it on the timeline AND in Messaging history.
 */
export async function sendMessage(input: SendInput): Promise<Result<Communication>> {
  await latency(200);
  const gate = requireFeature("messaging");
  if (gate) return gate;
  const actor = getCurrentUser();
  if (!hasPermission(actor, "messages.send")) return forbidden("Your role can't send messages.");
  const db = getDb();
  const contact = db.contacts.find((c) => c.id === input.contactId);
  if (!contact || !canViewContact(db, actor, contact)) return notFound();
  if (contact.status !== "active") return invalid("Restore this contact before messaging them.");
  if (!canWriteRecord(actor, contact, db.users)) return forbidden("You can't message this contact.");
  const body = input.body.trim();
  if (!body) return invalid("Write a message.");
  if (unknownVariables(body).length) return invalid(`Fill in or remove: ${unknownVariables(body).map((v) => `{{${v}}}`).join(", ")}`);
  if (input.channel === "email" && !input.subject?.trim()) return invalid("Add an email subject.");
  const to = addressFor(contact, input.channel);
  if (!to) return invalid(`${contact.displayName} has no usable ${input.channel === "email" ? "email address" : "phone number"}.`);
  const consent = messageAllowed(db.consents, contact.id, input.channel, input.purpose);
  if (!consent.allowed) return forbidden(consent.reason);
  const now = nowIso();
  const activity: Activity = {
    id: newId("ac"), orgId: contact.orgId, contactId: contact.id, dealId: input.dealId, type: input.channel === "email" ? "email" : "message", channel: input.channel, messagePurpose: input.purpose,
    subject: input.subject?.trim() || body.split("\n")[0].slice(0, 80), body, occurredAt: now, direction: "outbound", assigneeId: contact.ownerId, createdBy: actor.id, createdAt: now, updatedAt: now,
  };
  const comm: Communication = {
    id: newId("msg"), orgId: contact.orgId, channel: input.channel, kind: "one_to_one", contactId: contact.id, to, dealId: input.dealId, leadId: input.leadId, ticketId: input.ticketId, activityId: activity.id, templateId: input.templateId,
    subject: input.subject?.trim() || undefined, body, status: "sent", history: [{ status: "waiting", at: now }, { status: "sent", at: now, note: "Simulated — no provider connected" }],
    cost: messageCost(input.channel, body, db.settings.smsCostPerPartGhs), consent: { purpose: input.purpose, allowed: true, reason: consent.reason }, mode: "demo", createdBy: actor.id, createdAt: now, updatedAt: now,
  };
  commitDb({
    ...db,
    activities: [activity, ...db.activities],
    communications: [comm, ...db.communications],
    contacts: db.contacts.map((c) => (c.id === contact.id ? { ...c, lastActivityAt: now } : c)),
    deals: input.dealId ? db.deals.map((d) => (d.id === input.dealId ? { ...d, lastActivityAt: now } : d)) : db.deals,
  });
  simulateDelivery([comm.id]);
  return ok(comm);
}

/* ---------------- Templates ---------------- */

export interface TemplateInput {
  name: string;
  channel: Channel;
  subject?: string;
  body: string;
}

function templateGuard(): Result<never> | null {
  return requireFeature("messaging") ?? (hasPermission(getCurrentUser(), "templates.manage") ? null : forbidden("Your role can't manage templates."));
}

export async function saveTemplate(input: TemplateInput, id?: string): Promise<Result<MessageTemplate>> {
  await latency(150);
  const g = templateGuard();
  if (g) return g;
  const actor = getCurrentUser();
  const db = getDb();
  if (!input.name.trim()) return invalid("Give the template a name.");
  if (!input.body.trim()) return invalid("Write the message.");
  if (input.channel === "email" && !input.subject?.trim()) return invalid("Email templates need a subject.");
  const bad = unknownVariables(`${input.subject ?? ""} ${input.body}`);
  if (bad.length) return invalid(`Unknown field${bad.length > 1 ? "s" : ""}: ${bad.map((v) => `{{${v}}}`).join(", ")}. Use the Insert field menu.`);
  if (db.templates.some((t) => t.id !== id && t.orgId === actor.orgId && t.name.trim().toLowerCase() === input.name.trim().toLowerCase())) return invalid("A template with this name already exists.");
  const now = nowIso();
  if (id) {
    const before = db.templates.find((t) => t.id === id);
    if (!before) return notFound();
    const after = { ...before, ...input, name: input.name.trim(), subject: input.channel === "email" ? input.subject?.trim() : undefined, updatedAt: now };
    commitDb({ ...db, templates: db.templates.map((t) => (t.id === id ? after : t)), audit: [...db.audit, auditEvent(actor.orgId, "template", id, "updated", actor.id, after.name)] });
    return ok(after);
  }
  const t: MessageTemplate = { id: newId("tpl"), orgId: actor.orgId, name: input.name.trim(), channel: input.channel, subject: input.channel === "email" ? input.subject?.trim() : undefined, body: input.body, createdBy: actor.id, createdAt: now, updatedAt: now };
  commitDb({ ...db, templates: [t, ...db.templates], audit: [...db.audit, auditEvent(actor.orgId, "template", t.id, "created", actor.id, t.name)] });
  return ok(t);
}

export async function deleteTemplate(id: string): Promise<Result<true>> {
  await latency(120);
  const g = templateGuard();
  if (g) return g;
  const actor = getCurrentUser();
  const db = getDb();
  const t = db.templates.find((x) => x.id === id);
  if (!t) return notFound();
  commitDb({ ...db, templates: db.templates.filter((x) => x.id !== id), audit: [...db.audit, auditEvent(actor.orgId, "template", id, "deleted", actor.id, t.name)] });
  return ok(true);
}
