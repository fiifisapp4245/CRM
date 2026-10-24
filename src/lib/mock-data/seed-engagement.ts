/**
 * Phase 3 seed: activities, messages, templates, campaigns, tickets, saved
 * answers, folders and documents — all built against the contacts, accounts
 * and deals already in the database so every module tells the same story.
 * Dates are relative to "now" so Late/Today/Coming up and ticket targets stay meaningful.
 */
import { DEFAULT_SETTINGS, type BusinessSettings } from "@/lib/business/settings";
import { dayKey, nextBusinessSlot, zonedIso } from "@/lib/business/time";
import type { Account } from "@/features/accounts/types";
import type { Activity } from "@/features/activities/types";
import type { AuditEvent, ConsentRecord, Contact } from "@/features/contacts/types";
import type { Deal } from "@/features/sales/types";
import type { Segment } from "@/features/segments/types";
import { orgAudience } from "@/features/segments/lib/match";
import { addressFor, campaignEligibility, messageCost } from "@/features/messaging/lib/messaging";
import type { Campaign, Communication, MessageTemplate } from "@/features/messaging/types";
import { targetsFor } from "@/features/tickets/lib/tickets";
import type { SavedAnswer, Ticket, TicketEntry, TicketPriority, TicketStatus } from "@/features/tickets/types";
import type { DocumentFile, Folder } from "@/features/documents/types";

const ORG = "org_adinkra";
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export interface EngagementSeedInput {
  now: number;
  contacts: Contact[];
  accounts: Account[];
  deals: Deal[];
  activities: Activity[];
  consents: ConsentRecord[];
  segments: Segment[];
  nextId: (prefix: string) => string;
}

export interface EngagementSeed {
  activities: Activity[];
  communications: Communication[];
  templates: MessageTemplate[];
  campaigns: Campaign[];
  tickets: Ticket[];
  savedAnswers: SavedAnswer[];
  folders: Folder[];
  documents: DocumentFile[];
  settings: BusinessSettings;
  audit: AuditEvent[];
}

export function buildEngagementSeed({ now, contacts, deals, activities: existing, consents, segments, nextId }: EngagementSeedInput): EngagementSeed {
  const settings = DEFAULT_SETTINGS;
  const tz = settings.timezone;
  const iso = (offset: number) => new Date(now + offset).toISOString();
  /** Business-local wall time `dayOffset` days from today. */
  const at = (dayOffset: number, time: string) => zonedIso(dayKey(now + dayOffset * DAY, tz), time, tz);
  const contact = (id: string) => contacts.find((c) => c.id === id);
  const firstAt = (accountId: string) => contacts.find((c) => c.accountId === accountId && c.status === "active");
  const deal = (id: string) => deals.find((d) => d.id === id);
  const audit: AuditEvent[] = [];

  /* ---------------- Activities ---------------- */

  const activities: Activity[] = [];
  const act = (a: Partial<Activity> & Pick<Activity, "type" | "subject" | "assigneeId">) => {
    const created = a.createdAt ?? iso(-3 * DAY);
    const full: Activity = { id: nextId("ac"), orgId: ORG, contactId: null, createdBy: a.assigneeId ?? "u_ama", createdAt: created, updatedAt: created, ...a };
    activities.push(full);
    return full;
  };
  const coastal = deal("dl_coastal_branch");
  const harmattan = deal("dl_harmattan_av");
  const tema = deal("dl_tema_fitout");
  const akwaaba = deals.find((d) => d.id === "dl_akwaaba_showroom");

  // Planned follow-up call on an open deal (Tasks & Calls → Calendar → contact).
  act({ type: "call", subject: "Follow-up call on branch roll-out proposal", contactId: "ct_abigail", dealId: coastal?.id, accountId: "acc_coastal_pharm", dueAt: at(1, "10:00"), endAt: at(1, "10:15"), status: "open", priority: "high", reminder: "default", assigneeId: "u_kwame", body: "Check procurement's questions on the 5% volume discount." });
  // Completed call with an outcome, earlier today.
  if (harmattan) act({ type: "call", subject: "Confirmed AV installation dates", contactId: "ct_oliver", dealId: harmattan.id, accountId: "acc_harmattan", occurredAt: at(0, "09:20"), callOutcome: "connected", direction: "outbound", durationMinutes: 12, assigneeId: "u_efua", createdAt: at(0, "09:35"), body: "Install week of the 17th works for them. Waiting on signed PO." });
  // Meeting linked to a deal, with attendees and a place.
  if (tema) act({ type: "meeting", subject: "Fit-out walkthrough at the warehouse", contactId: tema.contactId, dealId: tema.id, accountId: "acc_tema_hw", dueAt: at(2, "14:00"), endAt: at(2, "15:30"), status: "open", priority: "normal", location: "Tema Hardware Supplies, Community 1", attendeeIds: ["u_ama"], reminder: 60, assigneeId: "u_kwame" });
  // Visit.
  if (akwaaba?.contactId) act({ type: "visit", subject: "Measure showroom for furniture layout", contactId: akwaaba.contactId, dealId: akwaaba.id, dueAt: at(3, "11:00"), endAt: at(3, "12:00"), status: "open", location: "Akwaaba Travel showroom, Osu", reminder: "default", assigneeId: "u_kojo" });
  // Overdue, high-priority task.
  act({ type: "task", subject: "Send revised delivery schedule to Coastal Pharmacy", contactId: "ct_abigail", dealId: coastal?.id, dueAt: at(-2, "16:00"), status: "open", priority: "high", reminder: "none", assigneeId: "u_kwame" });
  // Recurring internal meeting (no customer).
  const nextMonday = (() => {
    for (let i = 1; i <= 7; i++) if (new Date(now + i * DAY).getUTCDay() === 1) return i;
    return 7;
  })();
  act({ type: "meeting", subject: "Weekly pipeline review", dueAt: at(nextMonday, "09:00"), endAt: at(nextMonday, "09:45"), status: "open", recurrence: "weekly", reminder: 15, location: "Head office, meeting room 2", attendeeIds: ["u_kwame", "u_efua", "u_kojo"], assigneeId: "u_ama", priority: "normal" });
  // Today items.
  act({ type: "task", subject: "Prepare quotation pack for Bright Path Schools", contactId: firstAt("acc_brightpath")?.id ?? null, dealId: "dl_brightpath", dueAt: at(0, "15:00"), status: "open", priority: "normal", assigneeId: "u_kojo" });
  act({ type: "call", subject: "Payment reminder — invoice INV-3307", contactId: "ct_kwesi", dueAt: at(0, "11:30"), endAt: at(0, "11:45"), status: "open", priority: "normal", assigneeId: "u_kwame" });
  // No date + nobody's.
  act({ type: "task", subject: "Update 2027 price list in the catalogue", status: "open", priority: "low", assigneeId: "u_ama" });
  act({ type: "task", subject: "Call back walk-in customer about standing desks", status: "open", priority: "normal", dueAt: at(1, "12:00"), assigneeId: null, body: "Left their number at reception; no contact record yet." });
  // A logged visit this week.
  act({ type: "visit", subject: "Delivered sample chairs to Coastal Pharmacy HQ", contactId: "ct_abigail", accountId: "acc_coastal_pharm", occurredAt: at(-3, "13:00"), durationMinutes: 45, assigneeId: "u_kwame", createdAt: at(-3, "14:10") });

  // Give existing open items a priority/end time so the calendar can place them.
  const tidy = (a: Activity): Activity => (a.status === "open" && a.dueAt ? { ...a, priority: a.priority ?? "normal", endAt: a.endAt ?? (a.type === "meeting" ? new Date(Date.parse(a.dueAt) + (a.durationMinutes ?? 60) * MIN).toISOString() : undefined), updatedAt: a.updatedAt ?? a.createdAt } : a);

  /* ---------------- Messages ---------------- */

  const communications: Communication[] = [];
  const comm = (c: Omit<Communication, "id" | "orgId" | "history" | "mode" | "updatedAt" | "cost"> & { cost?: number | null }) => {
    const history: Communication["history"] = [{ status: "sent", at: c.createdAt }];
    if (c.status === "delivered") history.push({ status: "delivered", at: new Date(Date.parse(c.createdAt) + 40_000).toISOString() });
    if (c.status === "failed") history.push({ status: "failed", at: new Date(Date.parse(c.createdAt) + 60_000).toISOString(), note: c.failureReason });
    const m: Communication = { id: nextId("msg"), orgId: ORG, history, mode: "demo", updatedAt: history.at(-1)!.at, ...c, cost: c.cost === undefined ? messageCost(c.channel, c.body, settings.smsCostPerPartGhs) : c.cost };
    communications.push(m);
    return m;
  };
  // Every one-to-one message already on a timeline gets its delivery record.
  let i = 0;
  for (const a of existing) {
    if (a.type !== "message" || !a.occurredAt || !a.contactId) continue;
    const c = contact(a.contactId);
    const channel = a.channel ?? "sms";
    const to = c ? addressFor(c, channel) : null;
    const failed = !to || i++ % 9 === 4;
    comm({ channel, kind: "one_to_one", contactId: a.contactId, to: to ?? "—", activityId: a.id, dealId: a.dealId, body: a.body ?? a.subject, status: failed ? "failed" : "delivered", failureReason: failed ? (to ? "Handset unreachable (simulated)" : "No usable number") : undefined, consent: { purpose: a.messagePurpose ?? "operational", allowed: true, reason: "Operational message — not marketing." }, createdBy: a.createdBy, createdAt: a.occurredAt });
  }

  const templates: MessageTemplate[] = [
    { id: "tpl_delivery", orgId: ORG, name: "Delivery confirmation", channel: "whatsapp", body: "Hello {{first_name}}, your order is on its way and will arrive today between 9am and 1pm. Reply here if anything changes.", createdBy: "u_ama", createdAt: iso(-60 * DAY), updatedAt: iso(-20 * DAY) },
    { id: "tpl_quote_followup", orgId: ORG, name: "Quote follow-up", channel: "email", subject: "Your quotation for {{deal}}", body: "Dear {{first_name}},\n\nThank you for considering us for {{deal}}. I'm happy to walk {{company}} through the options or adjust quantities.\n\nKind regards", createdBy: "u_ama", createdAt: iso(-45 * DAY), updatedAt: iso(-45 * DAY) },
    { id: "tpl_payment", orgId: ORG, name: "Payment reminder", channel: "sms", body: "Hi {{first_name}}, a friendly reminder that your invoice is due this week. Thank you for your business.", createdBy: "u_abena", createdAt: iso(-30 * DAY), updatedAt: iso(-30 * DAY) },
  ];

  /* ---------------- Campaigns ---------------- */

  const seg = (id: string) => segments.find((s) => s.id === id)!;
  const audience = (id: string) => orgAudience(contacts, consents, ORG, seg(id).conditions);
  const campaigns: Campaign[] = [];
  const smsSeg = segments.find((s) => s.id === "seg_sms_marketing");
  const wholesale = segments.find((s) => s.id === "seg_accra_wholesale");
  if (smsSeg) {
    // Sent campaign with its messages in Messaging history.
    const body = "Adinkra Home & Office: new ergonomic chairs are in. 10% off for existing customers until 31 Oct. Reply STOP to opt out.";
    const el = campaignEligibility(audience(smsSeg.id), "sms", consents);
    const sentAt = at(-12, "10:00");
    const id = "cmp_oct_arrivals";
    const msgs = el.eligible.map((e, k) => comm({ channel: "sms", kind: "campaign", campaignId: id, contactId: e.contact.id, to: e.to, body, status: k % 7 === 3 ? "failed" : "delivered", failureReason: k % 7 === 3 ? "Number not reachable (simulated)" : undefined, consent: { purpose: "marketing", allowed: true, reason: "Customer agreed to marketing on this channel." }, createdBy: "u_ama", createdAt: sentAt }));
    campaigns.push({ id, orgId: ORG, name: "October new arrivals", channel: "sms", segmentId: smsSeg.id, body, status: "sent", eligibleCount: el.eligible.length, excludedCount: el.excluded.length, exclusions: el.byReason, scheduledAt: sentAt, timezone: tz, sentAt, communicationIds: msgs.map((m) => m.id), createdBy: "u_ama", createdAt: at(-14, "15:00"), updatedAt: sentAt });
    // Scheduled campaign inside business hours.
    const el2 = campaignEligibility(audience(smsSeg.id), "sms", consents);
    const when = nextBusinessSlot(at(5, "10:00"), tz, settings.businessHours);
    campaigns.push({ id: "cmp_yearend", orgId: ORG, name: "Year-end office refresh", channel: "sms", segmentId: smsSeg.id, body: "Plan your 2027 office refresh with Adinkra. Free layout consultation for orders placed before 15 Dec. Reply STOP to opt out.", status: "scheduled", eligibleCount: el2.eligible.length, excludedCount: el2.excluded.length, exclusions: el2.byReason, scheduledAt: when, timezone: tz, communicationIds: [], createdBy: "u_ama", createdAt: iso(-2 * DAY), updatedAt: iso(-2 * DAY) });
  }
  if (wholesale) {
    campaigns.push({ id: "cmp_nov_prices", orgId: ORG, name: "November wholesale price update", channel: "email", segmentId: wholesale.id, subject: "Updated wholesale prices for November", body: "Dear {{first_name}},\n\nOur November wholesale price list for {{company}} is attached to your account. Prices hold until 30 November.", templateId: undefined, status: "draft", eligibleCount: 0, excludedCount: 0, timezone: tz, communicationIds: [], createdBy: "u_ama", createdAt: iso(-1 * DAY), updatedAt: iso(-1 * DAY) });
  }

  /* ---------------- Tickets ---------------- */

  const tickets: Ticket[] = [];
  let num = 1040;
  const ticket = (t: { subject: string; description: string; contactId: string; ownerId: string | null; category: string; priority: TicketPriority; status: TicketStatus; source: Ticket["source"]; openedAgo: number; respondedAfterH?: number; resolvedAfterH?: number; closedAfterH?: number; rating?: Ticket["rating"]; summary?: string; entries?: Array<Omit<TicketEntry, "id" | "at"> & { afterH: number }> }) => {
    const c = contact(t.contactId);
    const openedAt = iso(-t.openedAgo);
    const targets = targetsFor(t.priority, openedAt, settings);
    const after = (h: number) => new Date(Date.parse(openedAt) + h * HOUR).toISOString();
    const entries: TicketEntry[] = [{ id: nextId("te"), kind: "customer", body: t.description, at: openedAt, by: "customer" }, ...(t.entries ?? []).map((e) => ({ id: nextId("te"), kind: e.kind, body: e.body, by: e.by, simulated: e.simulated, at: after(e.afterH) }))];
    const tk: Ticket = {
      id: nextId("tk"), orgId: ORG, number: `T-${++num}`, subject: t.subject, description: t.description, contactId: t.contactId, accountId: c?.accountId ?? null, ownerId: t.ownerId, category: t.category, priority: t.priority, status: t.status, source: t.source,
      openedAt, ...targets, firstRespondedAt: t.respondedAfterH !== undefined ? after(t.respondedAfterH) : undefined, resolvedAt: t.resolvedAfterH !== undefined ? after(t.resolvedAfterH) : undefined, closedAt: t.closedAfterH !== undefined ? after(t.closedAfterH) : undefined,
      resolutionSummary: t.summary, rating: t.rating, entries, createdBy: t.ownerId ?? "u_selasi", createdAt: openedAt, updatedAt: entries.at(-1)!.at,
    };
    tickets.push(tk);
    audit.push({ id: nextId("au"), orgId: ORG, entityType: "ticket", entityId: tk.id, action: "opened", actorId: tk.createdBy, at: openedAt, summary: `${tk.number} ${tk.subject}` });
    if (tk.resolvedAt) audit.push({ id: nextId("au"), orgId: ORG, entityType: "ticket", entityId: tk.id, action: "resolved", actorId: tk.ownerId ?? "u_selasi", at: tk.resolvedAt, summary: `${tk.number} ${tk.subject}` });
    return tk;
  };
  const urgent = ticket({ subject: "Wrong VAT number on invoice INV-3290", description: "Our finance team can't process invoice INV-3290 — the VAT number is ours from last year. Please reissue today.", contactId: "ct_abigail", ownerId: "u_selasi", category: "Billing", priority: "urgent", status: "open", source: "email", openedAgo: 3 * HOUR, entries: [{ kind: "note", body: "Finance confirms the old VAT number is still on the customer record in MyStoreGuard.", by: "u_selasi", afterH: 0.5 }] });
  ticket({ subject: "Two chairs delivered with damaged castors", description: "Two of the twelve chairs delivered on Monday have broken castors.", contactId: "ct_abigail", ownerId: "u_selasi", category: "Delivery", priority: "normal", status: "resolved", source: "whatsapp", openedAgo: 18 * DAY, respondedAfterH: 2, resolvedAfterH: 40, summary: "Replacement castors fitted on site by our technician.", rating: { score: "good", comment: "Quick and friendly.", at: iso(-16 * DAY) }, entries: [{ kind: "reply", body: "Sorry about this — a technician will bring replacement castors on Wednesday.", by: "u_selasi", afterH: 2, simulated: true }, { kind: "event", body: "Status changed to Resolved", by: "u_selasi", afterH: 40 }] });
  const waiting = ticket({ subject: "Assembly instructions for standing desk", description: "We received 6 standing desks but no assembly instructions.", contactId: "ct_kwesi", ownerId: "u_kwame", category: "Installation", priority: "normal", status: "waiting", source: "phone", openedAgo: 2 * DAY, respondedAfterH: 3, entries: [{ kind: "reply", body: "I've attached the PDF guide. Could you confirm the model number on the underside of the desk?", by: "u_kwame", afterH: 3, simulated: true }, { kind: "event", body: "Status changed to Waiting on customer", by: "u_kwame", afterH: 3 }] });
  ticket({ subject: "Request for bulk discount on chairs", description: "Can we get a better price if we order 50 more chairs?", contactId: "ct_oliver", ownerId: null, category: "General enquiry", priority: "low", status: "open", source: "web", openedAgo: 30 * HOUR });
  ticket({ subject: "Delivery missed agreed time slot", description: "Driver arrived after 4pm, the store was closed.", contactId: firstAt("acc_akwaaba_travel")?.id ?? "ct_kwesi", ownerId: "u_kojo", category: "Delivery", priority: "high", status: "open", source: "phone", openedAgo: 30 * HOUR, respondedAfterH: 6, entries: [{ kind: "reply", body: "Apologies — we've rebooked delivery for tomorrow 10am.", by: "u_kojo", afterH: 6, simulated: true }] });
  ticket({ subject: "Cabinet lock not working", description: "Key turns but the lock doesn't engage.", contactId: firstAt("acc_tema_hw")?.id ?? "ct_kwesi", ownerId: "u_selasi", category: "Product fault", priority: "normal", status: "closed", source: "walk_in", openedAgo: 25 * DAY, respondedAfterH: 10, resolvedAfterH: 90, closedAfterH: 140, summary: "Lock mechanism replaced under warranty.", rating: { score: "poor", comment: "Took too long.", at: iso(-21 * DAY) } });
  ticket({ subject: "Receipt needed for warranty claim", description: "Please resend the receipt for our March purchase.", contactId: firstAt("acc_kintampo_solar")?.id ?? "ct_kwesi", ownerId: "u_selasi", category: "Billing", priority: "low", status: "resolved", source: "email", openedAgo: 6 * DAY, respondedAfterH: 30, resolvedAfterH: 31, summary: "Receipt re-sent by email." });

  const savedAnswers: SavedAnswer[] = [
    { id: "sa_delivery_rebook", orgId: ORG, title: "Delivery rebooked", category: "Delivery", body: "Sorry we missed you. We've rebooked your delivery for {{date}} between 9am and 1pm. Reply if another time suits you better.", createdBy: "u_selasi", updatedAt: iso(-40 * DAY) },
    { id: "sa_invoice_reissue", orgId: ORG, title: "Invoice reissued", category: "Billing", body: "Thank you for flagging this. We've corrected the invoice and reissued it to your finance team.", createdBy: "u_selasi", updatedAt: iso(-40 * DAY) },
    { id: "sa_warranty", orgId: ORG, title: "Warranty repair booked", category: "Product fault", body: "This is covered by your warranty. A technician will contact you to arrange a visit.", createdBy: "u_abena", updatedAt: iso(-15 * DAY) },
  ];

  /* ---------------- Documents ---------------- */

  const folders: Folder[] = [
    { id: "fld_customers", orgId: ORG, name: "Customer documents", parentId: null, color: "cyan", ownerId: "u_ama", createdAt: iso(-90 * DAY), updatedAt: iso(-10 * DAY) },
    { id: "fld_coastal", orgId: ORG, name: "Coastal Pharmacy Group", parentId: "fld_customers", color: "emerald", ownerId: "u_kwame", createdAt: iso(-80 * DAY), updatedAt: iso(-4 * DAY) },
    { id: "fld_support", orgId: ORG, name: "Support evidence", parentId: null, color: "amber", ownerId: "u_selasi", createdAt: iso(-30 * DAY), updatedAt: iso(-1 * DAY) },
    { id: "fld_templates", orgId: ORG, name: "Sales templates", parentId: null, color: "default", ownerId: "u_ama", createdAt: iso(-120 * DAY), updatedAt: iso(-60 * DAY) },
  ];
  const doc = (d: Partial<DocumentFile> & Pick<DocumentFile, "name" | "mimeType" | "sizeBytes" | "ownerId">, ago: number): DocumentFile => ({ id: nextId("doc"), orgId: ORG, folderId: null, starred: false, links: [], storageRef: null, createdAt: iso(-ago), updatedAt: iso(-ago), ...d });
  const documents: DocumentFile[] = [
    doc({ name: "Branch roll-out proposal v3.pdf", mimeType: "application/pdf", sizeBytes: 842_000, folderId: "fld_coastal", ownerId: "u_kwame", starred: true, links: [{ kind: "contact", id: "ct_abigail" }, { kind: "account", id: "acc_coastal_pharm" }, ...(coastal ? [{ kind: "deal" as const, id: coastal.id }] : [])] }, 5 * DAY),
    doc({ name: "Branch floor plan.png", mimeType: "image/png", sizeBytes: 1_240_000, folderId: "fld_coastal", ownerId: "u_ama", links: [{ kind: "account", id: "acc_coastal_pharm" }] }, 95 * DAY),
    doc({ name: "Signed marketing consent form.pdf", mimeType: "application/pdf", sizeBytes: 96_200, folderId: "fld_coastal", ownerId: "u_kwame", links: [{ kind: "contact", id: "ct_abigail" }] }, 200 * DAY),
    doc({ name: "INV-3290 as sent.pdf", mimeType: "application/pdf", sizeBytes: 120_400, folderId: "fld_support", ownerId: "u_selasi", links: [{ kind: "ticket", id: urgent.id }, { kind: "contact", id: "ct_abigail" }] }, 2 * HOUR),
    doc({ name: "Standing desk assembly guide.pdf", mimeType: "application/pdf", sizeBytes: 2_310_000, folderId: "fld_support", ownerId: "u_kwame", links: [{ kind: "ticket", id: waiting.id }] }, 2 * DAY - 3 * HOUR),
    doc({ name: "Price list 2026.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: 64_500, folderId: "fld_templates", ownerId: "u_ama", starred: true }, 60 * DAY),
    doc({ name: "Company profile.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", sizeBytes: 5_820_000, folderId: "fld_templates", ownerId: "u_ama" }, 100 * DAY),
    doc({ name: "Standard terms of sale.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 38_900, folderId: "fld_templates", ownerId: "u_abena" }, 110 * DAY),
    doc({ name: "Showroom walkthrough.mp4", mimeType: "video/mp4", sizeBytes: 48_600_000, ownerId: "u_kojo" }, 14 * DAY),
    doc({ name: "Old brochure 2024.pdf", mimeType: "application/pdf", sizeBytes: 3_100_000, folderId: "fld_templates", ownerId: "u_ama", deletedAt: iso(-26 * DAY) }, 400 * DAY),
  ];
  // Items in the recycle bin point at themselves so they can be restored or purged as a unit.
  for (const d of documents) if (d.deletedAt) d.binnedWith = d.id;
  for (const d of documents) audit.push({ id: nextId("au"), orgId: ORG, entityType: "document", entityId: d.id, action: "created", actorId: d.ownerId, at: d.createdAt, summary: d.name });

  return { activities: [...existing.map(tidy), ...activities], communications, templates, campaigns, tickets, savedAnswers, folders, documents, settings, audit };
}
