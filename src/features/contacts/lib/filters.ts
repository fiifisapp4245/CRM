import { normalizeEmail, normalizePhone } from "@/lib/utils/normalize";
import type { User } from "@/lib/types";
import type { AccountRef } from "@/lib/types/related";
import type { Contact, ContactFilters, SavedView } from "../types";

export const UNASSIGNED = "unassigned";
const RECENT_DAYS = 14;

export const DEFAULT_FILTERS: ContactFilters = {
  search: "",
  ownerIds: [],
  sources: [],
  statuses: ["active"],
  tags: [],
  sort: "recent",
};

export function builtInViews(user: User): SavedView[] {
  return [
    { id: "view_all", name: "All contacts", ownerUserId: null, builtIn: "all", filters: { ...DEFAULT_FILTERS } },
    { id: "view_mine", name: "My contacts", ownerUserId: null, builtIn: "mine", filters: { ...DEFAULT_FILTERS, ownerIds: [user.id] } },
    { id: "view_unassigned", name: "Unassigned", ownerUserId: null, builtIn: "unassigned", filters: { ...DEFAULT_FILTERS, ownerIds: [UNASSIGNED] } },
    { id: "view_recent", name: "Recently added", ownerUserId: null, builtIn: "recent", filters: { ...DEFAULT_FILTERS, sort: "newest" } },
    { id: "view_archived", name: "Archived", ownerUserId: null, builtIn: "archived", filters: { ...DEFAULT_FILTERS, statuses: ["archived"] } },
  ];
}

export function primaryMethod(contact: Contact, kind: "phone" | "email" | "whatsapp") {
  const ofKind = contact.methods.filter((m) => m.kind === kind);
  return ofKind.find((m) => m.isPrimary) ?? ofKind[0];
}

interface FilterContext {
  accounts: AccountRef[];
  now?: number;
  recentOnly?: boolean;
}

export function filterContacts(contacts: Contact[], filters: ContactFilters, ctx: FilterContext): Contact[] {
  const q = filters.search.trim().toLowerCase();
  const qPhone = q.replace(/\D/g, "").length >= 4 ? normalizePhone(q).slice(-7) : "";
  const accountName = new Map(ctx.accounts.map((a) => [a.id, a.name.toLowerCase()]));
  const recentCutoff = (ctx.now ?? Date.now()) - RECENT_DAYS * 86_400_000;

  const result = contacts.filter((c) => {
    if (filters.statuses.length && !filters.statuses.includes(c.status as "active" | "archived")) return false;
    if (filters.sources.length && !filters.sources.includes(c.source)) return false;
    if (filters.ownerIds.length) {
      const key = c.ownerId ?? UNASSIGNED;
      if (!filters.ownerIds.includes(key)) return false;
    }
    if (filters.tags.length && !filters.tags.some((t) => c.tags.includes(t))) return false;
    if (ctx.recentOnly && new Date(c.createdAt).getTime() < recentCutoff) return false;
    if (q) {
      const haystack = [c.displayName, c.firstName, c.lastName, c.jobTitle, c.accountId ? accountName.get(c.accountId) : "", c.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (haystack.includes(q)) return true;
      if (c.methods.some((m) => m.kind === "email" && normalizeEmail(m.value).includes(q))) return true;
      if (qPhone && c.methods.some((m) => m.kind !== "email" && normalizePhone(m.value).includes(qPhone))) return true;
      return false;
    }
    return true;
  });

  const sorters: Record<ContactFilters["sort"], (a: Contact, b: Contact) => number> = {
    recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    name: (a, b) => a.displayName.localeCompare(b.displayName),
  };
  return result.sort(sorters[filters.sort]);
}

export function countActiveFilters(f: ContactFilters, base: ContactFilters = DEFAULT_FILTERS): number {
  let n = 0;
  if (f.ownerIds.join() !== base.ownerIds.join()) n += f.ownerIds.length || 1;
  n += f.sources.length + f.tags.length;
  if (f.statuses.join() !== base.statuses.join()) n++;
  return n;
}

export function allTags(contacts: Contact[]): string[] {
  return [...new Set(contacts.flatMap((c) => c.tags))].sort();
}
