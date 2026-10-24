"use client";

import { useMemo } from "react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useNow } from "@/lib/hooks/use-now";
import { eligibleOwners } from "@/lib/mock-data/users";
import { canWriteRecord } from "@/lib/permissions";
import { useCurrentUser } from "@/features/permissions";
import { visibleContacts } from "@/features/contacts/lib/access";
import { visibleDeals } from "@/features/sales/lib/access";
import { visibleActivities } from "../lib/access";

/** Shared lookups for Tasks & Calls and Calendar. */
export function useActivitiesData() {
  const db = useDbStore((s) => s.db);
  const user = useCurrentUser();
  const now = useNow();
  const activities = useMemo(() => visibleActivities(db, user), [db, user]);
  const contacts = useMemo(() => visibleContacts(db, user).filter((c) => c.status === "active").sort((a, b) => a.displayName.localeCompare(b.displayName)), [db, user]);
  const contactMap = useMemo(() => new Map(db.contacts.map((c) => [c.id, c])), [db.contacts]);
  const deals = useMemo(() => visibleDeals(db, user), [db, user]);
  const dealMap = useMemo(() => new Map(db.deals.map((d) => [d.id, d])), [db.deals]);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]);
  const accountName = (id?: string | null) => (id ? db.accounts.find((a) => a.id === id)?.name : undefined);
  /** People work can be assigned to (write scope). */
  const assignable = useMemo(() => eligibleOwners(db.users, user.orgId).filter((u) => canWriteRecord(user, { orgId: user.orgId, ownerId: u.id }, db.users)), [db.users, user]);
  /** People shown in "Whose" filters and as attendees. */
  const people = useMemo(() => eligibleOwners(db.users, user.orgId), [db.users, user.orgId]);
  return { db, user, now, activities, contacts, contactMap, deals, dealMap, users, accountName, assignable, people, tz: db.settings.timezone, settings: db.settings };
}
