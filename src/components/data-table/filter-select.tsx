"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Single-choice filter button, styled like FilterPopover. Highlighted when it differs from `baseline`. */
export function FilterSelect<T extends string>({ label, options, value, onChange, baseline }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; baseline: T }) {
  const [open, setOpen] = useState(false);
  const active = value !== baseline;
  const current = options.find((o) => o.value === value)?.label;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 px-3.5", active && "border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-300 hover:bg-brand-50")} aria-label={`${label}: ${current}`}>
          {active ? current : label}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1.5" align="start">
        <ul role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={o.value}>
              <button type="button" role="option" aria-selected={o.value === value} onClick={() => (onChange(o.value), setOpen(false))} className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-secondary">
                {o.label}
                {o.value === value && <Check className="size-4 text-brand-700" />}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
