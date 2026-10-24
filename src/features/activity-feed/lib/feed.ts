import { canReadRecord, canReadSalesRecord, hasPermission } from "@/lib/permissions";
import type { User } from "@/lib/types";
import type { Db } from "@/lib/mock-data/db-types";
import type { AuditEvent } from "@/features/contacts/types";
import type { Activity } from "@/features/activities/types";
import { ACTION_LABELS, actorName, humanizeField, humanizeValue, isSensitiveField, isTechnicalKey } from "./describe";

export type FeedCategory = "sales" | "customers" | "tasks" | "service" | "messaging" | "settings";

export const FEED_CATEGORIES: { key: "all" | FeedCategory; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "sales", label: "Sales" },
  { key: "customers", label: "Customers" },
  { key: "tasks", label: "Tasks & Calls" },
  { key: "service", label: "Service" },
  { key: "messaging", label: "Messaging" },
  { key: "settings", label: "Settings" },
];

export interface FeedChange {
  label: string;
  rawKey?: string;
  from: string;
  to: string;
}

export interface FeedEvent {
  id: string;
  at: string;
  actorId: string;
  actor: string;
  category: FeedCategory;
  /** e.g. "Edited" — followed by the record type and name in the UI. */
  verb: string;
  recordType: string;
  recordName: string;
  href?: string;
  /** Why there's no link, e.g. module pending. */
  linkNote?: string;
  summary?: string;
  changes: FeedChange[];
  /** Values withheld from this viewer (role can't see change history or field is personal). */
  restricted: boolean;
  technical: { source: "audit" | "activity"; eventId: string; entityType: string; entityId: string; action: string; rawFields: string[] };
}

const ACTIVITY_VERB: Record<Activity["type"], string> = {
  note: "Added a note to",
  call: "Logged a call with",
  meeting: "Scheduled a meeting with",
  visit: "Planned a visit to",
  task: "Created a task for",
  email: "Emailed",
  message: "Messaged",
};

/**
 * Builds the activity feed for one viewer from the prototype's audit trail
 * and interaction records. Nothing is invented: every entry maps to a stored
 * event, and entries about records the viewer can't access are dropped.
 */
export function buildFeed(db: Db, viewer: User): FeedEvent[] {
  const users = new Map(db.users.map((u) => [u.id, u]));
  const contacts = new Map(db.contacts.filter((c) => c.orgId === viewer.orgId).map((c) => [c.id, c]));
  const accounts = new Map(db.accounts.filter((a) => a.orgId === viewer.orgId).map((a) => [a.id, a]));
  const accountNames = new Map([...accounts.values()].map((a) => [a.id, a.name]));
  const segments = new Map(db.segments.filter((s) => s.orgId === viewer.orgId).map((s) => [s.id, s]));
  const deals = new Map(db.deals.map((d) => [d.id, d]));
  const tickets = new Map(db.tickets.map((t) => [t.id, t]));
  const canSeeContact = (id: string) => {
    const c = contacts.get(id);
    return !!c && canReadRecord(viewer, c, db.users);
  };
  const seesHistory = hasPermission(viewer, "contacts.viewAudit");

  const out: FeedEvent[] = [];

  const fromAudit = (e: AuditEvent): FeedEvent | null => {
    if (e.orgId !== viewer.orgId) return null;
    let category: FeedCategory = "customers";
    let recordName = "";
    let href: string | undefined;
    let linkNote: string | undefined;
    switch (e.entityType) {
      case "contact": {
        if (!canSeeContact(e.entityId)) return null;
        const c = contacts.get(e.entityId)!;
        recordName = c.displayName;
        href = `/contacts/${c.id}`;
        if (e.action === "consent_recorded") category = "messaging";
        break;
      }
      case "account": {
        const a = accounts.get(e.entityId);
        if (!a || !hasPermission(viewer, "accounts.view")) return null;
        recordName = a.name;
        href = `/accounts/${a.id}`;
        break;
      }
      case "segment": {
        const s = segments.get(e.entityId);
        if (s && s.isPrivate && s.ownerUserId !== viewer.id) return null;
        if (!s && e.actorId !== viewer.id && !hasPermission(viewer, "segments.manage")) return null;
        recordName = s?.name ?? e.summary ?? "Deleted segment";
        href = s ? `/segments/${s.id}` : undefined;
        if (!s) linkNote = "This segment has been deleted.";
        break;
      }
      case "deal": {
        const d = deals.get(e.entityId);
        if (!d || !canReadSalesRecord(viewer, d, db.users)) return null;
        category = "sales";
        recordName = d.title;
        href = `/deals/${d.id}`;
        break;
      }
      case "lead": {
        const l = db.leads.find((x) => x.id === e.entityId);
        if (!l || !canReadSalesRecord(viewer, l, db.users)) return null;
        category = "sales";
        recordName = l.name;
        href = `/leads/${l.id}`;
        break;
      }
      case "quote": {
        const q = db.quotes.find((x) => x.id === e.entityId);
        const d = q && deals.get(q.dealId);
        if (!q || !d || !canReadSalesRecord(viewer, d, db.users)) return null;
        category = "sales";
        recordName = `${q.number} for ${d.title}`;
        href = `/quotes/${q.id}`;
        break;
      }
      case "product": {
        const p = db.products.find((x) => x.id === e.entityId);
        if (!p || !hasPermission(viewer, "sales.view")) return null;
        category = "sales";
        recordName = p.name;
        href = "/products";
        break;
      }
      case "ticket": {
        const t = tickets.get(e.entityId);
        if (!t || !canSeeContact(t.contactId)) return null;
        category = "service";
        recordName = `${t.number} ${t.subject}`;
        href = `/tickets/${t.id}`;
        break;
      }
      case "activity": {
        const a = db.activities.find((x) => x.id === e.entityId);
        if (a?.contactId && !canSeeContact(a.contactId)) return null;
        category = "tasks";
        recordName = a?.subject ?? e.summary ?? "an activity";
        href = a ? `/activities?open=${a.id}` : undefined;
        if (!a) linkNote = "This activity has been deleted.";
        break;
      }
      case "campaign":
      case "template": {
        category = "messaging";
        recordName = e.summary ?? "";
        href = e.entityType === "campaign" ? `/campaigns/${e.entityId}` : "/messaging?tab=templates";
        break;
      }
      case "document":
      case "folder":
        // Files are not one of the audited feed categories; their history stays on the document.
        return null;
      case "setting": {
        if (!hasPermission(viewer, "settings.view")) return null;
        category = "settings";
        recordName = e.summary ?? "CRM settings";
        linkNote = "Settings have not been redesigned yet.";
        break;
      }
    }

    const restrictedByRole = e.entityType === "contact" && !seesHistory;
    let restricted = restrictedByRole;
    const changes: FeedChange[] = [];
    for (const ch of e.changes ?? []) {
      const label = humanizeField(ch.field);
      if (isSensitiveField(label) && !seesHistory) restricted = true;
      changes.push({
        label,
        rawKey: isTechnicalKey(ch.field) ? ch.field : undefined,
        from: humanizeValue(ch.field, ch.from, users, accountNames),
        to: humanizeValue(ch.field, ch.to, users, accountNames),
      });
    }

    return {
      id: e.id,
      at: e.at,
      actorId: e.actorId,
      actor: actorName(e.actorId, users),
      category,
      verb: ACTION_LABELS[e.action],
      recordType: e.entityType === "setting" ? "" : e.entityType,
      recordName,
      href,
      linkNote,
      summary: e.entityType === "contact" || e.entityType === "account" ? e.summary : undefined,
      changes: restricted ? changes.map((c) => ({ ...c, from: "", to: "" })) : changes,
      restricted: restricted && changes.length > 0,
      technical: { source: "audit", eventId: e.id, entityType: e.entityType, entityId: e.entityId, action: e.action, rawFields: (e.changes ?? []).map((c) => c.field) },
    };
  };

  for (const e of db.audit) {
    const f = fromAudit(e);
    if (f) out.push(f);
  }

  for (const a of db.activities) {
    if (a.orgId !== viewer.orgId || !a.contactId || !canSeeContact(a.contactId)) continue;
    const c = contacts.get(a.contactId)!;
    const category: FeedCategory = a.type === "message" || a.type === "email" ? "messaging" : "tasks";
    const base = {
      actorId: a.createdBy,
      actor: actorName(a.createdBy, users),
      category,
      recordType: "contact",
      recordName: c.displayName,
      href: `/contacts/${c.id}`,
      changes: [] as FeedChange[],
      restricted: false,
    };
    out.push({
      ...base,
      id: `act_${a.id}`,
      at: a.createdAt,
      verb: ACTIVITY_VERB[a.type],
      summary: a.type === "note" ? a.body : a.subject,
      technical: { source: "activity", eventId: a.id, entityType: "activity", entityId: a.id, action: `${a.type}.created`, rawFields: [] },
    });
    if (a.completedAt && a.status === "done") {
      out.push({
        ...base,
        id: `act_done_${a.id}`,
        at: a.completedAt,
        verb: a.type === "meeting" ? "Held a meeting with" : "Completed a task for",
        summary: a.subject,
        technical: { source: "activity", eventId: a.id, entityType: "activity", entityId: a.id, action: `${a.type}.completed`, rawFields: [] },
      });
    }
  }

  return out.sort((x, y) => y.at.localeCompare(x.at));
}

export type DateRange = "today" | "yesterday" | "7d" | "30d" | "90d" | "all" | "custom";

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
  custom: "Custom range",
};

export function rangeBounds(range: DateRange, now: number, custom?: { from?: string; to?: string }): { from: number; to: number } {
  const startOfDay = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const DAY = 86_400_000;
  const today = startOfDay(now);
  switch (range) {
    case "today":
      return { from: today, to: Infinity };
    case "yesterday":
      return { from: today - DAY, to: today };
    case "7d":
      return { from: today - 6 * DAY, to: Infinity };
    case "30d":
      return { from: today - 29 * DAY, to: Infinity };
    case "90d":
      return { from: today - 89 * DAY, to: Infinity };
    case "all":
      return { from: -Infinity, to: Infinity };
    case "custom":
      return {
        from: custom?.from ? new Date(`${custom.from}T00:00:00`).getTime() : -Infinity,
        to: custom?.to ? new Date(`${custom.to}T00:00:00`).getTime() + DAY : Infinity,
      };
  }
}

export interface FeedFilters {
  category: "all" | FeedCategory;
  search: string;
  actorIds: string[];
  range: DateRange;
  customFrom?: string;
  customTo?: string;
}

export function filterFeed(events: FeedEvent[], f: FeedFilters, now: number): FeedEvent[] {
  const { from, to } = rangeBounds(f.range, now, { from: f.customFrom, to: f.customTo });
  const q = f.search.trim().toLowerCase();
  return events.filter((e) => {
    const t = new Date(e.at).getTime();
    if (t < from || t >= to) return false;
    if (f.category !== "all" && e.category !== f.category) return false;
    if (f.actorIds.length && !f.actorIds.includes(e.actorId)) return false;
    if (q) {
      const hay = [e.actor, e.verb, e.recordType, e.recordName, e.summary, ...e.changes.map((c) => c.label)].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
