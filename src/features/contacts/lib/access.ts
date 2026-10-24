import { canActOnRecord, canReadRecord, canWriteRecord, hasPermission, type Permission } from "@/lib/permissions";
import type { User } from "@/lib/types";
import type { Db } from "@/lib/mock-data/db-types";
import type { Contact } from "../types";

/** Contacts the user may see. Merged records are never listed. */
export function visibleContacts(db: Db, user: User): Contact[] {
  return db.contacts.filter((c) => c.status !== "merged" && canReadRecord(user, c, db.users));
}

export function canViewContact(db: Db, user: User, contact: Contact): boolean {
  return contact.status !== "merged" && canReadRecord(user, contact, db.users);
}

export function canEditContact(db: Db, user: User, contact: Contact): boolean {
  return contact.status === "active" && canActOnRecord(user, "contacts.edit", contact, db.users);
}

export function canDoOnContact(db: Db, user: User, contact: Contact, permission: Permission): boolean {
  return canActOnRecord(user, permission, contact, db.users);
}

export function contactCapabilities(db: Db, user: User, contact: Contact) {
  const writable = canWriteRecord(user, contact, db.users);
  const active = contact.status === "active";
  return {
    edit: active && writable && hasPermission(user, "contacts.edit"),
    archive: active && writable && hasPermission(user, "contacts.archive"),
    restore: contact.status === "archived" && writable && hasPermission(user, "contacts.restore"),
    reassign: active && writable && hasPermission(user, "contacts.reassign"),
    logActivity: active && writable && hasPermission(user, "activities.create"),
    recordConsent: writable && hasPermission(user, "consent.record"),
    viewEvidence: hasPermission(user, "consent.viewEvidence"),
    viewAudit: hasPermission(user, "contacts.viewAudit"),
    sendMessage: active && writable && hasPermission(user, "messages.send"),
  };
}

export type ContactCapabilities = ReturnType<typeof contactCapabilities>;
