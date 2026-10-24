"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LineChart, Snowflake, Table2 } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSales } from "../../hooks/use-sales";
import { dealAttention, dealValue, formatAmount, stageOf } from "../../lib/calc";
import { addMonths, groupSum, monthLabel, monthOf, monthlySeries, monthsBetween, scopedDeals, summarise, type ForecastScope } from "../../lib/forecast";
import { LEAD_SOURCE_LABELS, type Currency, type LeadSource } from "../../types";
import { ForecastChart, ForecastLegend } from "./forecast-chart";

type Preset = "this_month" | "this_quarter" | "next_quarter" | "last_quarter" | "year" | "custom";
const PRESETS: Record<Preset, string> = { this_month: "This month", this_quarter: "This quarter", next_quarter: "Next quarter", last_quarter: "Last quarter", year: "This year", custom: "Custom range" };

function presetRange(p: Exclude<Preset, "custom">, month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const qStart = `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}`;
  switch (p) {
    case "this_month":
      return { from: month, to: month };
    case "this_quarter":
      return { from: qStart, to: addMonths(qStart, 2) };
    case "next_quarter":
      return { from: addMonths(qStart, 3), to: addMonths(qStart, 5) };
    case "last_quarter":
      return { from: addMonths(qStart, -3), to: addMonths(qStart, -1) };
    case "year":
      return { from: `${y}-01`, to: `${y}-12` };
  }
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl border border-border bg-card p-5", className)}>{children}</section>;
}

function Breakdown({ title, note, rows, empty }: { title: string; note?: string; rows: { key: string; label: string; value: string; share: number; href: string; count: number }[]; empty: string }) {
  return (
    <Card>
      <h3 className="text-[0.9375rem] font-semibold">{title}</h3>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {rows.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className="group -mx-2 block rounded-lg px-2 py-1.5 hover:bg-panel">
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">
                    {r.label} <span className="text-xs text-muted-foreground tabular-nums">{r.count}</span>
                  </span>
                  <span className="flex items-center gap-1 font-medium tabular-nums">
                    {r.value}
                    <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </span>
                </span>
                <span className="mt-1 block h-1.5 rounded-full bg-panel">
                  <span className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.max(2, r.share * 100)}%` }} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ForecastPage() {
  const { db, user, now, deals, leads, users, pipelines, taxes } = useSales();
  const thisMonth = new Date(now).toISOString().slice(0, 7);
  const [preset, setPreset] = useState<Preset>("this_quarter");
  const [custom, setCustom] = useState(() => presetRange("this_quarter", new Date().toISOString().slice(0, 7)));
  const [scope, setScope] = useState<string>("team");
  const [currency, setCurrency] = useState<Currency>("GHS");
  const [table, setTable] = useState(false);

  const range = preset === "custom" ? custom : presetRange(preset, thisMonth);
  const ownerId = scope === "team" ? null : scope === "me" ? user.id : scope;
  const s: ForecastScope = { ...range, currency, ownerId };
  const ctx = useMemo(() => ({ pipelines, taxes, targets: db.targets.filter((t) => t.orgId === user.orgId) }), [pipelines, taxes, db.targets, user.orgId]);
  const sum = summarise(deals, s, ctx);
  const chartMonths = monthsBetween(addMonths(thisMonth, -3), addMonths(thisMonth, 2));
  const series = monthlySeries(deals, { currency, ownerId }, chartMonths, ctx);
  const mine = scopedDeals(deals, s);
  const inPeriod = (d: string | undefined) => !!d && monthOf(d) >= range.from && monthOf(d) <= range.to;
  const owners = useMemo(() => {
    const ids = new Set(deals.map((d) => d.ownerId));
    return db.users.filter((u) => ids.has(u.id) && u.id !== user.id);
  }, [deals, db.users, user.id]);
  const otherCurrency: Currency = currency === "GHS" ? "USD" : "GHS";
  const hasOther = scopedDeals(deals, { currency: otherCurrency, ownerId }).length > 0;

  if (!hasPermission(user, "forecast.view")) return <PageContainer><PermissionNotice /></PageContainer>;

  const fmt = (v: number) => formatAmount(v, currency);
  const periodLabel = range.from === range.to ? monthLabel(range.from, { month: "long", year: "numeric" }) : `${monthLabel(range.from, { month: "short", year: "numeric" })} – ${monthLabel(range.to, { month: "short", year: "numeric" })}`;
  const ownerQ = ownerId ? `&owner=${ownerId}` : "";
  const cur = `&currency=${currency}`;

  const openInPeriod = mine.filter((d) => d.status === "open" && inPeriod(d.expectedClose));
  const byStage = groupSum(openInPeriod, (d) => d.stageId, (d) => dealValue(d, taxes));
  const wonInPeriod = mine.filter((d) => d.status === "won" && inPeriod(d.closedAt));
  const lostInPeriod = mine.filter((d) => d.status === "lost" && inPeriod(d.closedAt));
  const byWon = groupSum(wonInPeriod, (d) => d.wonReason ?? "No reason recorded", (d) => dealValue(d, taxes));
  const byLost = groupSum(lostInPeriod, (d) => d.lostReason, (d) => dealValue(d, taxes));
  const leadRows = leads.filter((l) => inPeriod(l.createdAt) && (ownerId === null || l.ownerId === ownerId));
  const bySource = (() => {
    const m = new Map<LeadSource, { count: number; converted: number }>();
    for (const l of leadRows) {
      const c = m.get(l.source) ?? { count: 0, converted: 0 };
      c.count += 1;
      if (l.status === "converted") c.converted += 1;
      m.set(l.source, c);
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  })();
  const cold = scopedDeals(deals, { currency, ownerId }).filter((d) => dealAttention(d, now).kind === "going_cold").length;
  const pastClose = scopedDeals(deals, { currency, ownerId }).filter((d) => dealAttention(d, now).kind === "past_close").length;
  const share = (v: number, list: { value: number }[]) => v / Math.max(1, ...list.map((x) => x.value));
  const nothing = sum.wonCount + sum.lostCount + sum.openCount === 0;
  const anyDeals = scopedDeals(deals, { currency, ownerId }).length > 0;
  const gap = sum.target !== null ? Math.max(0, sum.target - sum.won - sum.weighted) : null;

  return (
    <PageContainer>
      <PageHeader title="Forecast" description="How much have we won, what is likely to close, and are we on track? Every figure comes from the same deals as the pipeline." />

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="fc-period" className="text-xs text-muted-foreground">Period</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger id="fc-period" className="min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRESETS).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {preset === "custom" && (
          <div className="flex items-end gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="fc-from" className="text-xs text-muted-foreground">From</Label>
              <Input id="fc-from" type="month" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} className="w-40" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fc-to" className="text-xs text-muted-foreground">To</Label>
              <Input id="fc-to" type="month" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} className="w-40" />
            </div>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="fc-scope" className="text-xs text-muted-foreground">Whose deals</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger id="fc-scope" className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">Everyone I can see</SelectItem>
              <SelectItem value="me">Just me</SelectItem>
              {owners.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Currency</span>
          <Segmented label="Currency" value={currency} onChange={setCurrency} options={[{ value: "GHS", label: "GHS" }, { value: "USD", label: "USD" }]} />
        </div>
        <p className="text-sm text-muted-foreground lg:ml-auto lg:pb-2">{periodLabel}</p>
      </div>
      {hasOther && <p className="-mt-4 text-xs text-muted-foreground">Figures are in {currency} only. {otherCurrency} deals are shown separately — switch currency to see them. Nothing is converted.</p>}

      {!anyDeals ? (
        <EmptyState icon={LineChart} title={`No ${currency} deals ${ownerId ? "for this person" : "yet"}`} description="The forecast fills in as deals are created and closed." action={hasOther ? <Button variant="outline" onClick={() => setCurrency(otherCurrency)}>Show {otherCurrency}</Button> : undefined} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <p className="text-sm text-muted-foreground">1 · How much have we won?</p>
              <p className="mt-2 text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] tabular-nums">{fmt(sum.won)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <Link href={`/deals?status=won${ownerQ}${cur}`} className="hover:underline">{sum.wonCount} deal{sum.wonCount === 1 ? "" : "s"} won</Link> in the period
              </p>
            </Card>
            <Card>
              <p className="text-sm text-muted-foreground">2 · What&apos;s likely to close?</p>
              <p className="mt-2 text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] tabular-nums">{fmt(sum.weighted)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Weighted from <Link href={`/deals?status=open${ownerQ}${cur}`} className="hover:underline">{fmt(sum.open)} open across {sum.openCount} deal{sum.openCount === 1 ? "" : "s"}</Link> due to close
              </p>
            </Card>
            <Card>
              <p className="text-sm text-muted-foreground">3 · Are we on track?</p>
              {sum.target !== null ? (
                <>
                  <p className="mt-2 text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] tabular-nums">{sum.projectedPct}%<span className="ml-1.5 text-sm font-normal text-muted-foreground">of target</span></p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel" role="img" aria-label={`Won ${fmt(sum.won)} plus weighted ${fmt(sum.weighted)} against a target of ${fmt(sum.target)}`}>
                    <div className="flex h-full">
                      <span className="h-full" style={{ width: `${Math.min(100, (sum.won / sum.target) * 100)}%`, background: "#0891b2" }} />
                      <span className="h-full border-l-2 border-card" style={{ width: `${Math.min(100 - Math.min(100, (sum.won / sum.target) * 100), (sum.weighted / sum.target) * 100)}%`, background: "#d97706" }} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{gap && gap > 0 ? `${fmt(gap)} short of the ${fmt(sum.target)} target, if weighted deals close as expected.` : `Won plus weighted covers the ${fmt(sum.target)} target.`}</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-muted-foreground">No target</p>
                  <p className="mt-1 text-sm text-muted-foreground">{ownerId ? "Targets are set for the whole team in this prototype, not per person." : `No ${currency} target is set for this period.`}</p>
                </>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-border px-5 py-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Win rate", sum.winRate === null ? "—" : `${sum.winRate}%`, sum.winRate === null ? "No deals closed" : `${sum.wonCount} won · ${sum.lostCount} lost`],
              ["Average won deal", sum.avgDealSize === null ? "—" : fmt(sum.avgDealSize), null],
              ["Days to close", sum.avgDaysToClose === null ? "—" : `${sum.avgDaysToClose}`, "Average, won deals"],
              ["Lost value", fmt(sum.lost), null],
            ].map(([l, v, sub]) => (
              <div key={l as string}>
                <p className="text-muted-foreground">{l}</p>
                <p className="mt-0.5 font-semibold tabular-nums">{v}</p>
                {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
              </div>
            ))}
            <Link href="/deals?attention=cold" className="-m-2 rounded-lg p-2 hover:bg-panel">
              <p className="flex items-center gap-1 text-muted-foreground"><Snowflake className="size-3.5" /> Going cold</p>
              <p className="mt-0.5 font-semibold tabular-nums">{cold}</p>
              <p className="text-xs text-muted-foreground">Open, all dates</p>
            </Link>
            <Link href="/deals?attention=past_close" className="-m-2 rounded-lg p-2 hover:bg-panel">
              <p className="text-muted-foreground">Past close date</p>
              <p className={cn("mt-0.5 font-semibold tabular-nums", pastClose > 0 && "text-destructive")}>{pastClose}</p>
              <p className="text-xs text-muted-foreground">Need a new date</p>
            </Link>
          </div>

          <Card className="p-0">
            <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[0.9375rem] font-semibold">Won and pipeline by month · {currency}</h2>
                <p className="text-xs text-muted-foreground">Last three months, this month and the next two. Open deals are placed in their expected close month.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTable((t) => !t)} aria-pressed={table}>
                {table ? <LineChart /> : <Table2 />} {table ? "Show chart" : "Show table"}
              </Button>
            </div>
            <div className="px-5 py-4">
              {table ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-border/70">
                        <th scope="col" className="py-2 pr-3 text-left font-medium">Month</th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">Won</th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">Weighted</th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">Open</th>
                        <th scope="col" className="py-2 text-right font-medium">Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 tabular-nums">
                      {series.map((p) => (
                        <tr key={p.month} className={p.month === thisMonth ? "font-medium" : undefined}>
                          <th scope="row" className="py-2 pr-3 text-left font-normal">{monthLabel(p.month, { month: "long", year: "numeric" })}</th>
                          <td className="py-2 pr-3 text-right">{fmt(p.won)}</td>
                          <td className="py-2 pr-3 text-right">{fmt(p.weighted)}</td>
                          <td className="py-2 pr-3 text-right">{fmt(p.open)}</td>
                          <td className="py-2 text-right">{p.target !== null ? fmt(p.target) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  <ForecastLegend />
                  <div className="mt-3">
                    <ForecastChart points={series} currency={currency} currentMonth={thisMonth} onSelectMonth={(m) => { setPreset("custom"); setCustom({ from: m, to: m }); }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Click a month to see its breakdown below. Targets are prototype figures, not real goals.</p>
                </>
              )}
            </div>
          </Card>

          {nothing && <p className="text-sm text-muted-foreground">No {currency} deals were won, lost or due to close in {periodLabel}. Try a different period.</p>}

          <div className="grid gap-4 md:grid-cols-2">
            <Breakdown
              title="Open pipeline by stage"
              note={`Due to close in the period · ${currency}`}
              empty="No open deals are due to close in this period."
              rows={byStage.map((r) => ({ key: r.key, label: stageOf(pipelines, { pipelineId: pipelines[0].id, stageId: r.key })?.name ?? r.key, count: r.count, value: `${fmt(r.value)}`, share: share(r.value, byStage), href: `/deals?stage=${r.key}${ownerQ}${cur}` }))}
            />
            <Breakdown
              title="Why we win"
              note={`Won in the period · ${currency}`}
              empty="No deals won in this period."
              rows={byWon.map((r) => ({ key: r.key, label: r.key, count: r.count, value: fmt(r.value), share: share(r.value, byWon), href: `/deals?status=won&reason=${encodeURIComponent(r.key)}${ownerQ}${cur}` }))}
            />
            <Breakdown
              title="Why we lose"
              note={`Lost in the period · ${currency}`}
              empty="No deals lost in this period."
              rows={byLost.map((r) => ({ key: r.key, label: r.key, count: r.count, value: fmt(r.value), share: share(r.value, byLost), href: `/deals?status=lost&reason=${encodeURIComponent(r.key)}${ownerQ}${cur}` }))}
            />
            <Breakdown
              title="Where new leads come from"
              note="Leads created in the period · counted across all currencies"
              empty="No leads were created in this period."
              rows={bySource.map(([k, v]) => ({ key: k, label: LEAD_SOURCE_LABELS[k], count: v.count, value: `${v.converted} converted`, share: v.count / Math.max(1, ...bySource.map(([, x]) => x.count)), href: `/leads?source=${k}` }))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Weighted value = deal value × chance of winning (the deal&apos;s own chance, or its stage default). {users.size > 0 && "Only deals you're allowed to see are included."}
          </p>
        </>
      )}
    </PageContainer>
  );
}
