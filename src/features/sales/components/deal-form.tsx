"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/permissions";
import { useAssignableOwners } from "@/features/contacts/hooks/use-contacts";
import { visibleContacts } from "@/features/contacts/lib/access";
import { AccountSelect } from "@/features/accounts/components/account-select";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { OwnerSelect } from "@/components/forms/owner-select";
import { useBeforeUnload } from "@/components/forms/use-unsaved-changes";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSales } from "../hooks/use-sales";
import { dealValue, formatAmount } from "../lib/calc";
import { dealFormSchema, dealToForm, type DealFormValues } from "../schemas/deal-form";
import { createDeal, updateDeal } from "../services/deals-service";
import type { Currency, Deal } from "../types";
import { ContactSelect } from "./contact-select";
import { FormFooter } from "./form-footer";
import { LineItemEditor } from "./line-item-editor";

export function DealForm({ deal }: { deal?: Deal }) {
  const router = useRouter();
  const params = useSearchParams();
  const user = useCurrentUser();
  const owners = useAssignableOwners();
  const { db, taxes } = useSales();
  const pipeline = db.pipelines[0];
  const openStages = pipeline.stages.filter((s) => s.kind === "open");
  const contacts = useMemo(() => visibleContacts(db, user).filter((c) => c.status === "active"), [db, user]);
  const accounts = useMemo(() => db.accounts.filter((a) => a.orgId === user.orgId), [db.accounts, user.orgId]);
  const accountName = (id?: string | null) => (id ? accounts.find((a) => a.id === id)?.name : undefined);

  // Lazy state: computed once per mount (the page is keyed by deal id).
  const [defaults] = useState<DealFormValues>(() => {
    if (deal) return dealToForm(deal);
    const contactId = params.get("contactId") ?? "";
    const c = contacts.find((x) => x.id === contactId);
    return {
      title: "", pipelineId: pipeline.id, stageId: openStages[0].id, contactId: c?.id ?? "", accountId: params.get("accountId") ?? c?.accountId ?? "",
      expectedClose: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), probability: "", ownerId: owners.some((o) => o.id === user.id) ? user.id : "",
      valuation: "manual", currency: "GHS", amount: "", lineItems: [], notes: "",
    };
  });

  const { register, control, handleSubmit, formState, setValue, getValues } = useForm<DealFormValues>({ resolver: zodResolver(dealFormSchema), defaultValues: defaults, mode: "onTouched" });
  const { errors, isDirty, isSubmitting } = formState;
  const [saved, setSaved] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  useBeforeUnload(isDirty && !saved);
  const [valuation, currency, stageId, lineItems, amount] = useWatch({ control, name: ["valuation", "currency", "stageId", "lineItems", "amount"] });
  const stage = openStages.find((s) => s.id === stageId);
  const total = dealValue({ valuation, amount: Number(amount?.replace(/,/g, "")) || 0, lineItems: lineItems ?? [] }, taxes);
  const closed = deal && deal.status !== "open";
  const cancelHref = deal ? `/deals/${deal.id}` : "/deals";

  const changeCurrency = (c: Currency) => {
    const lines = getValues("lineItems");
    const kept = lines.filter((l) => !l.productId || db.products.find((p) => p.id === l.productId)?.currency === c);
    if (kept.length !== lines.length) toast.info(`Removed ${lines.length - kept.length} product line${lines.length - kept.length === 1 ? "" : "s"} priced in another currency.`);
    setValue("lineItems", kept, { shouldDirty: true });
    setValue("currency", c, { shouldDirty: true });
  };

  const save = async (v: DealFormValues) => {
    const r = deal ? await updateDeal(deal.id, v) : await createDeal(v);
    if (!r.ok) return void toast.error(r.error);
    setSaved(true);
    toast.success(deal ? "Deal saved" : `“${r.data.title}” created`);
    router.push(`/deals/${r.data.id}`);
  };
  const guarded = (href: string) => {
    if (isDirty && !saved) {
      setLeaveTo(href);
      return false;
    }
    return true;
  };

  return (
    <PageContainer width="narrow" className="pb-28">
      <PageHeader
        breadcrumbs={<Breadcrumbs onNavigate={guarded} items={[{ label: "Deals", href: "/deals" }, ...(deal ? [{ label: deal.title, href: `/deals/${deal.id}` }] : []), { label: deal ? "Edit" : "New deal" }]} />}
        title={deal ? `Edit ${deal.title}` : "New deal"}
        description={deal ? undefined : "A deal is an opportunity you're working to win. Only the title is required."}
      />
      <form id="deal-form" onSubmit={(e) => handleSubmit(save, () => toast.error("Some details need attention"))(e)} noValidate className="flex flex-col gap-5">
        <FormSection title="Deal">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="title" error={errors.title?.message} className="sm:col-span-2">
              <Input id="title" autoFocus={!deal} aria-invalid={!!errors.title} {...register("title")} placeholder="e.g. Branch seating roll-out" />
            </Field>
            <Field label="Pipeline" htmlFor="pipelineId">
              <Select value={pipeline.id} disabled>
                <SelectTrigger id="pipelineId" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={pipeline.id}>{pipeline.name}</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Stage" htmlFor="stageId" hint={closed ? "Closed deals keep their outcome. Reopen the deal to change stage." : undefined}>
              <Controller control={control} name="stageId" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!!closed}>
                  <SelectTrigger id="stageId" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(closed ? pipeline.stages : openStages).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{s.kind === "open" ? ` (${s.probability}%)` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Owner" htmlFor="ownerId">
              <Controller control={control} name="ownerId" render={({ field }) => <OwnerSelect id="ownerId" value={field.value} onChange={field.onChange} owners={owners} />} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Customer">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact" htmlFor="contactId" hint="Choosing a contact fills in their company." optional>
              <Controller control={control} name="contactId" render={({ field }) => (
                <ContactSelect id="contactId" value={field.value} contacts={contacts} accountName={accountName} onChange={(v) => {
                  field.onChange(v);
                  const c = contacts.find((x) => x.id === v);
                  if (c?.accountId && !getValues("accountId")) setValue("accountId", c.accountId, { shouldDirty: true });
                }} />
              )} />
            </Field>
            <Field label="Company" htmlFor="accountId" optional>
              <Controller control={control} name="accountId" render={({ field }) => <AccountSelect id="accountId" value={field.value} onChange={field.onChange} accounts={accounts} placeholder="No company" />} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Value" description="Enter one amount, or add up products and services from the catalogue.">
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Valuation method">
              {([["manual", "Enter the value", "Type a single amount."], ["products", "Add up products", "Use line items with quantities, discounts and tax."]] as const).map(([v, t, d]) => (
                <label key={v} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 has-focus-visible:ring-2 has-focus-visible:ring-ring", valuation === v ? "border-brand-700 bg-brand-50/60" : "border-border hover:bg-secondary/50")}>
                  <input type="radio" name="valuation" checked={valuation === v} onChange={() => setValue("valuation", v, { shouldDirty: true, shouldValidate: formState.isSubmitted })} className="mt-1 accent-[var(--brand-700)]" />
                  <span><span className="block text-sm font-medium">{t}</span><span className="block text-sm text-muted-foreground">{d}</span></span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Currency" htmlFor="currency">
                <Select value={currency} onValueChange={(v) => changeCurrency(v as Currency)}>
                  <SelectTrigger id="currency" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GHS">GHS — Ghana cedi</SelectItem>
                    <SelectItem value="USD">USD — US dollar</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {valuation === "manual" && (
                <Field label="Amount" htmlFor="amount" error={errors.amount?.message} className="sm:col-span-2">
                  <Input id="amount" inputMode="decimal" aria-invalid={!!errors.amount} {...register("amount")} placeholder="0.00" />
                </Field>
              )}
            </div>
            {valuation === "products" && (
              <Controller control={control} name="lineItems" render={({ field }) => (
                <LineItemEditor items={field.value} onChange={field.onChange} currency={currency} products={db.products} taxes={taxes} error={errors.lineItems?.message ?? (Array.isArray(errors.lineItems) ? "Check the highlighted line items." : undefined)} />
              )} />
            )}
            <p className="text-sm text-muted-foreground">
              Deal value: <span className="font-medium text-foreground tabular-nums">{formatAmount(total, currency)}</span>
            </p>
          </div>
        </FormSection>

        <FormSection title="Timing and chance of winning">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expected close date" htmlFor="expectedClose" error={errors.expectedClose?.message}>
              <Input id="expectedClose" type="date" {...register("expectedClose")} />
            </Field>
            <Field label="Chance of winning (%)" htmlFor="probability" error={errors.probability?.message} hint={`Leave blank to use the stage default${stage ? ` (${stage.probability}%)` : ""}. Used for the weighted forecast.`} optional>
              <Input id="probability" inputMode="numeric" placeholder={stage ? String(stage.probability) : ""} aria-invalid={!!errors.probability} {...register("probability")} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Notes">
          <Field label="Notes" htmlFor="notes" optional>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </Field>
        </FormSection>
      </form>
      <FormFooter dirty={isDirty} busy={isSubmitting} onCancel={() => guarded(cancelHref) && router.push(cancelHref)} submitLabel={deal ? "Save changes" : "Create deal"} formId="deal-form" disabled={!!deal && !isDirty} />
      <ConfirmDialog open={!!leaveTo} onOpenChange={(o) => !o && setLeaveTo(null)} title="Discard unsaved changes?" description="Your changes to this deal haven't been saved." confirmLabel="Discard changes" cancelLabel="Keep editing" destructive onConfirm={() => { setSaved(true); router.push(leaveTo!); }} />
    </PageContainer>
  );
}
