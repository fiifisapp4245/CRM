import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/mock-data/seed";
import { parseCsv } from "@/lib/utils/csv";
import { applyDealImportPlan, autoMapDealColumns, parseDate, planDealImport } from "./deal-import";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const table = parseCsv(readFileSync("public/samples/deals-sample.csv", "utf8"));
const db = buildSeed(NOW);
const actor = db.users.find((u) => u.id === "u_ama")!;
const mapping = autoMapDealColumns(table[0]);
let n = 0;
const newId = (p: string) => `${p}_t${++n}`;
const audit = (entityType: never, id: string, action: never) => ({ id: newId("au"), orgId: actor.orgId, entityType, entityId: id, action, actorId: actor.id, at: "2026-10-21T12:00:00Z" });

const outcome = (plan: ReturnType<typeof planDealImport>, title: string, nth = 0) => plan.rows.filter((r) => r.values.title === title)[nth];

describe("deal import", () => {
  it("parses ISO and day-first dates and rejects impossible ones", () => {
    expect(parseDate("2026-12-15")).toBe("2026-12-15");
    expect(parseDate("15/12/2026")).toBe("2026-12-15");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("next week")).toBeNull();
  });

  it("maps the sample file and validates every row without writing", () => {
    const plan = planDealImport(table, mapping, db, actor, "skip", { createMissing: false, today: "2026-10-21" });
    expect(plan.fatal).toBeUndefined();
    expect(outcome(plan, "Pharmacy back-office shelving").outcome).toBe("create");
    expect(outcome(plan, "Pharmacy back-office shelving").contact).toMatchObject({ kind: "existing", id: "ct_abigail" });
    expect(outcome(plan, "Pharmacy back-office shelving").account).toMatchObject({ kind: "existing", id: "acc_coastal_pharm" });
    expect(outcome(plan, "Clinic waiting-room seating").outcome).toBe("error"); // new customer, creation not allowed
    expect(outcome(plan, "Staff canteen tables").outcome).toBe("error"); // lost without reason
    expect(outcome(plan, "Boardroom chairs").outcome).toBe("error"); // future close
    expect(outcome(plan, "Reception sofas").outcome).toBe("error"); // unknown stage
    expect(outcome(plan, "Bakery staff seating top-up").outcome).toBe("error"); // ambiguous email
    expect(outcome(plan, "Branch seating roll-out").outcome).toBe("skip"); // existing deal
    expect(outcome(plan, "Warehouse racking", 1).outcome).toBe("skip"); // duplicate in file
    expect(outcome(plan, "Textile showroom lighting").deal?.currency).toBe("USD");
    expect(plan.newContacts).toHaveLength(0);
  });

  it("creates related records only when allowed, and lists them first", () => {
    const plan = planDealImport(table, mapping, db, actor, "skip", { createMissing: true, today: "2026-10-21" });
    expect(outcome(plan, "Clinic waiting-room seating").outcome).toBe("create");
    expect(plan.newContacts.map((c) => c.name)).toEqual(["Mercy Boateng"]);
    expect(plan.newAccounts.map((a) => a.name)).toEqual(["Ridge Family Clinic"]);
    const applied = applyDealImportPlan(db, actor, plan, "2026-10-21T12:00:00Z", newId, audit as never);
    expect(applied.created).toBe(plan.counts.create);
    expect(applied.contactsCreated).toBe(1);
    expect(applied.accountsCreated).toBe(1);
    const clinic = applied.db.deals.find((d) => d.title === "Clinic waiting-room seating")!;
    expect(clinic.contactId).toBe(applied.db.contacts.find((c) => c.displayName === "Mercy Boateng")!.id);
    expect(clinic.probability).toBe(60);
    const won = applied.db.deals.find((d) => d.title === "Warehouse racking" && d.createdAt.startsWith("2026-10-21"))!;
    expect(won).toMatchObject({ status: "won", wonReason: "Fast delivery", stageId: "st_won" });
    expect(won.closedAt?.slice(0, 10)).toBe("2026-09-18");
  });

  it("updates a matched open deal in update mode, keeping product-based values", () => {
    const plan = planDealImport(table, mapping, db, actor, "update", { createMissing: false, today: "2026-10-21" });
    const row = outcome(plan, "Branch seating roll-out");
    expect(row.outcome).toBe("update");
    const before = db.deals.find((d) => d.id === row.matchedDealId)!;
    const applied = applyDealImportPlan(db, actor, plan, "2026-10-21T12:00:00Z", newId, audit as never);
    const after = applied.db.deals.find((d) => d.id === row.matchedDealId)!;
    expect(after.valuation).toBe("products");
    expect(after.lineItems).toEqual(before.lineItems);
    expect(after.expectedClose).toBe("2026-11-20");
  });
});
