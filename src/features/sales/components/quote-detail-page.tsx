"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CircleDollarSign, Copy, ExternalLink, FilePlus2, Pencil, Send, ThumbsDown, TimerOff, Trophy } from "lucide-react";
import { toast } from "sonner";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { InlineNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSales } from "../hooks/use-sales";
import { formatAmount, lineTotals } from "../lib/calc";
import { acceptQuote, declineQuote, effectiveStatus, expireQuote, recordPayment, sendQuote } from "../services/quotes-service";
import { QUOTE_STATUS_LABELS, type Quote, type QuoteEvent } from "../types";
import { QuoteStatusBadge } from "./badges";
import { CloseDealDialog } from "./close-deal-dialog";
import { QuoteDocument } from "./quote-document";

const EVENT_LABELS: Record<QuoteEvent["kind"], string> = { created: "Draft created", edited: "Draft edited", sent: "Sent", opened: "Opened by customer", accepted: "Accepted", declined: "Declined", expired: "Marked expired", paid: "Payment recorded" };

type Action = "send" | "accept" | "decline" | "expire" | "pay" | null;

export function QuoteDetailPage({ quote }: { quote: Quote }) {
  const { db, user, users, taxes, now } = useSales();
  const deal = db.deals.find((d) => d.id === quote.dealId);
  const canAct = !!deal && hasPermission(user, "quotes.manage") && canWriteRecord(user, deal, db.users);
  const status = effectiveStatus(quote, new Date(now).toISOString().slice(0, 10));
  const total = lineTotals(quote.lineItems, taxes).total;
  const seller = db.orgs.find((o) => o.id === quote.orgId)?.name ?? "Your organisation";
  const [action, setAction] = useState<Action>(null);
  const [to, setTo] = useState(quote.customer.email ?? "");
  const [reason, setReason] = useState("");
  const [ref, setRef] = useState("");
  const [closeDeal, setCloseDeal] = useState(false);
  const link = typeof window === "undefined" ? `/q/${quote.id}` : `${window.location.origin}/q/${quote.id}`;
  const dealOpen = deal?.status === "open";
  const who = (by: string) => (by === "customer" ? "Customer (simulated)" : (users.get(by)?.name ?? "Unknown"));

  const run = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => {
    const r = await p;
    if (r.ok) toast.success(msg);
    else {
      toast.error(r.error);
      throw new Error(r.error);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Quotes", href: "/quotes" }, { label: quote.number }]} />}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {quote.number} <QuoteStatusBadge status={status} />
          </span>
        }
        description={
          <>
            {formatAmount(total, quote.currency)} for {quote.customer.name}
            {deal && (
              <>
                {" · "}
                <Link href={`/deals/${deal.id}`} className="text-foreground underline decoration-border-strong underline-offset-4">
                  {deal.title}
                </Link>
              </>
            )}
          </>
        }
        actions={
          canAct && (
            <>
              {quote.status === "draft" && (
                <>
                  <Button variant="outline" asChild>
                    <Link href={`/quotes/${quote.id}/edit`}>
                      <Pencil /> Edit
                    </Link>
                  </Button>
                  <Button onClick={() => setAction("send")}>
                    <Send /> Send
                  </Button>
                </>
              )}
              {quote.status === "sent" && (
                <>
                  {status === "expired" ? (
                    <Button variant="outline" onClick={() => setAction("expire")}>
                      <TimerOff /> Record as expired
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setAction("decline")}>
                        <ThumbsDown /> Record declined
                      </Button>
                      <Button onClick={() => setAction("accept")}>
                        <Check /> Record accepted
                      </Button>
                    </>
                  )}
                </>
              )}
              {quote.status === "accepted" && (
                <Button onClick={() => setAction("pay")}>
                  <CircleDollarSign /> Record payment
                </Button>
              )}
              {(quote.status === "declined" || quote.status === "expired") && deal && (
                <Button variant="outline" asChild>
                  <Link href={`/quotes/new?dealId=${deal.id}`}>
                    <FilePlus2 /> New quote for this deal
                  </Link>
                </Button>
              )}
            </>
          )
        }
      />

      {(quote.status === "accepted" || quote.status === "paid") && dealOpen && canAct && (
        // Accepting a quote never closes the deal by itself — the salesperson decides.
        <InlineNotice tone="success" icon={Trophy}>
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>The customer {quote.status === "paid" ? "has paid" : "accepted"}. The deal is still open — mark it won when you&apos;re ready.</span>
            <Button size="sm" onClick={() => setCloseDeal(true)}>
              Mark deal won…
            </Button>
          </span>
        </InlineNotice>
      )}
      {quote.status === "sent" && status === "expired" && <InlineNotice tone="warning">Valid until {formatDate(quote.validUntil)} — this date has passed, so the quote shows as expired. Record it, then create a new quote if the customer is still interested.</InlineNotice>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <QuoteDocument quote={quote} sellerName={seller} taxes={taxes} />
        <aside className="flex flex-col gap-4" aria-label="Quote status">
          {quote.status !== "draft" && (
            <section className="rounded-2xl border border-border bg-card p-5 text-sm">
              <h2 className="text-[0.9375rem] font-semibold">Customer link</h2>
              <p className="mt-1 text-muted-foreground">A simulated page where the customer can view, accept or decline. Nothing is emailed in this prototype.</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={`/q/${quote.id}`} target="_blank" rel="noreferrer">
                    <ExternalLink /> Open
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(link);
                    toast.success("Link copied");
                  }}
                >
                  <Copy /> Copy link
                </Button>
              </div>
              {quote.sentTo && <p className="mt-3 text-xs text-muted-foreground">Recorded as shared with {quote.sentTo}</p>}
            </section>
          )}
          <section className="rounded-2xl border border-border bg-card p-5 text-sm">
            <h2 className="text-[0.9375rem] font-semibold">History</h2>
            <ol className="mt-3 space-y-3">
              {[...quote.history].reverse().map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" aria-hidden />
                  <span>
                    <span className="block font-medium">{EVENT_LABELS[e.kind]}</span>
                    {e.note && <span className="block text-muted-foreground">{e.note}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(e.at)} · {who(e.by)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={action === "send"}
        onOpenChange={(o) => !o && setAction(null)}
        title={`Send ${quote.number}?`}
        description="The quote is locked once sent. In this prototype nothing is emailed — we record who it was shared with and give you the customer link."
        confirmLabel="Mark as sent"
        onConfirm={() => run(sendQuote(quote.id, to.trim()), `${quote.number} marked as sent`)}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="send-to">Shared with</Label>
          <Input id="send-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Email or phone" />
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={action === "accept"}
        onOpenChange={(o) => !o && setAction(null)}
        title="Record that the customer accepted?"
        description="Use this when the customer accepted outside the link (in person, by phone). The deal stays open until you mark it won."
        confirmLabel="Record accepted"
        onConfirm={() => run(acceptQuote(quote.id), "Quote accepted")}
      />
      <ConfirmDialog
        open={action === "decline"}
        onOpenChange={(o) => !o && setAction(null)}
        title="Record that the customer declined?"
        description="The deal stays open so you can revise the offer or mark it lost."
        confirmLabel="Record declined"
        onConfirm={() => run(declineQuote(quote.id, reason.trim()), "Quote declined")}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="decline-reason">Reason (optional)</Label>
          <Input id="decline-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Price too high" />
        </div>
      </ConfirmDialog>
      <ConfirmDialog open={action === "expire"} onOpenChange={(o) => !o && setAction(null)} title="Record as expired?" description="The quote can no longer be accepted." confirmLabel="Record expired" onConfirm={() => run(expireQuote(quote.id), "Quote recorded as expired")} />
      <ConfirmDialog
        open={action === "pay"}
        onOpenChange={(o) => !o && setAction(null)}
        title="Record a payment?"
        description={`Record that ${formatAmount(total, quote.currency)} was received. This prototype has no payment provider — nothing is charged.`}
        confirmLabel="Record payment"
        onConfirm={() => run(recordPayment(quote.id, ref.trim() || "manual entry"), "Payment recorded")}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="pay-ref">Reference (optional)</Label>
          <Input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. MoMo transaction ID or receipt number" />
        </div>
      </ConfirmDialog>
      <CloseDealDialog deal={closeDeal && deal ? deal : null} outcome="won" onOpenChange={(o) => !o && setCloseDeal(false)} />
      <span className="sr-only">Status: {QUOTE_STATUS_LABELS[status]}</span>
    </PageContainer>
  );
}
