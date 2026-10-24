"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useDbStore } from "@/lib/mock-data/db-store";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import { useCurrentUser } from "@/features/permissions";
import { DEFAULT_ACCOUNT_FILTERS, type AccountFilters } from "../lib/filters";
import type { Account } from "../types";

/** Accounts in the viewer's organisation. Prototype rule: every CRM role can read all org accounts (unverified). */
export function useVisibleAccounts(): Account[] {
  const accounts = useDbStore((s) => s.db.accounts);
  const user = useCurrentUser();
  return useMemo(() => (hasPermission(user, "accounts.view") ? accounts.filter((a) => a.orgId === user.orgId) : []), [accounts, user]);
}

export function useAccountCaps(account: Account | undefined) {
  const user = useCurrentUser();
  const users = useDbStore((s) => s.db.users);
  const writable = !!account && canWriteRecord(user, account, users);
  return {
    edit: writable && hasPermission(user, "accounts.edit"),
    create: hasPermission(user, "accounts.create"),
    addContact: hasPermission(user, "contacts.create"),
    viewHistory: hasPermission(user, "contacts.viewAudit"),
  };
}

interface AccountsUi {
  filters: AccountFilters;
  pageIndex: number;
  pageSize: number;
  setFilters: (p: Partial<AccountFilters>) => void;
  reset: () => void;
  setPage: (i: number, size?: number) => void;
}

export const useAccountsUi = create<AccountsUi>()(
  persist(
    (set) => ({
      filters: DEFAULT_ACCOUNT_FILTERS,
      pageIndex: 0,
      pageSize: 25,
      setFilters: (p) => set((s) => ({ filters: { ...s.filters, ...p }, pageIndex: 0 })),
      reset: () => set({ filters: DEFAULT_ACCOUNT_FILTERS, pageIndex: 0 }),
      setPage: (pageIndex, pageSize) => set((s) => ({ pageIndex, pageSize: pageSize ?? s.pageSize })),
    }),
    { name: "trovesuite-crm:accounts-ui", storage: createJSONStorage(() => sessionStorage) },
  ),
);
