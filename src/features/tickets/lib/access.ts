import { canWriteRecord, hasPermission } from "@/lib/permissions";
import type { User } from "@/lib/types";
import type { Db } from "@/lib/mock-data/db-types";
import { canViewContact } from "@/features/contacts/lib/access";
import type { Ticket } from "../types";

/** A ticket is visible to anyone who can see its customer. */
export function canSeeTicket(db: Db, user: User, t: Ticket): boolean {
  const c = db.contacts.find((x) => x.id === t.contactId);
  return t.orgId === user.orgId && !!c && canViewContact(db, user, c);
}

/** Changing a ticket: tickets.manage plus owner scope (own/unassigned, team, or all). */
export function canWorkTicket(db: Db, user: User, t: Pick<Ticket, "orgId" | "ownerId">): boolean {
  return hasPermission(user, "tickets.manage") && canWriteRecord(user, { orgId: t.orgId, ownerId: t.ownerId }, db.users);
}

export const visibleTickets = (db: Db, user: User) => db.tickets.filter((t) => canSeeTicket(db, user, t));
