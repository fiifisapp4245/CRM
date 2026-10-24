"use client";

import Link from "next/link";
import { Bell, CalendarClock, Check, MapPin, Pencil, Repeat, RotateCcw, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { formatInTz } from "@/lib/business/time";
import { formatRelative } from "@/lib/utils/format";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useActivitiesData } from "../hooks/use-activities";
import { canChangeActivity } from "../lib/access";
import { activityKind, isOverdue, reminderAt, reminderMinutes } from "../lib/activities";
import { setActivityStatus } from "../services/activities-service";
import { CALL_OUTCOME_LABELS, DIRECTION_LABELS, KIND_LABELS, PRIORITY_LABELS, RECURRENCE_LABELS, type Activity } from "../types";
import { ActivityIcon } from "./activity-icon";

export function ActivityDetailSheet({ activity, onOpenChange, onEdit, onDelete }: { activity: Activity | null; onOpenChange: (o: boolean) => void; onEdit: (a: Activity) => void; onDelete: (a: Activity) => void }) {
  const { db, user, now, contactMap, dealMap, users, tz, settings } = useActivitiesData();
  const a = activity ? (db.activities.find((x) => x.id === activity.id) ?? null) : null;
  const can = a ? canChangeActivity(db, user, a) : false;
  const fmt = (iso: string) => formatInTz(iso, tz, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const toggle = async () => {
    if (!a) return;
    const r = await setActivityStatus(a.id, a.status === "done" ? "open" : "done");
    if (!r.ok) return toast.error(r.error);
    toast.success(a.status === "done" ? "Reopened" : "Marked done", { description: r.data.next ? `Next one planned for ${fmt(r.data.next.dueAt!)}` : a.subject });
  };
  const contact = a?.contactId ? contactMap.get(a.contactId) : undefined;
  const deal = a?.dealId ? dealMap.get(a.dealId) : undefined;
  const rem = a ? reminderAt(a, settings.defaultReminderMinutes) : null;
  const row = (label: string, value: React.ReactNode, Icon?: typeof MapPin) =>
    value ? (
      <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2">
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          {Icon && <Icon className="size-3.5" />} {label}
        </dt>
        <dd>{value}</dd>
      </div>
    ) : null;

  return (
    <Sheet open={!!a} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {a && (
          <>
            <SheetHeader className="border-b border-border/70 px-6 py-5">
              <div className="flex items-center gap-3">
                <ActivityIcon type={a.type} />
                <div className="min-w-0">
                  <SheetTitle className="text-lg leading-snug">{a.subject}</SheetTitle>
                  <SheetDescription>
                    {KIND_LABELS[activityKind(a)]} · {a.status === "open" ? "To do" : a.status === "done" ? "Done" : "Logged"}
                  </SheetDescription>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {isOverdue(a, now) && <StatusPill tone="danger">Overdue</StatusPill>}
                {a.priority === "high" && a.status === "open" && <StatusPill tone="warning">High priority</StatusPill>}
                {a.recurrence && a.recurrence !== "none" && (
                  <StatusPill tone="neutral">
                    <Repeat className="size-3" /> {RECURRENCE_LABELS[a.recurrence]}
                  </StatusPill>
                )}
              </div>
            </SheetHeader>
            <dl className="flex-1 divide-y divide-border/60 overflow-y-auto px-6 py-2 text-sm">
              {row(a.status ? "Planned for" : "Happened", a.dueAt ? `${fmt(a.dueAt)}${a.endAt ? ` – ${formatInTz(a.endAt, tz, { hour: "2-digit", minute: "2-digit" })}` : ""}` : a.occurredAt ? fmt(a.occurredAt) : "No date", CalendarClock)}
              {a.completedAt && row("Completed", fmt(a.completedAt))}
              {row("Contact", contact ? <Link className="font-medium hover:underline" href={`/contacts/${contact.id}`}>{contact.displayName}</Link> : null)}
              {row("Deal", deal ? <Link className="font-medium hover:underline" href={`/deals/${deal.id}`}>{deal.title}</Link> : null)}
              {row("Owner", a.assigneeId ? users.get(a.assigneeId)?.name : "Nobody")}
              {row("Also attending", a.attendeeIds?.length ? a.attendeeIds.map((id) => users.get(id)?.name).join(", ") : null, Users)}
              {row("Where", a.location, MapPin)}
              {a.status === "open" && row("Priority", PRIORITY_LABELS[a.priority ?? "normal"])}
              {a.status === "open" && a.dueAt && row("Reminder", rem ? `${fmt(rem)} (${reminderMinutes(a, settings.defaultReminderMinutes)} min before${a.reminder === "default" || a.reminder === undefined ? ", business default" : ""}) — in-app, simulated` : "None", Bell)}
              {a.type === "call" && !a.status && row("What happened", a.callOutcome ? CALL_OUTCOME_LABELS[a.callOutcome] : null)}
              {a.type === "call" && !a.status && row("Direction", a.direction ? DIRECTION_LABELS[a.direction] : null)}
              {row("Minutes", a.durationMinutes ? String(a.durationMinutes) : null)}
              {row("Notes", a.body ? <span className="whitespace-pre-line">{a.body}</span> : null)}
              {row("Created", `${users.get(a.createdBy)?.name ?? "Unknown"} · ${formatRelative(a.createdAt, now)}`)}
            </dl>
            {can && (
              <div className="flex flex-wrap gap-2 border-t border-border/70 px-6 py-4">
                {a.status && (
                  <Button onClick={toggle}>
                    {a.status === "done" ? <RotateCcw /> : <Check />} {a.status === "done" ? "Reopen" : "Mark done"}
                  </Button>
                )}
                <Button variant="outline" onClick={() => onEdit(a)}>
                  <Pencil /> Edit
                </Button>
                <Button variant="ghost" className="ml-auto text-destructive" onClick={() => onDelete(a)}>
                  <Trash2 /> Delete
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
