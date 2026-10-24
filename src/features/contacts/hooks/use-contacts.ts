"use client";

import { useMemo } from "react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { eligibleOwners } from "@/lib/mock-data/users";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import { useCurrentUser } from "@/features/permissions";
import { canViewContact, contactCapabilities, visibleContacts } from "../lib/access";

export function useDb() {
  return useDbStore((s) => s.db);
}

export function useVisibleContacts() {
  const db = useDb();
  const user = useCurrentUser();
  return useMemo(() => visibleContacts(db, user), [db, user]);
}

export type ContactLookup =
  | { state: "not_found" }
  | { state: "forbidden" }
  | { state: "merged"; mergedIntoId: string }
  | { state: "ok"; contact: import("../types").Contact; caps: ReturnType<typeof contactCapabilities> };

export function useContact(id: string): ContactLookup {
  const db = useDb();
  const user = useCurrentUser();
  return useMemo(() => {
    const contact = db.contacts.find((c) => c.id === id);
    if (!contact || contact.orgId !== user.orgId) return { state: "not_found" };
    if (contact.status === "merged" && contact.mergedIntoId) return { state: "merged", mergedIntoId: contact.mergedIntoId };
    if (!canViewContact(db, user, contact)) return { state: "forbidden" };
    return { state: "ok", contact, caps: contactCapabilities(db, user, contact) };
  }, [db, user, id]);
}

/** Owners the current user is allowed to assign records to. */
export function useAssignableOwners() {
  const db = useDb();
  const user = useCurrentUser();
  return useMemo(
    () => eligibleOwners(db.users, user.orgId).filter((u) => canWriteRecord(user, { orgId: user.orgId, ownerId: u.id }, db.users)),
    [db.users, user],
  );
}

/** Owners shown in filters: eligible owners whose records the user can see. */
export function useFilterOwners() {
  const db = useDb();
  const user = useCurrentUser();
  return useMemo(() => {
    const visibleOwnerIds = new Set(visibleContacts(db, user).map((c) => c.ownerId));
    return db.users.filter((u) => u.orgId === user.orgId && !u.isTestAccount && !u.duplicateOfUserId && visibleOwnerIds.has(u.id));
  }, [db, user]);
}

export function useUserLookup() {
  const users = useDbStore((s) => s.db.users);
  return useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
}

export function useAccountLookup() {
  const accounts = useDbStore((s) => s.db.accounts);
  return useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
}

export function useCan() {
  const user = useCurrentUser();
  return (p: Parameters<typeof hasPermission>[1]) => hasPermission(user, p);
}
