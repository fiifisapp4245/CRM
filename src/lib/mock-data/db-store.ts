"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildSeed } from "./seed";
import { migrateDb } from "./migrate";
import { DB_VERSION, type Db } from "./db-types";

/**
 * Local prototype database (localStorage). This is the ONLY place app data
 * lives in the prototype. Components must not write to it directly — go
 * through the feature services (e.g. features/contacts/services), which
 * enforce permissions. Swap those services for API calls when a backend
 * exists; this store then becomes a client cache or disappears.
 */

interface DbStore {
  db: Db;
  hydrated: boolean;
  /** Internal: replace the whole db (services only). */
  commit: (next: Db) => void;
  reset: () => void;
}

export const STORAGE_KEY = "trovesuite-crm:prototype-db";

export const useDbStore = create<DbStore>()(
  persist(
    (set) => ({
      db: buildSeed(),
      hydrated: false,
      commit: (next) => set({ db: next }),
      reset: () => set({ db: buildSeed() }),
    }),
    {
      name: STORAGE_KEY,
      version: DB_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ db: s.db }),
      skipHydration: true,
      // v4 data is upgraded in place (customer records kept); anything older is reseeded.
      migrate: (persisted, version) => ({ db: migrateDb(persisted, version) }) as unknown as DbStore,
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          useDbStore.setState({ db: buildSeed(), hydrated: true });
          return;
        }
        useDbStore.setState({ hydrated: true });
      },
    },
  ),
);

export function getDb(): Db {
  return useDbStore.getState().db;
}

export function commitDb(next: Db) {
  useDbStore.getState().commit(next);
}

/** Simulated network latency so loading states are exercised. */
export function latency(ms = 180): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
