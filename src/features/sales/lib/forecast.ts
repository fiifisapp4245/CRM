/**
 * Forecast maths. Every figure is for ONE currency — GHS and USD are never
 * added together. All values come from the same deal records as the pipeline.
 */
import { averageDaysToClose, dealValue, weightedValue, winRate } from "./calc";
import type { Currency, Deal, Pipeline, SalesTarget, Tax } from "../types";

/** "YYYY-MM" of an ISO date or YYYY-MM-DD string. */
export const monthOf = (date: string) => date.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 36; m = addMonths(m, 1)) out.push(m);
  return out;
}

export const monthLabel = (month: string, opts: Intl.DateTimeFormatOptions = { month: "short" }) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

export interface ForecastScope {
  from: string; // YYYY-MM
  to: string; // YYYY-MM
  currency: Currency;
  /** null = everyone the viewer can see */
  ownerId: string | null;
}

const inRange = (month: string, s: ForecastScope) => month >= s.from && month <= s.to;

export function scopedDeals(deals: Deal[], s: Pick<ForecastScope, "currency" | "ownerId">): Deal[] {
  return deals.filter((d) => d.currency === s.currency && (s.ownerId === null || d.ownerId === s.ownerId));
}

export interface ForecastSummary {
  won: number;
  wonCount: number;
  lost: number;
  lostCount: number;
  /** Open deals expected to close in the period. */
  open: number;
  openCount: number;
  weighted: number;
  /** Team target for the period; null when no target applies (e.g. an individual). */
  target: number | null;
  /** won + weighted as a share of target. */
  projectedPct: number | null;
  winRate: number | null;
  avgDealSize: number | null;
  avgDaysToClose: number | null;
}

export function summarise(deals: Deal[], s: ForecastScope, ctx: { pipelines: Pipeline[]; taxes: Tax[]; targets: SalesTarget[] }): ForecastSummary {
  const mine = scopedDeals(deals, s);
  const wonDeals = mine.filter((d) => d.status === "won" && d.closedAt && inRange(monthOf(d.closedAt), s));
  const lostDeals = mine.filter((d) => d.status === "lost" && d.closedAt && inRange(monthOf(d.closedAt), s));
  const openDeals = mine.filter((d) => d.status === "open" && inRange(monthOf(d.expectedClose), s));
  const sum = (list: Deal[], f: (d: Deal) => number) => Math.round(list.reduce((a, d) => a + f(d), 0) * 100) / 100;
  const won = sum(wonDeals, (d) => dealValue(d, ctx.taxes));
  const weighted = sum(openDeals, (d) => weightedValue(d, ctx.pipelines, ctx.taxes));
  const target = targetFor(ctx.targets, s);
  return {
    won,
    wonCount: wonDeals.length,
    lost: sum(lostDeals, (d) => dealValue(d, ctx.taxes)),
    lostCount: lostDeals.length,
    open: sum(openDeals, (d) => dealValue(d, ctx.taxes)),
    openCount: openDeals.length,
    weighted,
    target,
    projectedPct: target ? Math.round(((won + weighted) / target) * 1000) / 10 : null,
    winRate: winRate([...wonDeals, ...lostDeals]),
    avgDealSize: wonDeals.length ? Math.round(won / wonDeals.length) : null,
    avgDaysToClose: averageDaysToClose(wonDeals),
  };
}

/** Prototype: targets are set for the whole team only, so an individual scope has none. */
export function targetFor(targets: SalesTarget[], s: ForecastScope): number | null {
  if (s.ownerId !== null) return null;
  const rows = targets.filter((t) => t.ownerId === null && t.currency === s.currency && inRange(t.month, s));
  return rows.length ? rows.reduce((a, t) => a + t.amount, 0) : null;
}

export interface MonthPoint {
  month: string;
  won: number;
  open: number;
  weighted: number;
  target: number | null;
}

export function monthlySeries(deals: Deal[], s: Omit<ForecastScope, "from" | "to">, months: string[], ctx: { pipelines: Pipeline[]; taxes: Tax[]; targets: SalesTarget[] }): MonthPoint[] {
  return months.map((month) => {
    const m = summarise(deals, { ...s, from: month, to: month }, ctx);
    return { month, won: m.won, open: m.open, weighted: m.weighted, target: m.target };
  });
}

export function groupSum<K extends string>(rows: Deal[], key: (d: Deal) => K | undefined, value: (d: Deal) => number): { key: K; count: number; value: number }[] {
  const m = new Map<K, { key: K; count: number; value: number }>();
  for (const d of rows) {
    const k = key(d);
    if (!k) continue;
    const cur = m.get(k) ?? { key: k, count: 0, value: 0 };
    cur.count += 1;
    cur.value += value(d);
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.value - a.value || b.count - a.count);
}
