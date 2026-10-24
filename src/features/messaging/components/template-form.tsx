"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Braces } from "lucide-react";
import { toast } from "sonner";
import { useDbStore } from "@/lib/mock-data/db-store";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { useBeforeUnload } from "@/components/forms/use-unsaved-changes";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { InlineNotice } from "@/components/feedback/states";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContactSelect } from "@/features/sales/components/contact-select";
import { FormFooter } from "@/features/sales/components/form-footer";
import { renderTemplate, smsParts, TEMPLATE_VARIABLES, unknownVariables } from "../lib/messaging";
import { saveTemplate } from "../services/messaging-service";
import { CHANNEL_LABELS, type Channel, type MessageTemplate } from "../types";

/** Full-page template editor (create and edit), laid out like the deal form. */
export function TemplateForm({ template }: { template?: MessageTemplate }) {
  const router = useRouter();
  const db = useDbStore((s) => s.db);
  const initial = useMemo(() => ({ name: template?.name ?? "", channel: (template?.channel ?? "sms") as Channel, subject: template?.subject ?? "", body: template?.body ?? "" }), [template]);
  const [v, setV] = useState(initial);
  const [sampleId, setSampleId] = useState("ct_abigail");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  useBeforeUnload(dirty && !saved);
  const set = (p: Partial<typeof v>) => setV((s) => ({ ...s, ...p }));
  const back = "/messaging?tab=templates";
  const guarded = (href: string) => {
    if (dirty && !saved) {
      setLeaveTo(href);
      return false;
    }
    return true;
  };

  const contacts = useMemo(() => db.contacts.filter((c) => c.status === "active"), [db.contacts]);
  const sample = db.contacts.find((c) => c.id === sampleId);
  const deal = sample ? db.deals.find((d) => d.contactId === sample.id && d.status === "open") : undefined;
  const ctx = { firstName: sample?.firstName, fullName: sample?.displayName, company: sample?.accountId ? db.accounts.find((a) => a.id === sample.accountId)?.name : undefined, deal: deal?.title };
  const preview = renderTemplate(v.body, ctx);
  const bad = unknownVariables(`${v.subject} ${v.body}`);
  const insert = (key: string) => set({ body: `${v.body}${v.body && !v.body.endsWith(" ") ? " " : ""}{{${key}}}` });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await saveTemplate(v, template?.id);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return toast.error("Some details need attention");
    }
    setSaved(true);
    toast.success(template ? "Template saved" : `“${r.data.name}” created`);
    router.push(back);
  };

  return (
    <PageContainer width="narrow" className="pb-28">
      <PageHeader
        breadcrumbs={<Breadcrumbs onNavigate={guarded} items={[{ label: "Messaging", href: "/messaging" }, { label: "Templates", href: back }, { label: template ? template.name : "New template" }]} />}
        title={template ? `Edit ${template.name}` : "New template"}
        description="Wording you use again and again, with fields filled in for each person."
      />
      <form id="template-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <FormSection title="Template">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Name" htmlFor="tpl-name">
              <Input id="tpl-name" autoFocus={!template} value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Delivery confirmation" />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Channel</span>
              <Segmented label="Channel" value={v.channel} onChange={(channel) => set({ channel })} options={(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))} />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Message"
          description="Fields are filled in from each person's record when the template is used."
          aside={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Braces /> Insert field
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {TEMPLATE_VARIABLES.map((x) => (
                  <DropdownMenuItem key={x.key} onSelect={() => insert(x.key)}>
                    {x.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        >
          <div className="grid gap-4">
            {v.channel === "email" && (
              <Field label="Subject" htmlFor="tpl-subject">
                <Input id="tpl-subject" value={v.subject} onChange={(e) => set({ subject: e.target.value })} />
              </Field>
            )}
            <Field label="Wording" htmlFor="tpl-body" hint={v.channel === "sms" ? `${v.body.length} characters · about ${smsParts(preview.text) || 1} SMS part${smsParts(preview.text) > 1 ? "s" : ""} once filled in` : undefined}>
              <Textarea id="tpl-body" rows={7} value={v.body} onChange={(e) => set({ body: e.target.value })} />
            </Field>
            {bad.length > 0 && <InlineNotice tone="danger">The CRM can&apos;t fill {bad.map((b) => `{{${b}}}`).join(", ")}. Use Insert field.</InlineNotice>}
          </div>
        </FormSection>

        <FormSection title="Preview" description="How it reads for a real contact.">
          <div className="grid gap-4">
            <Field label="Preview as" htmlFor="tpl-sample">
              <ContactSelect id="tpl-sample" value={sampleId} onChange={setSampleId} contacts={contacts} accountName={(id) => (id ? db.accounts.find((a) => a.id === id)?.name : undefined)} />
            </Field>
            <div className="min-h-28 rounded-xl border border-border bg-panel/60 p-4 text-sm">
              {v.channel === "email" && v.subject && <p className="mb-2 font-medium">{renderTemplate(v.subject, ctx).text}</p>}
              <p className="whitespace-pre-line">{preview.text || <span className="text-muted-foreground">Your message appears here.</span>}</p>
            </div>
            {preview.missing.length > 0 && (
              <InlineNotice tone="warning" icon={AlertTriangle}>
                {sample?.displayName ?? "This contact"} has no {preview.missing.map((m) => TEMPLATE_VARIABLES.find((x) => x.key === m)?.label.toLowerCase()).join(" or ")}. People sending this template are warned before it&apos;s used for someone like this.
              </InlineNotice>
            )}
          </div>
        </FormSection>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      </form>
      <FormFooter dirty={dirty} busy={busy} onCancel={() => guarded(back) && router.push(back)} submitLabel={template ? "Save template" : "Create template"} formId="template-form" disabled={!!template && !dirty} />
      <ConfirmDialog open={!!leaveTo} onOpenChange={(o) => !o && setLeaveTo(null)} title="Discard unsaved changes?" description="Your changes to this template haven't been saved." confirmLabel="Discard changes" cancelLabel="Keep editing" destructive onConfirm={() => (setSaved(true), router.push(leaveTo!))} />
    </PageContainer>
  );
}
