"use client";

import { useState } from "react";
import { Building2, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Account } from "../types";

/** Searchable account picker. Callers pass only the accounts that are valid choices. */
export function AccountSelect({ id, value, onChange, accounts, placeholder = "No parent (top level)", invalid }: { id?: string; value: string; onChange: (v: string) => void; accounts: Account[]; placeholder?: string; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === value);
  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} aria-invalid={invalid || undefined} className="w-full min-w-0 justify-between rounded-lg font-normal">
            <span className="flex min-w-0 items-center gap-2">
              <Building2 className="size-4 text-subtle-foreground" />
              <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? selected.name : placeholder}</span>
            </span>
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search accounts…" />
            <CommandList>
              <CommandEmpty>No matching accounts.</CommandEmpty>
              <CommandGroup>
                {accounts.map((a) => (
                  <CommandItem key={a.id} value={`${a.name} ${a.accountNumber ?? ""} ${a.id}`} onSelect={() => (onChange(a.id), setOpen(false))}>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{a.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{[a.accountNumber, a.billingAddress?.city].filter(Boolean).join(" · ") || "No account number"}</span>
                    </span>
                    <Check className={cn("ml-auto", value === a.id ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")} aria-label="Remove parent account">
          <X />
        </Button>
      )}
    </div>
  );
}
