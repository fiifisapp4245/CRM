/**
 * Tickets mock service (Advance). Customer replies are SIMULATED: they're
 * recorded on the ticket and in Messaging history, but nobody receives them.
 * FUTURE INTEGRATION POINT.
 */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import type { Db } from "@/lib/mock-data/db-types";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { hasPermission } from "@/lib/permissions";
import type { Result } from "@/lib/types";
import { getCurrentUser, requireFeature } from "@/features/permissions";
import { canViewContact } from "@/features/contacts/lib/access";
import { messageAllowed } from "@/features/contacts/lib/consent";
import { auditEvent } from "@/features/sales/services/helpers";
import { addressFor, messageCost } from "@/features/messaging/lib/messaging";
import { simulateDelivery } from "@/features/messaging/services/messaging-service";
import type { Communication } from "@/features/messaging/types";
import { canWorkTicket } from "../lib/access";
import { targetsFor, TICKET_TRANSITIONS } from "../lib/tickets";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS, type SavedAnswer, type Ticket, type TicketEntry, type TicketStatus } from "../types";

function gate(): Result<never> | null {
  return requireFeature("tickets") ?? (hasPermission(getCurrentUser(), "tickets.manage") ? null : forbidden("Your role can't change tickets."));
}

function load(id: string) {
  const actor = getCurrentUser();
  const db = getDb();
  return { actor, db, t: db.tickets.find((x) => x.id === id && x.orgId === actor.orgId) };
}

const entry = (kind: TicketEntry["kind"], body: string, by: string, extra: Partial<TicketEntry> = {}): TicketEntry => ({ id: newId("te"), kind, body, by, at: nowIso(), ...extra });

export interface TicketInput {
  subject: string;
  description: string;
  contactId: string;
  ownerId: string | null;
  category: string;
  priority: Ticket["priority"];
  source: Ticket["source"];
}

export async function createTicket(input: TicketInput): Promise<Result<Ticket>> {
  await latency(200);
  const g = gate();
  if (g) return g;
  const actor = getCurrentUser();
  const db = getDb();
  if (!input.subject.trim()) return invalid("Add a subject.");
  if (!input.description.trim()) return invalid("Describe what the customer needs.");
  const c = db.contacts.find((x) => x.id === input.contactId);
  if (!c || !canViewContact(db, actor, c) || c.status !== "active") return invalid("Choose an active customer.");
  if (!canWorkTicket(db, actor, { orgId: actor.orgId, ownerId: input.ownerId })) return forbidden("You can only assign tickets to yourself or your team.");
  const now = nowIso();
  const num = Math.max(1000, ...db.tickets.map((t) => Number(t.number.replace(/\D/g, "")) || 0)) + 1;
  const t: Ticket = {
    id: newId("tk"), orgId: actor.orgId, number: `T-${num}`, subject: input.subject.trim(), description: input.description.trim(), contactId: c.id, accountId: c.accountId ?? null, ownerId: input.ownerId, category: input.category, priority: input.priority, status: "open", source: input.source,
    openedAt: now, ...targetsFor(input.priority, now, db.settings), entries: [entry("customer", input.description.trim(), "customer"), entry("event", `Opened by ${actor.name}`, actor.id)], createdBy: actor.id, createdAt: now, updatedAt: now,
  };
  commitDb({ ...db, tickets: [t, ...db.tickets], audit: [...db.audit, auditEvent(actor.orgId, "ticket", t.id, "opened", actor.id, `${t.number} ${t.subject}`)] });
  return ok(t);
}

/** Owner, category, priority. Changing priority recalculates both targets from when the ticket was opened. */
export async function updateTicket(id: string, patch: Partial<Pick<Ticket, "ownerId" | "category" | "priority">>): Promise<Result<Ticket>> {
  await latency(120);
  const g = gate();
  if (g) return g;
  const { actor, db, t } = load(id);
  if (!t) return notFound();
  if (!canWorkTicket(db, actor, t)) return forbidden("You can't change this ticket.");
  if (patch.ownerId !== undefined && !canWorkTicket(db, actor, { orgId: t.orgId, ownerId: patch.ownerId })) return forbidden("You can only assign tickets to yourself or your team.");
  const users = new Map(db.users.map((u) => [u.id, u.name]));
  const events: TicketEntry[] = [];
  if (patch.ownerId !== undefined && patch.ownerId !== t.ownerId) events.push(entry("event", patch.ownerId ? `Assigned to ${users.get(patch.ownerId)}` : "Unassigned", actor.id));
  if (patch.priority && patch.priority !== t.priority) events.push(entry("event", `Priority ${TICKET_PRIORITY_LABELS[t.priority]} → ${TICKET_PRIORITY_LABELS[patch.priority]}; targets recalculated`, actor.id));
  if (patch.category && patch.category !== t.category) events.push(entry("event", `Category ${t.category} → ${patch.category}`, actor.id));
  if (!events.length) return ok(t);
  const after: Ticket = { ...t, ...patch, ...(patch.priority && patch.priority !== t.priority ? targetsFor(patch.priority, t.openedAt, db.settings) : {}), entries: [...t.entries, ...events], updatedAt: nowIso() };
  commitDb({ ...db, tickets: db.tickets.map((x) => (x.id === id ? after : x)), audit: [...db.audit, auditEvent(actor.orgId, "ticket", id, patch.ownerId !== undefined ? "assigned" : "updated", actor.id, `${t.number} ${t.subject}`)] });
  return ok(after);
}

export async function setTicketStatus(id: string, status: TicketStatus, summary?: string): Promise<Result<Ticket>> {
  await latency(150);
  const g = gate();
  if (g) return g;
  const { actor, db, t } = load(id);
  if (!t) return notFound();
  if (!canWorkTicket(db, actor, t)) return forbidden("You can't change this ticket.");
  if (!TICKET_TRANSITIONS[t.status].includes(status)) return invalid(`A ${TICKET_STATUS_LABELS[t.status].toLowerCase()} ticket can't become ${TICKET_STATUS_LABELS[status].toLowerCase()}.`);
  if (status === "resolved" && !summary?.trim()) return invalid("Say how it was resolved.");
  const now = nowIso();
  const reopening = status === "open" && (t.status === "resolved" || t.status === "closed");
  const after: Ticket = {
    ...t,
    status,
    resolvedAt: status === "resolved" ? now : reopening ? undefined : t.resolvedAt,
    closedAt: status === "closed" ? now : reopening ? undefined : t.closedAt,
    resolutionSummary: status === "resolved" ? summary!.trim() : t.resolutionSummary,
    rating: reopening ? undefined : t.rating,
    entries: [...t.entries, entry("event", reopening ? "Reopened — the resolution target still counts from when the ticket was opened" : `Status changed to ${TICKET_STATUS_LABELS[status]}${status === "resolved" ? `: ${summary!.trim()}` : ""}`, actor.id)],
    updatedAt: now,
  };
  commitDb({ ...db, tickets: db.tickets.map((x) => (x.id === id ? after : x)), audit: [...db.audit, auditEvent(actor.orgId, "ticket", id, status === "resolved" ? "resolved" : reopening ? "reopened" : "status_changed", actor.id, `${t.number} ${t.subject}`)] });
  return ok(after);
}

/**
 * Reply (customer-facing, simulated) or internal note. The first reply sets
 * the first-response time. A reply is also logged as a demo message in
 * Messaging when the customer has a usable address and hasn't refused service updates.
 */
export async function addTicketEntry(id: string, kind: "reply" | "note", body: string, opts: { waitForCustomer?: boolean } = {}): Promise<Result<Ticket>> {
  await latency(200);
  const g = gate();
  if (g) return g;
  const { actor, db, t } = load(id);
  if (!t) return notFound();
  if (!canWorkTicket(db, actor, t)) return forbidden("You can't reply on this ticket.");
  if (t.status === "closed") return invalid("Reopen the ticket to add to it.");
  if (!body.trim()) return invalid(kind === "reply" ? "Write a reply." : "Write a note.");
  const now = nowIso();
  let next: Db = db;
  const entries = [...t.entries];
  let comm: Communication | undefined;
  if (kind === "reply") {
    const c = db.contacts.find((x) => x.id === t.contactId);
    const channel = c && addressFor(c, "email") ? "email" : "sms";
    const to = c ? addressFor(c, channel) : null;
    const allowed = c ? messageAllowed(db.consents, c.id, channel, "operational") : { allowed: false, reason: "" };
    if (c && to && allowed.allowed) {
      comm = {
        id: newId("msg"), orgId: t.orgId, channel, kind: "one_to_one", contactId: c.id, to, ticketId: t.id, subject: channel === "email" ? `Re: ${t.subject} [${t.number}]` : undefined, body: body.trim(), status: "sent",
        history: [{ status: "waiting", at: now }, { status: "sent", at: now, note: "Simulated — no provider connected" }], cost: messageCost(channel, body.trim(), db.settings.smsCostPerPartGhs), consent: { purpose: "operational", allowed: true, reason: allowed.reason }, mode: "demo", createdBy: actor.id, createdAt: now, updatedAt: now,
      };
      next = { ...next, communications: [comm, ...next.communications] };
    }
    entries.push(entry("reply", body.trim(), actor.id, { simulated: true }));
    if (!comm) entries.push(entry("event", "Reply recorded only — the customer has no usable address or has refused service updates", "system"));
  } else entries.push(entry("note", body.trim(), actor.id));
  const waiting = kind === "reply" && opts.waitForCustomer && t.status === "open";
  if (waiting) entries.push(entry("event", "Status changed to Waiting on customer", actor.id));
  const after: Ticket = { ...t, entries, firstRespondedAt: kind === "reply" ? (t.firstRespondedAt ?? now) : t.firstRespondedAt, status: waiting ? "waiting" : t.status, updatedAt: now };
  commitDb({ ...next, tickets: next.tickets.map((x) => (x.id === id ? after : x)), audit: [...next.audit, auditEvent(actor.orgId, "ticket", id, kind === "reply" ? "replied" : "updated", actor.id, `${t.number} ${t.subject}`)] });
  if (comm) simulateDelivery([comm.id]);
  return ok(after);
}

/** Demo: records the customer's rating as if they answered the satisfaction question. */
export async function recordRating(id: string, score: "good" | "poor", comment?: string): Promise<Result<Ticket>> {
  await latency(120);
  const g = gate();
  if (g) return g;
  const { actor, db, t } = load(id);
  if (!t) return notFound();
  if (t.status !== "resolved" && t.status !== "closed") return invalid("Customers rate a ticket once it's resolved.");
  const now = nowIso();
  const after: Ticket = { ...t, rating: { score, comment: comment?.trim() || undefined, at: now }, entries: [...t.entries, entry("customer", `Rated ${score === "good" ? "Good" : "Poor"}${comment?.trim() ? `: “${comment.trim()}”` : ""} (simulated)`, "customer")], updatedAt: now };
  commitDb({ ...db, tickets: db.tickets.map((x) => (x.id === id ? after : x)), audit: [...db.audit, auditEvent(actor.orgId, "ticket", id, "updated", "system:customer", `${t.number} rated ${score}`)] });
  return ok(after);
}

/* ---------------- Saved answers ---------------- */

export async function saveAnswer(input: { title: string; body: string; category?: string }, id?: string): Promise<Result<SavedAnswer>> {
  await latency(120);
  const g = requireFeature("tickets") ?? (hasPermission(getCurrentUser(), "answers.manage") ? null : forbidden("Your role can't manage saved answers."));
  if (g) return g;
  const actor = getCurrentUser();
  const db = getDb();
  if (!input.title.trim() || !input.body.trim()) return invalid("Saved answers need a title and wording.");
  const now = nowIso();
  if (id) {
    const before = db.savedAnswers.find((a) => a.id === id);
    if (!before) return notFound();
    const after = { ...before, title: input.title.trim(), body: input.body.trim(), category: input.category || undefined, updatedAt: now };
    commitDb({ ...db, savedAnswers: db.savedAnswers.map((a) => (a.id === id ? after : a)) });
    return ok(after);
  }
  const a: SavedAnswer = { id: newId("sa"), orgId: actor.orgId, title: input.title.trim(), body: input.body.trim(), category: input.category || undefined, createdBy: actor.id, updatedAt: now };
  commitDb({ ...db, savedAnswers: [a, ...db.savedAnswers] });
  return ok(a);
}

export async function deleteAnswer(id: string): Promise<Result<true>> {
  const g = requireFeature("tickets") ?? (hasPermission(getCurrentUser(), "answers.manage") ? null : forbidden("Your role can't manage saved answers."));
  if (g) return g;
  const db = getDb();
  if (!db.savedAnswers.some((a) => a.id === id)) return notFound();
  commitDb({ ...db, savedAnswers: db.savedAnswers.filter((a) => a.id !== id) });
  return ok(true);
}
