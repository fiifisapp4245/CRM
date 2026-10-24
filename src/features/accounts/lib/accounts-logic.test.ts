import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/mock-data/seed";
import { USERS } from "@/lib/mock-data/users";
import { parseCsv } from "@/lib/utils/csv";
import { readFileSync } from "node:fs";
import { ancestors, structureRole, wouldCreateCycle } from "./hierarchy";
import { applyAccountImportPlan, autoMapAccountColumns, planAccountImport } from "./import";
import { DEFAULT_ACCOUNT_FILTERS, filterAccounts } from "./filters";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const ama = USERS.find((u) => u.id === "u_ama")!;
let n = 0;
const newId = (p: string) => `${p}_t${++n}`;

describe("account hierarchy", () => {
  const db = buildSeed(NOW);
  const accounts = db.accounts.filter((a) => a.orgId === "org_adinkra");
  it("identifies head offices, branches and independents", () => {
    const by = (id: string) => accounts.find((a) => a.id === id)!;
    expect(structureRole(accounts, by("acc_coastal_pharm"))).toBe("head_office");
    expect(structureRole(accounts, by("acc_coastal_kumasi"))).toBe("branch");
    expect(structureRole(accounts, by("acc_osu_bakery"))).toBe("standalone");
    expect(ancestors(accounts, "acc_coastal_kumasi").map((a) => a.id)).toEqual(["acc_coastal_pharm"]);
  });
  it("prevents circular parents", () => {
    expect(wouldCreateCycle(accounts, "acc_coastal_pharm", "acc_coastal_kumasi")).toBe(true);
    expect(wouldCreateCycle(accounts, "acc_coastal_pharm", "acc_coastal_pharm")).toBe(true);
    expect(wouldCreateCycle(accounts, "acc_osu_bakery", "acc_coastal_pharm")).toBe(false);
  });
  it("filters by structure and type", () => {
    const heads = filterAccounts(accounts, { ...DEFAULT_ACCOUNT_FILTERS, structure: ["head_office"] });
    expect(heads.map((a) => a.id).sort()).toEqual(["acc_asante_log", "acc_brightpath", "acc_coastal_pharm"]);
    expect(filterAccounts(accounts, { ...DEFAULT_ACCOUNT_FILTERS, types: ["supplier"] }).every((a) => a.type === "supplier")).toBe(true);
  });
});

describe("account import", () => {
  const db = buildSeed(NOW);
  const table = parseCsv(readFileSync("public/samples/accounts-sample.csv", "utf8"));
  const mapping = autoMapAccountColumns(table[0]);
  it("maps the standard columns", () => {
    expect(mapping.slice(0, 4)).toEqual(["name", "accountNumber", "type", "parent"]);
  });
  const plan = planAccountImport(table, mapping, db, ama, "update");
  const row = (name: string) => plan.rows.find((r) => r.displayName === name)!;
  it("matches by account number first, then by name", () => {
    expect(row("Coastal Pharmacy Group").outcome).toBe("update");
    expect(row("Coastal Pharmacy Group").matchedAccountId).toBe("acc_coastal_pharm");
    expect(row("Labadi Events").outcome).toBe("update"); // name match, no number
  });
  it("flags names shared by several accounts instead of guessing", () => {
    expect(row("Sunrise Pharmacy").outcome).toBe("error");
  });
  it("resolves parents: existing, in-file, and to-be-created", () => {
    expect(row("Coastal Pharmacy – Cape Coast").parent).toMatchObject({ kind: "existing", id: "acc_coastal_pharm" });
    expect(row("Volta Lake Fisheries – Ho Depot").parent).toMatchObject({ kind: "in_file" });
    expect(plan.parentsToCreate).toEqual(["Northern Agro Traders"]);
  });
  it("rejects invalid numbers", () => {
    expect(row("Bad Revenue Ltd").outcome).toBe("error");
  });
  it("never crosses into another organisation (same account number elsewhere)", () => {
    expect(row("Coastal Pharmacy Group").matchedAccountId).not.toBe("acc_volta_coop");
  });
  it("applies: creates parents, links branches, and never erases populated values", () => {
    const res = applyAccountImportPlan(db, ama, plan, new Date(NOW).toISOString(), newId);
    const accts = res.db.accounts;
    const northern = accts.find((a) => a.name === "Northern Agro Traders")!;
    expect(accts.find((a) => a.name === "Northern Agro Traders – Bolgatanga")!.parentId).toBe(northern.id);
    const ho = accts.find((a) => a.name === "Volta Lake Fisheries – Ho Depot")!;
    expect(ho.parentId).toBe(accts.find((a) => a.name === "Volta Lake Fisheries")!.id);
    const coastal = accts.find((a) => a.id === "acc_coastal_pharm")!;
    expect(coastal.employees).toBe(450); // updated from file
    expect(coastal.phone).toBe("+233 30 255 0100"); // empty cell did not erase
    expect(coastal.ownerId).toBe("u_kwame");
  });
});
