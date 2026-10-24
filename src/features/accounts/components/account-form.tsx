"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { COUNTRIES, GHANA_REGIONS } from "@/lib/mock-data/reference";
import { useDbStore } from "@/lib/mock-data/db-store";
import { hasPermission } from "@/lib/permissions";
import { useCurrentUser } from "@/features/permissions";
import { useAssignableOwners } from "@/features/contacts/hooks/use-contacts";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { OwnerSelect } from "@/components/forms/owner-select";
import { TagInput } from "@/components/forms/tag-input";
import { useBeforeUnload } from "@/components/forms/use-unsaved-changes";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useVisibleAccounts } from "../hooks/use-accounts";
import { descendantIds } from "../lib/hierarchy";
import { accountFormSchema, accountToForm, emptyAccountForm, type AccountFormValues } from "../schemas/account-form";
import { createAccount, updateAccount } from "../services/accounts-service";
import { ACCOUNT_OWNERSHIP_LABELS, ACCOUNT_RATING_LABELS, ACCOUNT_SIZE_LABELS, ACCOUNT_TYPE_LABELS, type Account } from "../types";
import { AccountSelect } from "./account-select";

const NONE = "__none";

function EnumSelect<T extends string>({ id, value, onChange, labels, noneLabel }: { id: string; value: T | ""; onChange: (v: T | "") => void; labels: Record<T, string>; noneLabel?: string }) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : (v as T))}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {(Object.keys(labels) as T[]).map((k) => (
          <SelectItem key={k} value={k}>
            {labels[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Disclosure({ title, hint, open, onOpenChange, children }: { title: string; hint: string; open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-2xl border border-border bg-card">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl px-6 py-5 text-left hover:bg-[#f8fbfc] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span>
          <span className="block text-base font-semibold">{title}</span>
          <span className="block text-sm text-muted-foreground">{hint}</span>
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/70 px-6 pt-5 pb-6">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AccountForm({ mode, account }: { mode: "create" | "edit"; account?: Account }) {
  const router = useRouter();
  const params = useSearchParams();
  const user = useCurrentUser();
  const owners = useAssignableOwners();
  const accounts = useVisibleAccounts();
  const allAccounts = useDbStore((s) => s.db.accounts);
  const tagSuggestions = useMemo(() => [...new Set(allAccounts.flatMap((a) => a.tags))].sort(), [allAccounts]);
  const presetParent = params.get("parentId") ?? "";
  const defaults = useMemo(
    () => (account ? accountToForm(account) : emptyAccountForm(user.role === "crm_user" || owners.some((o) => o.id === user.id) ? user.id : "", accounts.some((a) => a.id === presetParent) ? presetParent : "")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account?.id],
  );
  const form = useForm<AccountFormValues>({ resolver: zodResolver(accountFormSchema), defaultValues: defaults, mode: "onTouched" });
  const { register, control, handleSubmit, formState } = form;
  const { errors, isDirty, isSubmitting } = formState;
  const [saved, setSaved] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [businessOpen, setBusinessOpen] = useState(() => !!account && !!(account.ownership || account.employees || account.size || account.annualRevenue || account.accountNumber));
  const [addressOpen, setAddressOpen] = useState(() => !!account && !!(account.billingAddress || account.shippingAddress || account.tags.length || account.notes));
  const shippingSame = useWatch({ control, name: "shippingSame" });
  useBeforeUnload(isDirty && !saved);

  // A parent can't be this account or one of its branches.
  const parentChoices = useMemo(() => {
    if (!account) return accounts;
    const blocked = descendantIds(accounts, account.id);
    blocked.add(account.id);
    return accounts.filter((a) => !blocked.has(a.id));
  }, [accounts, account]);
  const ownerLocked = mode === "edit" && !hasPermission(user, "contacts.reassign");

  const save = async (values: AccountFormValues) => {
    const res = mode === "create" ? await createAccount(values) : await updateAccount(account!.id, values);
    if (!res.ok) return void toast.error(res.error);
    setSaved(true);
    toast.success(mode === "create" ? `${res.data.name} added` : "Changes saved");
    router.push(`/accounts/${res.data.id}`);
  };
  const onInvalid = () => {
    toast.error("Some details need attention", { description: "Check the highlighted fields." });
    if (errors.phone || errors.email || errors.website || errors.employees || errors.annualRevenue) setBusinessOpen(true);
  };
  const guarded = (href: string) => {
    if (isDirty && !saved) {
      setLeaveTo(href);
      return false;
    }
    return true;
  };
  const cancelHref = account ? `/accounts/${account.id}` : "/accounts";
  const parentName = accounts.find((a) => a.id === presetParent)?.name;

  return (
    <PageContainer width="narrow" className="pb-28">
      <PageHeader
        breadcrumbs={<Breadcrumbs onNavigate={guarded} items={[{ label: "Accounts", href: "/accounts" }, ...(account ? [{ label: account.name, href: `/accounts/${account.id}` }] : []), { label: mode === "create" ? "New account" : "Edit" }]} />}
        title={mode === "create" ? (parentName ? `New branch of ${parentName}` : "New account") : `Edit ${account!.name}`}
        description={mode === "create" ? "Only the name is required. Add the rest now or later." : undefined}
      />
      <form id="account-form" onSubmit={(e) => handleSubmit(save, onInvalid)(e)} noValidate className="flex flex-col gap-5">
        <FormSection title="Account basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account name" htmlFor="name" error={errors.name?.message} className="sm:col-span-2">
              <Input id="name" aria-invalid={!!errors.name} {...register("name")} autoFocus={mode === "create"} />
            </Field>
            <Field label="Type" htmlFor="type">
              <Controller control={control} name="type" render={({ field }) => <EnumSelect id="type" value={field.value} onChange={(v) => field.onChange(v || "customer")} labels={ACCOUNT_TYPE_LABELS} />} />
            </Field>
            <Field label="Rating" htmlFor="rating" optional>
              <Controller control={control} name="rating" render={({ field }) => <EnumSelect id="rating" value={field.value} onChange={field.onChange} labels={ACCOUNT_RATING_LABELS} noneLabel="Not rated" />} />
            </Field>
            <Field label="Owner" htmlFor="ownerId" hint={ownerLocked ? "Your role can't change the owner." : undefined}>
              <Controller control={control} name="ownerId" render={({ field }) => <OwnerSelect id="ownerId" value={field.value} onChange={field.onChange} owners={owners} disabled={ownerLocked} />} />
            </Field>
            <Field label="Parent account" htmlFor="parentId" hint="Set this for a branch. Branches don't inherit contacts, owners or billing details." optional>
              <Controller control={control} name="parentId" render={({ field }) => <AccountSelect id="parentId" value={field.value} onChange={field.onChange} accounts={parentChoices} />} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Contact and business information">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message} optional>
              <Input id="phone" type="tel" aria-invalid={!!errors.phone} {...register("phone")} />
            </Field>
            <Field label="Email" htmlFor="email" error={errors.email?.message} optional>
              <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
            </Field>
            <Field label="Website" htmlFor="website" error={errors.website?.message} optional>
              <Input id="website" placeholder="company.com" aria-invalid={!!errors.website} {...register("website")} />
            </Field>
            <Field label="Industry" htmlFor="industry" optional>
              <Input id="industry" {...register("industry")} />
            </Field>
          </div>
          <div className="mt-4">
            <Collapsible open={businessOpen} onOpenChange={setBusinessOpen}>
              <CollapsibleTrigger className="flex cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium text-primary hover:underline">
                <ChevronDown className={cn("size-4 transition-transform", businessOpen && "rotate-180")} />
                {businessOpen ? "Hide" : "Show"} account number, ownership, size and revenue
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-4 pt-4 sm:grid-cols-2">
                  <Field label="Account number" htmlFor="accountNumber" hint="Used first when matching imports." optional>
                    <Input id="accountNumber" {...register("accountNumber")} />
                  </Field>
                  <Field label="Ownership" htmlFor="ownership" optional>
                    <Controller control={control} name="ownership" render={({ field }) => <EnumSelect id="ownership" value={field.value} onChange={field.onChange} labels={ACCOUNT_OWNERSHIP_LABELS} noneLabel="Not specified" />} />
                  </Field>
                  <Field label="Employees" htmlFor="employees" error={errors.employees?.message} optional>
                    <Input id="employees" inputMode="numeric" aria-invalid={!!errors.employees} {...register("employees")} />
                  </Field>
                  <Field label="Size" htmlFor="size" optional>
                    <Controller control={control} name="size" render={({ field }) => <EnumSelect id="size" value={field.value} onChange={field.onChange} labels={ACCOUNT_SIZE_LABELS} noneLabel="Not specified" />} />
                  </Field>
                  <Field label="Annual revenue (GHS)" htmlFor="annualRevenue" error={errors.annualRevenue?.message} optional>
                    <Input id="annualRevenue" inputMode="decimal" aria-invalid={!!errors.annualRevenue} {...register("annualRevenue")} />
                  </Field>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </FormSection>

        <Disclosure title="Addresses and notes" hint="Billing and shipping addresses, tags and notes" open={addressOpen} onOpenChange={setAddressOpen}>
          <div className="space-y-6">
            <AddressFields prefix="billingAddress" title="Billing address" register={register} />
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm">
                <Controller control={control} name="shippingSame" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
                Shipping address is the same as billing
              </label>
              {!shippingSame && <AddressFields prefix="shippingAddress" title="Shipping address" register={register} />}
            </div>
            <Field label="Tags" htmlFor="tags" optional>
              <Controller control={control} name="tags" render={({ field }) => <TagInput id="tags" value={field.value} onChange={field.onChange} suggestions={tagSuggestions} />} />
            </Field>
            <Field label="Notes" htmlFor="notes" optional>
              <Textarea id="notes" rows={4} {...register("notes")} />
            </Field>
          </div>
        </Disclosure>
      </form>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur lg:left-[var(--sidebar-w,0)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="hidden text-sm text-muted-foreground sm:block" aria-live="polite">
            {isDirty ? "You have unsaved changes." : mode === "edit" ? "No changes yet." : ""}
          </p>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" onClick={() => guarded(cancelHref) && router.push(cancelHref)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="account-form" disabled={isSubmitting || (mode === "edit" && !isDirty)}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {mode === "create" ? "Create account" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={!!leaveTo}
        onOpenChange={(o) => !o && setLeaveTo(null)}
        title="Discard unsaved changes?"
        description="You've made changes that haven't been saved. If you leave now they'll be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setSaved(true);
          router.push(leaveTo!);
        }}
      />
    </PageContainer>
  );
}

function AddressFields({ prefix, title, register }: { prefix: "billingAddress" | "shippingAddress"; title: string; register: ReturnType<typeof useForm<AccountFormValues>>["register"] }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Street" htmlFor={`${prefix}-line1`} className="sm:col-span-2" optional>
          <Input id={`${prefix}-line1`} {...register(`${prefix}.line1`)} />
        </Field>
        <Field label="City / town" htmlFor={`${prefix}-city`} optional>
          <Input id={`${prefix}-city`} {...register(`${prefix}.city`)} />
        </Field>
        <Field label="Region" htmlFor={`${prefix}-region`} optional>
          <Input id={`${prefix}-region`} list="acc-regions" {...register(`${prefix}.region`)} />
          <datalist id="acc-regions">{GHANA_REGIONS.map((r) => <option key={r} value={r} />)}</datalist>
        </Field>
        <Field label="Country" htmlFor={`${prefix}-country`} optional>
          <Input id={`${prefix}-country`} list="acc-countries" {...register(`${prefix}.country`)} />
          <datalist id="acc-countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Postal code / digital address" htmlFor={`${prefix}-postal`} optional>
          <Input id={`${prefix}-postal`} {...register(`${prefix}.postalCode`)} />
        </Field>
      </div>
    </fieldset>
  );
}
