"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Search } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatDate, formatRelative } from "@/lib/utils/format";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { SearchField } from "@/components/data-table/search-field";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { useSales } from "../hooks/use-sales";
import { lineTotals } from "../lib/calc";
import { effectiveStatus } from "../services/quotes-service";
import { QUOTE_STATUS_LABELS, type Quote, type QuoteStatus } from "../types";
import { Money, QuoteStatusBadge } from "./badges";

type Row = Quote & { shown: QuoteStatus; total: number; dealTitle?: string };

export function QuotesListPage() {
  const router = useRouter();
  const { db, user, now, quotes, taxes } = useSales();
  const [status, setStatus] = useState<"all" | QuoteStatus>("all");
  const [search, setSearch] = useState("");
  const today = new Date(now).toISOString().slice(0, 10);

  const all = useMemo<Row[]>(
    () => quotes.map((q) => ({ ...q, shown: effectiveStatus(q, today), total: lineTotals(q.lineItems, taxes).total, dealTitle: db.deals.find((d) => d.id === q.dealId)?.title })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [quotes, taxes, db.deals, today],
  );
  const counts = useMemo(() => all.reduce<Record<string, number>>((m, q) => ({ ...m, [q.shown]: (m[q.shown] ?? 0) + 1 }), {}), [all]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) => (status === "all" || r.shown === status) && (!q || [r.number, r.customer.name, r.customer.company, r.dealTitle].filter(Boolean).join(" ").toLowerCase().includes(q)));
  }, [all, status, search]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "number",
        header: "Quote",
        cell: ({ row: { original: q } }) => (
          <div className="min-w-44">
            <Link href={`/quotes/${q.id}`} onClick={(e) => e.stopPropagation()} className="font-medium tabular-nums hover:underline">
              {q.number}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{q.dealTitle ?? "—"}</p>
          </div>
        ),
      },
      { id: "customer", header: "Customer", cell: ({ row: { original: q } }) => <div className="max-w-56"><p className="truncate">{q.customer.name}</p>{q.customer.company && q.customer.company !== q.customer.name && <p className="truncate text-xs text-muted-foreground">{q.customer.company}</p>}</div> },
      { id: "total", header: "Total", meta: { className: "whitespace-nowrap text-right", headerClassName: "text-right" }, cell: ({ row: { original: q } }) => <Money amount={q.total} currency={q.currency} className="font-medium" /> },
      { id: "status", header: "Status", cell: ({ row }) => <QuoteStatusBadge status={row.original.shown} /> },
      { id: "valid", header: "Valid until", meta: { className: "hidden md:table-cell whitespace-nowrap", headerClassName: "hidden md:table-cell" }, cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.validUntil)}</span> },
      {
        id: "opened",
        header: "Opened",
        meta: { className: "hidden lg:table-cell whitespace-nowrap", headerClassName: "hidden lg:table-cell" },
        cell: ({ row: { original: q } }) => <span className="text-muted-foreground">{q.openedAt ? formatRelative(q.openedAt, now) : q.status === "draft" ? "—" : "Not yet"}</span>,
      },
      { id: "updated", header: "Updated", meta: { className: "hidden xl:table-cell whitespace-nowrap", headerClassName: "hidden xl:table-cell" }, cell: ({ row }) => <span className="text-muted-foreground">{formatRelative(row.original.updatedAt, now)}</span> },
    ],
    [now],
  );

  if (!hasPermission(user, "sales.view")) return <PageContainer><PermissionNotice /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader title="Quotes" description="Offers sent to customers. Create a quote from a deal so prices and the customer come with it." actions={<Button variant="outline" asChild><Link href="/deals">Go to deals</Link></Button>} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Segmented
            label="Quote status"
            value={status}
            onChange={setStatus}
            options={[{ value: "all" as const, label: "All" }, ...(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).filter((s) => counts[s]).map((s) => ({ value: s, label: QUOTE_STATUS_LABELS[s], count: counts[s] }))]}
          />
          <SearchField value={search} onChange={setSearch} placeholder="Search number, customer or deal" label="Search quotes" />
        </div>
        <DataTable
          label="Quotes"
          columns={columns}
          data={rows}
          getRowId={(q) => q.id}
          onRowClick={(q) => router.push(`/quotes/${q.id}`)}
          empty={
            all.length === 0 ? (
              <EmptyState icon={FileText} title="No quotes yet" description="Open a deal and choose New quote." action={<Button asChild variant="outline"><Link href="/deals">Go to deals</Link></Button>} />
            ) : (
              <EmptyState icon={Search} title="No quotes match" description="Try another status or search." />
            )
          }
        />
      </div>
    </PageContainer>
  );
}
