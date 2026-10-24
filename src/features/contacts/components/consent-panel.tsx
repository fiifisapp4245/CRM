"use client";

import { useMemo, useState } from "react";
import { Lock, Plus } from "lucide-react";
import type { User } from "@/lib/types";
import { formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDb } from "../hooks/use-contacts";
import { CONSENT_CHANNELS, consentStatus } from "../lib/consent";
import { CONSENT_CHANNEL_LABELS, CONSENT_METHOD_LABELS, CONSENT_PURPOSE_LABELS, CONSENT_STATUS_LABELS, type ConsentChannel, type ConsentPurpose } from "../types";
import { ConsentBadge } from "./contact-badges";
import { RecordConsentDialog } from "./record-consent-dialog";

export function ConsentPanel({ contactId, contactName, users, canRecord, canViewEvidence }: { contactId: string; contactName: string; users: Map<string, User>; canRecord: boolean; canViewEvidence: boolean }) {
  const db = useDb();
  const [dialog, setDialog] = useState<{ channel?: ConsentChannel; purpose?: ConsentPurpose } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useMemo(() => db.consents.filter((r) => r.contactId === contactId).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)), [db.consents, contactId]);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="consent-heading">
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <h2 id="consent-heading" className="text-[0.9375rem] font-semibold">Communication preferences</h2>
        {canRecord && (
          <Button size="sm" variant="ghost" onClick={() => setDialog({})}>
            <Plus /> Record
          </Button>
        )}
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Current permission per channel</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="px-5 pt-2 pb-1 text-left font-medium">Channel</th>
            <th scope="col" className="px-2 pt-3 pb-1 text-left font-medium">Marketing</th>
            <th scope="col" className="px-5 pt-2 pb-1 text-left font-medium">Service</th>
          </tr>
        </thead>
        <tbody>
          {CONSENT_CHANNELS.map((ch) => (
            <tr key={ch}>
              <th scope="row" className="px-5 py-1.5 text-left font-normal">{CONSENT_CHANNEL_LABELS[ch]}</th>
              {(["marketing", "service_updates"] as const).map((p) => {
                const status = consentStatus(db.consents, contactId, ch, p);
                return (
                  <td key={p} className={p === "marketing" ? "px-2 py-1.5" : "px-4 py-1.5"}>
                    {canRecord ? (
                      <button type="button" onClick={() => setDialog({ channel: ch, purpose: p })} className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`${CONSENT_CHANNEL_LABELS[ch]} ${CONSENT_PURPOSE_LABELS[p]}: ${CONSENT_STATUS_LABELS[status]}. Record a change`}>
                        <ConsentBadge status={status} />
                      </button>
                    ) : (
                      <ConsentBadge status={status} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
        <span>{history.length ? `${history.length} recorded decision${history.length === 1 ? "" : "s"}` : "Nothing recorded yet"}</span>
        {history.length > 0 && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setHistoryOpen(true)}>
            View history
          </Button>
        )}
      </div>

      <RecordConsentDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} contactId={contactId} contactName={contactName} initialChannel={dialog?.channel} initialPurpose={dialog?.purpose} />

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Preference history</SheetTitle>
            <SheetDescription>Every decision {contactName} has made, newest first. The most recent decision per channel is the current one.</SheetDescription>
          </SheetHeader>
          <ol className="space-y-3 px-4 pb-6">
            {history.map((r) => (
              <li key={r.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {CONSENT_CHANNEL_LABELS[r.channel]} · {CONSENT_PURPOSE_LABELS[r.purpose]}
                  </p>
                  <ConsentBadge status={r.decision} />
                </div>
                <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1 text-muted-foreground">
                  <dt>How</dt>
                  <dd className="text-foreground">{CONSENT_METHOD_LABELS[r.method]}</dd>
                  <dt>Recorded</dt>
                  <dd className="text-foreground">{formatDateTime(r.recordedAt)}</dd>
                  <dt>By</dt>
                  <dd className="text-foreground">{users.get(r.recordedBy)?.name ?? "Unknown"}</dd>
                  {r.note && (
                    <>
                      <dt>Note</dt>
                      <dd className="text-foreground">{r.note}</dd>
                    </>
                  )}
                  {r.evidenceRef && (
                    <>
                      <dt>Evidence</dt>
                      <dd className="text-foreground">
                        {canViewEvidence ? (
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.evidenceRef}</code>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground"><Lock className="size-3" /> On file — restricted</span>
                        )}
                      </dd>
                    </>
                  )}
                  {r.carriedFromContactId && (
                    <>
                      <dt>Origin</dt>
                      <dd className="text-foreground">Carried over from a merged contact</dd>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ol>
        </SheetContent>
      </Sheet>
    </section>
  );
}
