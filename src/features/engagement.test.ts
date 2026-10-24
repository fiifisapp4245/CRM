import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/mock-data/seed";
import { upgradeV5toV6 } from "@/lib/mock-data/migrate";
import { DEFAULT_SETTINGS } from "@/lib/business/settings";
import { addDaysKey, dayKey, inBusinessHours, nextBusinessSlot, startOfWeekKey, weekday, zonedIso } from "@/lib/business/time";
import { hasFeature } from "@/lib/entitlements";
import { activityKind, bucketOf, nextOccurrence, reminderAt, reschedule } from "@/features/activities/lib/activities";
import type { Activity } from "@/features/activities/types";
import { campaignEligibility, commSummary, renderTemplate, smsParts, unknownVariables } from "@/features/messaging/lib/messaging";
import { checkSchedule } from "@/features/messaging/lib/campaigns";
import { inView, isLateNow, targetsFor, ticketDashboard } from "@/features/tickets/lib/tickets";
import type { Ticket } from "@/features/tickets/types";
import { daysLeft, descendantFolderIds, fileCategory, retentionDeadline, uniqueFileName } from "@/features/documents/lib/documents";

const NOW = Date.parse("2026-10-21T12:00:00Z"); // Wednesday, Accra = UTC
const TZ = "Africa/Accra";
const base: Activity = { id: "a", orgId: "o", contactId: null, type: "task", subject: "x", assigneeId: "u", createdBy: "u", createdAt: "2026-10-01T00:00:00Z" };

describe("plans", () => {
  it("Basic has Tasks, Calendar and Documents but not Messaging, Tickets or Campaigns", () => {
    expect(["activities", "calendar", "documents"].every((f) => hasFeature("basic", f as never))).toBe(true);
    expect(hasFeature("basic", "messaging")).toBe(false);
    expect(hasFeature("advance", "tickets")).toBe(true);
    expect(hasFeature("advance", "campaigns")).toBe(false);
    expect(hasFeature("premium", "campaigns")).toBe(true);
  });
});

describe("business time", () => {
  it("round-trips wall time and finds business slots", () => {
    expect(zonedIso("2026-10-21", "09:30", TZ)).toBe("2026-10-21T09:30:00.000Z");
    expect(zonedIso("2026-10-21", "09:30", "Africa/Lagos")).toBe("2026-10-21T08:30:00.000Z");
    expect(weekday("2026-10-25")).toBe(7);
    expect(startOfWeekKey("2026-10-25")).toBe("2026-10-19");
    expect(addDaysKey("2026-10-31", 1)).toBe("2026-11-01");
    const h = DEFAULT_SETTINGS.businessHours;
    expect(inBusinessHours("2026-10-21T10:00:00Z", TZ, h)).toBe(true);
    expect(inBusinessHours("2026-10-24T10:00:00Z", TZ, h)).toBe(false); // Saturday
    expect(nextBusinessSlot("2026-10-24T10:00:00Z", TZ, h)).toBe("2026-10-26T08:00:00.000Z");
    expect(nextBusinessSlot("2026-10-21T18:00:00Z", TZ, h)).toBe("2026-10-22T08:00:00.000Z");
  });
});

describe("activities", () => {
  it("puts the same records in genuinely different views", () => {
    const late = { ...base, status: "open" as const, dueAt: "2026-10-20T09:00:00Z" };
    const earlierToday = { ...base, status: "open" as const, dueAt: "2026-10-21T08:00:00Z" };
    const upcoming = { ...base, status: "open" as const, dueAt: "2026-10-22T09:00:00Z" };
    const noDate = { ...base, status: "open" as const };
    const logged = { ...base, type: "call" as const, occurredAt: "2026-10-21T09:00:00Z" };
    expect([late, earlierToday, upcoming, noDate, logged].map((a) => bucketOf(a, NOW, TZ))).toEqual(["late", "today", "upcoming", "no_date", "done"]);
    expect(bucketOf({ ...base, status: "cancelled" }, NOW, TZ)).toBeNull();
  });
  it("derives SMS/WhatsApp kinds, reminders, repeats and keeps duration when moved", () => {
    expect(activityKind({ type: "message", channel: "whatsapp" })).toBe("whatsapp");
    const meeting = { ...base, type: "meeting" as const, status: "open" as const, dueAt: "2026-10-22T10:00:00Z", endAt: "2026-10-22T11:30:00Z" };
    expect(reminderAt({ ...meeting, reminder: "default" }, 15)).toBe("2026-10-22T09:45:00.000Z");
    expect(reminderAt({ ...meeting, reminder: "none" }, 15)).toBeNull();
    expect(reminderAt({ ...meeting, reminder: 1440 }, 15)).toBe("2026-10-21T10:00:00.000Z");
    expect(reschedule(meeting, "2026-10-23T14:00:00Z")).toEqual({ dueAt: "2026-10-23T14:00:00Z", endAt: "2026-10-23T15:30:00.000Z" });
    expect(nextOccurrence("2026-01-31T09:00:00Z", "monthly")).toBe("2026-02-28T09:00:00.000Z");
    expect(nextOccurrence("2026-10-21T09:00:00Z", "weekly")).toBe("2026-10-28T09:00:00.000Z");
  });
});

describe("messaging", () => {
  it("fills only known fields and reports missing values", () => {
    expect(renderTemplate("Hi {{first_name}}, about {{deal}}.", { firstName: "Ama" })).toEqual({ text: "Hi Ama, about.", missing: ["deal"] });
    expect(unknownVariables("Hi {{first_name}} {{invoice_no}}")).toEqual(["invoice_no"]);
    expect(smsParts("a".repeat(160))).toBe(1);
    expect(smsParts("a".repeat(161))).toBe(2);
    expect(commSummary([]).smsCost).toBeNull();
  });
  it("never treats a whole segment as eligible", () => {
    const db = buildSeed(NOW);
    const audience = db.contacts.filter((c) => c.orgId === "org_adinkra" && c.status === "active");
    const el = campaignEligibility(audience, "sms", db.consents);
    expect(el.eligible.length + el.excluded.length).toBe(audience.length);
    expect(el.excluded.length).toBeGreaterThan(0);
    expect(el.excluded.some((e) => e.contact.id === "ct_abigail" && e.reason === "opted_out")).toBe(true); // withdrew SMS marketing
  });
  it("explains schedule conflicts instead of moving the time", () => {
    const sat = checkSchedule("2026-10-24T10:00:00Z", NOW, DEFAULT_SETTINGS);
    expect(sat).toEqual({ ok: false, reason: "That time is outside your business hours.", suggestion: "2026-10-26T08:00:00.000Z" });
    expect(checkSchedule("2026-10-22T10:00:00Z", NOW, DEFAULT_SETTINGS).ok).toBe(true);
  });
});

describe("tickets", () => {
  const t = (p: Partial<Ticket>): Ticket => ({ id: "t", orgId: "o", number: "T-1", subject: "s", description: "d", contactId: "c", accountId: null, ownerId: "u1", category: "Billing", priority: "normal", status: "open", source: "email", openedAt: "2026-10-21T00:00:00Z", ...targetsFor("normal", "2026-10-21T00:00:00Z", DEFAULT_SETTINGS), entries: [], createdBy: "u1", createdAt: "", updatedAt: "", ...p });
  it("models response and resolution targets independently", () => {
    const x = t({});
    expect(x.firstResponseDueAt).toBe("2026-10-21T08:00:00.000Z");
    expect(x.resolutionDueAt).toBe("2026-10-24T00:00:00.000Z");
    expect(isLateNow(x, NOW)).toBe(true); // no reply after 12h
    expect(isLateNow(t({ firstRespondedAt: "2026-10-21T02:00:00Z" }), NOW)).toBe(false);
    expect(inView(t({ ownerId: null }), "nobody", "u1", NOW)).toBe(true);
    expect(inView(t({ status: "waiting" }), "open", "u1", NOW)).toBe(true);
    expect(inView(t({ status: "resolved" }), "open", "u1", NOW)).toBe(false);
  });
  it("distinguishes zero from no data on the dashboard", () => {
    const empty = ticketDashboard([], { from: "2026-10-01", to: "2026-10-31" }, NOW);
    expect(empty.openNow).toBe(0);
    expect(empty.customersHappy.kind).toBe("none");
    const d = ticketDashboard([t({ status: "resolved", firstRespondedAt: "2026-10-21T02:00:00Z", resolvedAt: "2026-10-21T10:00:00Z", rating: { score: "good", at: "2026-10-21T11:00:00Z" } }), t({ id: "t2", rating: undefined })], { from: "2026-10-01", to: "2026-10-31" }, NOW);
    expect(d.customersHappy).toEqual({ kind: "value", value: 100 });
    expect(d.firstReplyOnTime).toEqual({ kind: "value", value: 100 });
    expect(d.resolvedOnTime).toEqual({ kind: "value", value: 100 });
    expect(d.openNow).toBe(1);
  });
});

describe("documents", () => {
  it("classifies files, keeps names unique and computes the 30-day bin deadline", () => {
    expect(fileCategory("application/pdf", "a.pdf")).toBe("pdfs");
    expect(fileCategory("", "Budget.XLSX")).toBe("spreadsheets");
    expect(fileCategory("image/heic", "x")).toBe("pictures");
    expect(uniqueFileName(["Report.pdf", "Report (2).pdf"], "report.pdf")).toBe("report (3).pdf");
    expect(retentionDeadline("2026-10-01T10:00:00Z", 30)).toBe("2026-10-31T10:00:00.000Z");
    expect(daysLeft("2026-10-01T10:00:00Z", 30, NOW)).toBe(10);
    const folders = [{ id: "a", parentId: null }, { id: "b", parentId: "a" }, { id: "c", parentId: "b" }, { id: "d", parentId: null }] as never;
    expect([...descendantFolderIds(folders, "a")].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("seed and migration", () => {
  it("links engagement records to existing customers and survives a v5 upgrade", () => {
    const db = buildSeed(NOW);
    const ids = new Set(db.contacts.map((c) => c.id));
    expect(db.tickets.every((x) => ids.has(x.contactId))).toBe(true);
    expect(db.communications.every((m) => ids.has(m.contactId))).toBe(true);
    expect(db.communications.filter((m) => m.activityId).every((m) => db.activities.some((a) => a.id === m.activityId))).toBe(true);
    expect(db.documents.some((d) => d.links.some((l) => l.kind === "ticket"))).toBe(true);
    expect(db.campaigns.map((c) => c.status).sort()).toEqual(["draft", "scheduled", "sent"]);
    expect(db.activities.some((a) => a.recurrence === "weekly")).toBe(true);
    expect(db.documents.filter((d) => d.deletedAt).every((d) => d.binnedWith === d.id)).toBe(true);
    expect(dayKey(NOW, TZ)).toBe("2026-10-21");
    const edited = { ...db, contacts: db.contacts.map((c) => (c.id === "ct_abigail" ? { ...c, jobTitle: "Edited" } : c)) };
    const v5 = { ...edited, version: 5, tickets: [], documents: [] } as never;
    const up = upgradeV5toV6(v5);
    expect(up.contacts.find((c) => c.id === "ct_abigail")!.jobTitle).toBe("Edited");
    expect(up.deals.length).toBe(db.deals.length);
    expect(up.tickets.length).toBeGreaterThan(0);
    expect(up.settings.plan).toBe("premium");
  });
});

describe("activity import", async () => {
  const { readFileSync } = await import("node:fs");
  const { parseCsv } = await import("@/lib/utils/csv");
  const { autoMapActivityColumns, planActivityImport, applyActivityImportPlan } = await import("@/features/activities/lib/import");
  const table = parseCsv(readFileSync("public/samples/activities-sample.csv", "utf8"));
  const db = buildSeed(NOW);
  const actor = db.users.find((u) => u.id === "u_ama")!;
  it("splits history from to-dos and never creates contacts", () => {
    const plan = planActivityImport(table, autoMapActivityColumns(table[0]), db, actor, "skip", { importAs: "each", now: NOW });
    const by = (s: string, n = 0) => plan.rows.filter((r) => r.values.subject === s)[n];
    expect(by("Discussed revised delivery dates").state).toBe("logged");
    expect(by("Discussed revised delivery dates").activity?.callOutcome).toBe("connected");
    expect(by("Quarterly review with Harmattan Textiles").state).toBe("scheduled");
    expect(by("Send updated price list").activity?.contactId).toBeNull();
    expect(by("Customer prefers WhatsApp").state).toBe("logged");
    expect(by("Call new prospect").outcome).toBe("error");
    expect(by("Team lunch").outcome).toBe("error");
    expect(by("Book delivery van").outcome).toBe("error");
    expect(by("Discussed revised delivery dates", 1).outcome).toBe("skip");
    const contactsBefore = db.contacts.length;
    let n = 0;
    const applied = applyActivityImportPlan(db, actor, plan, "2026-10-21T12:00:00Z", (p) => `${p}_${++n}`, (id, action) => ({ id: `au${++n}`, orgId: "org_adinkra", entityType: "activity", entityId: id, action, actorId: actor.id, at: "" }));
    expect(applied.created).toBe(plan.counts.create);
    expect(applied.db.contacts.length).toBe(contactsBefore);
    expect(applied.db.activities.filter((a) => a.status === "open").length - db.activities.filter((a) => a.status === "open").length).toBe(plan.scheduled);
  });
  it("can force every row to one kind", () => {
    const plan = planActivityImport(table, autoMapActivityColumns(table[0]).map((m) => (m === "type" ? "ignore" : m)), db, actor, "skip", { importAs: "task", now: NOW });
    expect(plan.rows.filter((r) => r.activity).every((r) => r.activity!.type === "task")).toBe(true);
  });
});

describe("calendar layout", async () => {
  const { placeDay, monthGrid } = await import("@/features/calendar/lib/layout");
  it("puts overlapping events side by side and builds Monday-first months", () => {
    const ev = (id: string, s: string, e: string) => ({ ...base, id, type: "meeting" as const, status: "open" as const, dueAt: s, endAt: e });
    const placed = placeDay([ev("a", "2026-10-21T09:00:00Z", "2026-10-21T10:00:00Z"), ev("b", "2026-10-21T09:30:00Z", "2026-10-21T10:30:00Z"), ev("c", "2026-10-21T11:00:00Z", "2026-10-21T11:30:00Z")], "2026-10-21", TZ);
    expect(placed.map((p) => [p.a.id, p.lane, p.lanes])).toEqual([["a", 0, 2], ["b", 1, 2], ["c", 0, 1]]);
    expect(placed[0].startMin).toBe(540);
    const grid = monthGrid("2026-10");
    expect(grid[0]).toBe("2026-09-28");
    expect(grid).toHaveLength(42);
  });
});

describe("history filters and file sorting", async () => {
  const { filterComms, DEFAULT_COMM_FILTERS } = await import("@/features/messaging/lib/messaging");
  const { sortDocs } = await import("@/features/documents/lib/documents");
  it("filters messages by channel, status, kind and date together", () => {
    const db = buildSeed(NOW);
    const name = (id: string) => db.contacts.find((c) => c.id === id)?.displayName ?? "";
    const all = filterComms(db.communications, DEFAULT_COMM_FILTERS, name);
    expect(all.length).toBe(db.communications.length);
    const sms = filterComms(db.communications, { ...DEFAULT_COMM_FILTERS, channels: ["sms"], kind: "campaign" }, name);
    expect(sms.length).toBeGreaterThan(0);
    expect(sms.every((m) => m.channel === "sms" && m.kind === "campaign")).toBe(true);
    const failed = filterComms(db.communications, { ...DEFAULT_COMM_FILTERS, statuses: ["failed"] }, name);
    expect(failed.every((m) => m.status === "failed")).toBe(true);
    expect(filterComms(db.communications, { ...DEFAULT_COMM_FILTERS, from: "2099-01-01" }, name)).toHaveLength(0);
  });
  it("sorts files by name, size and last change", () => {
    const d = (name: string, size: number, at: string) => ({ id: name, orgId: "o", name, mimeType: "application/pdf", sizeBytes: size, folderId: null, ownerId: "u", starred: false, links: [], storageRef: null, createdAt: at, updatedAt: at });
    const list = [d("b 10.pdf", 5, "2026-10-01"), d("b 9.pdf", 50, "2026-10-03"), d("a.pdf", 1, "2026-10-02")];
    expect(sortDocs(list, "name").map((x) => x.name)).toEqual(["a.pdf", "b 9.pdf", "b 10.pdf"]);
    expect(sortDocs(list, "size")[0].name).toBe("b 9.pdf");
    expect(sortDocs(list, "changed")[0].name).toBe("b 9.pdf");
  });
});
