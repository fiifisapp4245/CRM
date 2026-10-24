"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Handshake, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizeEmail, normalizePhone } from "@/lib/utils/normalize";
import { hasPermission } from "@/lib/permissions";
import { visibleContacts } from "@/features/contacts/lib/access";
import { primaryMethod } from "@/features/contacts/lib/filters";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { InlineNotice, PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSales } from "../hooks/use-sales";
import { leadCaps } from "../lib/access";
import { convertLead, type ConvertInput } from "../services/leads-service";
import { LEAD_SOURCE_LABELS, type Currency, type Lead } from "../types";
import { Money } from "./badges";

function Choice({ checked, onSelect, title, detail, badge, disabled }: { checked: boolean; onSelect: () => void; title: React.ReactNode; detail?: React.ReactNode; badge?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-3.5 has-focus-visible:ring-2 has-focus-visible:ring-ring", checked ? "border-brand-700 bg-brand-50/60" : "border-border hover:bg-secondary/50", disabled && "cursor-not-allowed opacity-60")}>
      <input type="radio" checked={checked} onChange={onSelect} disabled={disabled} className="mt-1 accent-[var(--brand-700)]" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {title}
          {badge && <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">{badge}</span>}
        </span>
        {detail && <span className="mt-0.5 block text-sm text-muted-foreground">{detail}</span>}
      </span>
    </label>
  );
}

export function LeadConvertPage({ lead }: { lead: Lead }) {
  const { db, user, users } = useSales();
  const caps = leadCaps(db, user, lead);
  const pipeline = db.pipelines[0];
  const openStages = pipeline.stages.filter((s) => s.kind === "open");

  // Matching: email/phone for contacts, exact name for accounts. Reuse is the default when a match exists.
  const contactMatches = useMemo(() => {
    const email = normalizeEmail(lead.email);
    const phone = lead.phone ? normalizePhone(lead.phone) : "";
    return visibleContacts(db, user).filter((c) => c.status === "active" && c.methods.some((m) => (m.kind === "email" ? email && normalizeEmail(m.value) === email : phone && normalizePhone(m.value) === phone)));
  }, [db, user, lead.email, lead.phone]);
  const hiddenMatch = useMemo(() => {
    const email = normalizeEmail(lead.email);
    return !contactMatches.length && !!email && db.contacts.some((c) => c.orgId === user.orgId && c.status === "active" && c.methods.some((m) => m.kind === "email" && normalizeEmail(m.value) === email));
  }, [contactMatches.length, db.contacts, user.orgId, lead.email]);
  const accountMatches = useMemo(() => (lead.company ? db.accounts.filter((a) => a.orgId === user.orgId && a.name.trim().toLowerCase() === lead.company!.trim().toLowerCase()) : []), [db.accounts, user.orgId, lead.company]);

  const [first, ...rest] = lead.name.split(" ");
  const [contactMode, setContactMode] = useState<string>(contactMatches[0]?.id ?? "new");
  const [cFirst, setCFirst] = useState(first ?? "");
  const [cLast, setCLast] = useState(rest.join(" "));
  const [accountMode, setAccountMode] = useState<string>(accountMatches[0]?.id ?? (lead.company ? "new" : "none"));
  const [accountName, setAccountName] = useState(lead.company ?? "");
  const [createDeal, setCreateDeal] = useState(hasPermission(user, "deals.manage"));
  const [dealTitle, setDealTitle] = useState(lead.need ? `${lead.company ?? lead.name} – ${lead.need.slice(0, 50)}` : `${lead.company ?? lead.name} opportunity`);
  const [amount, setAmount] = useState(lead.estimatedValue ? String(lead.estimatedValue) : "");
  const [currency, setCurrency] = useState<Currency>(lead.currency);
  const [stageId, setStageId] = useState("st_qualified");
  const [close, setClose] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ contactId: string; accountId?: string; dealId?: string } | null>(null);

  if (!caps.convert && !done)
    return (
      <PageContainer>
        <PermissionNotice title={lead.status === "converted" ? "This lead is already converted" : "You can't convert this lead"} action={<Button asChild variant="outline"><Link href={`/leads/${lead.id}`}>Back to lead</Link></Button>} />
      </PageContainer>
    );

  const contactLabel = contactMode === "new" ? `New contact: ${[cFirst, cLast].filter(Boolean).join(" ") || "—"}` : `Existing contact: ${contactMatches.find((c) => c.id === contactMode)?.displayName}`;
  const accountLabel = accountMode === "none" ? "No account" : accountMode === "new" ? `New account: ${accountName || "—"}` : `Existing account: ${accountMatches.find((a) => a.id === accountMode)?.name}`;
  const amountNum = Number(amount.replace(/,/g, ""));
  const dealInvalid = createDeal && (!dealTitle.trim() || amount === "" || Number.isNaN(amountNum) || amountNum < 0 || !close);
  const contactInvalid = contactMode === "new" && !cFirst.trim() && !cLast.trim();
  const accountInvalid = accountMode === "new" && !accountName.trim();

  const submit = async () => {
    setBusy(true);
    const input: ConvertInput = {
      contact: contactMode === "new" ? { mode: "new", firstName: cFirst, lastName: cLast, email: lead.email, phone: lead.phone, jobTitle: lead.jobTitle, city: lead.city } : { mode: "existing", id: contactMode },
      account: accountMode === "none" ? { mode: "none" } : accountMode === "new" ? { mode: "new", name: accountName } : { mode: "existing", id: accountMode },
      deal: createDeal ? { create: true, title: dealTitle, amount: amountNum, currency, stageId, expectedClose: close } : { create: false },
    };
    const r = await convertLead(lead.id, input);
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    setDone(r.data);
    toast.success(`${lead.name} converted`);
  };

  if (done)
    return (
      <PageContainer width="narrow">
        <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <div>
            <h1 className="text-xl font-semibold">{lead.name} is converted</h1>
            <p className="text-sm text-muted-foreground">The lead keeps a link to everything created or reused below.</p>
          </div>
          <div className="grid w-full max-w-md gap-2 text-left">
            <Link href={`/contacts/${done.contactId}`} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-secondary/50">
              <User className="size-4 text-brand-700" /> <span className="flex-1">{db.contacts.find((c) => c.id === done.contactId)?.displayName}</span> <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
            {done.accountId && (
              <Link href={`/accounts/${done.accountId}`} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-secondary/50">
                <Building2 className="size-4 text-brand-700" /> <span className="flex-1">{db.accounts.find((a) => a.id === done.accountId)?.name}</span> <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            )}
            {done.dealId && (
              <Link href={`/deals/${done.dealId}`} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-secondary/50">
                <Handshake className="size-4 text-brand-700" /> <span className="flex-1">{db.deals.find((d) => d.id === done.dealId)?.title}</span> <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            )}
          </div>
          <Button variant="outline" asChild>
            <Link href="/leads">Back to leads</Link>
          </Button>
        </section>
      </PageContainer>
    );

  return (
    <PageContainer width="narrow" className="pb-28">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Leads", href: "/leads" }, { label: lead.name, href: `/leads/${lead.id}` }, { label: "Convert" }]} />}
        title={`Convert ${lead.name}`}
        description="Turn this lead into a customer record and, if there's a real opportunity, a deal. Existing records are reused where they match, so nothing is duplicated."
      />

      <FormSection title="1. Review the lead">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Name", lead.name],
            ["Company", lead.company],
            ["Phone", lead.phone],
            ["Email", lead.email],
            ["Wants", lead.need],
            ["Estimated value", lead.estimatedValue ? <Money key="v" amount={lead.estimatedValue} currency={lead.currency} /> : undefined],
            ["Source", LEAD_SOURCE_LABELS[lead.source]],
            ["Owner", lead.ownerId ? users.get(lead.ownerId)?.name : "Unassigned"],
          ].map(([k, v]) => (
            <div key={k as string} className="flex gap-2">
              <dt className="w-28 shrink-0 text-muted-foreground">{k}</dt>
              <dd className="min-w-0">{v || <span className="text-subtle-foreground">—</span>}</dd>
            </div>
          ))}
        </dl>
      </FormSection>

      <FormSection title="2. Contact" description="Who is the person behind this lead?">
        <div className="space-y-2" role="radiogroup" aria-label="Contact">
          {contactMatches.map((c) => (
            <Choice key={c.id} checked={contactMode === c.id} onSelect={() => setContactMode(c.id)} badge="Recommended" title={<>Use existing contact {c.displayName}</>} detail={`Matches by email or phone · ${primaryMethod(c, "email")?.value ?? primaryMethod(c, "phone")?.value ?? ""}`} />
          ))}
          <Choice checked={contactMode === "new"} onSelect={() => setContactMode("new")} title="Create a new contact" detail={contactMatches.length ? "Only if the match above is a different person." : "No existing contact shares this lead's email or phone."} disabled={!hasPermission(user, "contacts.create")} />
          {contactMode === "new" && (
            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <Field label="First name" htmlFor="cv-first">
                <Input id="cv-first" value={cFirst} onChange={(e) => setCFirst(e.target.value)} aria-invalid={contactInvalid} />
              </Field>
              <Field label="Last name" htmlFor="cv-last">
                <Input id="cv-last" value={cLast} onChange={(e) => setCLast(e.target.value)} />
              </Field>
            </div>
          )}
          {hiddenMatch && <InlineNotice tone="warning">A contact you can&apos;t access already uses this email. Creating a new one may duplicate it — check with its owner first.</InlineNotice>}
        </div>
      </FormSection>

      <FormSection title="3. Account" description="Which company do they belong to?">
        <div className="space-y-2" role="radiogroup" aria-label="Account">
          {accountMatches.map((a) => (
            <Choice key={a.id} checked={accountMode === a.id} onSelect={() => setAccountMode(a.id)} badge="Recommended" title={<>Use existing account {a.name}</>} detail={[a.accountNumber, a.billingAddress?.city].filter(Boolean).join(" · ") || "Same name"} />
          ))}
          {lead.company && <Choice checked={accountMode === "new"} onSelect={() => setAccountMode("new")} title="Create a new account" detail={accountMatches.length ? "Only if the match above is a different organisation." : "No account has this company name."} disabled={!hasPermission(user, "accounts.create")} />}
          {accountMode === "new" && (
            <Field label="Account name" htmlFor="cv-acc" className="pt-1">
              <Input id="cv-acc" value={accountName} onChange={(e) => setAccountName(e.target.value)} aria-invalid={accountInvalid} />
            </Field>
          )}
          <Choice checked={accountMode === "none"} onSelect={() => setAccountMode("none")} title="Don't link an account" detail="For individuals buying for themselves." />
        </div>
      </FormSection>

      <FormSection title="4. Deal" description="Create the opportunity now, or later from the contact.">
        <label className="mb-4 flex items-center gap-3 text-sm">
          <Checkbox checked={createDeal} onCheckedChange={(v) => setCreateDeal(!!v)} disabled={!hasPermission(user, "deals.manage")} />
          Create a deal for this opportunity
        </label>
        {createDeal && (
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Deal title" htmlFor="cv-title" className="sm:col-span-6">
              <Input id="cv-title" value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} aria-invalid={!dealTitle.trim()} />
            </Field>
            <Field label="Value" htmlFor="cv-amount" className="sm:col-span-3">
              <Input id="cv-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={amount !== "" && (Number.isNaN(amountNum) || amountNum < 0)} placeholder="0" />
            </Field>
            <Field label="Currency" htmlFor="cv-cur" className="sm:col-span-1">
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger id="cv-cur" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GHS">GHS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Stage" htmlFor="cv-stage" className="sm:col-span-2">
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger id="cv-stage" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {openStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.probability}%)</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Expected close" htmlFor="cv-close" className="sm:col-span-3">
              <Input id="cv-close" type="date" value={close} onChange={(e) => setClose(e.target.value)} />
            </Field>
          </div>
        )}
      </FormSection>

      <FormSection title="5. Review and confirm">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2"><User className="size-4 text-brand-700" /> {contactLabel}</li>
          <li className="flex items-center gap-2"><Building2 className="size-4 text-brand-700" /> {accountLabel}</li>
          <li className="flex items-center gap-2"><Handshake className="size-4 text-brand-700" /> {createDeal ? `New deal: ${dealTitle} (${currency} ${amount || "0"})` : "No deal"}</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">The lead becomes Converted and keeps links to these records. Owner: {lead.ownerId ? users.get(lead.ownerId)?.name : "you"}.</p>
      </FormSection>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur lg:left-[var(--sidebar-w,0)]">
        <div className="mx-auto flex max-w-4xl justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <Button variant="outline" asChild>
            <Link href={`/leads/${lead.id}`}>Cancel</Link>
          </Button>
          <Button onClick={submit} disabled={busy || dealInvalid || contactInvalid || accountInvalid}>
            {busy && <Loader2 className="animate-spin" />} Convert lead
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
