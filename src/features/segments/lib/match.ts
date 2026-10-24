import type { User } from "@/lib/types";
import type { Db } from "@/lib/mock-data/db-types";
import { hasPermission } from "@/lib/permissions";
import { visibleContacts } from "@/features/contacts/lib/access";
import { consentStatus } from "@/features/contacts/lib/consent";
import { CONSENT_CHANNEL_LABELS, CONSENT_PURPOSE_LABELS, SOURCE_LABELS, type ConsentRecord, type Contact } from "@/features/contacts/types";
import type { Segment, SegmentCondition, SegmentConditionKind } from "../types";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const GENDER_LABELS: Record<string, string> = { female: "Female", male: "Male", other: "Other", undisclosed: "Prefer not to say", unspecified: "Not specified" };

export const CONDITION_KINDS: { kind: SegmentConditionKind; label: string; hint: string }[] = [
  { kind: "location", label: "Location", hint: "City, region or country" },
  { kind: "source", label: "Source", hint: "Where the contact came from" },
  { kind: "owner", label: "Owner", hint: "Who owns the relationship" },
  { kind: "gender", label: "Gender", hint: "As recorded on the contact" },
  { kind: "consent", label: "Communication permission", hint: "Has agreed to a channel" },
  { kind: "has_method", label: "Phone or email", hint: "Has (or lacks) a phone or email" },
  { kind: "birthday_month", label: "Birthday month", hint: "Month of birth" },
  { kind: "created", label: "Date added", hint: "When the contact was created" },
  { kind: "tags", label: "Tags", hint: "Include or exclude tags" },
];

/** A condition with nothing chosen yet. It doesn't filter, and can't be saved. */
export function isIncomplete(c: SegmentCondition): boolean {
  switch (c.kind) {
    case "location":
    case "source":
    case "owner":
    case "gender":
    case "tags":
      return c.values.length === 0;
    case "birthday_month":
      return c.months.length === 0;
    case "created":
      return !c.from && !c.to;
    default:
      return false;
  }
}

const eq = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

function matches(c: Contact, cond: SegmentCondition, consents: ConsentRecord[]): boolean {
  if (isIncomplete(cond)) return true;
  switch (cond.kind) {
    case "location":
      return cond.values.some((v) => eq(c[cond.field], v));
    case "source":
      return cond.values.includes(c.source);
    case "owner":
      return cond.values.includes(c.ownerId ?? "unassigned");
    case "gender":
      return cond.values.includes(c.gender ?? "unspecified");
    case "consent":
      // Current status only — an "agreed" that was later withdrawn does not count.
      return consentStatus(consents, c.id, cond.channel, cond.purpose) === "agreed";
    case "has_method": {
      const has = c.methods.some((m) => (cond.method === "email" ? m.kind === "email" : m.kind === "phone") && m.value.trim());
      return has === cond.present;
    }
    case "birthday_month": {
      if (!c.dateOfBirth) return false;
      return cond.months.includes(Number(c.dateOfBirth.slice(5, 7)));
    }
    case "created": {
      const d = c.createdAt.slice(0, 10);
      return (!cond.from || d >= cond.from) && (!cond.to || d <= cond.to);
    }
    case "tags": {
      const has = cond.values.some((t) => c.tags.includes(t));
      return cond.mode === "include" ? has : !has;
    }
  }
}

/**
 * The query model is a fixed conjunction: a contact must satisfy EVERY
 * condition. Inside one condition, matching ANY selected value is enough.
 * No nested AND/OR groups (not verified as supported by the backend).
 * The audience is always computed from the viewer's accessible, active contacts.
 */
export function segmentAudience(db: Db, viewer: User, conditions: SegmentCondition[]): Contact[] {
  return visibleContacts(db, viewer)
    .filter((c) => c.status === "active")
    .filter((c) => conditions.every((cond) => matches(c, cond, db.consents)))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function visibleSegments(db: Db, viewer: User): Segment[] {
  if (!hasPermission(viewer, "segments.view")) return [];
  return db.segments.filter((s) => s.orgId === viewer.orgId && (!s.isPrivate || s.ownerUserId === viewer.id));
}

export function canEditSegment(viewer: User, s: Segment): boolean {
  if (s.orgId !== viewer.orgId) return false;
  if (s.ownerUserId === viewer.id) return hasPermission(viewer, "segments.create");
  return !s.isPrivate && hasPermission(viewer, "segments.manage");
}

export function describeCondition(c: SegmentCondition, users: Map<string, { name: string }>): string {
  const list = (xs: string[]) => (xs.length ? xs.join(" or ") : "…");
  switch (c.kind) {
    case "location":
      return `${c.field === "city" ? "City / town" : c.field === "region" ? "Region" : "Country"} is ${list(c.values)}`;
    case "source":
      return `Source is ${list(c.values.map((v) => SOURCE_LABELS[v]))}`;
    case "owner":
      return `Owner is ${list(c.values.map((v) => (v === "unassigned" ? "Unassigned" : (users.get(v)?.name ?? v))))}`;
    case "gender":
      return `Gender is ${list(c.values.map((v) => GENDER_LABELS[v] ?? v))}`;
    case "consent":
      return `Has agreed to ${CONSENT_CHANNEL_LABELS[c.channel]} ${CONSENT_PURPOSE_LABELS[c.purpose].toLowerCase()}`;
    case "has_method":
      return `${c.present ? "Has" : "Has no"} ${c.method === "email" ? "email address" : "phone number"}`;
    case "birthday_month":
      return `Birthday in ${list(c.months.map((m) => MONTHS[m - 1]))}`;
    case "created":
      return `Added ${c.from ? `from ${c.from}` : ""}${c.from && c.to ? " " : ""}${c.to ? `until ${c.to}` : ""}`.trim();
    case "tags":
      return `${c.mode === "include" ? "Tagged" : "Not tagged"} ${list(c.values)}`;
  }
}

/**
 * Organisation-wide audience (campaigns): every active contact in the org that
 * matches, regardless of who owns it. Campaign sending is limited to roles with
 * `campaigns.manage`, so this does not widen what an ordinary user can see.
 */
export function orgAudience(contacts: Contact[], consents: ConsentRecord[], orgId: string, conditions: SegmentCondition[]): Contact[] {
  return contacts
    .filter((c) => c.orgId === orgId && c.status === "active")
    .filter((c) => conditions.every((cond) => matches(c, cond, consents)))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
