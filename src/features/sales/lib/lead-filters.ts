import type { Lead, LeadSource, LeadStatus, Rating } from "../types";
import { leadScore } from "./lead-score";

export interface LeadFilters {
  search: string;
  statuses: LeadStatus[];
  ownerIds: string[]; // "unassigned" allowed
  sources: LeadSource[];
  ratings: Rating[];
  sort: "best" | "newest" | "recent" | "name";
}

export const OPEN_LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "qualified"];
export const DEFAULT_LEAD_FILTERS: LeadFilters = { search: "", statuses: OPEN_LEAD_STATUSES, ownerIds: [], sources: [], ratings: [], sort: "best" };

export function filterLeads(leads: Lead[], f: LeadFilters, now: number): Lead[] {
  const q = f.search.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const out = leads.filter((l) => {
    if (f.statuses.length && !f.statuses.includes(l.status)) return false;
    if (f.ownerIds.length && !f.ownerIds.includes(l.ownerId ?? "unassigned")) return false;
    if (f.sources.length && !f.sources.includes(l.source)) return false;
    if (f.ratings.length && (!l.rating || !f.ratings.includes(l.rating))) return false;
    if (q) {
      const hay = [l.name, l.company, l.email, l.city, l.need, l.jobTitle].filter(Boolean).join(" ").toLowerCase();
      const phoneHit = digits.length >= 4 && (l.phone ?? "").replace(/\D/g, "").includes(digits.replace(/^0/, ""));
      if (!hay.includes(q) && !phoneHit) return false;
    }
    return true;
  });
  const score = new Map(out.map((l) => [l.id, leadScore(l, now).score]));
  const sorters: Record<LeadFilters["sort"], (a: Lead, b: Lead) => number> = {
    best: (a, b) => score.get(b.id)! - score.get(a.id)! || b.createdAt.localeCompare(a.createdAt),
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return out.sort(sorters[f.sort]);
}
