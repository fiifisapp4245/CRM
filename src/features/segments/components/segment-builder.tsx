"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, Loader2, Lock, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createId } from "@/lib/utils/id";
import { useDbStore } from "@/lib/mock-data/db-store";
import { eligibleOwners } from "@/lib/mock-data/users";
import { useCurrentUser } from "@/features/permissions";
import { allTags } from "@/features/contacts/lib/filters";
import { visibleContacts } from "@/features/contacts/lib/access";
import { CONSENT_CHANNEL_LABELS, CONSENT_PURPOSE_LABELS, SOURCE_LABELS, type ConsentChannel, type ConsentPurpose, type ContactSource } from "@/features/contacts/types";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { MultiSelect } from "@/components/forms/multi-select";
import { useBeforeUnload } from "@/components/forms/use-unsaved-changes";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { InlineNotice } from "@/components/feedback/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CONDITION_KINDS, describeCondition, GENDER_LABELS, isIncomplete, MONTHS, segmentAudience } from "../lib/match";
import { createSegment, deleteSegment, updateSegment } from "../services/segments-service";
import type { Segment, SegmentCondition, SegmentConditionKind } from "../types";

function newCondition(kind: SegmentConditionKind): SegmentCondition {
  const id = createId("cond");
  switch (kind) {
    case "location":
      return { id, kind, field: "region", values: [] };
    case "consent":
      return { id, kind, channel: "sms", purpose: "marketing" };
    case "has_method":
      return { id, kind, method: "phone", present: true };
    case "birthday_month":
      return { id, kind, months: [] };
    case "created":
      return { id, kind };
    case "tags":
      return { id, kind, mode: "include", values: [] };
    default:
      return { id, kind, values: [] } as SegmentCondition;
  }
}

function SmallSelect<T extends string>({ value, onChange, options, label, disabled, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; disabled?: boolean; className?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectTrigger className={cn("w-full sm:w-48", className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SegmentBuilder({ segment, readOnly = false }: { segment?: Segment; readOnly?: boolean }) {
  const router = useRouter();
  const user = useCurrentUser();
  const db = useDbStore((s) => s.db);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]);
  const [name, setName] = useState(segment?.name ?? "");
  const [description, setDescription] = useState(segment?.description ?? "");
  const [isPrivate, setIsPrivate] = useState(segment?.isPrivate ?? false);
  const [conditions, setConditions] = useState<SegmentCondition[]>(segment?.conditions ?? []);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  const initial = JSON.stringify({ n: segment?.name ?? "", d: segment?.description ?? "", p: segment?.isPrivate ?? false, c: segment?.conditions ?? [] });
  const dirty = !readOnly && JSON.stringify({ n: name, d: description, p: isPrivate, c: conditions }) !== initial;
  useBeforeUnload(dirty && !saved);

  const audience = useMemo(() => segmentAudience(db, user, conditions), [db, user, conditions]);
  const total = useMemo(() => visibleContacts(db, user).filter((c) => c.status === "active").length, [db, user]);
  const pool = useMemo(() => visibleContacts(db, user), [db, user]);
  const distinct = (k: "city" | "region" | "country") => [...new Set(pool.map((c) => c[k]).filter(Boolean) as string[])].sort().map((v) => ({ value: v, label: v }));
  const tagOptions = allTags(pool).map((t) => ({ value: t, label: t }));
  const ownerOptions = [{ value: "unassigned", label: "Unassigned" }, ...eligibleOwners(db.users, user.orgId).map((u) => ({ value: u.id, label: u.name }))];

  const update = (id: string, patch: Partial<SegmentCondition>) => setConditions((cs) => cs.map((c) => (c.id === id ? ({ ...c, ...patch } as SegmentCondition) : c)));
  const remove = (id: string) => setConditions((cs) => cs.filter((c) => c.id !== id));

  const save = async () => {
    setSubmitted(true);
    if (!name.trim()) return toast.error("Give the segment a name.");
    if (conditions.some(isIncomplete)) return toast.error("Finish or remove the incomplete conditions.");
    setBusy(true);
    const input = { name, description, isPrivate, conditions };
    const res = segment ? await updateSegment(segment.id, input) : await createSegment(input);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setSaved(true);
    toast.success(segment ? "Segment saved" : `“${res.data.name}” created`, { description: `${audience.length} matching contacts right now.` });
    router.push("/segments");
  };

  const guarded = (href: string) => {
    if (dirty && !saved) {
      setLeaveTo(href);
      return false;
    }
    return true;
  };

  const editor = (c: SegmentCondition) => {
    const invalid = submitted && isIncomplete(c);
    switch (c.kind) {
      case "location":
        return (
          <div className="flex flex-col gap-2 sm:flex-row">
            <SmallSelect value={c.field} onChange={(field) => update(c.id, { field, values: [] })} label="Location field" disabled={readOnly} options={[{ value: "city", label: "City / town" }, { value: "region", label: "Region" }, { value: "country", label: "Country" }]} />
            <div className="flex-1">
              <MultiSelect label="Locations" options={distinct(c.field)} value={c.values} onChange={(values) => update(c.id, { values })} placeholder="Choose one or more" disabled={readOnly} invalid={invalid} />
            </div>
          </div>
        );
      case "source":
        return <MultiSelect label="Sources" options={(Object.keys(SOURCE_LABELS) as ContactSource[]).map((s) => ({ value: s, label: SOURCE_LABELS[s] }))} value={c.values} onChange={(values) => update(c.id, { values: values as ContactSource[] })} placeholder="Choose sources" disabled={readOnly} invalid={invalid} />;
      case "owner":
        return <MultiSelect label="Owners" options={ownerOptions} value={c.values} onChange={(values) => update(c.id, { values })} placeholder="Choose owners" disabled={readOnly} invalid={invalid} />;
      case "gender":
        return <MultiSelect label="Genders" options={Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }))} value={c.values} onChange={(values) => update(c.id, { values })} placeholder="Choose values" disabled={readOnly} invalid={invalid} />;
      case "consent":
        return (
          <div className="space-y-2">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <span className="text-sm">Has agreed to</span>
              <SmallSelect value={c.channel} onChange={(channel) => update(c.id, { channel })} label="Channel" disabled={readOnly} className="sm:w-36" options={(Object.keys(CONSENT_CHANNEL_LABELS) as ConsentChannel[]).map((v) => ({ value: v, label: CONSENT_CHANNEL_LABELS[v] }))} />
              <SmallSelect value={c.purpose} onChange={(purpose) => update(c.id, { purpose })} label="Purpose" disabled={readOnly} className="sm:w-44" options={(Object.keys(CONSENT_PURPOSE_LABELS) as ConsentPurpose[]).map((v) => ({ value: v, label: CONSENT_PURPOSE_LABELS[v] }))} />
            </div>
            <p className="text-xs text-muted-foreground">Uses each contact&apos;s current decision. Not asked, refused and withdrawn never count as agreement.</p>
          </div>
        );
      case "has_method":
        return (
          <div className="flex flex-col gap-2 sm:flex-row">
            <SmallSelect value={c.present ? "yes" : "no"} onChange={(v) => update(c.id, { present: v === "yes" })} label="Has or lacks" disabled={readOnly} options={[{ value: "yes", label: "Has" }, { value: "no", label: "Doesn't have" }]} />
            <SmallSelect value={c.method} onChange={(method) => update(c.id, { method })} label="Contact method" disabled={readOnly} options={[{ value: "phone", label: "a phone number" }, { value: "email", label: "an email address" }]} />
          </div>
        );
      case "birthday_month":
        return <MultiSelect label="Months" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} value={c.months.map(String)} onChange={(v) => update(c.id, { months: v.map(Number).sort((a, b) => a - b) })} placeholder="Choose months" disabled={readOnly} invalid={invalid} />;
      case "created":
        return (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input type="date" aria-label="Added from" value={c.from ?? ""} onChange={(e) => update(c.id, { from: e.target.value || undefined })} disabled={readOnly} aria-invalid={invalid} className="sm:w-44" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" aria-label="Added until" value={c.to ?? ""} onChange={(e) => update(c.id, { to: e.target.value || undefined })} disabled={readOnly} aria-invalid={invalid} className="sm:w-44" />
          </div>
        );
      case "tags":
        return (
          <div className="flex flex-col gap-2 sm:flex-row">
            <SmallSelect value={c.mode} onChange={(mode) => update(c.id, { mode })} label="Include or exclude" disabled={readOnly} options={[{ value: "include", label: "Has any of" }, { value: "exclude", label: "Has none of" }]} />
            <div className="flex-1">
              <MultiSelect label="Tags" options={tagOptions} value={c.values} onChange={(values) => update(c.id, { values })} placeholder="Choose tags" disabled={readOnly} invalid={invalid} />
            </div>
          </div>
        );
    }
  };

  return (
    <PageContainer className={readOnly ? undefined : "pb-28"}>
      <PageHeader
        breadcrumbs={<Breadcrumbs onNavigate={guarded} items={[{ label: "Segments", href: "/segments" }, { label: segment ? segment.name : "New segment" }]} />}
        title={segment ? (readOnly ? segment.name : `Edit ${segment.name}`) : "New segment"}
        description={readOnly ? "You can view this segment but not change it." : "Describe who belongs in this group. The count updates as you add conditions."}
        actions={
          segment && !readOnly ? (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex flex-col gap-5">
          <FormSection title="Name and description">
            <div className="grid gap-4">
              <Field label="Name" htmlFor="seg-name" error={submitted && !name.trim() ? "Give the segment a name." : undefined}>
                <Input id="seg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} disabled={readOnly} aria-invalid={submitted && !name.trim()} placeholder="e.g. Accra wholesale buyers" />
              </Field>
              <Field label="Description" htmlFor="seg-desc" optional>
                <Textarea id="seg-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Visibility">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Visibility">
              {[
                { v: false, t: "Shared", d: "Everyone in your organisation can use it. Each person only sees contacts they can access." },
                { v: true, t: "Private", d: "Only you can see and use it." },
              ].map((o) => (
                <label key={o.t} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 has-focus-visible:ring-2 has-focus-visible:ring-ring", isPrivate === o.v ? "border-brand-700 bg-brand-50/60" : "border-border hover:bg-secondary/60", readOnly && "cursor-default opacity-80")}>
                  <input type="radio" name="visibility" checked={isPrivate === o.v} onChange={() => setIsPrivate(o.v)} disabled={readOnly} className="mt-1 accent-[var(--brand-700)]" />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {o.v && <Lock className="size-3.5" />}
                      {o.t}
                    </span>
                    <span className="block text-sm text-muted-foreground">{o.d}</span>
                  </span>
                </label>
              ))}
            </div>
          </FormSection>

          <FormSection
            title="Conditions"
            description="A contact must match every condition. Within one condition, matching any selected value is enough."
            aside={
              !readOnly && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus /> Add condition
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {CONDITION_KINDS.map((k) => (
                      <DropdownMenuItem key={k.kind} onSelect={() => setConditions((cs) => [...cs, newCondition(k.kind)])} className="flex-col items-start gap-0">
                        <span>{k.label}</span>
                        <span className="text-xs text-muted-foreground">{k.hint}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            }
          >
            {conditions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">No conditions yet, so every contact you can access matches. Use Add condition to narrow it down.</p>
            ) : (
              <ol className="space-y-3">
                {conditions.map((c, i) => (
                  <li key={c.id}>
                    {i > 0 && (
                      <div className="flex items-center gap-2 py-1 pl-4" aria-hidden>
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">AND</span>
                      </div>
                    )}
                    <div className={cn("rounded-xl border p-4", submitted && isIncomplete(c) ? "border-destructive" : "border-border")}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{CONDITION_KINDS.find((k) => k.kind === c.kind)?.label}</p>
                        {!readOnly && (
                          <Button variant="ghost" size="icon-sm" onClick={() => remove(c.id)} aria-label={`Remove ${describeCondition(c, users)}`}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                      {editor(c)}
                      {submitted && isIncomplete(c) && <p className="mt-2 text-sm text-destructive" role="alert">Choose at least one value, or remove this condition.</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </FormSection>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24" aria-label="Matching audience">
          <section className="rounded-2xl border border-border bg-card">
            <div className="px-5 pt-5 pb-3">
              <p className="text-sm text-muted-foreground">Matching contacts</p>
              <p className="text-4xl font-semibold tracking-tight tabular-nums" aria-live="polite">
                {audience.length}
              </p>
              <p className="text-xs text-muted-foreground">of {total} active contacts you can access</p>
            </div>
            {audience.length > 0 ? (
              <ul className="max-h-80 divide-y divide-border/70 overflow-y-auto border-t border-border/70">
                {audience.slice(0, 25).map((c) => (
                  <li key={c.id}>
                    <Link href={`/contacts/${c.id}`} target="_blank" className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-[#f8fbfc]">
                      <UserAvatar name={c.displayName} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{c.displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">{c.city}</span>
                    </Link>
                  </li>
                ))}
                {audience.length > 25 && <li className="px-5 py-2.5 text-xs text-muted-foreground">and {audience.length - 25} more</li>}
              </ul>
            ) : (
              <p className="flex items-center gap-2 border-t border-border/70 px-5 py-4 text-sm text-muted-foreground">
                <Users className="size-4" /> No contacts match these conditions.
              </p>
            )}
          </section>
          <InlineNotice tone="neutral" icon={ShieldCheck}>
            Being in a segment isn&apos;t permission to message someone. Campaigns and messages check each contact&apos;s current channel permission when they&apos;re sent.
          </InlineNotice>
          {segment && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" /> Created by {users.get(segment.ownerUserId)?.name ?? "Unknown"}.
            </p>
          )}
        </aside>
      </div>

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur lg:left-[var(--sidebar-w,0)]">
          <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <p className="hidden text-sm text-muted-foreground sm:block" aria-live="polite">
              {dirty ? `Unsaved changes · ${audience.length} matching` : "No changes yet."}
            </p>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => guarded("/segments") && router.push("/segments")} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={save} disabled={busy || (!!segment && !dirty)}>
                {busy && <Loader2 className="animate-spin" />} {segment ? "Save segment" : "Create segment"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${segment?.name}”?`}
        description="The segment definition is removed. Contacts are not affected."
        confirmLabel="Delete segment"
        destructive
        onConfirm={async () => {
          const r = await deleteSegment(segment!.id);
          if (!r.ok) return void toast.error(r.error);
          setSaved(true);
          toast.success("Segment deleted");
          router.push("/segments");
        }}
      />
      <ConfirmDialog
        open={!!leaveTo}
        onOpenChange={(o) => !o && setLeaveTo(null)}
        title="Discard unsaved changes?"
        description="Your changes to this segment haven't been saved."
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
