"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface Option {
  value: string;
  label: string;
}

/** Searchable multi-value picker; selections show as removable chips. */
export function MultiSelect({ options, value, onChange, placeholder, label, disabled, invalid }: { options: Option[]; value: string[]; onChange: (v: string[]) => void; placeholder: string; label: string; disabled?: boolean; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" disabled={disabled} aria-label={label} aria-invalid={invalid || undefined} className={cn("w-full justify-between rounded-lg font-normal", invalid && "border-destructive")}>
            <span className={cn("truncate", !value.length && "text-muted-foreground")}>{value.length ? `${value.length} selected` : placeholder}</span>
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-60 p-0" align="start">
          <Command>
            {options.length > 7 && <CommandInput placeholder="Search…" />}
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const on = value.includes(o.value);
                  return (
                    <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => toggle(o.value)}>
                      <span className={cn("flex size-4 items-center justify-center rounded-[5px] border", on ? "border-primary bg-primary text-white" : "border-border-strong bg-card")}>{on && <Check className="size-3 text-white" />}</span>
                      <span className="truncate">{o.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex h-7 items-center gap-1 rounded-md bg-secondary py-0.5 pr-1 pl-3 text-xs font-medium">
              {labelOf(v)}
              {!disabled && (
                <button type="button" onClick={() => toggle(v)} className="rounded p-1 text-muted-foreground hover:bg-[#e4ecef] hover:text-foreground" aria-label={`Remove ${labelOf(v)}`}>
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
