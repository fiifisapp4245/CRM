"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import type { User } from "@/lib/types";
import { formatDate } from "@/lib/utils/format";
import { EmptyState } from "@/components/feedback/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Segmented } from "@/components/shared/segmented";
import { ActivityIcon } from "./activity-icon";
import { ACTIVITY_LABELS, CALL_OUTCOME_LABELS, type Activity, type ActivityType } from "../types";

const FILTERS: Array<{ key: "all" | ActivityType; label: string }> = [
  { key: "all", label: "All" },
  { key: "note", label: "Notes" },
  { key: "call", label: "Calls" },
  { key: "meeting", label: "Meetings" },
  { key: "task", label: "Tasks" },
  { key: "email", label: "Emails" },
  { key: "message", label: "Messages" },
];

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatDate(iso, { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

/** Customer interaction history. System/audit events are deliberately NOT shown here. */
export function ActivityTimeline({ activities, users, emptyAction, title = "Timeline" }: { activities: Activity[]; users: Map<string, User>; emptyAction?: React.ReactNode; title?: string }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const happened = useMemo(() => activities.filter((a) => a.occurredAt).sort((a, b) => b.occurredAt!.localeCompare(a.occurredAt!)), [activities]);
  const shown = filter === "all" ? happened : happened.filter((a) => a.type === filter);
  const groups = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of shown) {
      const k = dayLabel(a.occurredAt!);
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return [...map.entries()];
  }, [shown]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, f.key === "all" ? happened.length : happened.filter((a) => a.type === f.key).length])), [happened]);

  return (
    // Filter and entries form one outlined section, so the filter reads as part of the timeline, not another tab bar.
    <section className="rounded-2xl border border-border bg-card" aria-label={title}>
      <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-[0.9375rem] font-semibold">
          {title} {happened.length > 0 && <span className="font-normal text-muted-foreground">{happened.length}</span>}
        </h3>
        {happened.length > 0 && (
          <Segmented
            label="Filter timeline"
            value={filter}
            onChange={setFilter}
            options={FILTERS.filter((f) => f.key === "all" || counts[f.key] > 0).map((f) => ({ value: f.key, label: f.label, count: f.key === "all" ? undefined : counts[f.key] }))}
          />
        )}
      </div>
      <div className="px-5 py-5">
      {shown.length === 0 ? (
        <EmptyState compact icon={History} title={happened.length ? "Nothing of this type yet" : "No interactions yet"} description={happened.length ? undefined : "Calls, notes, meetings and messages you log will appear here."} action={emptyAction} />
      ) : (
        <ol className="space-y-6">
          {groups.map(([day, items]) => (
            <li key={day}>
              <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{day}</h3>
              <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-border">
                {items.map((a) => (
                  <li key={a.id} className="relative flex gap-3">
                    <ActivityIcon type={a.type} />
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {/* A note's subject is just its first line, so show the note text itself instead. */}
                        {a.type === "note" && a.body ? <p className="whitespace-pre-line">{a.body}</p> : <p className="font-medium">{a.subject}</p>}
                        {a.type === "call" && a.callOutcome && <StatusPill tone={a.callOutcome === "connected" ? "success" : "neutral"}>{CALL_OUTCOME_LABELS[a.callOutcome]}</StatusPill>}
                        {a.type === "message" && a.messagePurpose && <StatusPill tone={a.messagePurpose === "marketing" ? "info" : "neutral"}>{a.channel === "whatsapp" ? "WhatsApp" : a.channel?.toUpperCase()} · {a.messagePurpose === "marketing" ? "Marketing" : "Operational"}</StatusPill>}
                        {a.type === "task" && a.status === "done" && <StatusPill tone="success">Completed</StatusPill>}
                      </div>
                      {a.body && a.type !== "note" && <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{a.body}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ACTIVITY_LABELS[a.type]}
                        {a.direction && ` · ${a.direction === "outbound" ? "Outgoing" : "Incoming"}`}
                        {a.durationMinutes ? ` · ${a.durationMinutes} min` : ""}
                        {" · "}
                        {new Date(a.occurredAt!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        {users.get(a.createdBy)?.name ?? "Unknown"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
      </div>
    </section>
  );
}
