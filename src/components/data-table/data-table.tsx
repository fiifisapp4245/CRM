"use client";

import { useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeleton } from "@/components/feedback/states";

export interface DataTableColumnMeta {
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  getRowId: (row: T) => string;
  /** Accessible name for the table. */
  label: string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  selectable?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  pageSizes?: number[];
}

/**
 * Generic table built on TanStack Table. Sorting/filtering happen upstream
 * (feature filter logic) so the same rules apply to export and counts.
 * Rows are keyboard reachable: Enter/Space on a focused row opens it.
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  label,
  loading,
  empty,
  onRowClick,
  rowLabel,
  selectable,
  rowSelection,
  onRowSelectionChange,
  pagination: controlledPagination,
  onPaginationChange,
  pageSizes = [25, 50, 100],
}: DataTableProps<T>) {
  const [localPagination, setLocalPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: pageSizes[0] });
  const pagination = controlledPagination ?? localPagination;

  const selectColumn: ColumnDef<T, unknown> = {
    id: "__select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all on this page"
        checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={`Select ${rowLabel?.(row.original) ?? "row"}`}
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      />
    ),
    meta: { className: "w-10 pr-0", headerClassName: "w-10 pr-0" } satisfies DataTableColumnMeta,
  };

  const table = useReactTable({
    data,
    columns: selectable ? [selectColumn, ...columns] : columns,
    getRowId,
    state: { rowSelection: rowSelection ?? {}, pagination },
    enableRowSelection: selectable,
    onRowSelectionChange,
    onPaginationChange: onPaginationChange ?? setLocalPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  const total = data.length;
  const start = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const end = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative w-full overflow-x-auto">
        <table className="w-full text-sm" aria-label={label} aria-busy={loading || undefined}>
          <thead className="border-b border-border">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    scope="col"
                    className={cn("h-11 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-5 last:pr-5", (h.column.columnDef.meta as DataTableColumnMeta | undefined)?.headerClassName)}
                  >
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          {!loading && total > 0 && (
            <tbody className="divide-y divide-border/70">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-selected={selectable ? row.getIsSelected() : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row.original);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "transition-colors outline-none",
                    onRowClick && "cursor-pointer hover:bg-[#f8fbfc] focus-visible:bg-brand-50/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    row.getIsSelected() && "bg-brand-50/70 hover:bg-brand-50",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn("px-3 py-3 align-middle first:pl-5 last:pr-4", (cell.column.columnDef.meta as DataTableColumnMeta | undefined)?.className)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
      {loading && <TableSkeleton />}
      {!loading && total === 0 && empty}
      {!loading && total > 0 && (
        <div className="flex flex-col gap-3 border-t border-border px-5 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite">
            Showing <span className="font-medium text-foreground">{start.toLocaleString()}</span>–<span className="font-medium text-foreground">{end.toLocaleString()}</span> of{" "}
            <span className="font-medium text-foreground">{total.toLocaleString()}</span>
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="hidden sm:inline">Rows per page</span>
              <Select value={String(pagination.pageSize)} onValueChange={(v) => table.setPagination({ pageIndex: 0, pageSize: Number(v) })}>
                <SelectTrigger size="sm" className="w-20" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizes.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <span className="tabular-nums text-foreground/80">
              Page {pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
