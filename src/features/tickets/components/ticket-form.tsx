"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { OwnerSelect } from "@/components/forms/owner-select";
import { InlineNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ContactSelect } from "@/features/sales/components/contact-select";
import { useTicketsData } from "../hooks";

import { createTicket } from "../services/tickets-service";
import { TICKET_PRIORITY_LABELS, TICKET_SOURCE_LABELS, type TicketPriority, type TicketSource } from "../types";

export function TicketForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { db, user, customerOptions, assignable, categories } = useTicketsData();
  const [contactId, setContactId] = useState(() => params.get("contactId") ?? "");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [source, setSource] = useState<TicketSource>("phone");
  const [ownerId, setOwnerId] = useState(user.id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = db.settings.ticketTargets[priority];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId) return setError("Choose the customer.");
    setBusy(true);
    const r = await createTicket({ contactId, subject, description, category, priority, source, ownerId: ownerId || null });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(`Ticket ${r.data.number} opened`);
    router.push(`/tickets/${r.data.id}`);
  };

  return (
    <PageContainer width="narrow">
      <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Tickets", href: "/tickets" }, { label: "New ticket" }]} />} title="New ticket" description="Record a complaint or request so someone owns it until it's resolved." />
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <FormSection title="Customer and request">
          <div className="grid gap-4">
            <Field label="Customer" htmlFor="tk-contact">
              <ContactSelect id="tk-contact" value={contactId} onChange={setContactId} contacts={customerOptions} accountName={(id) => (id ? db.accounts.find((a) => a.id === id)?.name : undefined)} />
            </Field>
            <Field label="Subject" htmlFor="tk-subject">
              <Input id="tk-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Delivery missed agreed time slot" />
            </Field>
            <Field label="What the customer said" htmlFor="tk-desc">
              <Textarea id="tk-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
        </FormSection>
        <FormSection title="Handling">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="tk-cat">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="tk-cat"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Priority" htmlFor="tk-pri" hint={`Prototype targets: reply within ${t.firstResponseHours} h, resolve within ${t.resolutionHours} h.`}>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger id="tk-pri"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map((p) => <SelectItem key={p} value={p}>{TICKET_PRIORITY_LABELS[p]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Came in by" htmlFor="tk-src">
              <Select value={source} onValueChange={(v) => setSource(v as TicketSource)}>
                <SelectTrigger id="tk-src"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(TICKET_SOURCE_LABELS) as TicketSource[]).map((s) => <SelectItem key={s} value={s}>{TICKET_SOURCE_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Owner" htmlFor="tk-owner">
              <OwnerSelect id="tk-owner" value={ownerId} onChange={setOwnerId} owners={assignable} />
            </Field>
          </div>
        </FormSection>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/tickets")}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Opening…" : "Open ticket"}</Button>
        </div>
      </form>
    </PageContainer>
  );
}
