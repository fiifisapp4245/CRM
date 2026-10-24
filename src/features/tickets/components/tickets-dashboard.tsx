"use client";

import { useState } from "react";
import { addDaysKey, dayKey } from "@/lib/business/time";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatHours, ticketDashboard, type DashboardRow, type Metric, type TicketView } from "../lib/tickets";
import type { Ticket } from "../types";

const show = (m: Metric, fmt: (v: number) => string) => (m.kind === "value" ? fmt(m.value) : "—");

/**
 * Service dashboard computed from the same tickets as the lists. "—" means
 * there's nothing to measure (not zero); the reason is shown underneath.
 */
export function TicketsDashboard({ tickets, now, tz, users, onOpenView }: { tickets: Ticket[]; now: number; tz: string; users: Map<string, { name: string }>; onOpenView: (v: TicketView) => void }) {
  const today = dayKey(now, tz);
  const [from, setFrom] = useState(addDaysKey(today, -29));
  const [to, setTo] = useState(today);
  const d = ticketDashboard(tickets, { from, to }, now);
  const card = (label: string, value: string, sub?: string, onClick?: () => void, tone?: "danger") => {
    const body = (
      <>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "danger" && value !== "0" && "text-destructive")}>{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </>
    );
    return onClick ? (
      <button type="button" onClick={onClick} className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {body}
        <span className="mt-1 block text-xs font-medium text-brand-700">See tickets →</span>
      </button>
    ) : (
      <div className="rounded-2xl border border-border bg-card p-4">{body}</div>
    );
  };
  const reason = (m: Metric) => (m.kind === "none" ? m.reason : undefined);
  const table = (title: string, rows: DashboardRow[], name: (k: string) => string) => (
    <section className="overflow-x-auto rounded-2xl border border-border bg-card">
      <h3 className="border-b border-border/70 px-5 py-3 text-[0.9375rem] font-semibold">{title}</h3>
      <table className="w-full min-w-[32rem] text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border/70">
            <th scope="col" className="px-5 py-2 text-left font-medium">{title === "By person" ? "Person" : "Category"}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Open</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Opened</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Resolved</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">First reply</th>
            <th scope="col" className="px-5 py-2 text-right font-medium">Rated good</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 tabular-nums">
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">No tickets in this period.</td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="px-5 py-2 text-left font-medium">{name(r.key)}</th>
              <td className="px-3 py-2 text-right">{r.open}</td>
              <td className="px-3 py-2 text-right">{r.opened}</td>
              <td className="px-3 py-2 text-right">{r.resolved}</td>
              <td className="px-3 py-2 text-right" title={reason(r.firstReplyHours)}>{show(r.firstReplyHours, formatHours)}</td>
              <td className="px-5 py-2 text-right" title={reason(r.ratedGood)}>{show(r.ratedGood, (v) => `${v}%`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="td-from" className="text-xs text-muted-foreground">From</Label>
          <Input id="td-from" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="td-to" className="text-xs text-muted-foreground">To</Label>
          <Input id="td-to" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-40" />
        </div>
        <p className="pb-2 text-xs text-muted-foreground">Open now and Late now are always current; the rest count tickets in the period.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {card("Open now", String(d.openNow), "Open or waiting on the customer", () => onOpenView("open"))}
        {card("Late now", String(d.lateNow), "Missed a reply or resolve target", () => onOpenView("late"), "danger")}
        {card("Opened / resolved", `${d.opened} / ${d.resolved}`, "In this period")}
        {card("Customers happy", show(d.customersHappy, (v) => `${v}%`), reason(d.customersHappy) ?? "Rated good, of tickets rated", d.customersHappy.kind === "value" ? () => onOpenView("resolved") : undefined)}
        {card("First reply, on average", show(d.firstReplyAvgHours, formatHours), reason(d.firstReplyAvgHours))}
        {card("Resolved in, on average", show(d.resolvedInAvgHours, formatHours), reason(d.resolvedInAvgHours))}
        {card("First reply on time", show(d.firstReplyOnTime, (v) => `${v}%`), reason(d.firstReplyOnTime))}
        {card("Resolved on time", show(d.resolvedOnTime, (v) => `${v}%`), reason(d.resolvedOnTime))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {table("By person", d.byPerson, (k) => (k === "unassigned" ? "Nobody" : (users.get(k)?.name ?? "Unknown")))}
        {table("By category", d.byCategory, (k) => k)}
      </div>
      <p className="text-xs text-muted-foreground">Targets are prototype rules per priority (e.g. Urgent: reply in 1 h, resolve in 8 h), counted in calendar hours — not your production service policy.</p>
    </div>
  );
}
