"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_FILTERS } from "../lib/filters";
import type { ContactFilters } from "../types";

/** Contacts list state that survives navigation and refresh (per browser tab session). */
interface ContactsUiStore {
  activeViewId: string;
  filters: ContactFilters;
  pageIndex: number;
  pageSize: number;
  setView: (id: string, filters: ContactFilters) => void;
  setFilters: (patch: Partial<ContactFilters>) => void;
  setPage: (pageIndex: number, pageSize?: number) => void;
}

export const useContactsUi = create<ContactsUiStore>()(
  persist(
    (set) => ({
      activeViewId: "view_all",
      filters: DEFAULT_FILTERS,
      pageIndex: 0,
      pageSize: 25,
      setView: (id, filters) => set({ activeViewId: id, filters: { ...filters }, pageIndex: 0 }),
      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch }, pageIndex: 0 })),
      setPage: (pageIndex, pageSize) => set((s) => ({ pageIndex, pageSize: pageSize ?? s.pageSize })),
    }),
    { name: "trovesuite-crm:contacts-ui", storage: createJSONStorage(() => sessionStorage) },
  ),
);
