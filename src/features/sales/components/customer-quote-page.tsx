"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleDollarSign, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils/format";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useRehydrateStores } from "@/components/layout/app-shell";
import { InlineNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatAmount, lineTotals } from "../lib/calc";
import { acceptQuote, declineQuote, effectiveStatus, markOpened, recordPayment } from "../services/quotes-service";
import { QuoteDocument } from "./quote-document";

/**
 * Simulated customer-facing quote page. It reads the same browser storage as the
 * CRM, so it only works in the browser that created the quote.
 */
export function CustomerQuotePage({ quoteId }: { quoteId: string }) {
  const hydrated = useRehydrateStores();
  const db = useDbStore((s) => s.db);
  const quote = hydrated ? db.quotes.find((q) => q.id === quoteId) : undefined;
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated) void markOpened(quoteId);
  }, [hydrated, quoteId]);

  const banner = (
    <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs text-[#7a4206]">
      <FlaskConical className="mr-1 inline size-3.5" /> Prototype customer view — simulated. No email was sent, nothing here is charged, and it only works in this browser.
    </div>
  );

  if (!hydrated)
    return (
      <div className="min-h-screen bg-panel">
        {banner}
        <div className="mx-auto max-w-3xl p-6"><Skeleton className="h-96 rounded-2xl" /></div>
      </div>
    );
  if (!quote || quote.status === "draft")
    return (
      <div className="min-h-screen bg-panel">
        {banner}
        <div className="mx-auto max-w-xl p-6 pt-20 text-center">
          <h1 className="text-xl font-semibold">This quote isn&apos;t available</h1>
          <p className="mt-2 text-muted-foreground">The link may be wrong, or the quote hasn&apos;t been sent yet.</p>
        </div>
      </div>
    );

  const status = effectiveStatus(quote);
  const taxes = db.taxes;
  const total = lineTotals(quote.lineItems, taxes).total;
  const seller = db.orgs.find((o) => o.id === quote.orgId)?.name ?? "Supplier";
  const act = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (r.ok) toast.success(msg);
    else toast.error(r.error);
  };

  return (
    <div className="min-h-screen bg-panel pb-16">
      {banner}
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-8 sm:px-6">
        <QuoteDocument quote={quote} sellerName={seller} taxes={taxes} />
        <section className="rounded-2xl border border-border bg-card p-6" aria-live="polite">
          {status === "sent" && !declining && (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                Total <span className="font-semibold tabular-nums">{formatAmount(total, quote.currency)}</span> · valid until {formatDate(quote.validUntil)}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDeclining(true)} disabled={busy}>
                  Decline
                </Button>
                <Button onClick={() => act(acceptQuote(quote.id, "customer"), "Quote accepted")} disabled={busy}>
                  Accept quote
                </Button>
              </div>
            </div>
          )}
          {status === "sent" && declining && (
            <div className="grid gap-3">
              <Label htmlFor="c-reason">Tell {seller} why (optional)</Label>
              <Textarea id="c-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeclining(false)}>
                  Back
                </Button>
                <Button onClick={() => act(declineQuote(quote.id, reason.trim(), "customer"), "Quote declined")} disabled={busy}>
                  Decline quote
                </Button>
              </div>
            </div>
          )}
          {status === "accepted" && (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-success" /> You accepted this quote. {seller} will be in touch.
              </p>
              <Button onClick={() => act(recordPayment(quote.id, `SIM-${quote.number}`, "customer"), "Payment simulated")} disabled={busy}>
                <CircleDollarSign /> Simulate payment
              </Button>
            </div>
          )}
          {status === "paid" && <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-success" /> Paid {formatDate(quote.paidAt)}. Thank you. (Simulated — no money moved.)</p>}
          {status === "declined" && <p className="text-sm">You declined this quote{quote.declineReason ? `: “${quote.declineReason}”` : ""}.</p>}
          {status === "expired" && <InlineNotice tone="warning">This quote expired on {formatDate(quote.validUntil)}. Ask {seller} for an updated quote.</InlineNotice>}
        </section>
      </main>
    </div>
  );
}
