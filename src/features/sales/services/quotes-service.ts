/**
 * Quotes mock service. Sending, the customer link, acceptance and payment
 * are SIMULATED inside this browser — no email, link hosting or payment
 * provider is involved.
 */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import type { Result } from "@/lib/types";
import { getCurrentUser } from "@/features/permissions";
import type { LineItem, Quote, QuoteEvent, QuoteStatus } from "../types";
import { auditEvent } from "./helpers";

export interface QuoteInput {
  customer: Quote["customer"];
  issueDate: string;
  validUntil: string;
  lineItems: LineItem[];
  notes?: string;
  terms?: string;
}

export const DEFAULT_TERMS = "50% deposit on acceptance, balance on delivery. Prices are valid until the date shown. (Prototype terms — replace with your organisation's terms.)";

function check(input: QuoteInput): string | null {
  if (!input.customer.name.trim()) return "Add the customer's name.";
  if (!input.issueDate || !input.validUntil) return "Set the issue and valid-until dates.";
  if (input.validUntil < input.issueDate) return "Valid-until must be on or after the issue date.";
  if (!input.lineItems.length) return "Add at least one line item.";
  if (input.lineItems.some((l) => !l.name.trim() || !(l.quantity > 0) || l.unitPrice < 0 || l.discountPct < 0 || l.discountPct > 100)) return "Check the line items: each needs a name, a quantity above 0, a price and a discount between 0 and 100%.";
  return null;
}

function nextNumber(): string {
  const year = new Date().getFullYear();
  const nums = getDb().quotes.map((q) => Number(q.number.split("-").at(-1)) || 0);
  return `Q-${year}-${String(Math.max(100, ...nums) + 1).padStart(4, "0")}`;
}

function dealFor(dealId: string) {
  const actor = getCurrentUser();
  const db = getDb();
  const deal = db.deals.find((d) => d.id === dealId && d.orgId === actor.orgId);
  return { actor, db, deal };
}

export async function createQuote(dealId: string, input: QuoteInput): Promise<Result<Quote>> {
  await latency();
  const { actor, db, deal } = dealFor(dealId);
  if (!deal) return notFound("The deal for this quote no longer exists.");
  if (!hasPermission(actor, "quotes.manage") || !canWriteRecord(actor, deal, db.users)) return forbidden("You can't create quotes for this deal.");
  const err = check(input);
  if (err) return invalid(err);
  const now = nowIso();
  const q: Quote = {
    id: newId("qt"), orgId: actor.orgId, number: nextNumber(), dealId, contactId: deal.contactId, accountId: deal.accountId, currency: deal.currency,
    ...input, lineItems: input.lineItems.map((l) => ({ ...l })), status: "draft", history: [{ kind: "created", at: now, by: actor.id }], createdAt: now, createdBy: actor.id, updatedAt: now,
  };
  commitDb({ ...db, quotes: [q, ...db.quotes], audit: [...db.audit, auditEvent(actor.orgId, "quote", q.id, "created", actor.id, q.number)] });
  return ok(q);
}

function loadQuote(id: string) {
  const actor = getCurrentUser();
  const db = getDb();
  const quote = db.quotes.find((q) => q.id === id && q.orgId === actor.orgId);
  const deal = quote && db.deals.find((d) => d.id === quote.dealId);
  return { actor, db, quote, deal };
}

export async function updateQuote(id: string, input: QuoteInput): Promise<Result<Quote>> {
  await latency();
  const { actor, db, quote, deal } = loadQuote(id);
  if (!quote || !deal) return notFound();
  if (!hasPermission(actor, "quotes.manage") || !canWriteRecord(actor, deal, db.users)) return forbidden("You can't edit this quote.");
  if (quote.status !== "draft") return invalid("Only draft quotes can be edited. Create a new quote for a revised offer.");
  const err = check(input);
  if (err) return invalid(err);
  const now = nowIso();
  const after: Quote = { ...quote, ...input, history: [...quote.history, { kind: "edited", at: now, by: actor.id }], updatedAt: now };
  commitDb({ ...db, quotes: db.quotes.map((q) => (q.id === id ? after : q)) });
  return ok(after);
}

const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "declined", "expired"],
  accepted: ["paid"],
  declined: [],
  expired: [],
  paid: [],
};

/**
 * `by: "customer"` is used by the simulated customer page; staff actions use
 * the signed-in user and need quotes.manage.
 */
async function transition(id: string, to: QuoteStatus, opts: { by?: "customer"; note?: string; patch?: Partial<Quote> } = {}): Promise<Result<Quote>> {
  await latency(200);
  const { actor, db, quote, deal } = loadQuote(id);
  if (!quote || !deal) return notFound();
  if (opts.by !== "customer" && (!hasPermission(actor, "quotes.manage") || !canWriteRecord(actor, deal, db.users))) return forbidden("You can't change this quote.");
  if (!TRANSITIONS[quote.status].includes(to)) return invalid(`A ${quote.status} quote can't become ${to}.`);
  const now = nowIso();
  const by = opts.by === "customer" ? "customer" : actor.id;
  const ev: QuoteEvent = { kind: to as QuoteEvent["kind"], at: now, by, note: opts.note };
  const after: Quote = { ...quote, ...opts.patch, status: to, history: [...quote.history, ev], updatedAt: now };
  commitDb({ ...db, quotes: db.quotes.map((q) => (q.id === id ? after : q)), audit: [...db.audit, auditEvent(quote.orgId, "quote", id, to as never, by === "customer" ? "system:customer" : actor.id, quote.number, opts.note ? [{ field: "Note", from: "", to: opts.note }] : undefined)] });
  return ok(after);
}

export const sendQuote = (id: string, to: string) => transition(id, "sent", { note: to ? `Shared with ${to}` : "Link shared", patch: { sentTo: to || undefined, sentAt: nowIso() } });
export const acceptQuote = (id: string, by?: "customer") => transition(id, "accepted", { by, patch: { decidedAt: nowIso() } });
export const declineQuote = (id: string, reason: string, by?: "customer") => transition(id, "declined", { by, note: reason || undefined, patch: { decidedAt: nowIso(), declineReason: reason || undefined } });
export const expireQuote = (id: string) => transition(id, "expired");
export const recordPayment = (id: string, ref: string, by?: "customer") => transition(id, "paid", { by, note: `Simulated payment ${ref}`, patch: { paidAt: nowIso(), paymentRef: ref } });

/** Records the first time the customer opens the link (simulated). */
export async function markOpened(id: string): Promise<Result<Quote>> {
  const db = getDb();
  const quote = db.quotes.find((q) => q.id === id);
  if (!quote) return notFound();
  if (quote.status !== "sent" || quote.openedAt) return ok(quote);
  const now = nowIso();
  const after: Quote = { ...quote, openedAt: now, history: [...quote.history, { kind: "opened", at: now, by: "customer" }], updatedAt: now };
  commitDb({ ...db, quotes: db.quotes.map((q) => (q.id === id ? after : q)) });
  return ok(after);
}

/** Display status: a sent quote past its validity shows as expired even before anyone records it. */
export function effectiveStatus(q: Quote, today = new Date().toISOString().slice(0, 10)): QuoteStatus {
  return q.status === "sent" && q.validUntil < today ? "expired" : q.status;
}
