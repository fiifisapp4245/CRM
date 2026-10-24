/** Pure ticket rules: targets, lateness, views and dashboard metrics. */
import type { BusinessSettings } from "@/lib/business/settings";
import type { Ticket, TicketPriority, TicketStatus } from "../types";

const H = 3_600_000;

export function targetsFor(priority: TicketPriority, openedAt: string, settings: Pick<BusinessSettings, "ticketTargets">) {
  const t = settings.ticketTargets[priority];
  return { firstResponseDueAt: new Date(Date.parse(openedAt) + t.firstResponseHours * H).toISOString(), resolutionDueAt: new Date(Date.parse(openedAt) + t.resolutionHours * H).toISOString() };
}

export const isActive = (t: Ticket) => t.status === "open" || t.status === "waiting";

/** First reply is late if not sent by its due time (or was sent after it). */
export function firstResponseLate(t: Ticket, now: number): boolean {
  if (t.firstRespondedAt) return t.firstRespondedAt > t.firstResponseDueAt;
  return isActive(t) && now > Date.parse(t.firstResponseDueAt);
}

export function resolutionLate(t: Ticket, now: number): boolean {
  if (t.resolvedAt) return t.resolvedAt > t.resolutionDueAt;
  return isActive(t) && now > Date.parse(t.resolutionDueAt);
}

/** "Late now": an active ticket that has missed a target it can still act on. */
export function isLateNow(t: Ticket, now: number): boolean {
  if (!isActive(t)) return false;
  return (!t.firstRespondedAt && now > Date.parse(t.firstResponseDueAt)) || now > Date.parse(t.resolutionDueAt);
}

export type TicketView = "mine" | "nobody" | "late" | "open" | "waiting" | "resolved" | "closed";

export function inView(t: Ticket, view: TicketView, userId: string, now: number): boolean {
  switch (view) {
    case "mine":
      return isActive(t) && t.ownerId === userId;
    case "nobody":
      return isActive(t) && t.ownerId === null;
    case "late":
      return isLateNow(t, now);
    case "open":
      return isActive(t);
    case "waiting":
      return t.status === "waiting";
    case "resolved":
      return t.status === "resolved";
    case "closed":
      return t.status === "closed";
  }
}

/** Allowed manual status changes (prototype lifecycle). */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["waiting", "resolved"],
  waiting: ["open", "resolved"],
  resolved: ["open", "closed"],
  closed: ["open"],
};

/* ---------------- Dashboard ---------------- */

export type Metric = { kind: "value"; value: number } | { kind: "none"; reason: string };

const avg = (xs: number[]): Metric => (xs.length ? { kind: "value", value: xs.reduce((a, b) => a + b, 0) / xs.length } : { kind: "none", reason: "No tickets in this period yet" });
const pct = (num: number, den: number, none: string): Metric => (den ? { kind: "value", value: Math.round((num / den) * 1000) / 10 } : { kind: "none", reason: none });

export interface DashboardRow {
  key: string;
  open: number;
  opened: number;
  resolved: number;
  firstReplyHours: Metric;
  ratedGood: Metric;
}

export function ticketDashboard(tickets: Ticket[], range: { from: string; to: string }, now: number) {
  const inRange = (iso?: string) => !!iso && iso.slice(0, 10) >= range.from && iso.slice(0, 10) <= range.to;
  const opened = tickets.filter((t) => inRange(t.openedAt));
  const resolved = tickets.filter((t) => inRange(t.resolvedAt));
  const replied = opened.filter((t) => t.firstRespondedAt);
  const rated = tickets.filter((t) => t.rating && inRange(t.rating.at));
  const hours = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / H;
  const row = (key: string, list: Ticket[]): DashboardRow => {
    const o = list.filter((t) => inRange(t.openedAt));
    const r = list.filter((t) => t.rating && inRange(t.rating.at));
    return {
      key,
      open: list.filter(isActive).length,
      opened: o.length,
      resolved: list.filter((t) => inRange(t.resolvedAt)).length,
      firstReplyHours: avg(o.filter((t) => t.firstRespondedAt).map((t) => hours(t.openedAt, t.firstRespondedAt!))),
      ratedGood: pct(r.filter((t) => t.rating!.score === "good").length, r.length, "No ratings yet"),
    };
  };
  const group = (key: (t: Ticket) => string) => {
    const m = new Map<string, Ticket[]>();
    for (const t of tickets) m.set(key(t), [...(m.get(key(t)) ?? []), t]);
    return [...m.entries()].map(([k, list]) => row(k, list)).filter((r) => r.open + r.opened + r.resolved > 0).sort((a, b) => b.open - a.open || b.opened - a.opened);
  };
  return {
    openNow: tickets.filter(isActive).length,
    lateNow: tickets.filter((t) => isLateNow(t, now)).length,
    opened: opened.length,
    resolved: resolved.length,
    customersHappy: pct(rated.filter((t) => t.rating!.score === "good").length, rated.length, "No ratings in this period"),
    firstReplyAvgHours: avg(replied.map((t) => hours(t.openedAt, t.firstRespondedAt!))),
    resolvedInAvgHours: avg(resolved.map((t) => hours(t.openedAt, t.resolvedAt!))),
    firstReplyOnTime: pct(replied.filter((t) => t.firstRespondedAt! <= t.firstResponseDueAt).length, replied.length, "No first replies in this period"),
    resolvedOnTime: pct(resolved.filter((t) => t.resolvedAt! <= t.resolutionDueAt).length, resolved.length, "Nothing resolved in this period"),
    byPerson: group((t) => t.ownerId ?? "unassigned"),
    byCategory: group((t) => t.category),
  };
}

export function formatHours(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round((h / 24) * 10) / 10} days`;
}
