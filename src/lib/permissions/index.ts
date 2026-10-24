import type { User } from "@/lib/types";
import { ROLE_DEFINITIONS, type Permission, type RecordScope } from "./config";

export * from "./config";

export function hasPermission(user: User | null | undefined, permission: Permission): boolean {
  if (!user || user.status !== "active") return false;
  return ROLE_DEFINITIONS[user.role].permissions.includes(permission);
}

/** Minimal shape needed to evaluate record-level access. */
export interface OwnedRecord {
  orgId: string;
  ownerId: string | null;
}

function inScope(user: User, record: OwnedRecord, scope: RecordScope, teamIds: Set<string>): boolean {
  if (record.orgId !== user.orgId) return false; // never cross organisation boundaries
  switch (scope) {
    case "all":
      return true;
    case "team":
      return record.ownerId === null || teamIds.has(record.ownerId);
    case "own":
      return record.ownerId === null || record.ownerId === user.id;
    case "none":
      return false;
  }
}

/** IDs whose records count as "team" for a user: themself plus direct reports. */
export function teamMemberIds(user: User, allUsers: User[]): Set<string> {
  const ids = new Set<string>([user.id]);
  for (const u of allUsers) if (u.managerId === user.id) ids.add(u.id);
  return ids;
}

export function canReadRecord(user: User | null, record: OwnedRecord, allUsers: User[]): boolean {
  if (!user || !hasPermission(user, "contacts.view")) return false;
  return inScope(user, record, ROLE_DEFINITIONS[user.role].readScope, teamMemberIds(user, allUsers));
}

export function canWriteRecord(user: User | null, record: OwnedRecord, allUsers: User[]): boolean {
  if (!user) return false;
  return inScope(user, record, ROLE_DEFINITIONS[user.role].writeScope, teamMemberIds(user, allUsers));
}

/** Combined check: action permission AND record-level write scope. */
export function canActOnRecord(
  user: User | null,
  permission: Permission,
  record: OwnedRecord,
  allUsers: User[],
): boolean {
  return hasPermission(user, permission) && canWriteRecord(user, record, allUsers);
}

/**
 * Sales records (leads, deals and the quotes that hang off deals) use the same
 * owner-based scopes as contacts, gated by `sales.view` instead of `contacts.view`.
 */
export function canReadSalesRecord(user: User | null, record: OwnedRecord, allUsers: User[]): boolean {
  if (!user || !hasPermission(user, "sales.view")) return false;
  return inScope(user, record, ROLE_DEFINITIONS[user.role].readScope, teamMemberIds(user, allUsers));
}
