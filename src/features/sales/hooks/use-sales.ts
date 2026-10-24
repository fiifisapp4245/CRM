"use client";

import { useMemo } from "react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useCurrentUser } from "@/features/permissions";
import { useNow } from "@/lib/hooks/use-now";
import { visibleDeals, visibleLeads, visibleQuotes } from "../lib/access";

export function useSales() {
  const db = useDbStore((s) => s.db);
  const user = useCurrentUser();
  const now = useNow();
  const deals = useMemo(() => visibleDeals(db, user), [db, user]);
  const leads = useMemo(() => visibleLeads(db, user), [db, user]);
  const quotes = useMemo(() => visibleQuotes(db, user), [db, user]);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]);
  const contacts = useMemo(() => new Map(db.contacts.map((c) => [c.id, c])), [db.contacts]);
  const accounts = useMemo(() => new Map(db.accounts.map((a) => [a.id, a])), [db.accounts]);
  return { db, user, now, deals, leads, quotes, users, contacts, accounts, pipelines: db.pipelines, taxes: db.taxes };
}
