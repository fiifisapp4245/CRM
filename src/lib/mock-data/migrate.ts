import { createId } from "@/lib/utils/id";
import type { Db } from "./db-types";
import { DB_VERSION } from "./db-types";
import { buildSeed } from "./seed";
import { buildSalesSeed } from "./seed-sales";
import { buildEngagementSeed } from "./seed-engagement";

/**
 * v4 → v5 adds the Sales module. Everything people may have changed —
 * contacts, accounts, segments, consent, activities, audit, imports — is
 * kept. v4 deals were read-only display stubs, so they are replaced by real
 * deals, and leads/products/quotes/targets are added, all built against the
 * contacts and accounts already in this browser.
 */
type V5Db = Omit<Db, "communications" | "templates" | "campaigns" | "savedAnswers" | "folders" | "settings" | "tickets" | "documents"> & { tickets: unknown[]; documents: unknown[] };

export function upgradeV4toV5(old: Omit<V5Db, "leads" | "pipelines" | "taxes" | "products" | "quotes" | "targets">): V5Db {
  const now = Date.now();
  const iso = (offset: number) => new Date(now + offset).toISOString();
  const orgContacts = old.contacts.filter((c) => c.orgId === "org_adinkra");
  const sales = buildSalesSeed({ now, iso, contacts: orgContacts, accounts: old.accounts, nextId: createId });
  return {
    ...old,
    version: 5,
    deals: sales.deals,
    leads: sales.leads,
    pipelines: sales.pipelines,
    taxes: sales.taxes,
    products: sales.products,
    quotes: sales.quotes,
    targets: sales.targets,
    activities: [...old.activities, ...sales.activities],
    audit: [...old.audit.filter((e) => e.entityType !== "deal"), ...sales.audit],
  };
}

/**
 * v5 → v6 adds Engagement, Service and Files. Everything from earlier phases
 * is kept (contacts, accounts, sales, activities, consent, audit, imports).
 * v5 tickets and documents were read-only display stubs, so they are replaced
 * by the real models, built against the records already in this browser.
 */
export function upgradeV5toV6(old: V5Db): Db {
  const orgContacts = old.contacts.filter((c) => c.orgId === "org_adinkra");
  const eng = buildEngagementSeed({ now: Date.now(), contacts: orgContacts, accounts: old.accounts, deals: old.deals, activities: old.activities, consents: old.consents, segments: old.segments, nextId: createId });
  return {
    ...old,
    version: DB_VERSION,
    activities: eng.activities,
    communications: eng.communications,
    templates: eng.templates,
    campaigns: eng.campaigns,
    tickets: eng.tickets,
    savedAnswers: eng.savedAnswers,
    folders: eng.folders,
    documents: eng.documents,
    settings: eng.settings,
    audit: [...old.audit.filter((e) => e.entityType !== "ticket"), ...eng.audit],
  };
}

export function migrateDb(persisted: unknown, version: number): Db {
  const db = (persisted as { db?: V5Db } | undefined)?.db;
  if (version === 4 && db?.contacts) return upgradeV5toV6(upgradeV4toV5(db));
  if (version === 5 && db?.contacts) return upgradeV5toV6(db);
  // v6 → v7: every module is open in the prototype; nothing else changes.
  if (version === 6 && db?.contacts) return { ...(db as unknown as Db), version: DB_VERSION, settings: { ...(db as unknown as Db).settings, plan: "premium" } };
  return buildSeed();
}
