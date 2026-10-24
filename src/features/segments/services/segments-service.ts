/** Segments mock service. FUTURE INTEGRATION POINT — enforces permissions itself. */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { hasPermission } from "@/lib/permissions";
import type { Result } from "@/lib/types";
import { getCurrentUser } from "@/features/permissions";
import type { FieldChange } from "@/features/contacts/types";
import { canEditSegment, describeCondition, isIncomplete } from "../lib/match";
import type { Segment, SegmentCondition } from "../types";

export interface SegmentInput {
  name: string;
  description?: string;
  isPrivate: boolean;
  conditions: SegmentCondition[];
}

function check(input: SegmentInput): string | null {
  if (!input.name.trim()) return "Give the segment a name.";
  if (input.conditions.some(isIncomplete)) return "Finish or remove the incomplete conditions.";
  return null;
}

export async function createSegment(input: SegmentInput): Promise<Result<Segment>> {
  await latency();
  const actor = getCurrentUser();
  if (!hasPermission(actor, "segments.create")) return forbidden("Your role can't create segments.");
  const err = check(input);
  if (err) return invalid(err);
  const now = nowIso();
  const seg: Segment = { id: newId("seg"), orgId: actor.orgId, ownerUserId: actor.id, createdAt: now, updatedAt: now, ...input, name: input.name.trim(), description: input.description?.trim() || undefined };
  const db = getDb();
  commitDb({ ...db, segments: [...db.segments, seg], audit: [...db.audit, { id: newId("au"), orgId: actor.orgId, entityType: "segment", entityId: seg.id, action: "created", actorId: actor.id, at: now, summary: seg.name }] });
  return ok(seg);
}

export async function updateSegment(id: string, input: SegmentInput): Promise<Result<Segment>> {
  await latency();
  const actor = getCurrentUser();
  const db = getDb();
  const before = db.segments.find((s) => s.id === id);
  if (!before) return notFound();
  if (!canEditSegment(actor, before)) return forbidden("You can't edit this segment.");
  const err = check(input);
  if (err) return invalid(err);
  const users = new Map(db.users.map((u) => [u.id, u]));
  const changes: FieldChange[] = [];
  if (before.name !== input.name.trim()) changes.push({ field: "Name", from: before.name, to: input.name.trim() });
  if ((before.description ?? "") !== (input.description?.trim() ?? "")) changes.push({ field: "Description", from: before.description ?? "", to: input.description?.trim() ?? "" });
  if (before.isPrivate !== input.isPrivate) changes.push({ field: "Visibility", from: before.isPrivate ? "Private" : "Shared", to: input.isPrivate ? "Private" : "Shared" });
  const desc = (cs: SegmentCondition[]) => cs.map((c) => describeCondition(c, users)).join("; ");
  if (desc(before.conditions) !== desc(input.conditions)) changes.push({ field: "Conditions", from: desc(before.conditions), to: desc(input.conditions) });
  const after: Segment = { ...before, ...input, name: input.name.trim(), description: input.description?.trim() || undefined, updatedAt: nowIso() };
  commitDb({
    ...db,
    segments: db.segments.map((s) => (s.id === id ? after : s)),
    audit: changes.length ? [...db.audit, { id: newId("au"), orgId: actor.orgId, entityType: "segment", entityId: id, action: "updated", actorId: actor.id, at: nowIso(), changes, summary: after.name }] : db.audit,
  });
  return ok(after);
}

export async function deleteSegment(id: string): Promise<Result<true>> {
  await latency();
  const actor = getCurrentUser();
  const db = getDb();
  const seg = db.segments.find((s) => s.id === id);
  if (!seg) return notFound();
  if (!canEditSegment(actor, seg)) return forbidden("You can't delete this segment.");
  commitDb({
    ...db,
    segments: db.segments.filter((s) => s.id !== id),
    audit: [...db.audit, { id: newId("au"), orgId: actor.orgId, entityType: "segment", entityId: id, action: "deleted", actorId: actor.id, at: nowIso(), summary: seg.name }],
  });
  return ok(true);
}
