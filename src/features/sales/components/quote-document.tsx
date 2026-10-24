import { formatDate } from "@/lib/utils/format";
import { formatAmount, lineResult, lineTotals } from "../lib/calc";
import type { Quote, Tax } from "../types";

/** The quote as the customer sees it. Shared by the staff preview and the simulated customer page. */
export function QuoteDocument({ quote, sellerName, taxes }: { quote: Quote; sellerName: string; taxes: Tax[] }) {
  const totals = lineTotals(quote.lineItems, taxes);
  const c = quote.customer;
  return (
    <article className="rounded-2xl border border-border bg-card text-sm" aria-label={`Quote ${quote.number}`}>
      <header className="flex flex-col gap-6 border-b border-border/70 p-6 sm:flex-row sm:justify-between sm:p-8">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Quote</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums">{quote.number}</h2>
          <p className="mt-1 text-muted-foreground">From {sellerName}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 self-start sm:text-right">
          <dt className="text-muted-foreground">Issued</dt>
          <dd className="tabular-nums">{formatDate(quote.issueDate)}</dd>
          <dt className="text-muted-foreground">Valid until</dt>
          <dd className="font-medium tabular-nums">{formatDate(quote.validUntil)}</dd>
          <dt className="text-muted-foreground">Currency</dt>
          <dd>{quote.currency}</dd>
        </dl>
      </header>
      <section className="border-b border-border/70 p-6 sm:px-8" aria-label="Prepared for">
        <p className="text-xs font-medium text-muted-foreground">Prepared for</p>
        <p className="mt-1 font-medium">{c.name}</p>
        {c.company && <p>{c.company}</p>}
        <p className="text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
        {c.address && <p className="whitespace-pre-line text-muted-foreground">{c.address}</p>}
      </section>
      <div className="overflow-x-auto px-6 pt-4 sm:px-8">
        <table className="w-full min-w-[34rem]">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border/70">
              <th scope="col" className="py-2 pr-3 text-left font-medium">Description</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Qty</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Unit price</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Discount</th>
              <th scope="col" className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {quote.lineItems.map((li) => {
              const tax = taxes.find((t) => t.id === li.taxId);
              return (
                <tr key={li.id} className="align-top">
                  <td className="py-3 pr-3">
                    <p className="font-medium">{li.name}</p>
                    {li.description && <p className="text-xs text-muted-foreground">{li.description}</p>}
                    {tax && <p className="text-xs text-muted-foreground">{tax.name} {tax.rate}%{li.taxInclusive ? " included" : ""}</p>}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">{li.quantity}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{formatAmount(li.unitPrice, quote.currency)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{li.discountPct ? `${li.discountPct}%` : "—"}</td>
                  <td className="py-3 text-right font-medium tabular-nums">{formatAmount(lineResult(li, taxes).total, quote.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end px-6 py-5 sm:px-8">
        <dl className="w-full max-w-xs space-y-1.5">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatAmount(totals.subtotal, quote.currency)}</dd></div>
          {totals.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{formatAmount(totals.discount, quote.currency)}</dd></div>}
          {totals.taxByName.map((t) => (
            <div key={t.name} className="flex justify-between"><dt className="text-muted-foreground">{t.name}</dt><dd className="tabular-nums">{formatAmount(t.amount, quote.currency)}</dd></div>
          ))}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatAmount(totals.total, quote.currency)}</dd></div>
        </dl>
      </div>
      {(quote.notes || quote.terms) && (
        <footer className="space-y-3 border-t border-border/70 p-6 text-muted-foreground sm:px-8">
          {quote.notes && <p className="whitespace-pre-line text-foreground">{quote.notes}</p>}
          {quote.terms && (
            <div>
              <p className="text-xs font-medium">Terms</p>
              <p className="whitespace-pre-line">{quote.terms}</p>
            </div>
          )}
        </footer>
      )}
    </article>
  );
}
