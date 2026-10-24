import type { Db } from "@/lib/mock-data/db-types";
import { inBusinessHours, nextBusinessSlot } from "@/lib/business/time";
import { orgAudience } from "@/features/segments/lib/match";
import { campaignEligibility, renderTemplate, type Eligibility } from "./messaging";
import type { Campaign } from "../types";

/** Live audience for a campaign: the segment's org-wide matches, filtered by consent and address. */
export function campaignAudience(db: Db, c: Pick<Campaign, "orgId" | "segmentId" | "channel">): Eligibility | null {
  const seg = db.segments.find((s) => s.id === c.segmentId);
  if (!seg) return null;
  return campaignEligibility(orgAudience(db.contacts, db.consents, c.orgId, seg.conditions), c.channel, db.consents);
}

export function renderFor(db: Db, body: string, contactId: string) {
  const c = db.contacts.find((x) => x.id === contactId);
  const company = c?.accountId ? db.accounts.find((a) => a.id === c.accountId)?.name : undefined;
  return renderTemplate(body, { firstName: c?.firstName, fullName: c?.displayName, company });
}

/** How many eligible recipients would get a gap where a field has no value. */
export function missingFieldCount(db: Db, body: string, el: Eligibility): number {
  return el.eligible.filter((e) => renderFor(db, body, e.contact.id).missing.length > 0).length;
}

export type ScheduleCheck = { ok: true } | { ok: false; reason: string; suggestion?: string };

/** Never silently moves the time: returns the conflict and a valid alternative. */
export function checkSchedule(at: string, now: number, settings: Db["settings"]): ScheduleCheck {
  if (Number.isNaN(Date.parse(at))) return { ok: false, reason: "Choose a date and time." };
  if (Date.parse(at) < now + 5 * 60_000) return { ok: false, reason: "Choose a time at least 5 minutes from now.", suggestion: nextBusinessSlot(new Date(now + 10 * 60_000).toISOString(), settings.timezone, settings.businessHours) };
  if (!inBusinessHours(at, settings.timezone, settings.businessHours)) return { ok: false, reason: "That time is outside your business hours.", suggestion: nextBusinessSlot(at, settings.timezone, settings.businessHours) };
  return { ok: true };
}

export const canEditCampaign = (c: Campaign) => c.status === "draft";
