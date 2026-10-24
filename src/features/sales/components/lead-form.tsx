"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCurrentUser } from "@/features/permissions";
import { useAssignableOwners } from "@/features/contacts/hooks/use-contacts";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { OwnerSelect } from "@/components/forms/owner-select";
import { useBeforeUnload } from "@/components/forms/use-unsaved-changes";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { emptyLeadForm, leadFormSchema, leadToForm, type LeadFormValues } from "../schemas/lead-form";
import { createLead, updateLead } from "../services/leads-service";
import { LEAD_SOURCE_LABELS, RATING_LABELS, type Lead, type LeadSource, type Rating } from "../types";
import { FormFooter } from "./form-footer";

const NONE = "__none";

export function LeadForm({ lead }: { lead?: Lead }) {
  const router = useRouter();
  const user = useCurrentUser();
  const owners = useAssignableOwners();
  const defaults = useMemo(() => (lead ? leadToForm(lead) : emptyLeadForm("auto")), [lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { register, control, handleSubmit, formState } = useForm<LeadFormValues>({ resolver: zodResolver(leadFormSchema), defaultValues: defaults, mode: "onTouched" });
  const { errors, isDirty, isSubmitting } = formState;
  const [saved, setSaved] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  useBeforeUnload(isDirty && !saved);
  const cancelHref = lead ? `/leads/${lead.id}` : "/leads";

  const save = async (v: LeadFormValues) => {
    const r = lead ? await updateLead(lead.id, v) : await createLead(v);
    if (!r.ok) return void toast.error(r.error);
    setSaved(true);
    const owner = r.data.ownerId ? owners.find((o) => o.id === r.data.ownerId)?.name : undefined;
    toast.success(lead ? "Lead saved" : `${r.data.name} added`, { description: !lead && v.ownerId === "auto" ? (owner ? `Assigned automatically to ${owner}.` : "No eligible owner — left unassigned.") : undefined });
    router.push(`/leads/${r.data.id}`);
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
        breadcrumbs={<Breadcrumbs onNavigate={guarded} items={[{ label: "Leads", href: "/leads" }, ...(lead ? [{ label: lead.name, href: `/leads/${lead.id}` }] : []), { label: lead ? "Edit" : "New lead" }]} />}
        title={lead ? `Edit ${lead.name}` : "New lead"}
        description={lead ? undefined : "Only a name is required. Capture what you know now; you can qualify the lead later."}
      />
      <form id="lead-form" onSubmit={(e) => handleSubmit(save, () => toast.error("Some details need attention"))(e)} noValidate className="flex flex-col gap-5">
        <FormSection title="Lead information">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" error={errors.name?.message} className="sm:col-span-2">
              <Input id="name" autoFocus={!lead} aria-invalid={!!errors.name} {...register("name")} placeholder="Person or business name" />
            </Field>
            <Field label="Company" htmlFor="company" optional>
              <Input id="company" {...register("company")} />
            </Field>
            <Field label="Job title" htmlFor="jobTitle" optional>
              <Input id="jobTitle" {...register("jobTitle")} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Contact details">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message} optional>
              <Input id="phone" type="tel" aria-invalid={!!errors.phone} {...register("phone")} placeholder="024 123 4567" />
            </Field>
            <Field label="Email" htmlFor="email" error={errors.email?.message} optional>
              <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
            </Field>
            <Field label="City / town" htmlFor="city" optional>
              <Input id="city" {...register("city")} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Business opportunity">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="What they want" htmlFor="need" className="sm:col-span-6" optional>
              <Textarea id="need" rows={2} {...register("need")} placeholder="e.g. 40 office chairs for a new branch" />
            </Field>
            <Field label="Estimated value" htmlFor="estimatedValue" error={errors.estimatedValue?.message} className="sm:col-span-3" optional>
              <Input id="estimatedValue" inputMode="decimal" aria-invalid={!!errors.estimatedValue} {...register("estimatedValue")} />
            </Field>
            <Field label="Currency" htmlFor="currency" className="sm:col-span-1">
              <Controller control={control} name="currency" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="currency" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GHS">GHS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Rating" htmlFor="rating" className="sm:col-span-2">
              <Controller control={control} name="rating" render={({ field }) => (
                <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : (v as Rating))}>
                  <SelectTrigger id="rating" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not rated</SelectItem>
                    {(Object.keys(RATING_LABELS) as Rating[]).map((r) => <SelectItem key={r} value={r}>{RATING_LABELS[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Source and ownership">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lead source" htmlFor="source">
              <Controller control={control} name="source" render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v as LeadSource)}>
                  <SelectTrigger id="source" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((s) => <SelectItem key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Source detail" htmlFor="sourceDetail" hint="e.g. who referred them, which event or advert" optional>
              <Input id="sourceDetail" {...register("sourceDetail")} />
            </Field>
            <Field label="Owner" htmlFor="ownerId" className="sm:col-span-2" hint={!lead ? "Automatic assignment picks the person with the fewest open leads (prototype rule)." : undefined}>
              <Controller control={control} name="ownerId" render={({ field }) => <OwnerSelect id="ownerId" value={field.value} onChange={field.onChange} owners={owners} autoOption={!lead ? "Assign automatically" : undefined} className="sm:max-w-sm" currentOwnerLabel={user.name} />} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Additional notes">
          <Field label="Notes" htmlFor="notes" optional>
            <Textarea id="notes" rows={4} {...register("notes")} />
          </Field>
        </FormSection>
      </form>
      <FormFooter dirty={isDirty} busy={isSubmitting} onCancel={() => guarded(cancelHref) && router.push(cancelHref)} submitLabel={lead ? "Save changes" : "Create lead"} formId="lead-form" disabled={!!lead && !isDirty} />
      <ConfirmDialog open={!!leaveTo} onOpenChange={(o) => !o && setLeaveTo(null)} title="Discard unsaved changes?" description="Your changes to this lead haven't been saved." confirmLabel="Discard changes" cancelLabel="Keep editing" destructive onConfirm={() => { setSaved(true); router.push(leaveTo!); }} />
    </PageContainer>
  );
}
