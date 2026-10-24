"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlarmClock, CalendarDays, Check, ListChecks, MoreHorizontal, PhoneCall, Plus, RotateCcw, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { addDaysKey, dayKey, formatInTz } from "@/lib/business/time";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SearchField } from "@/components/data-table/search-field";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/states";
import { Segmented } from "@/components/shared/segmented";
import { StatusPill } from "@/components/shared/status-pill";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActivitiesData } from "../hooks/use-activities";
import { canChangeActivity } from "../lib/access";
import { activityKind, bucketOf, isOverdue, matchesFilters, sortForView, type ActivityFilters, type Bucket } from "../lib/activities";
import { deleteActivity, setActivityStatus } from "../services/activities-service";
import { CALL_OUTCOME_LABELS, KIND_LABELS, type Activity, type ActivityKind } from "../types";
import { ActivityDetailSheet } from "./activity-detail-sheet";
import { ActivityFormDialog, type ActivityPreset } from "./activity-form-dialog";
import { ActivityIcon } from "./activity-icon";

const VIEWS: { value: ActivityFilters["view"]; label: string }[] = [
  { value: "late", label: "Late" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Coming up" },
  { value: "no_date", label: "No date" },
  { value: "done", label: "Done" },
  { value: "team", label: "Team" },
];

const useUi = create<{ f: ActivityFilters; set: (p: Partial<ActivityFilters>) => void }>()(
  persist((set) => ({ f: { view: "today", whose: "mine", kind: "all", search: "" }, set: (p) => set((s) => ({ f: { ...s.f, ...p } })) }), { name: "trovesuite-crm:activities-ui", storage: createJSONStorage(() => sessionStorage) }),
);

export function ActivitiesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { db, user, now, activities, contactMap, dealMap, users, people, tz } = useActivitiesData();
  const { f, set } = useUi();
  const [form, setForm] = useState<{ activity?: Activity; preset?: ActivityPreset } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const canCreate = hasPermission(user, "activities.create");

  // Deep links: ?open=<id> from the activity feed and other modules.
  const shownId = detailId ?? params.get("open");
  const detail = shownId ? (activities.find((x) => x.id === shownId) ?? null) : null;
  const setDetail = (a: Activity | null) => {
    setDetailId(a?.id ?? null);
    if (!a && params.get("open")) router.replace("/activities");
  };

  const ctx = useMemo(() => ({ userId: user.id, contactName: (id: string | null) => (id ? (contactMap.get(id)?.displayName ?? "") : ""), dealTitle: (id?: string) => (id ? (dealMap.get(id)?.title ?? "") : "") }), [user.id, contactMap, dealMap]);
  const filtered = useMemo(() => activities.filter((a) => matchesFilters(a, f, ctx)), [activities, f, ctx]);
  const byBucket = useMemo(() => {
    const m: Record<Bucket, Activity[]> = { late: [], today: [], upcoming: [], no_date: [], done: [] };
    for (const a of filtered) {
      const b = bucketOf(a, now, tz);
      if (b) m[b].push(a);
    }
    return m;
  }, [filtered, now, tz]);

  const today = dayKey(now, tz);
  const team = useMemo(() => {
    // Per-person workload across everything the viewer can see (ignores the Whose filter).
    const rows = new Map<string, Record<Bucket, number>>();
    for (const a of activities.filter((x) => matchesFilters(x, { ...f, whose: "everyone" }, ctx))) {
      const b = bucketOf(a, now, tz);
      if (!b) continue;
      if (b === "done" && dayKey(a.completedAt ?? a.occurredAt ?? a.createdAt, tz) < addDaysKey(today, -6)) continue;
      const k = a.assigneeId ?? "nobody";
      const r = rows.get(k) ?? { late: 0, today: 0, upcoming: 0, no_date: 0, done: 0 };
      r[b]++;
      rows.set(k, r);
    }
    return [...rows.entries()].sort((a, b) => b[1].late - a[1].late || b[1].today - a[1].today);
  }, [activities, f, ctx, now, tz, today]);

  const list = useMemo(() => (f.view === "team" ? [] : sortForView(byBucket[f.view], f.view)), [byBucket, f.view]);
  const groups = useMemo(() => {
    if (f.view !== "upcoming" && f.view !== "done") return [["", list] as const];
    const m = new Map<string, Activity[]>();
    for (const a of list) {
      const k = dayKey(a.dueAt ?? a.completedAt ?? a.occurredAt ?? a.createdAt, tz);
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return [...m.entries()];
  }, [list, f.view, tz]);

  const toggle = async (a: Activity) => {
    const r = await setActivityStatus(a.id, a.status === "done" ? "open" : "done");
    if (!r.ok) return toast.error(r.error);
    toast.success(a.status === "done" ? "Reopened" : "Done", { description: r.data.next ? `Repeats — next one planned for ${formatInTz(r.data.next.dueAt!, tz, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : a.subject, action: a.status !== "done" ? { label: "Undo", onClick: () => void setActivityStatus(a.id, "open") } : undefined });
  };

  const whoseLabel = (w: string) => (w === "mine" ? "Mine" : w === "everyone" ? "Everyone's" : w === "nobody" ? "Nobody's" : (users.get(w)?.name ?? "Someone"));
  const dupNames = new Set(people.filter((p, i) => people.findIndex((q) => q.name === p.name) !== i).map((p) => p.name));
  const emptyCopy: Record<Bucket, string> = { late: "Nothing is late. Nice.", today: "Nothing planned for today.", upcoming: "Nothing planned after today.", no_date: "Everything has a date.", done: "Nothing done yet." };

  return (
    <PageContainer>
      <PageHeader
        title="Tasks & calls"
        description="Calls to make, meetings to have, tasks to finish — and what has been done."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/calendar">
                <CalendarDays /> Calendar
              </Link>
            </Button>
            {hasPermission(user, "activities.import") && (
              <Button variant="outline" asChild>
                <Link href="/activities/import">
                  <Upload /> Import
                </Link>
              </Button>
            )}
            {canCreate && (
              <>
                <Button variant="outline" onClick={() => setForm({ preset: { type: "call", mode: "log", title: "Log a call" } })}>
                  <PhoneCall /> Log a call
                </Button>
                <Button onClick={() => setForm({})}>
                  <Plus /> New activity
                </Button>
              </>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <Segmented label="Activity view" value={f.view} onChange={(view) => set({ view })} options={VIEWS.map((v) => ({ ...v, count: v.value === "team" ? undefined : byBucket[v.value as Bucket].length || undefined }))} />
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchField value={f.search} onChange={(search) => set({ search })} placeholder="Search subject, contact, deal or notes" label="Search activities" />
          <div className="flex flex-wrap gap-2">
            <Select value={f.whose} onValueChange={(whose) => set({ whose })}>
              <SelectTrigger className="w-auto min-w-40 px-3.5" aria-label="Whose activities">
                <span className="text-muted-foreground">Whose:</span>
                <SelectValue>{whoseLabel(f.whose)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Mine</SelectItem>
                <SelectItem value="everyone">Everyone&apos;s</SelectItem>
                <SelectItem value="nobody">Nobody&apos;s</SelectItem>
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
            <Select value={f.kind} onValueChange={(kind) => set({ kind: kind as ActivityKind | "all" })}>
              <SelectTrigger className="w-auto min-w-36 px-3.5" aria-label="Kind">
                <span className="text-muted-foreground">Kind:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(Object.keys(KIND_LABELS) as ActivityKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(f.search || f.whose !== "mine" || f.kind !== "all") && (
              <Button variant="ghost" onClick={() => set({ search: "", whose: "mine", kind: "all" })}>
                Reset
              </Button>
            )}
          </div>
        </div>

        {f.view === "team" ? (
          <section className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/70">
                  <th scope="col" className="px-5 py-3 text-left font-medium">Person</th>
                  {(["late", "today", "upcoming", "no_date", "done"] as Bucket[]).map((b) => (
                    <th key={b} scope="col" className="px-3 py-3 text-right font-medium">
                      {b === "done" ? "Done (7 days)" : VIEWS.find((v) => v.value === b)!.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {team.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No activity for the people you can see.</td>
                  </tr>
                )}
                {team.map(([id, r]) => (
                  <tr key={id}>
                    <th scope="row" className="px-5 py-2.5 text-left font-medium">
                      <span className="flex items-center gap-2">
                        {id !== "nobody" && <UserAvatar name={users.get(id)?.name ?? "?"} size="xs" />}
                        {id === "nobody" ? "Nobody" : (users.get(id)?.name ?? "Unknown")}
                        {id === user.id && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                      </span>
                    </th>
                    {(["late", "today", "upcoming", "no_date", "done"] as Bucket[]).map((b) => (
                      <td key={b} className="px-3 py-2.5 text-right tabular-nums">
                        {r[b] ? (
                          <button type="button" className={cn("rounded px-1.5 hover:bg-secondary hover:underline", b === "late" && "font-semibold text-destructive")} onClick={() => set({ view: b, whose: id === "nobody" ? "nobody" : id })}>
                            {r[b]}
                          </button>
                        ) : (
                          <span className="text-subtle-foreground">0</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">Click a number to open that person&apos;s list.</p>
          </section>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card">
            <EmptyState icon={f.search || f.kind !== "all" ? Search : ListChecks} title={f.search || f.kind !== "all" ? "Nothing matches these filters" : emptyCopy[f.view]} description={f.whose === "mine" ? "Showing your own activities. Switch Whose to see others'." : undefined} action={canCreate && f.view !== "done" ? <Button variant="outline" onClick={() => setForm({})}>New activity</Button> : undefined} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map(([day, items]) => (
              <section key={day || "all"} aria-label={day || VIEWS.find((v) => v.value === f.view)!.label}>
                {day && <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{formatInTz(`${day}T12:00:00Z`, "UTC", { weekday: "long", day: "numeric", month: "long" })}</h2>}
                <ul className="divide-y divide-border/70 rounded-2xl border border-border bg-card">
                  {items.map((a) => {
                    const can = canChangeActivity(db, user, a);
                    const contact = a.contactId ? contactMap.get(a.contactId) : undefined;
                    const deal = a.dealId ? dealMap.get(a.dealId) : undefined;
                    const overdue = isOverdue(a, now);
                    const when = a.dueAt ?? a.completedAt ?? a.occurredAt;
                    return (
                      <li key={a.id} className="group flex items-start gap-3 px-4 py-3 text-sm sm:px-5">
                        {a.status ? (
                          <button
                            type="button"
                            disabled={!can}
                            onClick={() => toggle(a)}
                            aria-label={a.status === "done" ? `Reopen ${a.subject}` : `Mark ${a.subject} done`}
                            className={cn("mt-1 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-40", a.status === "done" ? "border-success bg-success text-white" : "border-border-strong hover:border-brand-700 hover:bg-brand-50")}
                          >
                            {a.status === "done" && <Check className="size-3.5" />}
                          </button>
                        ) : (
                          <span className="mt-1 size-5 shrink-0" aria-hidden />
                        )}
                        <ActivityIcon type={a.type} className="size-7 [&_svg]:size-3.5" />
                        <button type="button" onClick={() => setDetail(a)} className="min-w-0 flex-1 text-left">
                          <span className={cn("block font-medium", a.status === "done" && "text-muted-foreground line-through decoration-border-strong")}>{a.subject}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {KIND_LABELS[activityKind(a)]}
                            {contact && ` · ${contact.displayName}`}
                            {deal && ` · ${deal.title}`}
                            {a.type === "call" && a.callOutcome && ` · ${CALL_OUTCOME_LABELS[a.callOutcome]}`}
                            {a.location && ` · ${a.location}`}
                          </span>
                        </button>
                        <div className="hidden shrink-0 flex-col items-end gap-1 text-right sm:flex">
                          <span className={cn("text-xs tabular-nums", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                            {overdue && <AlarmClock className="mr-1 inline size-3" />}
                            {when ? formatInTz(when, tz, f.view === "today" || f.view === "upcoming" || f.view === "done" ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "No date"}
                            {overdue && <span className="sr-only"> (overdue)</span>}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {a.priority === "high" && a.status === "open" && <StatusPill tone="warning">High</StatusPill>}
                            {overdue && <StatusPill tone="danger">Overdue</StatusPill>}
                            {a.assigneeId ? <UserAvatar name={users.get(a.assigneeId)?.name ?? "?"} size="xs" /> : <span className="text-xs text-muted-foreground">Nobody</span>}
                          </span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Actions for ${a.subject}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setDetail(a)}>View details</DropdownMenuItem>
                            {contact && (
                              <DropdownMenuItem asChild>
                                <Link href={`/contacts/${contact.id}`}>Open contact</Link>
                              </DropdownMenuItem>
                            )}
                            {deal && (
                              <DropdownMenuItem asChild>
                                <Link href={`/deals/${deal.id}`}>Open deal</Link>
                              </DropdownMenuItem>
                            )}
                            {can && (
                              <>
                                <DropdownMenuSeparator />
                                {a.status && (
                                  <DropdownMenuItem onSelect={() => toggle(a)}>
                                    {a.status === "done" ? <RotateCcw /> : <Check />} {a.status === "done" ? "Reopen" : "Mark done"}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => setForm({ activity: a })}>Edit</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(a)}>
                                  Delete…
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Dates follow business time ({tz.replace("_", " ")}). Reminders are shown in the app only; nothing is sent by SMS or email.</p>
      </div>

      <ActivityFormDialog open={!!form} onOpenChange={(o) => !o && setForm(null)} activity={form?.activity} preset={form?.preset} />
      <ActivityDetailSheet activity={detail} onOpenChange={(o) => !o && setDetail(null)} onEdit={(a) => (setDetail(null), setForm({ activity: a }))} onDelete={(a) => setDeleting(a)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this activity?"
        description={deleting ? `"${deleting.subject}" will be removed from Tasks & Calls, the calendar and the customer's history. This can't be undone.` : ""}
        confirmLabel="Delete activity"
        destructive
        onConfirm={async () => {
          const r = await deleteActivity(deleting!.id);
          if (!r.ok) {
            toast.error(r.error);
            throw new Error(r.error);
          }
          toast.success("Activity deleted");
          setDetail(null);
        }}
      />
    </PageContainer>
  );
}
