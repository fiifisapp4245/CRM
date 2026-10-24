"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineNotice } from "@/components/feedback/states";
import { useAccountLookup, useDb, useUserLookup } from "../hooks/use-contacts";
import { buildMergedContact, conflictingFields, consentConflicts, defaultChoices, MERGE_FIELDS, relationCounts, type MergeChoices, type MergeFieldKey } from "../lib/merge";
import { mergeContacts } from "../services/contacts-service";
import { CONSENT_CHANNEL_LABELS, CONSENT_PURPOSE_LABELS, CONSENT_STATUS_LABELS, METHOD_KIND_LABELS, SOURCE_LABELS, type Contact } from "../types";
import { ConsentBadge } from "./contact-badges";

interface MergeDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contacts: Contact[];
  reasons: string[];
  onMerged: (primary: Contact) => void;
}

export function MergeDialog(props: MergeDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl">
        <MergeBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function MergeBody({ onOpenChange, contacts, reasons, onMerged }: MergeDialogProps) {
  const db = useDb();
  const users = useUserLookup();
  const accounts = useAccountLookup();
  const ids = useMemo(() => contacts.map((c) => c.id), [contacts]);
  const suggestedPrimary = useMemo(() => {
    // Suggest the record with the most history, then the oldest.
    const score = (c: Contact) => db.activities.filter((a) => a.contactId === c.id).length * 10 + c.methods.length;
    return [...contacts].sort((a, b) => score(b) - score(a) || a.createdAt.localeCompare(b.createdAt))[0]?.id;
  }, [contacts, db.activities]);
  const [primaryId, setPrimaryId] = useState(suggestedPrimary);
  const [choices, setChoices] = useState<MergeChoices>(() => defaultChoices(contacts, suggestedPrimary));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const conflicts = useMemo(() => conflictingFields(contacts), [contacts]);
  const merged = useMemo(() => (primaryId && contacts.length ? buildMergedContact(contacts, primaryId, choices) : null), [contacts, primaryId, choices]);
  const consentIssues = useMemo(() => consentConflicts(db, ids), [db, ids]);
  const counts = useMemo(() => relationCounts(db, ids), [db, ids]);

  const display = (c: Contact, key: MergeFieldKey) => {
    const v = c[key];
    if (!v) return <span className="text-muted-foreground">empty</span>;
    if (key === "accountId") return accounts.get(v as string)?.name ?? "—";
    if (key === "ownerId") return users.get(v as string)?.name ?? "—";
    if (key === "dateOfBirth") return formatDate(v as string);
    return String(v);
  };

  const choosePrimary = (id: string) => {
    setPrimaryId(id);
    setChoices(defaultChoices(contacts, id));
  };

  const submit = async () => {
    if (!primaryId) return;
    setBusy(true);
    const res = await mergeContacts({ primaryId, contactIds: ids, choices });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Merged into ${res.data.displayName}`, {
      description: "History, preferences and related records were kept.",
      action: { label: "Open", onClick: () => onMerged(res.data) },
    });
    onOpenChange(false);
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>Merge {contacts.length} contacts</DialogTitle>
          <DialogDescription>{reasons.join(" · ")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h3 className="mb-2 text-sm font-semibold">1. Choose the record to keep</h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(contacts.length, 3)}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Record to keep">
              {contacts.map((c) => {
                const acts = db.activities.filter((a) => a.contactId === c.id).length;
                return (
                  <label key={c.id} className={cn("cursor-pointer rounded-lg border p-3 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring", primaryId === c.id ? "border-brand-700 bg-brand-50/60" : "hover:bg-muted")}>
                    <span className="flex items-center gap-2">
                      <input type="radio" name="primary" checked={primaryId === c.id} onChange={() => choosePrimary(c.id)} className="accent-[var(--brand-700)]" />
                      <span className="font-medium">{c.displayName}</span>
                      {c.id === suggestedPrimary && <span className="text-xs text-brand-700">Suggested</span>}
                    </span>
                    <span className="mt-2 block space-y-0.5 text-xs text-muted-foreground">
                      <span className="block">{SOURCE_LABELS[c.source]} · created {formatDate(c.createdAt)}</span>
                      <span className="block">Owner: {c.ownerId ? users.get(c.ownerId)?.name : "Unassigned"}</span>
                      <span className="block">{acts} interaction{acts === 1 ? "" : "s"} · {c.methods.length} contact method{c.methods.length === 1 ? "" : "s"}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">2. Resolve differences</h3>
            {conflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conflicting details — empty fields will be filled from the other records.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-medium">Field</th>
                      {contacts.map((c) => (
                        <th key={c.id} scope="col" className="px-3 py-2 text-left font-medium">{c.displayName}{c.id === primaryId && " (kept)"}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {MERGE_FIELDS.filter((f) => conflicts.includes(f.key)).map((f) => (
                      <tr key={f.key}>
                        <th scope="row" className="px-3 py-2 text-left font-normal text-muted-foreground">{f.label}</th>
                        {contacts.map((c) => (
                          <td key={c.id} className="px-3 py-2">
                            <label className={cn("flex cursor-pointer items-center gap-2", !c[f.key] && "cursor-not-allowed opacity-60")}>
                              <input
                                type="radio"
                                name={`field-${f.key}`}
                                disabled={!c[f.key]}
                                checked={choices[f.key] === c.id}
                                onChange={() => setChoices((ch) => ({ ...ch, [f.key]: c.id }))}
                                className="accent-[var(--brand-700)]"
                                aria-label={`Use ${f.label} from ${c.displayName}`}
                              />
                              <span>{display(c, f.key)}</span>
                            </label>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {merged && (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h3 className="mb-2 text-sm font-semibold">3. Preview of the merged contact</h3>
                <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{merged.displayName}</dd>
                  <dt className="text-muted-foreground">Account</dt>
                  <dd>{merged.accountId ? accounts.get(merged.accountId)?.name : "—"}</dd>
                  <dt className="text-muted-foreground">Owner</dt>
                  <dd>{merged.ownerId ? users.get(merged.ownerId)?.name : "Unassigned"}</dd>
                  <dt className="text-muted-foreground">Contact methods</dt>
                  <dd>
                    <ul>
                      {merged.methods.map((m) => (
                        <li key={m.id}>
                          {METHOD_KIND_LABELS[m.kind]}: {m.value} {m.isPrimary && <span className="text-xs text-brand-700">primary</span>}
                        </li>
                      ))}
                    </ul>
                  </dd>
                  <dt className="text-muted-foreground">Tags</dt>
                  <dd>{merged.tags.join(", ") || "—"}</dd>
                </dl>
              </div>
              <div className="space-y-3 rounded-lg border p-4 text-sm">
                <h3 className="text-sm font-semibold">What moves to the kept record</h3>
                <p className="text-muted-foreground">
                  {counts.activities} interactions, {counts.consents} preference records, {counts.deals} deals, {counts.quotes} quotes, {counts.tickets} tickets and {counts.documents} files. The other record{contacts.length > 2 ? "s are" : " is"} marked as merged
                  (not deleted) and links redirect to the kept contact.
                </p>
                {consentIssues.length > 0 && (
                  <InlineNotice tone="warning" icon={AlertTriangle}>
                    <p className="font-medium">Communication preferences differ</p>
                    <p className="mb-2">All history is kept. The most recent decision becomes the current one:</p>
                    <ul className="space-y-1">
                      {consentIssues.map((c) => (
                        <li key={`${c.channel}-${c.purpose}`} className="flex flex-wrap items-center gap-1.5">
                          {CONSENT_CHANNEL_LABELS[c.channel]} ({CONSENT_PURPOSE_LABELS[c.purpose].toLowerCase()}):
                          {c.values.map((v) => (
                            <span key={v.contactId} className="text-xs">{CONSENT_STATUS_LABELS[v.decision as keyof typeof CONSENT_STATUS_LABELS]} ({formatDate(v.recordedAt)})</span>
                          ))}
                          <ArrowRight className="size-3" />
                          <ConsentBadge status={c.resulting as "agreed"} />
                        </li>
                      ))}
                    </ul>
                  </InlineNotice>
                )}
              </div>
            </section>
          )}

          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} className="mt-0.5" />
            <span>I understand these {contacts.length} records will become one contact. This is recorded in the change history.</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={!confirmed || busy}>
            {busy && <Loader2 className="animate-spin" />} Merge contacts
          </Button>
        </DialogFooter>
    </>
  );
}
