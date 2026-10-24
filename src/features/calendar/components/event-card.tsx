import { AlarmClock, ArrowUp, CheckCircle2, MapPin, Repeat, User } from "lucide-react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { formatInTz } from "@/lib/business/time";
import { ACTIVITY_ICONS } from "@/features/activities/components/activity-icon";
import { KIND_LABELS, type Activity } from "@/features/activities/types";
import { activityKind } from "@/features/activities/lib/activities";

/**
 * Type tones: a tinted surface plus a matching 1px border — no side stroke.
 * The type is also named by its icon, so colour is never the only cue.
 */
export const EVENT_TONE: Record<Activity["type"], { card: string; icon: string; dot: string }> = {
  meeting: { card: "bg-brand-50 border-brand-200 hover:border-brand-300", icon: "text-brand-700", dot: "bg-brand-600" },
  visit: { card: "bg-emerald-50 border-emerald-200 hover:border-emerald-300", icon: "text-emerald-700", dot: "bg-emerald-600" },
  call: { card: "bg-sky-50 border-sky-200 hover:border-sky-300", icon: "text-sky-700", dot: "bg-sky-600" },
  task: { card: "bg-amber-50 border-amber-200 hover:border-amber-300", icon: "text-amber-700", dot: "bg-amber-600" },
  note: { card: "bg-slate-50 border-slate-200", icon: "text-slate-600", dot: "bg-slate-500" },
  email: { card: "bg-violet-50 border-violet-200", icon: "text-violet-700", dot: "bg-violet-600" },
  message: { card: "bg-violet-50 border-violet-200", icon: "text-violet-700", dot: "bg-violet-600" },
};
const DONE = { card: "bg-card border-border hover:border-border-strong", icon: "text-muted-foreground" };

/**
 * Week-view card. Details appear as height allows:
 * < 34px one line (time + subject) · ≥ 34 time range on its own line ·
 * ≥ 58 customer or deal · ≥ 80 place · ≥ 100 owner.
 */
export function EventCardBody({ a, start, end, height, tz, now, contact, deal, owner }: { a: Activity; start: string; end: string; height: number; tz: string; now: number; contact?: string; deal?: string; owner?: string }) {
  const done = a.status === "done" || !a.status;
  const overdue = a.status === "open" && !!a.dueAt && Date.parse(a.dueAt) < now;
  const tone = done ? DONE : EVENT_TONE[a.type];
  const Icon = ACTIVITY_ICONS[a.type];
  const t = (iso: string) => formatInTz(iso, tz, { hour: "2-digit", minute: "2-digit" });
  const range = `${t(start)}–${t(end)}`;
  const flags = (
    <span className="ml-auto flex shrink-0 items-center gap-0.5">
      {done && <CheckCircle2 className="size-3 text-success" aria-label="Done" />}
      {overdue && <AlarmClock className="size-3 text-destructive" aria-label="Overdue" />}
      {a.priority === "high" && a.status === "open" && <ArrowUp className="size-3 text-amber-700" aria-label="High priority" />}
      {a.recurrence && a.recurrence !== "none" && <Repeat className="size-3 text-muted-foreground" aria-label="Repeats" />}
    </span>
  );
  if (height < 34)
    return (
      <span className="flex items-center gap-1 truncate">
        <Icon className={cn("size-3 shrink-0", tone.icon)} />
        <span className="shrink-0 tabular-nums text-muted-foreground">{t(start)}</span>
        <span className={cn("truncate font-medium", done && "text-muted-foreground")}>{a.subject}</span>
        {flags}
      </span>
    );
  return (
    <span className="flex h-full flex-col gap-0.5">
      <span className="flex items-center gap-1 text-muted-foreground">
        <Icon className={cn("size-3 shrink-0", tone.icon)} />
        <span className="truncate tabular-nums">{range}</span>
        {flags}
      </span>
      <span className={cn("font-medium text-foreground", height >= 58 ? "line-clamp-2" : "truncate", done && "text-muted-foreground")}>{a.subject}</span>
      {height >= 58 && (contact || deal) && <span className="truncate text-muted-foreground">{[contact, deal].filter(Boolean).join(" · ")}</span>}
      {height >= 80 && a.location && (
        <span className="flex items-center gap-1 truncate text-muted-foreground">
          <MapPin className="size-3 shrink-0" /> <span className="truncate">{a.location}</span>
        </span>
      )}
      {height >= 100 && owner && (
        <span className="mt-auto flex items-center gap-1 truncate text-muted-foreground">
          <User className="size-3 shrink-0" /> <span className="truncate">{owner}{a.attendeeIds?.length ? ` +${a.attendeeIds.length}` : ""}</span>
        </span>
      )}
      <span className="sr-only">{KIND_LABELS[activityKind(a)]}</span>
    </span>
  );
}

export function eventCardClass(a: Activity) {
  const done = a.status === "done" || !a.status;
  return (done ? DONE : EVENT_TONE[a.type]).card;
}

/** Full details on hover or keyboard focus, so short events stay readable. Light card, not the dark tooltip. */
export function EventPeek({ children, a, start, end, tz, now, contact, deal, owner, attendees }: { children: React.ReactNode; a: Activity; start: string; end: string; tz: string; now: number; contact?: string; deal?: string; owner?: string; attendees?: string[] }) {
  const done = a.status === "done" || !a.status;
  const overdue = a.status === "open" && !!a.dueAt && Date.parse(a.dueAt) < now;
  const Icon = ACTIVITY_ICONS[a.type];
  const tone = done ? DONE : EVENT_TONE[a.type];
  const row = (label: string, value?: React.ReactNode) =>
    value ? (
      <>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="min-w-0 truncate">{value}</dd>
      </>
    ) : null;
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side="right" align="start" sideOffset={6} collisionPadding={12} className="z-50 w-72 rounded-xl border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0">
          <div className="flex items-start gap-2">
            <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border", tone.card)}>
              <Icon className={cn("size-3.5", tone.icon)} />
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-snug font-medium">{a.subject}</p>
              <p className="text-muted-foreground">
                {KIND_LABELS[activityKind(a)]} · {formatInTz(start, tz, { weekday: "short", day: "numeric", month: "short" })}, {formatInTz(start, tz, { hour: "2-digit", minute: "2-digit" })}–{formatInTz(end, tz, { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {done && <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-0.5 text-success"><CheckCircle2 className="size-3" /> Done</span>}
            {overdue && <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-destructive"><AlarmClock className="size-3" /> Overdue</span>}
            {a.priority === "high" && a.status === "open" && <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-800"><ArrowUp className="size-3" /> High priority</span>}
            {a.recurrence && a.recurrence !== "none" && <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-muted-foreground"><Repeat className="size-3" /> Repeats {a.recurrence}</span>}
          </div>
          <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1">
            {row("Contact", contact)}
            {row("Deal", deal)}
            {row("Where", a.location)}
            {row("Owner", owner ?? "Nobody")}
            {row("With", attendees?.length ? attendees.join(", ") : undefined)}
            {row("Notes", a.body)}
          </dl>
          <p className="mt-2 text-[11px] text-subtle-foreground">Click to open{a.status === "open" ? " · drag to reschedule" : ""}</p>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
