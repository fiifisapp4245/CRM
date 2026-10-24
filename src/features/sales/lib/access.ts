import { canReadSalesRecord, canWriteRecord, hasPermission } from "@/lib/permissions";
import type { User } from "@/lib/types";
import type { Db } from "@/lib/mock-data/db-types";
import type { Deal, Lead, Quote } from "../types";

export function visibleLeads(db: Db, user: User): Lead[] {
  return db.leads.filter((l) => l.orgId === user.orgId && canReadSalesRecord(user, l, db.users));
}

export function visibleDeals(db: Db, user: User): Deal[] {
  return db.deals.filter((d) => d.orgId === user.orgId && canReadSalesRecord(user, d, db.users));
}

export function visibleQuotes(db: Db, user: User): Quote[] {
  const deals = new Set(visibleDeals(db, user).map((d) => d.id));
  return db.quotes.filter((q) => q.orgId === user.orgId && deals.has(q.dealId));
}

export function leadCaps(db: Db, user: User, lead: Lead) {
  const write = hasPermission(user, "leads.manage") && canWriteRecord(user, lead, db.users);
  const open = lead.status !== "converted" && lead.status !== "disqualified";
  return { edit: write && lead.status !== "converted", changeStatus: write && open, convert: write && open, log: write && lead.status !== "converted", reopen: write && lead.status === "disqualified" };
}

export function dealCaps(db: Db, user: User, deal: Deal) {
  const write = hasPermission(user, "deals.manage") && canWriteRecord(user, deal, db.users);
  return {
    edit: write,
    move: write && deal.status === "open",
    close: write && deal.status === "open",
    reopen: write && deal.status !== "open",
    quote: write && hasPermission(user, "quotes.manage"),
    log: write && !!deal.contactId,
  };
}
