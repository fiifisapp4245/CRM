import { canReadRecord, canWriteRecord, hasPermission } from "@/lib/permissions";
import type { User } from "@/lib/types";
import type { Db } from "@/lib/mock-data/db-types";
import { canViewContact } from "@/features/contacts/lib/access";
import type { Activity } from "../types";

/**
 * Activities about a customer follow that contact's visibility. Internal
 * activities (no contact) follow their assignee with the same owner scopes.
 */
export function canSeeActivity(db: Db, user: User, a: Activity): boolean {
  if (a.orgId !== user.orgId) return false;
  if (a.contactId) {
    const c = db.contacts.find((x) => x.id === a.contactId);
    return !!c && canViewContact(db, user, c);
  }
  return canReadRecord(user, { orgId: a.orgId, ownerId: a.assigneeId }, db.users) || (a.attendeeIds ?? []).includes(user.id);
}

export function canChangeActivity(db: Db, user: User, a: Pick<Activity, "orgId" | "contactId" | "assigneeId">): boolean {
  if (!hasPermission(user, "activities.create")) return false;
  if (a.contactId) {
    const c = db.contacts.find((x) => x.id === a.contactId);
    return !!c && c.status === "active" && canWriteRecord(user, c, db.users);
  }
  return canWriteRecord(user, { orgId: a.orgId, ownerId: a.assigneeId }, db.users);
}

export const visibleActivities = (db: Db, user: User) => db.activities.filter((a) => canSeeActivity(db, user, a));
