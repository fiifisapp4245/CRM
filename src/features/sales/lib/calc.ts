/**
 * Every sales calculation lives here so deals, quotes, the board, the
 * dashboard and the forecast can never disagree. Pure and unit-tested.
 */
import type { Currency, Deal, LineItem, Pipeline, PipelineStage, Tax } from "../types";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface LineResult {
  /** quantity × unit price, before discount (tax-exclusive) */
  gross: number;
  discount: number;
  /** after discount, before tax */
  net: number;
  tax: number;
  total: number;
}

/**
 * Discount applies to the price before tax. For a tax-inclusive price the
 * tax is backed out first (price ÷ (1 + rate)), so customers pay the price
 * shown when no discount applies.
 */
export function lineResult(item: Pick<LineItem, "quantity" | "unitPrice" | "discountPct" | "taxId" | "taxInclusive">, taxes: Tax[]): LineResult {
  const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 0;
  const price = Number.isFinite(item.unitPrice) && item.unitPrice > 0 ? item.unitPrice : 0;
  const pct = Math.min(100, Math.max(0, Number.isFinite(item.discountPct) ? item.discountPct : 0));
  const rate = (item.taxId ? taxes.find((t) => t.id === item.taxId)?.rate ?? 0 : 0) / 100;
  const exclusiveUnit = item.taxInclusive && rate ? price / (1 + rate) : price;
  const gross = round2(qty * exclusiveUnit);
  const discount = round2(gross * (pct / 100));
  const net = round2(gross - discount);
  const tax = round2(net * rate);
  return { gross, discount, net, tax, total: round2(net + tax) };
}

export interface Totals {
  subtotal: number;
  discount: number;
  net: number;
  tax: number;
  total: number;
  taxByName: Array<{ name: string; amount: number }>;
}

export function lineTotals(items: LineItem[], taxes: Tax[]): Totals {
  const t: Totals = { subtotal: 0, discount: 0, net: 0, tax: 0, total: 0, taxByName: [] };
  const byTax = new Map<string, number>();
  for (const it of items) {
    const r = lineResult(it, taxes);
    t.subtotal += r.gross;
    t.discount += r.discount;
    t.net += r.net;
    t.tax += r.tax;
    t.total += r.total;
    if (it.taxId && r.tax) {
      const name = taxes.find((x) => x.id === it.taxId)?.name ?? "Tax";
      byTax.set(name, (byTax.get(name) ?? 0) + r.tax);
    }
  }
  return {
    subtotal: round2(t.subtotal),
    discount: round2(t.discount),
    net: round2(t.net),
    tax: round2(t.tax),
    total: round2(t.total),
    taxByName: [...byTax.entries()].map(([name, amount]) => ({ name, amount: round2(amount) })),
  };
}

/** Customer-paid amount for a catalogue price. */
export function customerPrice(price: number, taxId: string | null, taxInclusive: boolean, taxes: Tax[]): number {
  return lineResult({ quantity: 1, unitPrice: price, discountPct: 0, taxId, taxInclusive }, taxes).total;
}

export function dealValue(deal: Pick<Deal, "valuation" | "amount" | "lineItems">, taxes: Tax[]): number {
  return deal.valuation === "products" ? lineTotals(deal.lineItems, taxes).total : round2(deal.amount);
}

export function stageOf(pipelines: Pipeline[], deal: Pick<Deal, "pipelineId" | "stageId">): PipelineStage | undefined {
  return pipelines.find((p) => p.id === deal.pipelineId)?.stages.find((s) => s.id === deal.stageId);
}

/** Explicit probability wins; otherwise the stage default. Won = 100, lost = 0. */
export function dealProbability(deal: Pick<Deal, "status" | "probability" | "pipelineId" | "stageId">, pipelines: Pipeline[]): number {
  if (deal.status === "won") return 100;
  if (deal.status === "lost") return 0;
  if (deal.probability !== undefined && deal.probability !== null) return Math.min(100, Math.max(0, deal.probability));
  return stageOf(pipelines, deal)?.probability ?? 0;
}

export function weightedValue(deal: Deal, pipelines: Pipeline[], taxes: Tax[]): number {
  if (deal.status !== "open") return 0;
  return round2((dealValue(deal, taxes) * dealProbability(deal, pipelines)) / 100);
}

/* ---------------- Attention ---------------- */

/** Prototype rule (not verified TroveSuite logic): an open deal with no activity or stage change for 14 days is going cold. */
export const GOING_COLD_DAYS = 14;
const DAY = 86_400_000;

export function lastTouch(deal: Pick<Deal, "lastActivityAt" | "stageChangedAt" | "updatedAt">): string {
  return [deal.lastActivityAt, deal.stageChangedAt].filter(Boolean).sort().at(-1) ?? deal.updatedAt;
}

export type Attention = "past_close" | "going_cold" | "healthy" | "closed";

export function dealAttention(deal: Deal, now: number): { kind: Attention; reason: string } {
  if (deal.status !== "open") return { kind: "closed", reason: deal.status === "won" ? "Won" : "Lost" };
  const today = new Date(now).toISOString().slice(0, 10);
  if (deal.expectedClose < today) {
    const days = Math.round((Date.parse(today) - Date.parse(deal.expectedClose)) / DAY);
    return { kind: "past_close", reason: `Expected close date passed ${days} day${days === 1 ? "" : "s"} ago` };
  }
  const idle = Math.floor((now - Date.parse(lastTouch(deal))) / DAY);
  if (idle >= GOING_COLD_DAYS) return { kind: "going_cold", reason: `No activity or stage change for ${idle} days (threshold ${GOING_COLD_DAYS})` };
  return { kind: "healthy", reason: "On track" };
}

/* ---------------- Outcomes ---------------- */

export function winRate(deals: Deal[]): number | null {
  const closed = deals.filter((d) => d.status !== "open");
  if (!closed.length) return null;
  return Math.round((closed.filter((d) => d.status === "won").length / closed.length) * 1000) / 10;
}

export function averageDaysToClose(deals: Deal[]): number | null {
  const won = deals.filter((d) => d.status === "won" && d.closedAt);
  if (!won.length) return null;
  const days = won.map((d) => Math.max(0, (Date.parse(d.closedAt!) - Date.parse(d.createdAt)) / DAY));
  return Math.round(days.reduce((a, b) => a + b, 0) / days.length);
}

export function sumByCurrency<T>(rows: T[], currency: (r: T) => Currency, amount: (r: T) => number): Record<Currency, number> {
  const out: Record<Currency, number> = { GHS: 0, USD: 0 };
  for (const r of rows) out[currency(r)] = round2(out[currency(r)] + amount(r));
  return out;
}

export function formatAmount(amount: number, currency: Currency, opts: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    notation: opts.compact ? "compact" : "standard",
    minimumFractionDigits: opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 1 : 2,
  }).format(amount);
}
