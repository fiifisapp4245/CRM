"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Lock, Package, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { hasPermission } from "@/lib/permissions";
import { formatRelative } from "@/lib/utils/format";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { SearchField } from "@/components/data-table/search-field";
import { EmptyState, InlineNotice, PermissionNotice } from "@/components/feedback/states";
import { FilterPopover } from "@/components/data-table/filter-popover";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSales } from "../hooks/use-sales";
import { customerPrice, formatAmount } from "../lib/calc";
import { simulateCatalogueSync } from "../services/products-service";
import type { Currency, Product } from "../types";


function SourcePill({ p }: { p: Product }) {
  return p.origin === "mystoreguard" ? (
    <StatusPill tone="info">
      <Lock className="size-3" /> MyStoreGuard
    </StatusPill>
  ) : (
    <StatusPill tone="neutral">CRM</StatusPill>
  );
}

export function ProductsPage() {
  const router = useRouter();
  const { db, user, now, taxes } = useSales();
  const canView = hasPermission(user, "sales.view");
  const canManage = hasPermission(user, "products.manage");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | Product["origin"]>("all");
  const [currency, setCurrency] = useState<"all" | Currency>("all");
  const [showOff, setShowOff] = useState(false);
  const [cats, setCats] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);

  const products = useMemo(() => db.products.filter((p) => p.orgId === user.orgId), [db.products, user.orgId]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => (showOff || p.active) && (source === "all" || p.origin === source) && (currency === "all" || p.currency === currency) && (!cats.length || cats.includes(p.category ?? "")))
      .filter((p) => !q || [p.name, p.sku, p.category].filter(Boolean).join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, search, source, currency, showOff, cats]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))].sort(), [products]);
  const synced = products.filter((p) => p.origin === "mystoreguard");
  const lastSync = synced.map((p) => p.lastSyncedAt).filter(Boolean).sort().at(-1);
  const offCount = products.filter((p) => !p.active).length;

  const columns = useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Product",
        cell: ({ row: { original: p } }) => (
          <div className="min-w-48">
            <p className={p.active ? "font-medium" : "font-medium text-muted-foreground"}>{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">{[p.sku, p.category].filter(Boolean).join(" · ") || "—"}</p>
          </div>
        ),
      },
      {
        id: "price",
        header: "Price",
        meta: { className: "whitespace-nowrap text-right", headerClassName: "text-right" },
        cell: ({ row: { original: p } }) => (
          <div className="text-right">
            <p className="font-medium tabular-nums">{formatAmount(p.price, p.currency)}</p>
            <p className="text-xs text-muted-foreground">per {p.soldPer}</p>
          </div>
        ),
      },
      {
        id: "tax",
        header: "Tax",
        meta: { className: "hidden md:table-cell whitespace-nowrap", headerClassName: "hidden md:table-cell" },
        cell: ({ row: { original: p } }) => {
          const t = taxes.find((x) => x.id === p.taxId);
          if (!t) return <span className="text-muted-foreground">No tax</span>;
          return (
            <div>
              <p>
                {t.name} {t.rate}% <span className="text-muted-foreground">{p.taxInclusive ? "included" : "added"}</span>
              </p>
              {!p.taxInclusive && <p className="text-xs text-muted-foreground tabular-nums">Customer pays {formatAmount(customerPrice(p.price, p.taxId, p.taxInclusive, taxes), p.currency)}</p>}
            </div>
          );
        },
      },
      { id: "source", header: "Source", cell: ({ row: { original: p } }) => <SourcePill p={p} /> },
      {
        id: "status",
        header: "Status",
        meta: { className: "whitespace-nowrap" },
        cell: ({ row: { original: p } }) => (p.active ? <StatusPill tone="success" dot>On sale</StatusPill> : <StatusPill tone="muted">Switched off</StatusPill>),
      },
    ],
    [taxes],
  );

  if (!canView) return <PageContainer><PermissionNotice /></PageContainer>;

  const sync = async () => {
    setSyncing(true);
    const r = await simulateCatalogueSync();
    setSyncing(false);
    if (r.ok) toast.success("Catalogue check simulated", { description: `${r.data.count} MyStoreGuard products marked as checked. No data was fetched — this prototype has no MyStoreGuard connection.` });
    else toast.error(r.error);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Products"
        description="What you sell and at what price. Deals and quotes pick from this catalogue."
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={sync} disabled={syncing}>
                <RefreshCw className={syncing ? "animate-spin" : undefined} /> {syncing ? "Checking…" : "Simulate sync"}
              </Button>
              <Button onClick={() => router.push("/products/new")}>
                <Plus /> New product
              </Button>
            </>
          )
        }
      />
      {synced.length > 0 && (
        <InlineNotice tone="info" icon={Lock}>
          {synced.length} products come from MyStoreGuard and are edited there — here you can only switch them on or off.
          {lastSync && ` Last checked ${formatRelative(lastSync, now)}.`} Sync is simulated in this prototype; no connection to MyStoreGuard is made.
        </InlineNotice>
      )}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchField value={search} onChange={setSearch} placeholder="Search name, SKU or category" label="Search products" />
          <div className="flex flex-wrap items-center gap-3">
            <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
              <SelectTrigger className="w-auto min-w-40 px-3.5" aria-label="Source">
                <span className="text-muted-foreground">Source:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="crm">CRM ({products.filter((p) => p.origin === "crm").length})</SelectItem>
                <SelectItem value="mystoreguard">MyStoreGuard ({products.filter((p) => p.origin === "mystoreguard").length})</SelectItem>
              </SelectContent>
            </Select>
            {categories.length > 0 && <FilterPopover label="Category" options={categories.map((c) => ({ value: c, label: c, hint: String(products.filter((p) => p.category === c).length) }))} selected={cats} onChange={setCats} searchable />}
            <Select value={currency} onValueChange={(v) => setCurrency(v as "all" | Currency)}>
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
            {offCount > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={showOff} onCheckedChange={setShowOff} /> Show switched off ({offCount})
              </label>
            )}
          </div>
        </div>
        <DataTable
          label="Products"
          columns={columns}
          data={rows}
          getRowId={(p) => p.id}
          onRowClick={(p) => router.push(`/products/${p.id}`)}
          empty={
            products.length === 0 ? (
              <EmptyState icon={Package} title="No products yet" description="Add what you sell so deals and quotes can use consistent prices." action={canManage ? <Button onClick={() => router.push("/products/new")}>New product</Button> : undefined} />
            ) : (
              <EmptyState icon={Search} title="No products match" description="Try another search, or show switched-off products." />
            )
          }
        />
      </div>
    </PageContainer>
  );
}

