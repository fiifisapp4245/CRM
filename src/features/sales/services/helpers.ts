import { newId, nowIso } from "@/lib/mock-data/service-helpers";
import type { AuditEvent, AuditEntityType, FieldChange } from "@/features/contacts/types";

export function auditEvent(orgId: string, entityType: AuditEntityType, entityId: string, action: AuditEvent["action"], actorId: string, summary?: string, changes?: FieldChange[]): AuditEvent {
  return { id: newId("au"), orgId, entityType, entityId, action, actorId, at: nowIso(), summary, changes };
}
