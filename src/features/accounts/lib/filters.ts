import type { Account, AccountRating, AccountSize, AccountType } from "../types";
import { structureRole, type StructureRole } from "./hierarchy";

export interface AccountFilters {
  search: string;
  ownerIds: string[]; // "unassigned" allowed
  types: AccountType[];
  ratings: AccountRating[];
  sizes: AccountSize[];
  structure: StructureRole[];
  sort: "name" | "recent" | "newest";
}

export const DEFAULT_ACCOUNT_FILTERS: AccountFilters = { search: "", ownerIds: [], types: [], ratings: [], sizes: [], structure: [], sort: "name" };

export function filterAccounts(accounts: Account[], f: AccountFilters): Account[] {
  const q = f.search.trim().toLowerCase();
  const out = accounts.filter((a) => {
    if (f.ownerIds.length && !f.ownerIds.includes(a.ownerId ?? "unassigned")) return false;
    if (f.types.length && !f.types.includes(a.type)) return false;
    if (f.ratings.length && (!a.rating || !f.ratings.includes(a.rating))) return false;
    if (f.sizes.length && (!a.size || !f.sizes.includes(a.size))) return false;
    if (f.structure.length && !f.structure.includes(structureRole(accounts, a))) return false;
    if (q) {
      const hay = [a.name, a.accountNumber, a.industry, a.email, a.website, a.billingAddress?.city, a.phone].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sorters: Record<AccountFilters["sort"], (a: Account, b: Account) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  };
  return out.sort(sorters[f.sort]);
}
