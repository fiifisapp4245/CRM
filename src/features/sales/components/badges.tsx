import Link from "next/link";
import { Snowflake, CalendarX2 } from "lucide-react";
import { StatusPill, type PillTone } from "@/components/shared/status-pill";
import { formatAmount, type Attention } from "../lib/calc";
import { LEAD_STATUS_LABELS, QUOTE_STATUS_LABELS, type Currency, type DealStatus, type LeadStatus, type QuoteStatus } from "../types";

export function Money({ amount, currency, className }: { amount: number; currency: Currency; className?: string }) {
  return <span className={className ? `${className} tabular-nums` : "tabular-nums"}>{formatAmount(amount, currency)}</span>;
}

const LEAD_TONE: Record<LeadStatus, PillTone> = { new: "info", contacted: "brand", qualified: "success", converted: "neutral", disqualified: "muted" };
export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <StatusPill tone={LEAD_TONE[status]}>{LEAD_STATUS_LABELS[status]}</StatusPill>;
}

const QUOTE_TONE: Record<QuoteStatus, PillTone> = { draft: "neutral", sent: "info", accepted: "success", declined: "danger", expired: "warning", paid: "brand" };
export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <StatusPill tone={QUOTE_TONE[status]}>{QUOTE_STATUS_LABELS[status]}</StatusPill>;
}

export function DealStatusBadge({ status, stageName }: { status: DealStatus; stageName?: string }) {
  if (status === "won") return <StatusPill tone="success">Won</StatusPill>;
  if (status === "lost") return <StatusPill tone="muted">Lost</StatusPill>;
  return <StatusPill tone="neutral">{stageName ?? "Open"}</StatusPill>;
}

/** Attention indicator; links to the matching filtered Deals list. */
export function AttentionBadge({ kind, reason, link = true }: { kind: Attention; reason: string; link?: boolean }) {
  if (kind !== "going_cold" && kind !== "past_close") return null;
  const pill =
    kind === "going_cold" ? (
      <StatusPill tone="info">
        <Snowflake className="size-3" /> Going cold
      </StatusPill>
    ) : (
      <StatusPill tone="danger">
        <CalendarX2 className="size-3" /> Past close date
      </StatusPill>
    );
  if (!link) return <span title={reason}>{pill}</span>;
  return (
    <Link href={`/deals?attention=${kind === "going_cold" ? "cold" : "past_close"}`} title={`${reason}. Show all deals like this.`} onClick={(e) => e.stopPropagation()} className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      {pill}
    </Link>
  );
}

export function ScoreMeter({ score }: { score: number }) {
  const tone = score >= 60 ? "bg-success" : score >= 35 ? "bg-brand-600" : "bg-border-strong";
  return (
    <span className="flex items-center gap-2" title={`Prototype lead score ${score} of 100`}>
      <span className="h-1.5 w-12 rounded-full bg-secondary" aria-hidden>
        <span className={`block h-1.5 rounded-full ${tone}`} style={{ width: `${score}%` }} />
      </span>
      <span className="text-sm tabular-nums">{score}</span>
    </span>
  );
}
