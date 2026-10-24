import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/mock-data/seed";
import { upgradeV4toV5 } from "@/lib/mock-data/migrate";
import { averageDaysToClose, customerPrice, dealAttention, dealProbability, dealValue, lineResult, lineTotals, weightedValue, winRate } from "./calc";
import { leadScore } from "./lead-score";
import { addMonths, monthsBetween, summarise } from "./forecast";
import type { Deal, LineItem, Tax } from "../types";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const taxes: Tax[] = [
  { id: "vat", name: "VAT", rate: 2 },
  { id: "cov", name: "COVID levy", rate: 4 },
];
const li = (o: Partial<LineItem>): LineItem => ({ id: "x", productId: null, name: "Item", quantity: 1, unitPrice: 100, discountPct: 0, taxId: null, taxInclusive: false, ...o });

describe("line items", () => {
  it("applies discount before tax", () => {
    const r = lineResult(li({ quantity: 3, unitPrice: 1000, discountPct: 10, taxId: "vat" }), taxes);
    expect(r).toEqual({ gross: 3000, discount: 300, net: 2700, tax: 54, total: 2754 });
  });
  it("backs tax out of tax-inclusive prices", () => {
    const r = lineResult(li({ unitPrice: 5600, taxId: "vat", taxInclusive: true }), taxes);
    expect(r.total).toBeCloseTo(5600, 2);
    expect(r.tax).toBeCloseTo(109.8, 2);
  });
  it("treats zero/negative quantities and out-of-range discounts safely", () => {
    expect(lineResult(li({ quantity: 0 }), taxes).total).toBe(0);
    expect(lineResult(li({ quantity: -2 }), taxes).total).toBe(0);
    expect(lineResult(li({ discountPct: 150 }), taxes).total).toBe(0);
    expect(lineResult(li({ discountPct: -5 }), taxes).total).toBe(100);
  });
  it("rounds to two decimals and totals by tax", () => {
    const t = lineTotals([li({ quantity: 3, unitPrice: 33.333, taxId: "vat" }), li({ unitPrice: 10, taxId: "cov" })], taxes);
    expect(t.subtotal).toBe(110);
    expect(t.taxByName.map((x) => x.name).sort()).toEqual(["COVID levy", "VAT"]);
    expect(t.total).toBe(Math.round((t.net + t.tax) * 100) / 100);
  });
  it("computes the customer-paid price", () => {
    expect(customerPrice(1850, "vat", false, taxes)).toBe(1887);
    expect(customerPrice(5600, "vat", true, taxes)).toBe(5600);
  });
});

describe("deals and forecast maths", () => {
  const db = buildSeed(NOW);
  const branch = db.deals.find((d) => d.id === "dl_coastal_branch")!;
  it("values product-based deals from their line items", () => {
    expect(dealValue(branch, db.taxes)).toBe(lineTotals(branch.lineItems, db.taxes).total);
  });
  it("uses explicit probability, else the stage default; closed deals are 100/0", () => {
    expect(dealProbability(branch, db.pipelines)).toBe(50);
    expect(dealProbability({ ...branch, probability: 80 }, db.pipelines)).toBe(80);
    expect(dealProbability({ ...branch, status: "won" }, db.pipelines)).toBe(100);
  });
  it("weights only open deals: GHS 10,000 at 50% = GHS 5,000", () => {
    const d = { ...branch, valuation: "manual", amount: 10000, lineItems: [] } as Deal;
    expect(weightedValue(d, db.pipelines, db.taxes)).toBe(5000);
    expect(weightedValue({ ...d, status: "won" }, db.pipelines, db.taxes)).toBe(0);
  });
  it("flags going-cold and past-close deals", () => {
    expect(dealAttention(db.deals.find((d) => d.id === "dl_akwaaba_showroom")!, NOW).kind).toBe("going_cold");
    expect(dealAttention(db.deals.find((d) => d.id === "dl_tema_fitout")!, NOW).kind).toBe("past_close");
    expect(dealAttention(branch, NOW).kind).toBe("healthy");
  });
  it("returns null win rate and days-to-close when there is no data", () => {
    expect(winRate([])).toBeNull();
    expect(averageDaysToClose([branch])).toBeNull();
    expect(winRate(db.deals)).not.toBeNull();
  });
});

describe("seed integrity", () => {
  const db = buildSeed(NOW);
  it("every deal references real customers; every quote a real deal", () => {
    const contacts = new Set(db.contacts.map((c) => c.id));
    const accounts = new Set(db.accounts.map((a) => a.id));
    expect(db.deals.every((d) => (!d.contactId || contacts.has(d.contactId)) && (!d.accountId || accounts.has(d.accountId)))).toBe(true);
    const deals = new Set(db.deals.map((d) => d.id));
    expect(db.quotes.every((q) => deals.has(q.dealId))).toBe(true);
    expect(new Set(db.quotes.map((q) => q.status))).toEqual(new Set(["draft", "sent", "accepted", "declined", "expired", "paid"]));
    expect(db.deals.some((d) => d.currency === "USD")).toBe(true);
  });
  it("upgrades v4 data without losing customer records", () => {
    const v4 = { ...db, version: 4 } as Parameters<typeof upgradeV4toV5>[0];
    const edited = { ...v4, contacts: v4.contacts.map((c) => (c.id === "ct_kwesi" ? { ...c, jobTitle: "Edited by user" } : c)) };
    const v5 = upgradeV4toV5(edited);
    expect(v5.contacts.find((c) => c.id === "ct_kwesi")!.jobTitle).toBe("Edited by user");
    expect(v5.deals.length).toBeGreaterThan(0);
    expect(v5.products.length).toBeGreaterThan(0);
  });
});

describe("prototype lead score", () => {
  it("is transparent and bounded", () => {
    const r = leadScore({ rating: "hot", email: "a@b.example", phone: "024 555 1111", estimatedValue: 60000, currency: "GHS", source: "referral", status: "qualified", company: "X", need: "Y" }, NOW);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.factors.reduce((a, f) => a + f.points, 0)).toBeGreaterThanOrEqual(r.score);
    expect(leadScore({ source: "other", status: "new", currency: "GHS" }, NOW).score).toBe(0);
  });
});

describe("forecast", () => {
  const pipelines = [{ id: "p", name: "P", stages: [{ id: "a", name: "A", probability: 50, kind: "open" as const }, { id: "w", name: "Won", probability: 100, kind: "won" as const }, { id: "l", name: "Lost", probability: 0, kind: "lost" as const }] }] as never;
  const base = { orgId: "o", pipelineId: "p", contactId: null, accountId: null, ownerId: "u1", valuation: "manual" as const, lineItems: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", createdBy: "u1", stageChangedAt: "2026-01-01T00:00:00Z" };
  const deals = [
    { ...base, id: "1", title: "won ghs", stageId: "w", status: "won", currency: "GHS", amount: 1000, expectedClose: "2026-03-10", closedAt: "2026-03-12T10:00:00Z" },
    { ...base, id: "2", title: "open ghs", stageId: "a", status: "open", currency: "GHS", amount: 10000, expectedClose: "2026-03-20" },
    { ...base, id: "3", title: "open usd", stageId: "a", status: "open", currency: "USD", amount: 500, expectedClose: "2026-03-20" },
    { ...base, id: "4", title: "lost ghs", stageId: "l", status: "lost", currency: "GHS", amount: 3000, expectedClose: "2026-03-01", closedAt: "2026-03-02T10:00:00Z", ownerId: "u2" },
  ] as never[];
  const targets = [{ id: "t", orgId: "o", month: "2026-03", currency: "GHS" as const, amount: 20000, ownerId: null }];
  const ctx = { pipelines, taxes: [], targets };

  it("never mixes currencies and weights open deals by probability", () => {
    const s = summarise(deals, { from: "2026-03", to: "2026-03", currency: "GHS", ownerId: null }, ctx);
    expect(s.won).toBe(1000);
    expect(s.open).toBe(10000);
    expect(s.weighted).toBe(5000);
    expect(s.lost).toBe(3000);
    expect(s.winRate).toBe(50);
    expect(s.target).toBe(20000);
    expect(s.projectedPct).toBe(30);
    const usd = summarise(deals, { from: "2026-03", to: "2026-03", currency: "USD", ownerId: null }, ctx);
    expect(usd.open).toBe(500);
    expect(usd.target).toBeNull();
  });

  it("individual scope has no team target and only that owner's deals", () => {
    const s = summarise(deals, { from: "2026-03", to: "2026-03", currency: "GHS", ownerId: "u2" }, ctx);
    expect(s.target).toBeNull();
    expect(s.lostCount).toBe(1);
    expect(s.wonCount).toBe(0);
    expect(s.winRate).toBe(0);
  });

  it("handles empty periods and month maths", () => {
    const s = summarise(deals, { from: "2025-01", to: "2025-02", currency: "GHS", ownerId: null }, ctx);
    expect(s.won).toBe(0);
    expect(s.winRate).toBeNull();
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
});
