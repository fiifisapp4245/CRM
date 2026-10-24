"use client";

import { CalendarCheck2 } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelative } from "@/lib/utils/format";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/feedback/states";
import { StatusPill } from "@/components/shared/status-pill";
import { useNow } from "@/lib/hooks/use-now";
import { ActivityIcon } from "./activity-icon";
import { setActivityStatus } from "../services/activities-service";
import type { Activity } from "../types";

export function UpNext({ activities, users, canComplete, emptyAction }: { activities: Activity[]; users: Map<string, User>; canComplete: boolean; emptyAction?: React.ReactNode }) {
  const open = activities.filter((a) => a.status === "open" && a.dueAt).sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  const now = useNow();

  const complete = async (a: Activity) => {
    const res = await setActivityStatus(a.id, "done");
    if (!res.ok) return toast.error(res.error);
    toast.success(a.type === "task" ? "Task completed" : "Meeting marked as held", {
      action: { label: "Undo", onClick: () => setActivityStatus(a.id, "open") },
    });
  };

  if (open.length === 0)
    return <EmptyState compact icon={CalendarCheck2} title="Nothing scheduled" description="Create a task or schedule a meeting so this relationship doesn't go quiet." action={emptyAction} />;

  return (
    <ul className="divide-y">
      {open.map((a) => {
        const overdue = new Date(a.dueAt!).getTime() < now;
        return (
          <li key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            {canComplete ? (
              <Checkbox className="mt-2" aria-label={a.type === "task" ? `Complete task: ${a.subject}` : `Mark meeting held: ${a.subject}`} onCheckedChange={(v) => v && complete(a)} />
            ) : (
              <ActivityIcon type={a.type} className="size-6" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{a.subject}</p>
                {a.type === "meeting" && <StatusPill tone="info">Meeting</StatusPill>}
                {overdue && <StatusPill tone="danger">Overdue</StatusPill>}
              </div>
              <p className={cn("text-sm", overdue ? "text-red-700" : "text-muted-foreground")}>
                <time dateTime={a.dueAt} title={formatDateTime(a.dueAt)}>
                  {a.type === "task" ? "Due " : ""}
                  {formatRelative(a.dueAt)} · {formatDateTime(a.dueAt)}
                </time>
                {a.assigneeId && ` · ${users.get(a.assigneeId)?.name ?? ""}`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
