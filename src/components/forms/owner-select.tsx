"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, UserX } from "lucide-react";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface OwnerSelectProps {
  /** "" = unassigned */
  value: string;
  onChange: (value: string) => void;
  owners: User[];
  allowUnassigned?: boolean;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  className?: string;
  /** Shown when the current owner isn't in `owners` (e.g. an inactive user). */
  currentOwnerLabel?: string;
  /** Adds an "assign automatically" choice with value "auto". */
  autoOption?: string;
}

/** Searchable owner picker. Callers pass only eligible owners (see eligibleOwners). */
export function OwnerSelect({ value, onChange, owners, allowUnassigned = true, disabled, id, invalid, className, currentOwnerLabel, autoOption }: OwnerSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = owners.find((o) => o.id === value);
  const label = value === "auto" && autoOption ? autoOption : (selected?.name ?? (value ? (currentOwnerLabel ?? "Unknown user") : "Unassigned"));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn("w-full justify-between bg-card font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            {value && value !== "auto" ? <UserAvatar name={label} size="xs" /> : <UserX className="size-4 text-muted-foreground" />}
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search people…" />
          <CommandList>
            <CommandEmpty>No matching people.</CommandEmpty>
            <CommandGroup>
              {autoOption && (
                <CommandItem value="assign automatically auto" onSelect={() => (onChange("auto"), setOpen(false))}>
                  <UserX className="text-muted-foreground" /> {autoOption}
                  <Check className={cn("ml-auto", value === "auto" ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              )}
              {allowUnassigned && (
                <CommandItem value="unassigned none" onSelect={() => (onChange(""), setOpen(false))}>
                  <UserX className="text-muted-foreground" /> Unassigned
                  <Check className={cn("ml-auto", value === "" ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              )}
              {owners.map((o) => (
                <CommandItem key={o.id} value={`${o.name} ${o.email}`} onSelect={() => (onChange(o.id), setOpen(false))}>
                  <UserAvatar name={o.name} size="xs" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{o.name}</span>
                    {/* Same-name colleagues are told apart by their email, never guessed. */}
                    {(o.jobTitle || owners.some((x) => x.id !== o.id && x.name === o.name)) && <span className="truncate text-xs text-muted-foreground">{[o.jobTitle, owners.some((x) => x.id !== o.id && x.name === o.name) ? o.email : null].filter(Boolean).join(" · ")}</span>}
                  </span>
                  <Check className={cn("ml-auto", value === o.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
