"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ChevronDown, Loader2, Mail, MessageCircle, Phone, Plus, RotateCcw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createId } from "@/lib/utils/id";
import { cn } from "@/lib/utils";
import { COUNTRIES, GHANA_REGIONS, TITLES } from "@/lib/mock-data/reference";
import { useCurrentUser } from "@/features/permissions";
import { hasPermission } from "@/lib/permissions";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { OwnerSelect } from "@/components/forms/owner-select";
import { TagInput } from "@/components/forms/tag-input";
import { useBeforeUnload } from "@/components/forms/use-unsaved-changes";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { InlineNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssignableOwners, useDb, useUserLookup, useVisibleContacts } from "../hooks/use-contacts";
import { buildDisplayName } from "../lib/display-name";
import { allTags } from "../lib/filters";
import { contactFormSchema, contactToForm, emptyContactForm, type ContactFormValues } from "../schemas/contact-form";
import { createContact, findPossibleDuplicates, recordConsent, updateContact } from "../services/contacts-service";
import { ConsentCapture, ConsentSummary, EMPTY_INITIAL_CONSENT, initialConsentErrors, type InitialConsent } from "./consent-capture";
import { METHOD_KIND_LABELS, METHOD_LABEL_LABELS, type ConsentChannel, type Contact, type MethodKind, type MethodLabel } from "../types";

const KIND_ICON = { phone: Phone, email: Mail, whatsapp: MessageCircle } as const;
const DEFAULT_LABEL: Record<MethodKind, MethodLabel> = { phone: "mobile", email: "work", whatsapp: "mobile" };
const NONE = "__none";

interface ContactFormProps {
  mode: "create" | "edit";
  contact?: Contact;
}

export function ContactForm({ mode, contact }: ContactFormProps) {
  const router = useRouter();
  const user = useCurrentUser();
  const db = useDb();
  const users = useUserLookup();
  const owners = useAssignableOwners();
  const visible = useVisibleContacts();
  const tagSuggestions = useMemo(() => allTags(visible), [visible]);
  const canReassign = hasPermission(user, "contacts.reassign");

  const searchParams = useSearchParams();
  const presetAccount = searchParams.get("accountId") ?? "";
  const defaults = useMemo<ContactFormValues>(
    () =>
      contact
        ? contactToForm(contact)
        : { ...emptyContactForm(user.role === "crm_user" ? user.id : owners.some((o) => o.id === user.id) ? user.id : ""), accountId: db.accounts.some((a) => a.id === presetAccount && a.orgId === user.orgId) ? presetAccount : "" },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contact?.id],
  );

  const form = useForm<ContactFormValues>({ resolver: zodResolver(contactFormSchema), defaultValues: defaults, mode: "onTouched" });
  const { register, control, handleSubmit, setValue, getValues, formState } = form;
  const { errors, isDirty, isSubmitting } = formState;
  const methods = useFieldArray({ control, name: "methods", keyName: "fieldKey" });

  const [displayNameTouched, setDisplayNameTouched] = useState(() => !!contact && contact.displayName !== buildDisplayName(contact));
  const [moreOpen, setMoreOpen] = useState(() => !!contact && !!(contact.gender || contact.dateOfBirth || contact.address || contact.city || contact.region || contact.tags.length || contact.notes || contact.middleName));
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<Contact[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [consent, setConsent] = useState<InitialConsent>(EMPTY_INITIAL_CONSENT);
  const [consentErrors, setConsentErrors] = useState<Partial<Record<ConsentChannel, string>>>({});
  const consentDirty = Object.values(consent).some((v) => v.decision);
  const dirty = isDirty || consentDirty;

  useBeforeUnload(dirty && !saved);

  // Display name follows the name fields until the user edits it themselves.
  const [title, firstName, middleName, lastName] = useWatch({ control, name: ["title", "firstName", "middleName", "lastName"] });
  useEffect(() => {
    if (displayNameTouched) return;
    const generated = buildDisplayName({ title, firstName, middleName, lastName });
    if (generated !== getValues("displayName")) setValue("displayName", generated, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  }, [title, firstName, middleName, lastName, displayNameTouched, getValues, setValue, formState.isSubmitted]);

  // Live duplicate check on contact methods.
  const watchedMethods = useWatch({ control, name: "methods" });
  const [liveDuplicates, setLiveDuplicates] = useState<Contact[]>([]);
  useEffect(() => {
    const t = setTimeout(() => setLiveDuplicates(findPossibleDuplicates(watchedMethods ?? [], contact?.id)), 300);
    return () => clearTimeout(t);
  }, [watchedMethods, contact?.id]);

  const addMethod = (kind: MethodKind, value = "") => {
    const hasKind = getValues("methods").some((m) => m.kind === kind);
    methods.append({ id: createId("cm"), kind, value, label: DEFAULT_LABEL[kind], isPrimary: !hasKind }, { shouldFocus: !value });
  };

  const removeMethod = (index: number) => {
    const all = getValues("methods");
    const removed = all[index];
    methods.remove(index);
    if (removed.isPrimary) {
      const nextIdx = getValues("methods").findIndex((m) => m.kind === removed.kind);
      if (nextIdx >= 0) setValue(`methods.${nextIdx}.isPrimary`, true, { shouldDirty: true });
    }
  };

  const makePrimary = (index: number) => {
    const all = getValues("methods");
    all.forEach((m, i) => {
      if (m.kind === all[index].kind) setValue(`methods.${i}.isPrimary`, i === index, { shouldDirty: true });
    });
  };

  const changeKind = (index: number, kind: MethodKind) => {
    const all = getValues("methods");
    const hasPrimary = all.some((m, i) => i !== index && m.kind === kind && m.isPrimary);
    setValue(`methods.${index}.kind`, kind, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    setValue(`methods.${index}.label`, DEFAULT_LABEL[kind], { shouldDirty: true });
    setValue(`methods.${index}.isPrimary`, !hasPrimary, { shouldDirty: true });
  };

  const save = async (values: ContactFormValues, duplicatesConfirmed = false) => {
    const cErrors = mode === "create" ? initialConsentErrors(consent) : {};
    setConsentErrors(cErrors);
    if (Object.keys(cErrors).length) {
      toast.error("Some details need attention", { description: "Say how the customer gave each permission." });
      return;
    }
    if (mode === "create" && !duplicatesConfirmed) {
      const dups = findPossibleDuplicates(values.methods);
      if (dups.length) {
        setDuplicatePrompt(dups);
        return;
      }
    }
    const res = mode === "create" ? await createContact(values) : await updateContact(contact!.id, values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (mode === "create") {
      for (const ch of Object.keys(consent) as ConsentChannel[]) {
        const c = consent[ch];
        if (!c.decision || !c.method) continue;
        const r = await recordConsent({ contactId: res.data.id, channel: ch, purpose: "marketing", decision: c.decision, method: c.method });
        if (!r.ok) toast.error(`${ch.toUpperCase()} permission wasn't saved`, { description: r.error });
      }
    }
    setSaved(true);
    toast.success(mode === "create" ? `${res.data.displayName} added` : "Changes saved");
    router.push(`/contacts/${res.data.id}`);
  };

  const onInvalid = () => {
    toast.error("Some details need attention", { description: "Check the highlighted fields." });
    if (errors.gender || errors.dateOfBirth || errors.address || errors.city || errors.notes || errors.tags) setMoreOpen(true);
  };

  const guardedNavigate = (href: string) => {
    if (dirty && !saved) {
      setLeaveTo(href);
      return false;
    }
    return true;
  };

  const cancelHref = contact ? `/contacts/${contact.id}` : "/contacts";
  const firstPhone = watchedMethods?.find((m) => m.kind === "phone" && m.value.trim());
  const hasWhatsapp = watchedMethods?.some((m) => m.kind === "whatsapp");
  const ownerLocked = mode === "edit" && !canReassign;
  const currentOwner = contact?.ownerId ? users.get(contact.ownerId) : undefined;

  return (
    <PageContainer width="narrow" className="pb-28">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            onNavigate={guardedNavigate}
            items={[{ label: "Contacts", href: "/contacts" }, ...(contact ? [{ label: contact.displayName, href: `/contacts/${contact.id}` }] : []), { label: mode === "create" ? "New contact" : "Edit" }]}
          />
        }
        title={mode === "create" ? "New contact" : `Edit ${contact!.displayName}`}
        description={mode === "create" ? "Only a name is required. Add whatever else you know — you can always come back." : undefined}
      />

      <form id="contact-form" onSubmit={(e) => handleSubmit((v) => save(v), onInvalid)(e)} noValidate className="flex flex-col gap-5">
        <FormSection title="Basic information" description="A first or last name is required. Everything else is optional.">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Title" htmlFor="title" className="sm:col-span-2" optional>
              <Controller
                control={control}
                name="title"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                    <SelectTrigger id="title" className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {[...new Set([...TITLES, ...(field.value ? [field.value] : [])])].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="First name" htmlFor="firstName" error={errors.firstName?.message} className="sm:col-span-4">
              <Input id="firstName" autoComplete="off" aria-invalid={!!errors.firstName} aria-describedby={errors.firstName ? "firstName-error" : undefined} {...register("firstName")} autoFocus={mode === "create"} />
            </Field>
            <Field label="Middle name" htmlFor="middleName" className="sm:col-span-3" optional>
              <Input id="middleName" autoComplete="off" {...register("middleName")} />
            </Field>
            <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message} className="sm:col-span-3">
              <Input id="lastName" autoComplete="off" {...register("lastName")} />
            </Field>
            <Field
              label="Display name"
              htmlFor="displayName"
              error={errors.displayName?.message}
              className="sm:col-span-6"
              hint={displayNameTouched ? "Edited by you. Shown everywhere this contact appears." : "Generated from the name fields. Change it if they prefer another name."}
            >
              <div className="flex gap-2">
                <Input
                  id="displayName"
                  autoComplete="off"
                  aria-invalid={!!errors.displayName}
                  {...register("displayName", { onChange: () => setDisplayNameTouched(true) })}
                />
                {displayNameTouched && (
                  <Button type="button" variant="outline" onClick={() => setDisplayNameTouched(false)} title="Use generated name">
                    <RotateCcw /> <span className="hidden sm:inline">Use generated</span>
                  </Button>
                )}
              </div>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Contact methods" description="Add as many numbers and addresses as you need, and star the one to use first.">
          <div className="flex flex-col gap-3">
            {methods.fields.length === 0 && <p className="text-sm text-muted-foreground">No phone numbers or email addresses yet. Neither is required.</p>}
            {methods.fields.map((f, index) => {
              const kind = watchedMethods?.[index]?.kind ?? f.kind;
              const Icon = KIND_ICON[kind];
              const err = errors.methods?.[index]?.value?.message;
              const isPrimary = watchedMethods?.[index]?.isPrimary ?? f.isPrimary;
              return (
                <div key={f.fieldKey} className="rounded-lg border p-3 sm:border-0 sm:p-0">
                  <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[9rem_1fr_8rem_auto_auto] sm:items-start">
                    <Select value={kind} onValueChange={(v) => changeKind(index, v as MethodKind)}>
                      <SelectTrigger className="w-full" aria-label={`Type for contact method ${index + 1}`}>
                        <Icon className="text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(METHOD_KIND_LABELS) as MethodKind[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {METHOD_KIND_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" className="sm:order-last" onClick={() => removeMethod(index)} aria-label={`Remove ${METHOD_KIND_LABELS[kind]} ${watchedMethods?.[index]?.value || index + 1}`}>
                      <Trash2 />
                    </Button>
                    <div className="col-span-2 sm:col-span-1">
                      <Input
                        {...register(`methods.${index}.value` as const)}
                        type={kind === "email" ? "email" : "tel"}
                        inputMode={kind === "email" ? "email" : "tel"}
                        placeholder={kind === "email" ? "name@company.com" : "024 123 4567 or +44 20…"}
                        aria-label={`${METHOD_KIND_LABELS[kind]} ${index + 1}`}
                        aria-invalid={!!err}
                        aria-describedby={err ? `method-${index}-error` : undefined}
                      />
                      {err && (
                        <p id={`method-${index}-error`} className="mt-1 text-sm text-destructive" role="alert">
                          {err}
                        </p>
                      )}
                    </div>
                    <Controller
                      control={control}
                      name={`methods.${index}.label` as const}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full" aria-label={`Label for ${METHOD_KIND_LABELS[kind]} ${index + 1}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(METHOD_LABEL_LABELS) as MethodLabel[]).map((l) => (
                              <SelectItem key={l} value={l}>
                                {METHOD_LABEL_LABELS[l]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Button
                      type="button"
                      variant={isPrimary ? "secondary" : "ghost"}
                      onClick={() => makePrimary(index)}
                      aria-pressed={isPrimary}
                      className={cn("justify-start", isPrimary && "text-brand-800")}
                      title={isPrimary ? `Primary ${METHOD_KIND_LABELS[kind].toLowerCase()}` : `Make primary ${METHOD_KIND_LABELS[kind].toLowerCase()}`}
                    >
                      <Star className={cn(isPrimary && "fill-current")} /> {isPrimary ? "Primary" : "Make primary"}
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => addMethod("phone")}>
                <Plus /> Phone
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addMethod("email")}>
                <Plus /> Email
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addMethod("whatsapp")}>
                <Plus /> WhatsApp
              </Button>
              {firstPhone && !hasWhatsapp && (
                <Button type="button" variant="ghost" size="sm" onClick={() => addMethod("whatsapp", firstPhone.value)}>
                  <MessageCircle /> WhatsApp is the same as {firstPhone.value}
                </Button>
              )}
            </div>
            {liveDuplicates.length > 0 && (
              <InlineNotice tone="warning" icon={AlertTriangle}>
                <p className="font-medium">Possible duplicate</p>
                <p>
                  {liveDuplicates.length === 1 ? "A contact" : `${liveDuplicates.length} contacts`} in your organisation already use{liveDuplicates.length === 1 ? "s" : ""} one of these details:{" "}
                  {liveDuplicates.slice(0, 3).map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && ", "}
                      {visible.some((v) => v.id === d.id) ? (
                        <Link href={`/contacts/${d.id}`} target="_blank" className="font-medium underline underline-offset-2">
                          {d.displayName}
                        </Link>
                      ) : (
                        <span className="font-medium">a contact you can&apos;t view</span>
                      )}
                      {d.status === "archived" && " (archived)"}
                    </span>
                  ))}
                  .
                </p>
              </InlineNotice>
            )}
          </div>
        </FormSection>

        <FormSection title="Organisation and ownership">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account" htmlFor="accountId" hint="The company they work for. Accounts will be managed in the Accounts module (audit pending)." optional>
              <Controller
                control={control}
                name="accountId"
                render={({ field }) => (
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                    <SelectTrigger id="accountId" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No account</SelectItem>
                      {db.accounts
                        .filter((a) => a.orgId === user.orgId)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Job title" htmlFor="jobTitle" optional>
              <Input id="jobTitle" {...register("jobTitle")} placeholder="e.g. Procurement Officer" />
            </Field>
            <Field
              label="Owner"
              htmlFor="ownerId"
              className="sm:col-span-2"
              hint={ownerLocked ? "Your role can't change the owner. Ask a sales manager or admin." : "The person responsible for this relationship."}
            >
              <Controller
                control={control}
                name="ownerId"
                render={({ field }) => (
                  <OwnerSelect id="ownerId" value={field.value} onChange={field.onChange} owners={owners} disabled={ownerLocked} currentOwnerLabel={currentOwner ? `${currentOwner.name}${currentOwner.status === "inactive" ? " (inactive)" : ""}` : undefined} className="sm:max-w-sm" />
                )}
              />
            </Field>
          </div>
        </FormSection>

        <Collapsible open={moreOpen} onOpenChange={setMoreOpen} className="rounded-2xl border border-border bg-card shadow-sm">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 rounded-xl px-5 py-4 text-left hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <span>
              <span className="block text-base font-semibold">Additional details</span>
              <span className="block text-sm text-muted-foreground">Gender, date of birth, address and tags</span>
            </span>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", moreOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-4 border-t p-5 sm:grid-cols-2">
              <Field label="Gender" htmlFor="gender" optional>
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger id="gender" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not specified</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="undisclosed">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Date of birth" htmlFor="dateOfBirth" error={errors.dateOfBirth?.message} optional>
                <Input id="dateOfBirth" type="date" max={new Date().toISOString().slice(0, 10)} aria-invalid={!!errors.dateOfBirth} {...register("dateOfBirth")} />
              </Field>
              <Field label="Address" htmlFor="address" className="sm:col-span-2" optional>
                <Input id="address" autoComplete="off" {...register("address")} placeholder="House number and street" />
              </Field>
              <Field label="City / town" htmlFor="city" optional>
                <Input id="city" {...register("city")} />
              </Field>
              <Field label="Region" htmlFor="region" optional>
                <Input id="region" list="region-options" {...register("region")} />
                <datalist id="region-options">{GHANA_REGIONS.map((r) => <option key={r} value={r} />)}</datalist>
              </Field>
              <Field label="Country" htmlFor="country" optional>
                <Input id="country" list="country-options" {...register("country")} />
                <datalist id="country-options">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Tags" htmlFor="tags" className="sm:col-span-2" error={errors.tags?.message} optional>
                <Controller control={control} name="tags" render={({ field }) => <TagInput id="tags" value={field.value} onChange={field.onChange} suggestions={tagSuggestions} />} />
              </Field>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <FormSection title="Consent and notes">
          <div className="space-y-6">
            {mode === "create" ? (
              <ConsentCapture value={consent} onChange={setConsent} errors={consentErrors} />
            ) : (
              <ConsentSummary contactId={contact!.id} consents={db.consents} />
            )}
            <Field label="Notes" htmlFor="notes" error={errors.notes?.message} hint="Background that helps your team. For a dated interaction, log a note on the profile timeline instead." optional>
              <Textarea id="notes" rows={4} {...register("notes")} />
            </Field>
          </div>
        </FormSection>
      </form>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur lg:left-[var(--sidebar-w,0)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="hidden text-sm text-muted-foreground sm:block" aria-live="polite">
            {dirty ? "You have unsaved changes." : mode === "edit" ? "No changes yet." : ""}
          </p>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" onClick={() => guardedNavigate(cancelHref) && router.push(cancelHref)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="contact-form" disabled={isSubmitting || (mode === "edit" && !isDirty)}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {mode === "create" ? "Create contact" : "Save changes"}
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
      <ConfirmDialog
        open={!!duplicatePrompt}
        onOpenChange={(o) => !o && setDuplicatePrompt(null)}
        title="This might be someone you already have"
        description={
          <div className="space-y-2">
            <p>These contacts share an email address or phone number with the one you&apos;re creating:</p>
            <ul className="list-disc space-y-1 pl-5">
              {duplicatePrompt?.map((d) => (
                <li key={d.id}>
                  {visible.some((v) => v.id === d.id) ? (
                    <Link href={`/contacts/${d.id}`} target="_blank" className="font-medium text-foreground underline underline-offset-2">
                      {d.displayName}
                    </Link>
                  ) : (
                    "A contact you don't have access to"
                  )}
                  {d.status === "archived" && " (archived)"}
                </li>
              ))}
            </ul>
            <p>Create a new contact anyway, or go back and check?</p>
          </div>
        }
        confirmLabel="Create anyway"
        cancelLabel="Go back"
        onConfirm={async () => {
          await handleSubmit((v) => save(v, true), onInvalid)();
        }}
      />
    </PageContainer>
  );
}
