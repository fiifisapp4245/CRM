import { AlarmClock, CheckCircle2, Clock } from "lucide-react";
import { formatInTz } from "@/lib/business/time";
import { formatHours } from "../lib/tickets";
import { cn } from "@/lib/utils";
import type { Ticket } from "../types";

/** One target (first reply or resolution): due time, met time, and whether it's late — in words, not colour alone. */
export function TargetState({ due, done, active, now, tz, compact }: { due: string; done?: string; active: boolean; now: number; tz: string; compact?: boolean }) {
  const fmt = (iso: string) => formatInTz(iso, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  if (done) {
    const late = done > due;
    return (
      <span className={cn("inline-flex items-center gap-1", late ? "text-destructive" : "text-success")}>
        <CheckCircle2 className="size-3.5" /> {late ? "Met late" : "Met"}
        {!compact && <span className="text-muted-foreground"> · {fmt(done)}</span>}
      </span>
    );
  }
  if (!active) return <span className="text-muted-foreground">Not needed</span>;
  const late = now > Date.parse(due);
  return (
    <span className={cn("inline-flex items-center gap-1", late ? "font-medium text-destructive" : "text-muted-foreground")}>
      {late ? <AlarmClock className="size-3.5" /> : <Clock className="size-3.5" />}
      {late ? `Late by ${formatHours((now - Date.parse(due)) / 3_600_000)}` : `Due in ${formatHours((Date.parse(due) - now) / 3_600_000)}`}
      {!compact && <span className="text-muted-foreground"> · {fmt(due)}</span>}
    </span>
  );
}

export const responseTarget = (t: Ticket) => ({ due: t.firstResponseDueAt, done: t.firstRespondedAt, active: t.status === "open" || t.status === "waiting" });
export const resolutionTarget = (t: Ticket) => ({ due: t.resolutionDueAt, done: t.resolvedAt, active: t.status === "open" || t.status === "waiting" });
