"use client";

import { useMemo } from "react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useNow } from "@/lib/hooks/use-now";
import { useCurrentUser } from "@/features/permissions";
import { canViewContact } from "@/features/contacts/lib/access";

/** Messages the viewer may see: those about contacts they can see. */
export function useMessagingData() {
  const db = useDbStore((s) => s.db);
  const user = useCurrentUser();
  const now = useNow();
  const contacts = useMemo(() => new Map(db.contacts.map((c) => [c.id, c])), [db.contacts]);
  const comms = useMemo(() => db.communications.filter((m) => m.orgId === user.orgId && (() => {
    const c = contacts.get(m.contactId);
    return !!c && canViewContact(db, user, c);
  })()), [db, user, contacts]);
  return { db, user, now, contacts, comms, tz: db.settings.timezone };
}
