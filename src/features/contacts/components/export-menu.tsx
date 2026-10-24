"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadFile } from "@/lib/utils/csv";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDb } from "../hooks/use-contacts";
import { contactsToCsv } from "../lib/export";
import { canExport } from "../services/contacts-service";
import type { Contact } from "../types";

/** Export is always limited to records the user can see; the list passed in is already permission-filtered. */
export function ExportMenu({ filtered, selected, allPermitted }: { filtered: Contact[]; selected: Contact[]; allPermitted: Contact[] }) {
  const db = useDb();
  const run = (rows: Contact[], label: string) => {
    if (!canExport()) return toast.error("Your role can't export contacts.");
    if (!rows.length) return toast.info("There are no contacts to export.");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`contacts-${label}-${stamp}.csv`, contactsToCsv(rows, db));
    toast.success(`Exported ${rows.length.toLocaleString()} contact${rows.length === 1 ? "" : "s"}`, { description: "CSV saved to your downloads." });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Export as CSV</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => run(filtered, "filtered")}>
          <span className="flex-1">Current results</span>
          <span className="text-xs text-muted-foreground tabular-nums">{filtered.length.toLocaleString()}</span>
        </DropdownMenuItem>
        {selected.length > 0 && (
          <DropdownMenuItem onSelect={() => run(selected, "selected")}>
            <span className="flex-1">Selected contacts</span>
            <span className="text-xs text-muted-foreground tabular-nums">{selected.length.toLocaleString()}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => run(allPermitted, "all")}>
          <span className="flex-1">All contacts you can access</span>
          <span className="text-xs text-muted-foreground tabular-nums">{allPermitted.length.toLocaleString()}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
