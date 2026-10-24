"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, History, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { hasPermission } from "@/lib/permissions";
import { useNow } from "@/lib/hooks/use-now";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useCurrentUser } from "@/features/permissions";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SearchField } from "@/components/data-table/search-field";
import { FilterPopover } from "@/components/data-table/filter-popover";
import { FilterChips, type FilterChip } from "@/components/data-table/filter-chips";
import { Segmented } from "@/components/shared/segmented";
import { EmptyState } from "@/components/feedback/states";
import { StatusPill } from "@/components/shared/status-pill";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { buildFeed, DATE_RANGE_LABELS, FEED_CATEGORIES, filterFeed, type DateRange, type FeedEvent, type FeedFilters } from "../lib/feed";

const PAGE = 40;
const DEFAULT: FeedFilters = { category: "all", search: "", actorIds: [], range: "30d" };
const CATEGORY_LABEL = Object.fromEntries(FEED_CATEGORIES.map((c) => [c.key, c.label]));

function dayHeading(iso: string, now: number) {
  const d = new Date(iso);
  const today = new Date(now);
  const y = new Date(now - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return formatDate(iso, { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function Sentence({ e }: { e: FeedEvent }) {
  return (
    <p className="text-sm">
      <span className="font-medium">{e.actor}</span> <span className="text-muted-foreground">{e.verb.toLowerCase()}</span>
      {e.recordType && <span className="text-muted-foreground"> {e.recordType}</span>} <span className="font-medium">{e.recordName}</span>
    </p>
  );
}

export function ActivityFeedPage() {
  const user = useCurrentUser();
  const db = useDbStore((s) => s.db);
  const now = useNow();
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<FeedEvent | null>(null);
  const patch = (p: Partial<FeedFilters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setLimit(PAGE);
  };

  const all = useMemo(() => buildFeed(db, user), [db, user]);
  const inRange = useMemo(() => filterFeed(all, { ...filters, category: "all" }, now), [all, filters, now]);
  const shown = useMemo(() => (filters.category === "all" ? inRange : inRange.filter((e) => e.category === filters.category)), [inRange, filters.category]);
  const categories = FEED_CATEGORIES.filter((c) => c.key !== "settings" || hasPermission(user, "settings.view"));
  const actors = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of all) m.set(e.actorId, e.actor);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));
  }, [all]);
  const olderAvailable = filters.range !== "all" && all.length > filterFeed(all, { ...filters, category: filters.category }, now).length;

  const groups = useMemo(() => {
    const m = new Map<string, FeedEvent[]>();
    for (const e of shown.slice(0, limit)) {
      const k = dayHeading(e.at, now);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [shown, limit, now]);

  const chips: FilterChip[] = [
    ...filters.actorIds.map((id) => ({ key: id, label: `By: ${actors.find((a) => a.value === id)?.label ?? id}`, onRemove: () => patch({ actorIds: filters.actorIds.filter((x) => x !== id) }) })),
    ...(filters.range !== DEFAULT.range ? [{ key: "range", label: filters.range === "custom" ? `${filters.customFrom ?? "…"} – ${filters.customTo ?? "…"}` : DATE_RANGE_LABELS[filters.range], onRemove: () => patch({ range: DEFAULT.range }) }] : []),
  ];
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT);

  return (
    <PageContainer>
      <PageHeader
        title="Activity feed"
        description="What changed across customers, sales and service, newest first. For your own follow-ups, use Tasks & Calls."
      />

      <div className="flex flex-col gap-4">
        <Segmented
          label="Activity categories"
          value={filters.category}
          onChange={(category) => patch({ category })}
          options={categories.map((c) => ({ value: c.key, label: c.label, count: c.key === "all" ? inRange.length : inRange.filter((e) => e.category === c.key).length }))}
        />
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchField value={filters.search} onChange={(search) => patch({ search })} placeholder="Search people, records or fields" label="Search activity" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterPopover label="People" options={actors} selected={filters.actorIds} onChange={(actorIds) => patch({ actorIds })} searchable />
            <Select value={filters.range} onValueChange={(v) => patch({ range: v as DateRange })}>
              <SelectTrigger className="w-auto min-w-40 px-3.5" aria-label="Date range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {DATE_RANGE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.range === "custom" && (
              <div className="flex items-center gap-2">
                <Input type="date" aria-label="From date" value={filters.customFrom ?? ""} onChange={(e) => patch({ customFrom: e.target.value || undefined })} className="w-40" />
                <span className="text-muted-foreground">to</span>
                <Input type="date" aria-label="To date" value={filters.customTo ?? ""} onChange={(e) => patch({ customTo: e.target.value || undefined })} className="w-40" />
              </div>
            )}
          </div>
        </div>
        <FilterChips chips={chips}>
          {dirty && (
            <Button variant="ghost" size="sm" onClick={() => patch(DEFAULT)}>
              Reset filters
            </Button>
          )}
        </FilterChips>
      </div>

      <section className="rounded-2xl border border-border bg-card" aria-label="Activity">
        {shown.length === 0 ? (
          <EmptyState
            icon={History}
            title={filters.search || filters.actorIds.length ? "No activity matches" : `No activity ${filters.range === "all" ? "yet" : `in ${DATE_RANGE_LABELS[filters.range].toLowerCase()}`}`}
            description={olderAvailable ? "There is older activity outside this period." : "Try another category or remove a filter."}
            action={
              olderAvailable ? (
                <Button variant="outline" onClick={() => patch({ range: filters.range === "90d" ? "all" : "90d" })}>
                  Show {filters.range === "90d" ? "all time" : "last 90 days"}
                </Button>
              ) : dirty ? (
                <Button variant="outline" onClick={() => patch(DEFAULT)}>
                  Reset filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ol className="divide-y divide-border/70">
            {groups.map(([day, items]) => (
              <li key={day}>
                <h2 className="sticky top-16 z-10 bg-card/95 px-5 pt-4 pb-2 text-xs font-semibold text-muted-foreground backdrop-blur">{day}</h2>
                <ol>
                  {items.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setOpen(e)}
                        className={cn("flex w-full cursor-pointer items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-[#f8fbfc] focus-visible:bg-brand-50/60 focus-visible:outline-none", open?.id === e.id && "bg-brand-50/60")}
                      >
                        <UserAvatar name={e.actor} size="md" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <Sentence e={e} />
                          {(e.summary || e.changes.length > 0) && (
                            <p className="truncate text-sm text-muted-foreground">
                              {e.changes.length === 1 && !e.restricted && (e.changes[0].from || e.changes[0].to)
                                ? `${e.changes[0].label}: ${e.changes[0].from || "empty"} → ${e.changes[0].to || "empty"}`
                                : e.changes.length
                                  ? `Changed ${e.changes.map((c) => c.label).join(", ")}`
                                  : e.summary}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <time dateTime={e.at} className="text-xs text-muted-foreground tabular-nums">
                            {new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </time>
                          <StatusPill tone="neutral" className="hidden sm:inline-flex">
                            {CATEGORY_LABEL[e.category]}
                          </StatusPill>
                        </div>
                      </button>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        )}
        {shown.length > limit && (
          <div className="border-t border-border/70 px-5 py-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({shown.length - limit} remaining)
            </Button>
          </div>
        )}
        {shown.length > 0 && shown.length <= limit && olderAvailable && (
          <div className="border-t border-border/70 px-5 py-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => patch({ range: filters.range === "90d" ? "all" : filters.range === "custom" ? "all" : "90d" })}>
              Show older activity
            </Button>
          </div>
        )}
      </section>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          {open && <EventDetail e={open} canSeeTechnical={hasPermission(user, "contacts.viewAudit")} />}
        </SheetContent>
      </Sheet>
    </PageContainer>
  );
}

function EventDetail({ e, canSeeTechnical }: { e: FeedEvent; canSeeTechnical: boolean }) {
  return (
    <>
      <SheetHeader className="border-b border-border/70 px-6 py-5">
        <StatusPill tone="brand" className="self-start">
          {CATEGORY_LABEL[e.category]}
        </StatusPill>
        <SheetTitle className="pt-2 text-lg leading-snug font-semibold">
          {e.verb} {e.recordType} {e.recordName}
        </SheetTitle>
        <SheetDescription>{formatDateTime(e.at)}</SheetDescription>
      </SheetHeader>
      <div className="space-y-6 px-6 py-5 text-sm">
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2.5">
          <dt className="text-muted-foreground">Event</dt>
          <dd>{e.verb}</dd>
          <dt className="text-muted-foreground">Record</dt>
          <dd>
            {e.href ? (
              <Link href={e.href} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                {e.recordName} <ArrowUpRight className="size-3.5" />
              </Link>
            ) : (
              <span className="font-medium">{e.recordName}</span>
            )}
            {e.linkNote && <p className="mt-0.5 text-xs text-muted-foreground">{e.linkNote}</p>}
          </dd>
          <dt className="text-muted-foreground">By</dt>
          <dd className="flex items-center gap-2">
            <UserAvatar name={e.actor} size="sm" /> {e.actor}
          </dd>
          <dt className="text-muted-foreground">When</dt>
          <dd>{formatDateTime(e.at)}</dd>
        </dl>

        {e.summary && (
          <section>
            <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">Details</h3>
            <p className="whitespace-pre-line">{e.summary}</p>
          </section>
        )}

        {e.changes.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">What changed</h3>
            {e.restricted ? (
              <p className="flex items-start gap-2 rounded-xl bg-secondary px-3 py-2.5 text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" />
                Changed {e.changes.map((c) => c.label).join(", ")}. Your role can&apos;t see the values.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/70">
                    <th scope="col" className="py-1.5 pr-2 text-left font-medium">Field</th>
                    <th scope="col" className="py-1.5 pr-2 text-left font-medium">Before</th>
                    <th scope="col" className="py-1.5 text-left font-medium">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {e.changes.map((c, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-2 pr-2 text-muted-foreground">{c.label}</td>
                      <td className="py-2 pr-2 break-words">{c.from || <span className="text-subtle-foreground">Empty</span>}</td>
                      <td className="py-2 break-words">{c.to || <span className="text-subtle-foreground">Empty</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {canSeeTechnical && (
          <Collapsible className="rounded-xl border border-border">
            <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Technical details
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 border-t border-border px-3.5 py-3 font-mono text-xs">
                <dt className="text-muted-foreground">Event ID</dt>
                <dd className="break-all">{e.technical.eventId}</dd>
                <dt className="text-muted-foreground">Source</dt>
                <dd>{e.technical.source}</dd>
                <dt className="text-muted-foreground">Action</dt>
                <dd>{e.technical.action}</dd>
                <dt className="text-muted-foreground">Entity</dt>
                <dd className="break-all">
                  {e.technical.entityType} · {e.technical.entityId}
                </dd>
                {e.technical.rawFields.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">Field keys</dt>
                    <dd className="break-all">{e.technical.rawFields.join(", ")}</dd>
                  </>
                )}
              </dl>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </>
  );
}
