"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { addDaysKey, dayKey, formatInTz, startOfWeekKey, timeKey, toWall, zonedIso } from "@/lib/business/time";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActivitiesData } from "@/features/activities/hooks/use-activities";
import { canChangeActivity } from "@/features/activities/lib/access";
import { activityKind, DEFAULT_MINUTES, isOverdue } from "@/features/activities/lib/activities";
import { deleteActivity, rescheduleActivity, restoreSchedule } from "@/features/activities/services/activities-service";
import { ActivityDetailSheet } from "@/features/activities/components/activity-detail-sheet";
import { ActivityFormDialog, type ActivityPreset } from "@/features/activities/components/activity-form-dialog";
import { ACTIVITY_ICONS, ActivityIcon } from "@/features/activities/components/activity-icon";
import { KIND_LABELS, type Activity } from "@/features/activities/types";
import { calendarStart, monthGrid, placeDay } from "../lib/layout";
import { EVENT_TONE, EventCardBody, eventCardClass, EventPeek } from "./event-card";

const HOUR_PX = 60;
const SLOT_MIN = 30;
/** Scheduled work only; notes and messages live on timelines and in Messaging. */
const ON_CALENDAR = new Set<Activity["type"]>(["task", "call", "meeting", "visit"]);
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const useCalUi = create<{ view: "week" | "month"; whose: string; set: (p: Partial<{ view: "week" | "month"; whose: string }>) => void }>()(
  persist((set) => ({ view: "week", whose: "mine", set: (p) => set(p) }), { name: "trovesuite-crm:calendar-ui", storage: createJSONStorage(() => sessionStorage) }),
);


export function CalendarPage() {
  const { db, user, now, activities, contactMap, dealMap, users, people, tz } = useActivitiesData();
  const { view, whose, set } = useCalUi();
  const today = dayKey(now, tz);
  const [anchor, setAnchor] = useState(today);
  const [form, setForm] = useState<{ activity?: Activity; preset?: ActivityPreset } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const canCreate = hasPermission(user, "activities.create");

  useEffect(() => {
    if (view === "week" && scroller.current) scroller.current.scrollTop = 7 * HOUR_PX;
  }, [view]);

  const events = useMemo(
    () => activities.filter((a) => a.status !== "cancelled" && ON_CALENDAR.has(a.type) && calendarStart(a) && (whose === "everyone" || (whose === "mine" ? a.assigneeId === user.id || (a.attendeeIds ?? []).includes(user.id) : a.assigneeId === whose || (a.attendeeIds ?? []).includes(whose)))),
    [activities, whose, user.id],
  );
  const weekStart = startOfWeekKey(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
  const month = anchor.slice(0, 7);
  const label = view === "week" ? `${formatInTz(`${days[0]}T12:00:00Z`, "UTC", { day: "numeric", month: "short" })} – ${formatInTz(`${days[6]}T12:00:00Z`, "UTC", { day: "numeric", month: "short", year: "numeric" })}` : formatInTz(`${month}-15T12:00:00Z`, "UTC", { month: "long", year: "numeric" });
  const move = (dir: -1 | 1) => setAnchor(view === "week" ? addDaysKey(anchor, dir * 7) : `${new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + dir, 1)).toISOString().slice(0, 7)}-01`);
  const detail = detailId ? (activities.find((a) => a.id === detailId) ?? null) : null;
  const dupNames = new Set(people.filter((p, i) => people.findIndex((q) => q.name === p.name) !== i).map((p) => p.name));

  const planAt = (key: string, time: string) => {
    if (!canCreate) return;
    const start = zonedIso(key, time, tz);
    setForm({ preset: { type: "meeting", mode: "plan", start, end: new Date(Date.parse(start) + DEFAULT_MINUTES.meeting * 60_000).toISOString() } });
  };

  const drop = async (a: Activity, key: string, time: string) => {
    setDragId(null);
    setOverSlot(null);
    const start = zonedIso(key, time, tz);
    if (start === a.dueAt) return;
    const r = await rescheduleActivity(a.id, start);
    if (!r.ok) return toast.error(r.error);
    toast.success("Rescheduled", {
      description: `${a.subject} → ${formatInTz(start, tz, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. Duration and reminder moved with it.`,
      action: { label: "Undo", onClick: () => void restoreSchedule(a.id, r.data.previous).then((u) => (u.ok ? toast.success("Moved back") : toast.error(u.error))) },
    });
  };

  const eventLabel = (a: Activity) => {
    const s = calendarStart(a)!;
    const c = a.contactId ? contactMap.get(a.contactId)?.displayName : undefined;
    return `${KIND_LABELS[activityKind(a)]}: ${a.subject}, ${formatInTz(s, tz, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}${c ? `, with ${c}` : ""}${a.status === "done" || !a.status ? ", done" : ""}${isOverdue(a, now) ? ", overdue" : ""}`;
  };

  return (
    <PageContainer width="full">
      <PageHeader
        title="Calendar"
        description="Calls, meetings, visits and tasks with a time. Click an empty slot to plan something; drag to reschedule."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/activities">
                <ListChecks /> Tasks & calls
              </Link>
            </Button>
            {canCreate && (
              <Button onClick={() => setForm({ preset: { mode: "plan", type: "meeting" } })}>
                <Plus /> New activity
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label={view === "week" ? "Previous week" : "Previous month"} onClick={() => move(-1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" onClick={() => setAnchor(today)}>
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label={view === "week" ? "Next week" : "Next month"} onClick={() => move(1)}>
            <ChevronRight />
          </Button>
        </div>
        <h2 className="min-w-44 px-2 text-base font-semibold" aria-live="polite">
          {label}
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={whose} onValueChange={(w) => set({ whose: w })}>
            <SelectTrigger className="w-auto min-w-40 px-3.5" aria-label="Whose calendar">
              <span className="text-muted-foreground">Whose:</span>
              <SelectValue>{whose === "mine" ? "Mine" : whose === "everyone" ? "Everyone's" : (users.get(whose)?.name ?? "Someone")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mine">Mine</SelectItem>
              <SelectItem value="everyone">Everyone&apos;s</SelectItem>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>People</SelectLabel>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {dupNames.has(p.name) ? ` (${p.email})` : p.jobTitle ? ` · ${p.jobTitle}` : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Segmented label="Calendar view" value={view} onChange={(v) => set({ view: v })} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
        </div>
      </div>

      <ul className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {(["meeting", "call", "visit", "task"] as const).map((t) => {
          const Icon = ACTIVITY_ICONS[t];
          return (
            <li key={t} className="flex items-center gap-1.5">
              <span className={cn("flex size-4 items-center justify-center rounded border", EVENT_TONE[t].card)}>
                <Icon className={cn("size-2.5", EVENT_TONE[t].icon)} />
              </span>
              {KIND_LABELS[t]}
            </li>
          );
        })}
        <li className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" /> Done</li>
      </ul>

      {view === "week" ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-label={`Week of ${label}`}>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border/70">
                <div />
                {days.map((d, i) => (
                  <div key={d} className={cn("px-2 py-2 text-center text-xs", d === today ? "font-semibold text-brand-800" : "text-muted-foreground")}>
                    {DAY_NAMES[i]}{" "}
                    <span className={cn("ml-0.5 inline-flex size-6 items-center justify-center rounded-full text-sm tabular-nums", d === today ? "bg-brand-700 text-white" : "text-foreground")}>{Number(d.slice(8))}</span>
                    {d === today && <span className="sr-only"> (today)</span>}
                  </div>
                ))}
              </div>
              <div ref={scroller} className="relative max-h-[640px] overflow-y-auto">
                <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR_PX }}>
                  <div className="relative">
                    {Array.from({ length: 24 }, (_, h) => (
                      <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums" style={{ top: h * HOUR_PX }}>
                        {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                      </span>
                    ))}
                  </div>
                  {days.map((d) => {
                    const placed = placeDay(events, d, tz);
                    const nowW = toWall(now, tz);
                    return (
                      <div key={d} className={cn("relative border-l border-border/60", d === today && "bg-brand-50/30")}>
                        {Array.from({ length: (24 * 60) / SLOT_MIN }, (_, s) => {
                          const time = `${String(Math.floor((s * SLOT_MIN) / 60)).padStart(2, "0")}:${String((s * SLOT_MIN) % 60).padStart(2, "0")}`;
                          const slotKey = `${d}|${time}`;
                          return (
                            <div
                              key={s}
                              role="button"
                              tabIndex={-1}
                              aria-label={`Plan at ${d} ${time}`}
                              onClick={() => planAt(d, time)}
                              onDragOver={(e) => {
                                if (!dragId) return;
                                e.preventDefault();
                                if (overSlot !== slotKey) setOverSlot(slotKey);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const a = events.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                                if (a) void drop(a, d, time);
                              }}
                              className={cn("absolute inset-x-0 cursor-pointer hover:bg-secondary/60", s % 2 === 0 && "border-t border-border/50", overSlot === slotKey && "bg-brand-100")}
                              style={{ top: (s * SLOT_MIN * HOUR_PX) / 60, height: (SLOT_MIN * HOUR_PX) / 60 }}
                            />
                          );
                        })}
                        {d === today && (
                          <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-destructive" style={{ top: ((nowW.h * 60 + nowW.min) * HOUR_PX) / 60 }} aria-hidden>
                            <span className="absolute -top-1 -left-1 size-2 rounded-full bg-destructive" />
                          </div>
                        )}
                        {placed.map((p) => {
                          const can = p.a.status === "open" && canChangeActivity(db, user, p.a);
                          return (
                            <EventPeek
                              key={p.a.id}
                              a={p.a}
                              start={p.start}
                              end={new Date(Date.parse(p.start) + (p.endMin - p.startMin) * 60_000).toISOString()}
                              tz={tz}
                              now={now}
                              contact={p.a.contactId ? contactMap.get(p.a.contactId)?.displayName : undefined}
                              deal={p.a.dealId ? dealMap.get(p.a.dealId)?.title : undefined}
                              owner={p.a.assigneeId ? users.get(p.a.assigneeId)?.name : undefined}
                              attendees={(p.a.attendeeIds ?? []).map((id) => users.get(id)?.name ?? "").filter(Boolean)}
                            >
                            <button
                              type="button"
                              draggable={can}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", p.a.id);
                                e.dataTransfer.effectAllowed = "move";
                                setDragId(p.a.id);
                              }}
                              onDragEnd={() => (setDragId(null), setOverSlot(null))}
                              onClick={() => setDetailId(p.a.id)}
                              aria-label={eventLabel(p.a)}
                              className={cn(
                                "absolute z-20 overflow-hidden rounded-lg border px-2 py-1 text-left text-[11px] leading-snug transition-[border-color,opacity,box-shadow] hover:z-30 hover:shadow-md focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                eventCardClass(p.a),
                                can && "cursor-grab active:cursor-grabbing",
                                dragId === p.a.id && "opacity-40",
                              )}
                              style={{ top: (p.startMin * HOUR_PX) / 60 + 1, height: Math.max(24, ((p.endMin - p.startMin) * HOUR_PX) / 60 - 2), left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`, width: `calc(${100 / p.lanes}% - 4px)` }}
                            >
                              <EventCardBody
                                a={p.a}
                                start={p.start}
                                end={new Date(Date.parse(p.start) + (p.endMin - p.startMin) * 60_000).toISOString()}
                                height={Math.max(24, ((p.endMin - p.startMin) * HOUR_PX) / 60 - 2)}
                                tz={tz}
                                now={now}
                                contact={p.a.contactId ? contactMap.get(p.a.contactId)?.displayName : undefined}
                                deal={p.a.dealId ? dealMap.get(p.a.dealId)?.title : undefined}
                                owner={p.a.assigneeId ? users.get(p.a.assigneeId)?.name : undefined}
                              />
                            </button>
                            </EventPeek>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-label={label}>
          <div className="grid grid-cols-7 border-b border-border/70 text-center text-xs text-muted-foreground">
            {DAY_NAMES.map((n) => (
              <div key={n} className="py-2">
                {n}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGrid(month).map((d) => {
              const list = events.filter((a) => dayKey(calendarStart(a)!, tz) === d).sort((x, y) => calendarStart(x)!.localeCompare(calendarStart(y)!));
              const inMonth = d.startsWith(month);
              const shown = list.slice(0, 3);
              return (
                <div
                  key={d}
                  className={cn("min-h-28 border-r border-b border-border/60 p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-panel/60", overSlot === d && "bg-brand-50")}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    if (overSlot !== d) setOverSlot(d);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const a = events.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                    if (a) void drop(a, d, timeKey(a.dueAt!, tz)); // keeps the time of day
                  }}
                >
                  <button type="button" onClick={() => planAt(d, "09:00")} disabled={!canCreate} aria-label={`Plan an activity on ${d}`} className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-xs tabular-nums hover:bg-secondary", d === today && "bg-brand-700 font-semibold text-white hover:bg-brand-800", !inMonth && "text-muted-foreground")}>
                    {Number(d.slice(8))}
                  </button>
                  <ul className="space-y-0.5">
                    {shown.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          draggable={a.status === "open" && canChangeActivity(db, user, a)}
                          onDragStart={(e) => (e.dataTransfer.setData("text/plain", a.id), setDragId(a.id))}
                          onDragEnd={() => (setDragId(null), setOverSlot(null))}
                          onClick={() => setDetailId(a.id)}
                          aria-label={eventLabel(a)}
                          title={eventLabel(a)}
                          className={cn("flex w-full items-center gap-1.5 truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] hover:shadow-sm", eventCardClass(a))}
                        >
                          <span className={cn("size-1.5 shrink-0 rounded-full", a.status === "open" ? EVENT_TONE[a.type].dot : "bg-border-strong")} aria-hidden />
                          <span className="shrink-0 text-muted-foreground tabular-nums">{timeKey(calendarStart(a)!, tz)}</span>
                          <span className={cn("truncate font-medium", a.status !== "open" && "text-muted-foreground")}>{a.subject}</span>
                          {a.status !== "open" && <CheckCircle2 className="ml-auto size-3 shrink-0 text-success" aria-label="Done" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {list.length > 3 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="mt-0.5 rounded px-1 text-[11px] font-medium text-brand-700 hover:underline">
                          +{list.length - 3} more
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2">
                        <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{formatInTz(`${d}T12:00:00Z`, "UTC", { weekday: "long", day: "numeric", month: "long" })}</p>
                        <ul className="space-y-1">
                          {list.map((a) => (
                            <li key={a.id}>
                              <button type="button" onClick={() => setDetailId(a.id)} className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-secondary">
                                <ActivityIcon type={a.type} className="size-6 [&_svg]:size-3" />
                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{timeKey(calendarStart(a)!, tz)}</span>
                                <span className="truncate">{a.subject}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        Business time ({tz.replace("_", " ")}). Keyboard: Tab to an event and press Enter to open it, then Edit to change its date and time. The same activities are listed in{" "}
        <Link href="/activities" className="underline">
          Tasks & calls
        </Link>
        . Not synced with external calendars.
      </p>

      <ActivityFormDialog open={!!form} onOpenChange={(o) => !o && setForm(null)} activity={form?.activity} preset={form?.preset} variant="calendar" />
      <ActivityDetailSheet activity={detail} onOpenChange={(o) => !o && setDetailId(null)} onEdit={(a) => (setDetailId(null), setForm({ activity: a }))} onDelete={(a) => setDeleting(a)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this activity?"
        description={deleting ? `"${deleting.subject}" will be removed from the calendar, Tasks & Calls and the customer's history.` : ""}
        confirmLabel="Delete activity"
        destructive
        onConfirm={async () => {
          const r = await deleteActivity(deleting!.id);
          if (!r.ok) {
            toast.error(r.error);
            throw new Error(r.error);
          }
          toast.success("Activity deleted");
          setDetailId(null);
        }}
      />
    </PageContainer>
  );
}
