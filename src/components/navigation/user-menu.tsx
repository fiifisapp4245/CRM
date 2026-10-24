"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw, ShieldCheck } from "lucide-react";
import { clearFiles } from "@/lib/storage/file-store";
import { toast } from "sonner";
import { useDbStore } from "@/lib/mock-data/db-store";
import { DEMO_PERSONA_BY_ROLE } from "@/lib/mock-data/users";
import { ROLE_DEFINITIONS, ROLE_ORDER } from "@/lib/permissions";
import type { RoleId } from "@/lib/types";
import { useCurrentUser, useSessionStore } from "@/features/permissions";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const user = useCurrentUser();
  const users = useDbStore((s) => s.db.users);
  const reset = useDbStore((s) => s.reset);
  const setCurrentUser = useSessionStore((s) => s.setCurrentUser);
  const [confirmReset, setConfirmReset] = useState(false);
  const role = ROLE_DEFINITIONS[user.role];

  const switchRole = (roleId: string) => {
    const personaId = DEMO_PERSONA_BY_ROLE[roleId as RoleId];
    const persona = users.find((u) => u.id === personaId);
    if (!persona) return;
    setCurrentUser(persona.id);
    toast.success(`Now viewing as ${persona.name}`, { description: ROLE_DEFINITIONS[persona.role].label });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Account menu: ${user.name}, ${role.label}. Switch role`} className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1 pr-3 pl-1 text-left transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <UserAvatar name={user.name} />
          <span className="hidden leading-tight md:block">
            <span className="block text-sm font-medium">{user.name}</span>
            <span className="block text-xs text-muted-foreground">{role.label}</span>
          </span>
          <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="font-normal">
            <p className="font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Prototype: view as role
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={user.role} onValueChange={switchRole}>
            {ROLE_ORDER.map((r) => {
              const persona = users.find((u) => u.id === DEMO_PERSONA_BY_ROLE[r]);
              return (
                <DropdownMenuRadioItem key={r} value={r} className="items-start">
                  <span className="flex flex-col">
                    <span>{ROLE_DEFINITIONS[r].label}</span>
                    <span className="text-xs text-muted-foreground">{persona?.name}</span>
                  </span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
            <RotateCcw /> Reset demo data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset demo data?"
        description="This restores the original fictional contacts and removes every change made in this browser — new contacts, edits, imports, merges, activities, tickets and uploaded files. Your selected role is kept."
        confirmLabel="Reset data"
        destructive
        onConfirm={() => {
          reset();
          void clearFiles().catch(() => undefined);
          toast.success("Demo data reset");
        }}
      />
    </>
  );
}
