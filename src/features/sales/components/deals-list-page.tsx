"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Handshake, KanbanSquare, MoreHorizontal, Plus, Search, Upload } from "lucide-react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/format";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { FilterPopover } from "@/components/data-table/filter-popover";
import { FilterChips, type FilterChip } from "@/components/data-table/filter-chips";
import { SearchField } from "@/components/data-table/search-field";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { Segmented } from "@/components/shared/segmented";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSales } from "../hooks/use-sales";
import { dealCaps } from "../lib/access";
import { dealAttention, dealProbability, dealValue, formatAmount, stageOf, sumByCurrency, weightedValue } from "../lib/calc";
import { DEFAULT_DEAL_FILTERS, filterDeals, type DealFilters } from "../lib/deal-filters";
import { LOST_REASONS, WON_REASONS, type Currency, type Deal } from "../types";
import { AttentionBadge, DealStatusBadge, Money } from "./badges";
import { CloseDealDialog } from "./close-deal-dialog";

const SORTS: Record<DealFilters["sort"], string> = { closing: "Closing soonest", biggest: "Biggest first", newest: "Newest", recent: "Recently changed" };
const ATTENTION: Record<DealFilters["attention"], string> = { any: "Any", going_cold: "Going cold", past_close: "Past close date" };
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

const useDealsUi = create<{ filters: DealFilters; page: { i: number; s: number }; set: (p: Partial<DealFilters>) => void; reset: () => void; setPage: (i: number, s: number) => void }>()(
  persist(
    (set) => ({
      filters: DEFAULT_DEAL_FILTERS,
      page: { i: 0, s: 25 },
      set: (p) => set((st) => ({ filters: { ...st.filters, ...p }, page: { ...st.page, i: 0 } })),
      reset: () => set((st) => ({ filters: DEFAULT_DEAL_FILTERS, page: { ...st.page, i: 0 } })),
      setPage: (i, s) => set({ page: { i, s } }),
    }),
    { name: "trovesuite-crm:deals-ui", storage: createJSONStorage(() => sessionStorage) },
  ),
);

export function DealsListPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { db, user, now, deals, users, contacts, accounts, pipelines, taxes } = useSales();
  const { filters, set, reset, page, setPage } = useDealsUi();
  const [closing, setClosing] = useState<{ deal: Deal; outcome: "won" | "lost" } | null>(null);
  const canView = hasPermission(user, "sales.view");
  const canCreate = hasPermission(user, "deals.manage");
  const canImport = hasPermission(user, "deals.import");

  // Drill-downs from the dashboard, pipeline and forecast: /deals?attention=cold, ?stage=st_x, ?status=won&reason=…, ?owner=u_x
  useEffect(() => {
    const keys = ["attention", "stage", "status", "reason", "owner", "currency"];
    if (!keys.some((k) => params.has(k))) return;
    const att = params.get("attention");
    const status = params.get("status") as DealFilters["status"] | null;
    const reason = params.get("reason");
    reset();
    set({
      attention: att === "cold" || att === "going_cold" ? "going_cold" : att === "past_close" ? "past_close" : "any",
      stageIds: params.get("stage") ? [params.get("stage")!] : [],
      status: status ?? "open",
      reasons: reason ? [reason] : [],
      ownerIds: params.get("owner") ? [params.get("owner")!] : [],
      currency: (params.get("currency") as Currency | null) ?? "all",
    });
    router.replace("/deals");
  }, [params, reset, set, router]);

  const filtered = useMemo(() => filterDeals(deals, filters, { contacts, accounts, taxes, now }), [deals, filters, contacts, accounts, taxes, now]);
  const totals = useMemo(() => sumByCurrency(filtered, (d) => d.currency, (d) => dealValue(d, taxes)), [filtered, taxes]);
  const weighted = useMemo(() => sumByCurrency(filtered.filter((d) => d.status === "open"), (d) => d.currency, (d) => weightedValue(d, pipelines, taxes)), [filtered, pipelines, taxes]);
  const ownerOptions = useMemo(() => {
    const ids = new Set(deals.map((d) => d.ownerId));
    const unassigned = deals.some((d) => !d.ownerId) ? [{ value: "unassigned", label: "Unassigned" }] : [];
    return [...unassigned, ...db.users.filter((u) => ids.has(u.id)).map((u) => ({ value: u.id, label: u.id === user.id ? `${u.name} (you)` : u.name }))];
  }, [deals, db.users, user.id]);
  const stageOptions = useMemo(() => pipelines.flatMap((p) => p.stages.filter((s) => s.kind === "open").map((s) => ({ value: s.id, label: s.name }))), [pipelines]);
  const reasonOptions = (filters.status === "won" ? WON_REASONS : filters.status === "lost" ? LOST_REASONS : [...new Set([...WON_REASONS, ...LOST_REASONS])]).map((r) => ({ value: r, label: r }));

  const columns = useMemo<ColumnDef<Deal, unknown>[]>(
    () => [
      {
        id: "deal",
        header: "Deal",
        cell: ({ row: { original: d } }) => {
          const c = d.contactId ? contacts.get(d.contactId) : undefined;
          const a = d.accountId ? accounts.get(d.accountId) : undefined;
          return (
            <div className="min-w-52">
              <Link href={`/deals/${d.id}`} onClick={stop} className="block truncate font-medium hover:underline">
                {d.title}
              </Link>
              <p className="truncate text-xs text-muted-foreground">{[c?.displayName, a?.name].filter(Boolean).join(" · ") || "No customer linked"}</p>
            </div>
          );
        },
      },
      { id: "stage", header: "Stage", meta: { className: "whitespace-nowrap" }, cell: ({ row: { original: d } }) => <DealStatusBadge status={d.status} stageName={stageOf(pipelines, d)?.name} /> },
      { id: "value", header: "Value", meta: { className: "whitespace-nowrap text-right", headerClassName: "text-right" }, cell: ({ row: { original: d } }) => <Money amount={dealValue(d, taxes)} currency={d.currency} className="font-medium" /> },
      {
        id: "chance",
        header: "Chance",
        meta: { className: "hidden lg:table-cell whitespace-nowrap text-right", headerClassName: "hidden lg:table-cell text-right" },
        cell: ({ row: { original: d } }) =>
          d.status === "open" ? (
            <span className="tabular-nums">
              {dealProbability(d, pipelines)}% <span className="text-xs text-muted-foreground">· {formatAmount(weightedValue(d, pipelines, taxes), d.currency, { compact: true })}</span>
            </span>
          ) : (
            <span className="text-subtle-foreground">—</span>
          ),
      },
      {
        id: "close",
        header: "Close date",
        meta: { className: "whitespace-nowrap" },
        cell: ({ row: { original: d } }) => {
          const att = dealAttention(d, now);
          return d.status === "open" ? (
            <span className={cn(att.kind === "past_close" && "font-medium text-destructive")}>{formatDate(d.expectedClose)}</span>
          ) : (
            <span className="text-muted-foreground">Closed {formatDate(d.closedAt)}</span>
          );
        },
      },
      {
        id: "attention",
        header: "Attention",
        meta: { className: "hidden md:table-cell", headerClassName: "hidden md:table-cell" },
        cell: ({ row: { original: d } }) => {
          const att = dealAttention(d, now);
          if (att.kind === "closed") return <span className="text-xs text-muted-foreground">{(d.status === "won" ? d.wonReason : d.lostReason) ?? "—"}</span>;
          return att.kind === "healthy" ? <span className="text-xs text-muted-foreground">On track</span> : <AttentionBadge kind={att.kind} reason={att.reason} link={false} />;
        },
      },
      {
        id: "owner",
        header: "Owner",
        meta: { className: "hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
        cell: ({ row: { original: d } }) => {
          const u = d.ownerId ? users.get(d.ownerId) : undefined;
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
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { className: "w-12 pl-0 text-right" },
        cell: ({ row: { original: d } }) => {
          const caps = dealCaps(db, user, d);
          return (
            <div onClick={stop} onKeyDown={stop}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Actions for ${d.title}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/deals/${d.id}`}>Open</Link>
                  </DropdownMenuItem>
                  {caps.edit && (
                    <DropdownMenuItem asChild>
                      <Link href={`/deals/${d.id}/edit`}>Edit</Link>
                    </DropdownMenuItem>
                  )}
                  {caps.quote && (
                    <DropdownMenuItem asChild>
                      <Link href={`/quotes/new?dealId=${d.id}`}>New quote</Link>
                    </DropdownMenuItem>
                  )}
                  {caps.close && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setClosing({ deal: d, outcome: "won" })}>Mark won…</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setClosing({ deal: d, outcome: "lost" })}>Mark lost…</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [db, user, users, contacts, accounts, pipelines, taxes, now],
  );

  if (!canView) return <PageContainer><PermissionNotice /></PageContainer>;

  const ownerLabel = (id: string) => ownerOptions.find((o) => o.value === id)?.label ?? id;
  const stageLabel = (id: string) => stageOptions.find((o) => o.value === id)?.label ?? id;
  const chips: FilterChip[] = [
    ...(filters.attention !== "any" ? [{ key: "att", label: `Attention: ${ATTENTION[filters.attention]}`, onRemove: () => set({ attention: "any" }) }] : []),
    ...(filters.currency !== "all" ? [{ key: "cur", label: `Currency: ${filters.currency}`, onRemove: () => set({ currency: "all" }) }] : []),
    ...filters.ownerIds.map((id) => ({ key: `o${id}`, label: `Owner: ${ownerLabel(id)}`, onRemove: () => set({ ownerIds: filters.ownerIds.filter((x) => x !== id) }) })),
    ...filters.stageIds.map((id) => ({ key: `s${id}`, label: `Stage: ${stageLabel(id)}`, onRemove: () => set({ stageIds: filters.stageIds.filter((x) => x !== id) }) })),
    ...filters.reasons.map((r) => ({ key: `r${r}`, label: `Reason: ${r}`, onRemove: () => set({ reasons: filters.reasons.filter((x) => x !== r) }) })),
  ];
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_DEAL_FILTERS);
  const currencies = (Object.keys(totals) as Currency[]).filter((c) => filtered.some((d) => d.currency === c));

  return (
    <PageContainer>
      <PageHeader
        title="Deals"
        description="Every opportunity in one list. Filter by stage, outcome or what needs attention."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/pipeline">
                <KanbanSquare /> Board
              </Link>
            </Button>
            {canImport && (
              <Button variant="outline" asChild>
                <Link href="/deals/import">
                  <Upload /> Import
                </Link>
              </Button>
            )}
            {canCreate && (
              <Button asChild>
                <Link href="/deals/new">
                  <Plus /> New deal
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Segmented
            label="Deal status"
            value={filters.status}
            onChange={(status) => set({ status, reasons: [], stageIds: status === "open" ? filters.stageIds : [], attention: status === "open" ? filters.attention : "any" })}
            options={[
              { value: "open", label: "Open" },
              { value: "won", label: "Won" },
              { value: "lost", label: "Lost" },
              { value: "all", label: "All" },
            ]}
          />
          <SearchField value={filters.search} onChange={(search) => set({ search })} placeholder="Search deal, contact or company" label="Search deals" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.status === "open" && (
            <>
              <Select value={filters.attention} onValueChange={(v) => set({ attention: v as DealFilters["attention"] })}>
                <SelectTrigger className="w-auto min-w-40 px-3.5" aria-label="Attention">
                  <span className="text-muted-foreground">Attention:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ATTENTION).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FilterPopover label="Stage" options={stageOptions} selected={filters.stageIds} onChange={(stageIds) => set({ stageIds })} />
            </>
          )}
          {filters.status !== "open" && <FilterPopover label="Reason" options={reasonOptions} selected={filters.reasons} onChange={(reasons) => set({ reasons })} />}
          <FilterPopover label="Owner" options={ownerOptions} selected={filters.ownerIds} onChange={(ownerIds) => set({ ownerIds })} searchable />
          <Select value={filters.currency} onValueChange={(v) => set({ currency: v as DealFilters["currency"] })}>
            <SelectTrigger className="w-auto min-w-36 px-3.5" aria-label="Currency">
              <span className="text-muted-foreground">Currency:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="GHS">GHS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => set({ sort: v as DealFilters["sort"] })}>
            <SelectTrigger className="w-auto min-w-44 px-3.5" aria-label="Sort deals">
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
        <FilterChips chips={chips}>
          {dirty && (
            <Button variant="ghost" size="sm" onClick={reset}>
              Clear filters
            </Button>
          )}
        </FilterChips>
        {filtered.length > 0 && (
          // Totals per currency — GHS and USD are never added together.
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground" aria-live="polite">
            <span>
              <span className="font-medium text-foreground tabular-nums">{filtered.length}</span> deal{filtered.length === 1 ? "" : "s"}
            </span>
            {currencies.map((c) => (
              <span key={c}>
                {c}: <span className="font-medium text-foreground tabular-nums">{formatAmount(totals[c], c)}</span>
                {filters.status !== "won" && filters.status !== "lost" && weighted[c] > 0 && <> · weighted <span className="tabular-nums">{formatAmount(weighted[c], c)}</span></>}
              </span>
            ))}
          </p>
        )}
        <DataTable
          label="Deals"
          columns={columns}
          data={filtered}
          getRowId={(d) => d.id}
          onRowClick={(d) => router.push(`/deals/${d.id}`)}
          pagination={{ pageIndex: page.i, pageSize: page.s }}
          onPaginationChange={(u) => {
            const n = typeof u === "function" ? u({ pageIndex: page.i, pageSize: page.s }) : u;
            setPage(n.pageIndex, n.pageSize);
          }}
          empty={
            deals.length === 0 ? (
              <EmptyState icon={Handshake} title="No deals yet" description="Create a deal when a customer is ready to talk about buying, or convert a qualified lead." action={canCreate ? <Button asChild><Link href="/deals/new">New deal</Link></Button> : undefined} />
            ) : (
              <EmptyState icon={Search} title="No deals match these filters" description="Try another status or clear the filters." action={<Button variant="outline" onClick={reset}>Clear filters</Button>} />
            )
          }
        />
      </div>
      <CloseDealDialog deal={closing?.deal ?? null} outcome={closing?.outcome ?? "won"} onOpenChange={(o) => !o && setClosing(null)} />
    </PageContainer>
  );
}
