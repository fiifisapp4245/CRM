"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEMO_PERSONA_BY_ROLE } from "@/lib/mock-data/users";

/**
 * Prototype session: which demo user is "signed in". Real authentication is
 * out of scope; replace with the suite's identity provider when integrating.
 */
interface SessionStore {
  currentUserId: string;
  setCurrentUser: (id: string) => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      currentUserId: DEMO_PERSONA_BY_ROLE.crm_user,
      setCurrentUser: (id) => set({ currentUserId: id }),
    }),
    { name: "trovesuite-crm:session", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
