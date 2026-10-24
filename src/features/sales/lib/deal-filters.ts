import type { Contact } from "@/features/contacts/types";
import type { Account } from "@/features/accounts/types";
import { dealAttention, dealValue } from "./calc";
import type { Currency, Deal, Tax } from "../types";

export interface DealFilters {
  search: string;
  status: "open" | "won" | "lost" | "all";
  attention: "any" | "going_cold" | "past_close";
  ownerIds: string[];
  stageIds: string[];
  reasons: string[];
  currency: "all" | Currency;
  sort: "closing" | "biggest" | "newest" | "recent";
}

export const DEFAULT_DEAL_FILTERS: DealFilters = { search: "", status: "open", attention: "any", ownerIds: [], stageIds: [], reasons: [], currency: "all", sort: "closing" };

interface Lookups {
  contacts: Map<string, Contact>;
  accounts: Map<string, Account>;
  taxes: Tax[];
  now: number;
}

export function filterDeals(deals: Deal[], f: DealFilters, { contacts, accounts, taxes, now }: Lookups): Deal[] {
  const q = f.search.trim().toLowerCase();
  const rows = deals.filter((d) => {
    if (f.status !== "all" && d.status !== f.status) return false;
    if (f.attention !== "any" && dealAttention(d, now).kind !== f.attention) return false;
    if (f.ownerIds.length && !f.ownerIds.includes(d.ownerId ?? "unassigned")) return false;
    if (f.stageIds.length && !f.stageIds.includes(d.stageId)) return false;
    if (f.reasons.length && !f.reasons.includes((d.status === "won" ? d.wonReason : d.lostReason) ?? "")) return false;
    if (f.currency !== "all" && d.currency !== f.currency) return false;
    if (q) {
      const hay = [d.title, d.contactId && contacts.get(d.contactId)?.displayName, d.accountId && accounts.get(d.accountId)?.name].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const by: Record<DealFilters["sort"], (a: Deal, b: Deal) => number> = {
    // Open deals close on expectedClose; closed ones on closedAt — show the most recent outcome first.
    closing: (a, b) => (a.status === "open" && b.status === "open" ? a.expectedClose.localeCompare(b.expectedClose) : (b.closedAt ?? b.expectedClose).localeCompare(a.closedAt ?? a.expectedClose)),
    biggest: (a, b) => dealValue(b, taxes) - dealValue(a, taxes),
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  };
  return rows.sort(by[f.sort]);
}
