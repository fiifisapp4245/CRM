/**
 * Campaigns mock service (Premium). Nothing is sent to anyone: recipients,
 * sending and delivery are simulated in this browser. FUTURE INTEGRATION POINT.
 */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { hasPermission } from "@/lib/permissions";
import type { Result } from "@/lib/types";
import { formatInTz } from "@/lib/business/time";
import { getCurrentUser, requireFeature } from "@/features/permissions";
import { auditEvent } from "@/features/sales/services/helpers";
import { campaignAudience, checkSchedule, renderFor } from "../lib/campaigns";
import { messageCost, unknownVariables } from "../lib/messaging";
import type { Campaign, Communication } from "../types";
import { setCommStatus, simulateDelivery } from "./messaging-service";

export interface CampaignInput {
  name: string;
  channel: Campaign["channel"];
  segmentId: string;
  subject?: string;
  body: string;
  templateId?: string;
}

function guard(): Result<never> | null {
  return requireFeature("campaigns") ?? (hasPermission(getCurrentUser(), "campaigns.manage") ? null : forbidden("Your role can't manage campaigns."));
}

function load(id: string) {
  const actor = getCurrentUser();
  const db = getDb();
  return { actor, db, c: db.campaigns.find((x) => x.id === id && x.orgId === actor.orgId) };
}

export async function saveCampaign(input: CampaignInput, id?: string): Promise<Result<Campaign>> {
  await latency(150);
  const g = guard();
  if (g) return g;
  const actor = getCurrentUser();
  const db = getDb();
  if (!input.name.trim()) return invalid("Give the campaign a name.");
  if (!db.segments.some((s) => s.id === input.segmentId && !s.isPrivate)) return invalid("Choose a shared segment as the audience.");
  if (input.channel === "email" && !input.subject?.trim()) return invalid("Email campaigns need a subject.");
  if (unknownVariables(`${input.subject ?? ""} ${input.body}`).length) return invalid("Remove fields the CRM can't fill.");
  const now = nowIso();
  if (id) {
    const before = db.campaigns.find((c) => c.id === id);
    if (!before) return notFound();
    if (before.status !== "draft") return invalid("Only drafts can be edited. A scheduled campaign must be moved back to draft first.");
    const after: Campaign = { ...before, ...input, name: input.name.trim(), subject: input.channel === "email" ? input.subject?.trim() : undefined, updatedAt: now };
    commitDb({ ...db, campaigns: db.campaigns.map((c) => (c.id === id ? after : c)), audit: [...db.audit, auditEvent(actor.orgId, "campaign", id, "updated", actor.id, after.name)] });
    return ok(after);
  }
  const c: Campaign = { id: newId("cmp"), orgId: actor.orgId, ...input, name: input.name.trim(), subject: input.channel === "email" ? input.subject?.trim() : undefined, status: "draft", eligibleCount: 0, excludedCount: 0, timezone: db.settings.timezone, communicationIds: [], createdBy: actor.id, createdAt: now, updatedAt: now };
  commitDb({ ...db, campaigns: [c, ...db.campaigns], audit: [...db.audit, auditEvent(actor.orgId, "campaign", c.id, "created", actor.id, c.name)] });
  return ok(c);
}

export async function deleteDraft(id: string): Promise<Result<true>> {
  const g = guard();
  if (g) return g;
  const { actor, db, c } = load(id);
  if (!c) return notFound();
  if (c.status !== "draft") return invalid("Only drafts can be deleted.");
  commitDb({ ...db, campaigns: db.campaigns.filter((x) => x.id !== id), audit: [...db.audit, auditEvent(actor.orgId, "campaign", id, "deleted", actor.id, c.name)] });
  return ok(true);
}

export async function scheduleCampaign(id: string, at: string): Promise<Result<Campaign>> {
  await latency(150);
  const g = guard();
  if (g) return g;
  const { actor, db, c } = load(id);
  if (!c) return notFound();
  if (c.status !== "draft") return invalid("Only drafts can be scheduled.");
  const check = checkSchedule(at, Date.now(), db.settings);
  if (!check.ok) return invalid(check.suggestion ? `${check.reason} Next available: ${formatInTz(check.suggestion, db.settings.timezone, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.` : check.reason);
  const el = campaignAudience(db, c);
  if (!el?.eligible.length) return invalid("Nobody in this segment may receive this campaign.");
  const after: Campaign = { ...c, status: "scheduled", scheduledAt: at, eligibleCount: el.eligible.length, excludedCount: el.excluded.length, exclusions: el.byReason, updatedAt: nowIso() };
  commitDb({ ...db, campaigns: db.campaigns.map((x) => (x.id === id ? after : x)), audit: [...db.audit, auditEvent(actor.orgId, "campaign", id, "scheduled", actor.id, c.name)] });
  return ok(after);
}

export async function unscheduleCampaign(id: string): Promise<Result<Campaign>> {
  const g = guard();
  if (g) return g;
  const { actor, db, c } = load(id);
  if (!c) return notFound();
  if (c.status !== "scheduled") return invalid("Only scheduled campaigns can go back to draft.");
  const after: Campaign = { ...c, status: "draft", scheduledAt: undefined, updatedAt: nowIso() };
  commitDb({ ...db, campaigns: db.campaigns.map((x) => (x.id === id ? after : x)), audit: [...db.audit, auditEvent(actor.orgId, "campaign", id, "updated", actor.id, `${c.name} moved back to draft`)] });
  return ok(after);
}

const BATCH = 6;
const BATCH_MS = 1200;

/** Starts the simulated send: messages queue as Waiting, go out in batches, then delivery is simulated. */
function startSending(id: string, actorId: string) {
  let db = getDb();
  const c = db.campaigns.find((x) => x.id === id);
  if (!c) return;
  const el = campaignAudience(db, c);
  const now = nowIso();
  const comms: Communication[] = (el?.eligible ?? []).map((e) => {
    const r = renderFor(db, c.body, e.contact.id);
    return {
      id: newId("msg"), orgId: c.orgId, channel: c.channel, kind: "campaign", campaignId: c.id, contactId: e.contact.id, to: e.to, subject: c.subject ? renderFor(db, c.subject, e.contact.id).text : undefined, body: r.text, status: "waiting",
      history: [{ status: "waiting", at: now }], cost: messageCost(c.channel, r.text, db.settings.smsCostPerPartGhs), consent: { purpose: "marketing", allowed: true, reason: "Customer agreed to marketing on this channel." }, mode: "demo", createdBy: actorId, createdAt: now, updatedAt: now,
    };
  });
  db = { ...db, communications: [...comms, ...db.communications], campaigns: db.campaigns.map((x) => (x.id === id ? { ...x, status: "going_out", sentAt: now, eligibleCount: comms.length, excludedCount: el?.excluded.length ?? 0, exclusions: el?.byReason, communicationIds: comms.map((m) => m.id), updatedAt: now } : x)) };
  commitDb(db);
  setTimeout(() => sendTick(id, actorId), BATCH_MS);
}

function sendTick(id: string, actorId: string) {
  let d = getDb();
  const camp = d.campaigns.find((x) => x.id === id);
  if (!camp || camp.status !== "going_out") return; // stopped
  const waiting = d.communications.filter((m) => m.campaignId === id && m.status === "waiting").slice(0, BATCH);
  for (const m of waiting) d = setCommStatus(d, m.id, "sent", "Simulated — no provider connected");
  const left = d.communications.some((m) => m.campaignId === id && m.status === "waiting");
  if (!left) d = { ...d, campaigns: d.campaigns.map((x) => (x.id === id ? { ...x, status: "sent", updatedAt: nowIso() } : x)), audit: [...d.audit, auditEvent(camp.orgId, "campaign", id, "sent", actorId, camp.name)] };
  commitDb(d);
  simulateDelivery(waiting.map((m) => m.id), 9);
  if (left) setTimeout(() => sendTick(id, actorId), BATCH_MS);
}

/** "Send now (demo)": only inside business hours, after the user confirmed the recipient preview. */
export async function sendCampaignNow(id: string): Promise<Result<Campaign>> {
  await latency(200);
  const g = guard();
  if (g) return g;
  const { actor, db, c } = load(id);
  if (!c) return notFound();
  if (c.status !== "draft" && c.status !== "scheduled") return invalid("This campaign has already gone out.");
  const check = checkSchedule(new Date(Date.now() + 6 * 60_000).toISOString(), Date.now(), db.settings);
  if (!check.ok) return invalid(`It's outside your business hours now. Schedule it instead — next available: ${formatInTz(check.suggestion!, db.settings.timezone, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`);
  const el = campaignAudience(db, c);
  if (!el?.eligible.length) return invalid("Nobody in this segment may receive this campaign.");
  startSending(id, actor.id);
  return ok(getDb().campaigns.find((x) => x.id === id)!);
}

export async function stopCampaign(id: string): Promise<Result<Campaign>> {
  const g = guard();
  if (g) return g;
  const { actor, db, c } = load(id);
  if (!c) return notFound();
  if (c.status !== "scheduled" && c.status !== "going_out") return invalid("Only scheduled or sending campaigns can be stopped.");
  let next = { ...db, campaigns: db.campaigns.map((x) => (x.id === id ? { ...x, status: "stopped" as const, stoppedAt: nowIso(), updatedAt: nowIso() } : x)) };
  for (const m of db.communications.filter((m) => m.campaignId === id && m.status === "waiting")) next = setCommStatus(next, m.id, "cancelled", "Campaign stopped");
  commitDb({ ...next, audit: [...next.audit, auditEvent(actor.orgId, "campaign", id, "stopped", actor.id, c.name)] });
  return ok(next.campaigns.find((x) => x.id === id)!);
}

/** Starts scheduled campaigns whose time has come. Runs when the app opens (no background process). */
export function processDueCampaigns(now = Date.now()) {
  const db = getDb();
  for (const c of db.campaigns) {
    if (c.status === "scheduled" && c.scheduledAt && Date.parse(c.scheduledAt) <= now) startSending(c.id, c.createdBy);
    // A send interrupted by closing the app carries on where it stopped.
    else if (c.status === "going_out") setTimeout(() => sendTick(c.id, c.createdBy), BATCH_MS);
  }
}
