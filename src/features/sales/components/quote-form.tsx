"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { useBeforeUnload } from "@/components/forms/use-unsaved-changes";
import { InlineNotice } from "@/components/feedback/states";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createId } from "@/lib/utils/id";
import { primaryMethod } from "@/features/contacts/lib/filters";
import { useSales } from "../hooks/use-sales";
import { createQuote, DEFAULT_TERMS, updateQuote, type QuoteInput } from "../services/quotes-service";
import type { Deal, LineItem, Quote } from "../types";
import { FormFooter } from "./form-footer";
import { LineItemEditor } from "./line-item-editor";

const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10);

export function QuoteForm({ deal, quote }: { deal: Deal; quote?: Quote }) {
  const router = useRouter();
  const { db, contacts, accounts, taxes } = useSales();
  const [v, setV] = useState<QuoteInput>(() => {
    if (quote) return { customer: { ...quote.customer }, issueDate: quote.issueDate, validUntil: quote.validUntil, lineItems: quote.lineItems.map((l) => ({ ...l })), notes: quote.notes ?? "", terms: quote.terms ?? "" };
    const c = deal.contactId ? contacts.get(deal.contactId) : undefined;
    const a = deal.accountId ? accounts.get(deal.accountId) : undefined;
    const today = new Date().toISOString().slice(0, 10);
    // Products deals copy their lines; a manual-value deal starts with one line at the deal amount.
    const lines: LineItem[] = deal.valuation === "products" ? deal.lineItems.map((l) => ({ ...l, id: createId("li") })) : [{ id: createId("li"), productId: null, name: deal.title, quantity: 1, unitPrice: deal.amount, discountPct: 0, taxId: null, taxInclusive: false }];
    return {
      customer: { name: c?.displayName ?? a?.name ?? "", company: a?.name ?? "", email: c ? (primaryMethod(c, "email")?.value ?? "") : "", phone: c ? (primaryMethod(c, "phone")?.value ?? "") : "", address: a?.billingAddress ? [a.billingAddress.line1, a.billingAddress.city].filter(Boolean).join(", ") : "" },
      issueDate: today,
      validUntil: addDays(today, 30),
      lineItems: lines,
      notes: "",
      terms: DEFAULT_TERMS,
    };
  });
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useBeforeUnload(dirty && !saving);
  const set = (p: Partial<QuoteInput>) => {
    setDirty(true);
    setV((s) => ({ ...s, ...p }));
  };
  const setCustomer = (p: Partial<QuoteInput["customer"]>) => set({ customer: { ...v.customer, ...p } });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input: QuoteInput = { ...v, lineItems: v.lineItems.map((l) => ({ ...l, productId: l.productId || null })) };
    const r = quote ? await updateQuote(quote.id, input) : await createQuote(deal.id, input);
    if (!r.ok) {
      setSaving(false);
      setError(r.error);
      return;
    }
    toast.success(quote ? "Quote saved" : `Quote ${r.data.number} created`, { description: "It's a draft until you send it." });
    router.push(`/quotes/${r.data.id}`);
  };

  return (
    <PageContainer width="narrow" className="pb-28">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Quotes", href: "/quotes" }, ...(quote ? [{ label: quote.number, href: `/quotes/${quote.id}` }, { label: "Edit" }] : [{ label: "New quote" }])]} />}
        title={quote ? `Edit ${quote.number}` : "New quote"}
        description={
          <>
            For <Link href={`/deals/${deal.id}`} className="text-foreground underline decoration-border-strong underline-offset-4">{deal.title}</Link> in {deal.currency}. The quote keeps its own copy of the prices — later product changes won&apos;t alter it.
          </>
        }
      />
      <form id="quote-form" onSubmit={save} className="flex flex-col gap-6" noValidate>
        <FormSection title="Customer" description="Prefilled from the deal's contact and company. Edit for this quote only.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="q-name">
              <Input id="q-name" value={v.customer.name} onChange={(e) => setCustomer({ name: e.target.value })} />
            </Field>
            <Field label="Company" htmlFor="q-company" optional>
              <Input id="q-company" value={v.customer.company ?? ""} onChange={(e) => setCustomer({ company: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="q-email" optional>
              <Input id="q-email" type="email" value={v.customer.email ?? ""} onChange={(e) => setCustomer({ email: e.target.value })} />
            </Field>
            <Field label="Phone" htmlFor="q-phone" optional>
              <Input id="q-phone" type="tel" value={v.customer.phone ?? ""} onChange={(e) => setCustomer({ phone: e.target.value })} />
            </Field>
            <Field label="Address" htmlFor="q-address" className="sm:col-span-2" optional>
              <Input id="q-address" value={v.customer.address ?? ""} onChange={(e) => setCustomer({ address: e.target.value })} />
            </Field>
          </div>
        </FormSection>
        <FormSection title="Dates">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Issue date" htmlFor="q-issue">
              <Input id="q-issue" type="date" value={v.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
            </Field>
            <Field label="Valid until" htmlFor="q-valid" hint="After this date the quote shows as expired.">
              <Input id="q-valid" type="date" value={v.validUntil} min={v.issueDate} onChange={(e) => set({ validUntil: e.target.value })} />
            </Field>
          </div>
        </FormSection>
        <FormSection title="Items">
          <LineItemEditor items={v.lineItems} onChange={(lineItems) => set({ lineItems })} currency={deal.currency} products={db.products.filter((p) => p.orgId === deal.orgId)} taxes={taxes} />
        </FormSection>
        <FormSection title="Notes and terms">
          <div className="grid gap-4">
            <Field label="Note to the customer" htmlFor="q-notes" optional>
              <Textarea id="q-notes" rows={2} value={v.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Delivery within 3 weeks of deposit." />
            </Field>
            <Field label="Terms" htmlFor="q-terms" optional>
              <Textarea id="q-terms" rows={3} value={v.terms ?? ""} onChange={(e) => set({ terms: e.target.value })} />
            </Field>
          </div>
        </FormSection>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      </form>
      <FormFooter dirty={dirty} busy={saving} formId="quote-form" submitLabel={quote ? "Save draft" : "Create draft quote"} onCancel={() => router.push(quote ? `/quotes/${quote.id}` : `/deals/${deal.id}`)} />
    </PageContainer>
  );
}
