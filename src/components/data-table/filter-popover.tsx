"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface FilterOption {
  value: string;
  label: string;
  hint?: string;
}

interface FilterPopoverProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  /** Selection that counts as "no filter" (e.g. a view's default); not highlighted. */
  baseline?: string[];
}

/** Multi-select filter button. Shows the count of active selections. */
export function FilterPopover({ label, options, selected, onChange, searchable, baseline = [] }: FilterPopoverProps) {
  const changed = [...selected].sort().join() !== [...baseline].sort().join() && selected.length > 0;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 px-3.5", changed && "border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-300 hover:bg-brand-50")}>
          {label}
          {changed && <span className="flex size-5 items-center justify-center rounded-full bg-brand-700 text-[11px] font-semibold text-white tabular-nums">{selected.length}</span>}
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />}
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => toggle(o.value)} aria-checked={on} role="menuitemcheckbox">
                    <span className={cn("flex size-4 items-center justify-center rounded-[5px] border", on ? "border-primary bg-primary text-white" : "border-border-strong bg-card")}>
                      {on && <Check className="size-3 text-white" />}
                    </span>
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="ml-auto text-xs text-muted-foreground">{o.hint}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onChange([])} className="justify-center text-muted-foreground">
                    Clear {label.toLowerCase()}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
