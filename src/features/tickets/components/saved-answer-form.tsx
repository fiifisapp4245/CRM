"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDbStore } from "@/lib/mock-data/db-store";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { useBeforeUnload } from "@/components/forms/use-unsaved-changes";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { InlineNotice } from "@/components/feedback/states";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormFooter } from "@/features/sales/components/form-footer";
import { saveAnswer } from "../services/tickets-service";
import type { SavedAnswer } from "../types";

const NONE = "__none";

/** Full-page saved-answer editor, laid out like the deal form. */
export function SavedAnswerForm({ answer }: { answer?: SavedAnswer }) {
  const router = useRouter();
  const tickets = useDbStore((s) => s.db.tickets);
  const categories = useMemo(() => [...new Set(["Delivery", "Billing", "Product fault", "Installation", "General enquiry", ...tickets.map((t) => t.category)])], [tickets]);
  const initial = useMemo(() => ({ title: answer?.title ?? "", category: answer?.category ?? "", body: answer?.body ?? "" }), [answer]);
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  useBeforeUnload(dirty && !saved);
  const back = "/tickets/answers";
  const guarded = (href: string) => {
    if (dirty && !saved) {
      setLeaveTo(href);
      return false;
    }
    return true;
  };

  return (
    <PageContainer width="narrow" className="pb-28">
      <PageHeader
        breadcrumbs={<Breadcrumbs onNavigate={guarded} items={[{ label: "Tickets", href: "/tickets" }, { label: "Saved answers", href: back }, { label: answer ? answer.title : "New saved answer" }]} />}
        title={answer ? `Edit ${answer.title}` : "New saved answer"}
        description="A reusable reply for a common question. Agents insert it into a reply and can edit it before sending."
      />
      <form
        id="answer-form"
        noValidate
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await saveAnswer(v, answer?.id);
          setBusy(false);
          if (!r.ok) return setError(r.error);
          setSaved(true);
          toast.success(answer ? "Saved answer updated" : `“${r.data.title}” added`);
          router.push(back);
        }}
      >
        <FormSection title="Saved answer">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="sa-title" hint="What agents search for.">
              <Input id="sa-title" autoFocus={!answer} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Delivery rebooked" />
            </Field>
            <Field label="Category" htmlFor="sa-cat" optional>
              <Select value={v.category || NONE} onValueChange={(c) => setV({ ...v, category: c === NONE ? "" : c })}>
                <SelectTrigger id="sa-cat"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any category</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Wording" htmlFor="sa-body" className="sm:col-span-2" hint="Leave placeholders like {{date}} for the agent to replace — replies can't be sent while one remains.">
              <Textarea id="sa-body" rows={7} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} />
            </Field>
          </div>
        </FormSection>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      </form>
      <FormFooter dirty={dirty} busy={busy} onCancel={() => guarded(back) && router.push(back)} submitLabel={answer ? "Save changes" : "Add saved answer"} formId="answer-form" disabled={!!answer && !dirty} />
      <ConfirmDialog open={!!leaveTo} onOpenChange={(o) => !o && setLeaveTo(null)} title="Discard unsaved changes?" description="Your changes haven't been saved." confirmLabel="Discard changes" cancelLabel="Keep editing" destructive onConfirm={() => (setSaved(true), router.push(leaveTo!))} />
    </PageContainer>
  );
}
