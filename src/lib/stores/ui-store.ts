"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface UiStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiStore>()(
  persist((set) => ({ sidebarCollapsed: false, toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })) }), {
    name: "trovesuite-crm:ui",
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  }),
);
