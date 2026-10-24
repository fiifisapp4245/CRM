"use client";

import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import type { User } from "@/lib/types";
import { formatDateTime } from "@/lib/utils/format";
import { EmptyState } from "@/components/feedback/states";
import { useDb } from "../hooks/use-contacts";
import { ACTION_LABELS, actorName, humanizeField } from "@/features/activity-feed/lib/describe";

/** System audit trail — who changed what, kept separate from the customer interaction timeline. */
export function AuditHistory({ contactId, users, noun = "contact" }: { contactId: string; users: Map<string, User>; noun?: string }) {
  const db = useDb();
  const events = useMemo(() => db.audit.filter((e) => e.entityId === contactId).sort((a, b) => b.at.localeCompare(a.at)), [db.audit, contactId]);
  if (!events.length) return <EmptyState compact icon={ShieldCheck} title="No recorded changes" />;
  return (
    <ol className="divide-y rounded-2xl border border-border bg-card shadow-sm">
      {events.map((e) => (
        <li key={e.id} className="px-5 py-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p>
              <span className="font-medium">{actorName(e.actorId, users)}</span> <span className="text-muted-foreground">{ACTION_LABELS[e.action].toLowerCase()}{["created", "updated", "archived", "restored", "imported", "synced"].includes(e.action) ? ` this ${noun}` : ACTION_LABELS[e.action].endsWith(" of") || ACTION_LABELS[e.action].endsWith(" for") || ACTION_LABELS[e.action].endsWith(" into") ? ` this ${noun}` : ""}</span>
            </p>
            <time className="text-xs text-muted-foreground" dateTime={e.at}>{formatDateTime(e.at)}</time>
          </div>
          {e.summary && <p className="mt-1 text-muted-foreground">{e.summary}</p>}
          {e.changes && e.changes.length > 0 && (
            <table className="mt-2 w-full text-xs">
              <caption className="sr-only">Field changes</caption>
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="w-32 py-1 pr-2 text-left font-medium">Field</th>
                  <th scope="col" className="py-1 pr-2 text-left font-medium">Before</th>
                  <th scope="col" className="py-1 text-left font-medium">After</th>
                </tr>
              </thead>
              <tbody>
                {e.changes.map((c, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-1 pr-2 text-muted-foreground">{humanizeField(c.field)}</td>
                    <td className="py-1 pr-2 break-words text-red-700 line-through decoration-red-300">{c.from || <span className="text-muted-foreground no-underline">empty</span>}</td>
                    <td className="py-1 break-words text-green-800">{c.to || <span className="text-muted-foreground">empty</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </li>
      ))}
    </ol>
  );
}
