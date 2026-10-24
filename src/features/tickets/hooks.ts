"use client";

import { useMemo } from "react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useNow } from "@/lib/hooks/use-now";
import { eligibleOwners } from "@/lib/mock-data/users";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import { useCurrentUser } from "@/features/permissions";
import { visibleContacts } from "@/features/contacts/lib/access";
import { visibleTickets } from "./lib/access";

export function useTicketsData() {
  const db = useDbStore((s) => s.db);
  const user = useCurrentUser();
  const now = useNow();
  const tickets = useMemo(() => visibleTickets(db, user), [db, user]);
  const contacts = useMemo(() => new Map(db.contacts.map((c) => [c.id, c])), [db.contacts]);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]);
  const assignable = useMemo(() => (hasPermission(user, "tickets.manage") ? eligibleOwners(db.users, user.orgId).filter((u) => canWriteRecord(user, { orgId: user.orgId, ownerId: u.id }, db.users)) : []), [db.users, user]);
  const customerOptions = useMemo(() => visibleContacts(db, user).filter((c) => c.status === "active").sort((a, b) => a.displayName.localeCompare(b.displayName)), [db, user]);
  const categories = useMemo(() => [...new Set(["Delivery", "Billing", "Product fault", "Installation", "General enquiry", ...db.tickets.map((t) => t.category)])], [db.tickets]);
  return { db, user, now, tickets, contacts, users, assignable, customerOptions, categories, tz: db.settings.timezone };
}
