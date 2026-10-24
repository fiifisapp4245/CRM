"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Contact } from "@/features/contacts/types";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ContactSelect({ id, value, onChange, contacts, accountName }: { id?: string; value: string; onChange: (v: string) => void; contacts: Contact[]; accountName: (accountId?: string | null) => string | undefined }) {
  const [open, setOpen] = useState(false);
  const sel = contacts.find((c) => c.id === value);
  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full min-w-0 justify-between font-normal">
            <span className="flex min-w-0 items-center gap-2">
              <User className="size-4 text-subtle-foreground" />
              <span className={cn("truncate", !sel && "text-muted-foreground")}>{sel ? sel.displayName : "No contact"}</span>
            </span>
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search contacts…" />
            <CommandList>
              <CommandEmpty>No matching contacts you can access.</CommandEmpty>
              <CommandGroup>
                {contacts.map((c) => (
                  <CommandItem key={c.id} value={`${c.displayName} ${accountName(c.accountId) ?? ""} ${c.id}`} onSelect={() => (onChange(c.id), setOpen(false))}>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{c.displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">{accountName(c.accountId) ?? "No account"}</span>
                    </span>
                    <Check className={cn("ml-auto", value === c.id ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")} aria-label="Remove contact">
          <X />
        </Button>
      )}
    </div>
  );
}
