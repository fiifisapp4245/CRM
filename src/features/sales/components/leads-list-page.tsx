"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils/format";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { FilterPopover } from "@/components/data-table/filter-popover";
import { FilterChips, type FilterChip } from "@/components/data-table/filter-chips";
import { SearchField } from "@/components/data-table/search-field";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSales } from "../hooks/use-sales";
import { leadCaps } from "../lib/access";
import { DEFAULT_LEAD_FILTERS, filterLeads, OPEN_LEAD_STATUSES, type LeadFilters } from "../lib/lead-filters";
import { leadScore } from "../lib/lead-score";
import { setLeadStatus } from "../services/leads-service";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, RATING_LABELS, type Lead, type LeadSource, type LeadStatus, type Rating } from "../types";
import { LeadStatusBadge, Money, ScoreMeter } from "./badges";

const SORTS: Record<LeadFilters["sort"], string> = { best: "Best first", newest: "Newest", recent: "Recently changed", name: "Name" };
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

const useLeadsUi = create<{ filters: LeadFilters; page: { i: number; s: number }; set: (p: Partial<LeadFilters>) => void; reset: () => void; setPage: (i: number, s: number) => void }>()(
  persist(
    (set) => ({
      filters: DEFAULT_LEAD_FILTERS,
      page: { i: 0, s: 25 },
      set: (p) => set((st) => ({ filters: { ...st.filters, ...p }, page: { ...st.page, i: 0 } })),
      reset: () => set((st) => ({ filters: DEFAULT_LEAD_FILTERS, page: { ...st.page, i: 0 } })),
      setPage: (i, s) => set({ page: { i, s } }),
    }),
    { name: "trovesuite-crm:leads-ui", storage: createJSONStorage(() => sessionStorage) },
  ),
);

export function LeadsListPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { db, user, now, leads, users } = useSales();
  const { filters, set, reset, page, setPage } = useLeadsUi();
  const canView = hasPermission(user, "sales.view");
  const canCreate = hasPermission(user, "leads.manage");

  // Drill-downs, e.g. /leads?source=referral from the forecast.
  useEffect(() => {
    const source = params.get("source") as LeadSource | null;
    if (!source) return;
    reset();
    set({ sources: [source], statuses: [] });
    router.replace("/leads");
  }, [params, reset, set, router]);

  const filtered = useMemo(() => filterLeads(leads, filters, now), [leads, filters, now]);
  const ownerOptions = useMemo(() => {
    const ids = new Set(leads.map((l) => l.ownerId));
    return [{ value: "unassigned", label: "Unassigned" }, ...db.users.filter((u) => ids.has(u.id)).map((u) => ({ value: u.id, label: u.id === user.id ? `${u.name} (you)` : u.name }))];
  }, [leads, db.users, user.id]);

  const quick = async (l: Lead, status: LeadStatus) => {
    const r = await setLeadStatus(l.id, status);
    if (r.ok) toast.success(`${l.name} marked ${LEAD_STATUS_LABELS[status].toLowerCase()}`);
    else toast.error(r.error);
  };

  const columns = useMemo<ColumnDef<Lead, unknown>[]>(
    () => [
      {
        id: "lead",
        header: "Lead",
        cell: ({ row: { original: l } }) => (
          <div className="flex min-w-48 items-center gap-3">
            <UserAvatar name={l.name} muted={l.status === "disqualified"} />
            <div className="min-w-0">
              <Link href={`/leads/${l.id}`} onClick={stop} className="block truncate font-medium hover:underline">
                {l.name}
              </Link>
              <p className="truncate text-xs text-muted-foreground">{[l.company, l.jobTitle].filter(Boolean).join(" · ") || l.need || "—"}</p>
            </div>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        meta: { className: "hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
        cell: ({ row: { original: l } }) => (
          <div className="max-w-48 leading-snug">
            {l.phone && <p className="truncate tabular-nums">{l.phone}</p>}
            {l.email && <p className={cn("truncate", l.phone && "text-xs text-muted-foreground")}>{l.email}</p>}
            {!l.phone && !l.email && <span className="text-subtle-foreground">—</span>}
          </div>
        ),
      },
      { id: "status", header: "Status", cell: ({ row }) => <LeadStatusBadge status={row.original.status} /> },
      { id: "score", header: "Score", cell: ({ row }) => <ScoreMeter score={leadScore(row.original, now).score} /> },
      { id: "value", header: "Est. value", meta: { className: "whitespace-nowrap" }, cell: ({ row: { original: l } }) => (l.estimatedValue ? <Money amount={l.estimatedValue} currency={l.currency} /> : <span className="text-subtle-foreground">—</span>) },
      { id: "source", header: "Source", meta: { className: "hidden lg:table-cell whitespace-nowrap", headerClassName: "hidden lg:table-cell" }, cell: ({ row }) => <span className="text-muted-foreground">{LEAD_SOURCE_LABELS[row.original.source]}</span> },
      {
        id: "owner",
        header: "Owner",
        cell: ({ row: { original: l } }) => {
          const u = l.ownerId ? users.get(l.ownerId) : undefined;
          return u ? (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <UserAvatar name={u.name} size="xs" />
              {u.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          );
        },
      },
      {
        id: "next",
        header: "Next action",
        meta: { className: "hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
        cell: ({ row: { original: l } }) =>
          l.nextAction ? (
            <span className="block max-w-44 truncate">
              {l.nextAction.label} <span className={cn("text-xs", Date.parse(l.nextAction.dueAt) < now ? "text-destructive" : "text-muted-foreground")}>· {formatRelative(l.nextAction.dueAt, now)}</span>
            </span>
          ) : (
            <span className="text-subtle-foreground">—</span>
          ),
      },
      {
        id: "last",
        header: "Last interaction",
        meta: { className: "hidden xl:table-cell whitespace-nowrap", headerClassName: "hidden xl:table-cell" },
        cell: ({ row: { original: l } }) => <span className="text-muted-foreground">{l.lastInteractionAt ? formatRelative(l.lastInteractionAt, now) : "None yet"}</span>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { className: "w-12 pl-0 text-right" },
        cell: ({ row: { original: l } }) => {
          const caps = leadCaps(db, user, l);
          return (
            <div onClick={stop} onKeyDown={stop}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Actions for ${l.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/leads/${l.id}`}>Open</Link>
                  </DropdownMenuItem>
                  {caps.edit && (
                    <DropdownMenuItem asChild>
                      <Link href={`/leads/${l.id}/edit`}>Edit</Link>
                    </DropdownMenuItem>
                  )}
                  {caps.changeStatus && l.status === "new" && <DropdownMenuItem onSelect={() => quick(l, "contacted")}>Mark contacted</DropdownMenuItem>}
                  {caps.changeStatus && l.status !== "qualified" && <DropdownMenuItem onSelect={() => quick(l, "qualified")}>Qualify</DropdownMenuItem>}
                  {caps.convert && (
                    <DropdownMenuItem asChild>
                      <Link href={`/leads/${l.id}/convert`}>Convert…</Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [db, user, users, now],
  );

  if (!canView) return <PageContainer><PermissionNotice /></PageContainer>;

  const ownerLabel = (id: string) => ownerOptions.find((o) => o.value === id)?.label ?? id;
  const statusDefault = filters.statuses.join() === OPEN_LEAD_STATUSES.join();
  const chips: FilterChip[] = [
    ...(statusDefault ? [] : [{ key: "st", label: `Status: ${filters.statuses.length ? filters.statuses.map((s) => LEAD_STATUS_LABELS[s]).join(", ") : "Any"}`, onRemove: () => set({ statuses: OPEN_LEAD_STATUSES }) }]),
    ...filters.ownerIds.map((id) => ({ key: `o${id}`, label: `Owner: ${ownerLabel(id)}`, onRemove: () => set({ ownerIds: filters.ownerIds.filter((x) => x !== id) }) })),
    ...filters.sources.map((s) => ({ key: `s${s}`, label: `Source: ${LEAD_SOURCE_LABELS[s]}`, onRemove: () => set({ sources: filters.sources.filter((x) => x !== s) }) })),
    ...filters.ratings.map((r) => ({ key: `r${r}`, label: `Rating: ${RATING_LABELS[r]}`, onRemove: () => set({ ratings: filters.ratings.filter((x) => x !== r) }) })),
  ];
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_LEAD_FILTERS);

  return (
    <PageContainer>
      <PageHeader
        title="Leads"
        description="People and businesses who might buy. Qualify them, then convert the good ones into contacts and deals."
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/leads/new">
                <Plus /> New lead
              </Link>
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchField value={filters.search} onChange={(search) => set({ search })} placeholder="Search name, company, phone, email" label="Search leads" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterPopover label="Status" options={(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))} selected={filters.statuses} baseline={OPEN_LEAD_STATUSES} onChange={(v) => set({ statuses: v as LeadStatus[] })} />
            <FilterPopover label="Owner" options={ownerOptions} selected={filters.ownerIds} onChange={(ownerIds) => set({ ownerIds })} searchable />
            <FilterPopover label="Source" options={(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] }))} selected={filters.sources} onChange={(v) => set({ sources: v as LeadSource[] })} />
            <FilterPopover label="Rating" options={(Object.keys(RATING_LABELS) as Rating[]).map((r) => ({ value: r, label: RATING_LABELS[r] }))} selected={filters.ratings} onChange={(v) => set({ ratings: v as Rating[] })} />
            <Select value={filters.sort} onValueChange={(v) => set({ sort: v as LeadFilters["sort"] })}>
              <SelectTrigger className="w-auto min-w-40 px-3.5" aria-label="Sort leads">
                <span className="text-muted-foreground">Sort:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORTS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <FilterChips chips={chips}>
          {dirty && (
            <Button variant="ghost" size="sm" onClick={reset}>
              Clear filters
            </Button>
          )}
        </FilterChips>
        <DataTable
          label="Leads"
          columns={columns}
          data={filtered}
          getRowId={(l) => l.id}
          onRowClick={(l) => router.push(`/leads/${l.id}`)}
          pagination={{ pageIndex: page.i, pageSize: page.s }}
          onPaginationChange={(u) => {
            const n = typeof u === "function" ? u({ pageIndex: page.i, pageSize: page.s }) : u;
            setPage(n.pageIndex, n.pageSize);
          }}
          empty={
            leads.length === 0 ? (
              <EmptyState icon={UserPlus} title="No leads yet" description="Add the people who've shown interest — walk-ins, referrals, WhatsApp enquiries." action={canCreate ? <Button asChild><Link href="/leads/new">New lead</Link></Button> : undefined} />
            ) : (
              <EmptyState icon={Search} title="No leads match these filters" description="Try another status or clear the filters." action={<Button variant="outline" onClick={reset}>Clear filters</Button>} />
            )
          }
        />
        <p className="text-xs text-muted-foreground">Score is a prototype model (0–100) shown in full on each lead. It isn&apos;t TroveSuite&apos;s production formula.</p>
      </div>
    </PageContainer>
  );
}
