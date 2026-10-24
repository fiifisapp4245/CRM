"use client";

import { useState } from "react";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDaysKey } from "@/lib/business/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateRange {
  from: string; // YYYY-MM-DD or ""
  to: string;
}

const fmt = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function presets(today: string): { key: string; label: string; range: DateRange }[] {
  return [
    { key: "any", label: "Any time", range: { from: "", to: "" } },
    { key: "today", label: "Today", range: { from: today, to: today } },
    { key: "7", label: "Last 7 days", range: { from: addDaysKey(today, -6), to: today } },
    { key: "30", label: "Last 30 days", range: { from: addDaysKey(today, -29), to: today } },
    { key: "month", label: "This month", range: { from: `${today.slice(0, 8)}01`, to: today } },
  ];
}

/** Human label for a range: a preset name when it matches one, else "1 Oct – 23 Oct". */
export function dateRangeLabel(r: DateRange, today: string): string {
  const p = presets(today).find((x) => x.range.from === r.from && x.range.to === r.to);
  if (p) return p.label;
  if (r.from && r.to) return r.from === r.to ? fmt(r.from) : `${fmt(r.from)} – ${fmt(r.to)}`;
  return r.from ? `From ${fmt(r.from)}` : `Until ${fmt(r.to)}`;
}

/** Date filter button: common periods first, an exact range underneath. */
export function DateRangeFilter({ value, onChange, today, label = "Date" }: { value: DateRange; onChange: (r: DateRange) => void; today: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const active = !!(value.from || value.to);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 px-3.5", active && "border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-300 hover:bg-brand-50")} aria-label={`${label}: ${dateRangeLabel(value, today)}`}>
          <CalendarRange className={active ? "text-brand-700" : "text-muted-foreground"} />
          {active ? dateRangeLabel(value, today) : label}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1.5" align="start">
        <ul role="listbox" aria-label={label}>
          {presets(today).map((p) => {
            const on = p.range.from === value.from && p.range.to === value.to;
            return (
              <li key={p.key}>
                <button type="button" role="option" aria-selected={on} onClick={() => (onChange(p.range), setOpen(false))} className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-secondary">
                  {p.label}
                  {on && <Check className="size-4 text-brand-700" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 grid grid-cols-2 gap-2 border-t border-border/70 px-1.5 pt-2.5 pb-1.5">
          <div className="grid gap-1">
            <Label htmlFor="dr-from" className="text-xs text-muted-foreground">From</Label>
            <Input id="dr-from" type="date" value={value.from} max={value.to || today} onChange={(e) => onChange({ ...value, from: e.target.value })} className="h-8 px-2 text-xs" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="dr-to" className="text-xs text-muted-foreground">To</Label>
            <Input id="dr-to" type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} className="h-8 px-2 text-xs" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
