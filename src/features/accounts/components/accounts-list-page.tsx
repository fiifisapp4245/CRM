"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, CornerDownRight, GitBranch, MoreHorizontal, Plus, Search, Upload } from "lucide-react";
import { usePermission, useCurrentUser } from "@/features/permissions";
import { canWriteRecord } from "@/lib/permissions";
import { useDbStore } from "@/lib/mock-data/db-store";
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
import { useAccountsUi, useVisibleAccounts } from "../hooks/use-accounts";
import { DEFAULT_ACCOUNT_FILTERS, filterAccounts, type AccountFilters } from "../lib/filters";
import { STRUCTURE_LABELS, childrenOf, type StructureRole } from "../lib/hierarchy";
import { ACCOUNT_RATING_LABELS, ACCOUNT_SIZE_LABELS, ACCOUNT_TYPE_LABELS, type Account, type AccountRating, type AccountSize, type AccountType } from "../types";
import { RatingPill } from "./account-badges";

const SORTS: Record<AccountFilters["sort"], string> = { name: "Name (A–Z)", recent: "Recently changed", newest: "Newest first" };
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function AccountsListPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const canView = usePermission("accounts.view");
  const canCreate = usePermission("accounts.create");
  const canImport = usePermission("accounts.import");
  const canEdit = usePermission("accounts.edit");
  const db = useDbStore((s) => s.db);
  const accounts = useVisibleAccounts();
  const { filters, setFilters, reset, pageIndex, pageSize, setPage } = useAccountsUi();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 200);
    return () => clearTimeout(t);
  }, []);

  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]);
  const contactCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of db.contacts) if (c.accountId && c.status === "active") m.set(c.accountId, (m.get(c.accountId) ?? 0) + 1);
    return m;
  }, [db.contacts]);
  const filtered = useMemo(() => filterAccounts(accounts, filters), [accounts, filters]);
  const ownerOptions = useMemo(() => {
    const ids = new Set(accounts.map((a) => a.ownerId));
    return [{ value: "unassigned", label: "Unassigned" }, ...db.users.filter((u) => ids.has(u.id)).map((u) => ({ value: u.id, label: u.id === user.id ? `${u.name} (you)` : u.name }))];
  }, [accounts, db.users, user.id]);

  const columns = useMemo<ColumnDef<Account, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Account",
        cell: ({ row: { original: a } }) => {
          const parent = a.parentId ? byId.get(a.parentId) : undefined;
          const branches = childrenOf(accounts, a.id).length;
          return (
            <div className="flex min-w-52 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">{parent ? <CornerDownRight className="size-4" /> : <Building2 className="size-4" />}</span>
              <div className="min-w-0">
                <Link href={`/accounts/${a.id}`} onClick={stop} className="block truncate font-medium hover:underline">
                  {a.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {parent ? <>Branch of {parent.name}</> : branches ? <>Head office · {branches} {branches === 1 ? "branch" : "branches"}</> : a.accountNumber ?? "No account number"}
                </p>
              </div>
            </div>
          );
        },
      },
      { id: "type", header: "Type", cell: ({ row }) => ACCOUNT_TYPE_LABELS[row.original.type] },
      { id: "rating", header: "Rating", cell: ({ row }) => <RatingPill rating={row.original.rating} /> },
      {
        id: "owner",
        header: "Owner",
        cell: ({ row: { original: a } }) => {
          const u = a.ownerId ? users.get(a.ownerId) : undefined;
          return u ? (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <UserAvatar name={u.name} size="xs" muted={u.status !== "active"} />
              {u.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          );
        },
      },
      { id: "size", header: "Size", cell: ({ row }) => (row.original.size ? <span className="whitespace-nowrap">{ACCOUNT_SIZE_LABELS[row.original.size].split(" (")[0]}</span> : <span className="text-subtle-foreground">—</span>) },
      { id: "contacts", header: "Contacts", meta: { className: "text-right tabular-nums", headerClassName: "text-right" }, cell: ({ row }) => contactCounts.get(row.original.id) ?? 0 },
      { id: "city", header: "Location", cell: ({ row }) => row.original.billingAddress?.city ?? <span className="text-subtle-foreground">—</span> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { className: "w-12 pl-0 text-right" },
        cell: ({ row: { original: a } }) => (
          <div onClick={stop} onKeyDown={stop}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Actions for ${a.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/accounts/${a.id}`}>Open</Link>
                </DropdownMenuItem>
                {canEdit && canWriteRecord(user, a, db.users) && (
                  <DropdownMenuItem asChild>
                    <Link href={`/accounts/${a.id}/edit`}>Edit</Link>
                  </DropdownMenuItem>
                )}
                {canCreate && (
                  <DropdownMenuItem asChild>
                    <Link href={`/accounts/new?parentId=${a.id}`}>
                      <GitBranch /> Add branch
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [accounts, byId, users, contactCounts, canEdit, canCreate, user, db.users],
  );

  if (!canView) return <PageContainer><PermissionNotice /></PageContainer>;

  const labelFor = (id: string) => ownerOptions.find((o) => o.value === id)?.label ?? id;
  const chips: FilterChip[] = [
    ...filters.ownerIds.map((id) => ({ key: `o${id}`, label: `Owner: ${labelFor(id)}`, onRemove: () => setFilters({ ownerIds: filters.ownerIds.filter((x) => x !== id) }) })),
    ...filters.types.map((t) => ({ key: `t${t}`, label: `Type: ${ACCOUNT_TYPE_LABELS[t]}`, onRemove: () => setFilters({ types: filters.types.filter((x) => x !== t) }) })),
    ...filters.ratings.map((r) => ({ key: `r${r}`, label: `Rating: ${ACCOUNT_RATING_LABELS[r]}`, onRemove: () => setFilters({ ratings: filters.ratings.filter((x) => x !== r) }) })),
    ...filters.sizes.map((s) => ({ key: `s${s}`, label: `Size: ${ACCOUNT_SIZE_LABELS[s].split(" (")[0]}`, onRemove: () => setFilters({ sizes: filters.sizes.filter((x) => x !== s) }) })),
    ...filters.structure.map((s) => ({ key: `h${s}`, label: STRUCTURE_LABELS[s], onRemove: () => setFilters({ structure: filters.structure.filter((x) => x !== s) }) })),
  ];
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_ACCOUNT_FILTERS);

  return (
    <PageContainer>
      <PageHeader
        title="Accounts"
        description="Organisations you sell to, buy from or work with, including head offices and their branches."
        actions={
          <>
            {canImport && (
              <Button variant="outline" asChild>
                <Link href="/accounts/import">
                  <Upload /> Import
                </Link>
              </Button>
            )}
            {canCreate && (
              <Button asChild>
                <Link href="/accounts/new">
                  <Plus /> New account
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchField value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Search name, number, industry, city" label="Search accounts" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterPopover label="Owner" options={ownerOptions} selected={filters.ownerIds} onChange={(ownerIds) => setFilters({ ownerIds })} searchable />
            <FilterPopover label="Type" options={(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => ({ value: t, label: ACCOUNT_TYPE_LABELS[t] }))} selected={filters.types} onChange={(v) => setFilters({ types: v as AccountType[] })} />
            <FilterPopover label="Rating" options={(Object.keys(ACCOUNT_RATING_LABELS) as AccountRating[]).map((t) => ({ value: t, label: ACCOUNT_RATING_LABELS[t] }))} selected={filters.ratings} onChange={(v) => setFilters({ ratings: v as AccountRating[] })} />
            <FilterPopover label="Size" options={(Object.keys(ACCOUNT_SIZE_LABELS) as AccountSize[]).map((t) => ({ value: t, label: ACCOUNT_SIZE_LABELS[t] }))} selected={filters.sizes} onChange={(v) => setFilters({ sizes: v as AccountSize[] })} />
            <FilterPopover label="Structure" options={(Object.keys(STRUCTURE_LABELS) as StructureRole[]).map((t) => ({ value: t, label: STRUCTURE_LABELS[t] }))} selected={filters.structure} onChange={(v) => setFilters({ structure: v as StructureRole[] })} />
            <Select value={filters.sort} onValueChange={(v) => setFilters({ sort: v as AccountFilters["sort"] })}>
              <SelectTrigger className="w-auto min-w-40 px-3.5" aria-label="Sort accounts">
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
              Reset filters
            </Button>
          )}
        </FilterChips>
        <DataTable
          label="Accounts"
          columns={columns}
          data={filtered}
          getRowId={(a) => a.id}
          loading={loading}
          onRowClick={(a) => router.push(`/accounts/${a.id}`)}
          pagination={{ pageIndex, pageSize }}
          onPaginationChange={(u) => {
            const n = typeof u === "function" ? u({ pageIndex, pageSize }) : u;
            setPage(n.pageIndex, n.pageSize);
          }}
          empty={
            accounts.length === 0 ? (
              <EmptyState icon={Building2} title="No accounts yet" description="Add the organisations you work with, or import them from a spreadsheet." action={canCreate ? <Button asChild><Link href="/accounts/new">New account</Link></Button> : undefined} />
            ) : (
              <EmptyState icon={Search} title="No accounts match" description="Try removing a filter." action={<Button variant="outline" onClick={reset}>Reset filters</Button>} />
            )
          }
        />
      </div>
    </PageContainer>
  );
}
