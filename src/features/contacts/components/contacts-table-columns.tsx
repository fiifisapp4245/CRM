"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import type { User } from "@/lib/types";
import type { AccountRef } from "@/lib/types/related";
import { formatPhone, formatRelative } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { primaryMethod } from "../lib/filters";
import type { Contact } from "../types";
import { ContactStatusBadge, SourceBadge } from "./contact-badges";

export interface RowActions {
  canEdit: (c: Contact) => boolean;
  canArchive: (c: Contact) => boolean;
  canRestore: (c: Contact) => boolean;
  canReassign: (c: Contact) => boolean;
  onEdit: (c: Contact) => void;
  onArchive: (c: Contact) => void;
  onRestore: (c: Contact) => void;
  onReassign: (c: Contact) => void;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function contactColumns(users: Map<string, User>, accounts: Map<string, AccountRef>, actions: RowActions): ColumnDef<Contact, unknown>[] {
  return [
    {
      id: "name",
      header: "Name",
      cell: ({ row: { original: c } }) => (
        <div className="flex min-w-40 items-center gap-3">
          <UserAvatar name={c.displayName} muted={c.status !== "active"} />
          <div className="min-w-0">
            <Link href={`/contacts/${c.id}`} onClick={stop} className="block truncate font-medium text-foreground decoration-border-strong hover:underline focus-visible:underline focus-visible:outline-none">
              {c.displayName}
            </Link>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {c.status !== "active" && <ContactStatusBadge status={c.status} />}
              {c.jobTitle}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "account",
      header: "Account",
      cell: ({ row: { original: c } }) => <span className="block max-w-40 truncate">{c.accountId ? accounts.get(c.accountId)?.name : <span className="text-subtle-foreground">—</span>}</span>,
    },
    {
      id: "reach",
      header: "Reach",
      cell: ({ row: { original: c } }) => {
        const e = primaryMethod(c, "email");
        const p = primaryMethod(c, "phone");
        if (!e && !p) return <span className="text-subtle-foreground">No details</span>;
        return (
          <div className="min-w-0 max-w-56 leading-snug">
            {p && <p className="whitespace-nowrap tabular-nums">{formatPhone(p.value)}</p>}
            {e && <p className={p ? "truncate text-xs text-muted-foreground" : "truncate"}>{e.value}</p>}
          </div>
        );
      },
    },
    {
      id: "owner",
      header: "Owner",
      cell: ({ row: { original: c } }) => {
        if (!c.ownerId) return <span className="text-muted-foreground">Unassigned</span>;
        const u = users.get(c.ownerId);
        return (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <UserAvatar name={u?.name ?? "?"} size="xs" muted={u?.status !== "active"} />
            {u?.name}
            {u?.status === "inactive" && <span className="text-xs text-warning">(inactive)</span>}
          </span>
        );
      },
    },
    { id: "source", header: "Source", cell: ({ row }) => <span className="whitespace-nowrap"><SourceBadge source={row.original.source} /></span> },
    {
      id: "activity",
      header: "Last activity",
      cell: ({ row: { original: c } }) => (
        <span className="whitespace-nowrap text-muted-foreground" title={c.lastActivityAt ? undefined : `Updated ${formatRelative(c.updatedAt)}`}>
          {c.lastActivityAt ? formatRelative(c.lastActivityAt) : "No activity"}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      meta: { className: "w-12 pl-0 text-right" },
      cell: ({ row: { original: c } }) => {
        const items = [
          actions.canEdit(c) && { label: "Edit", onSelect: () => actions.onEdit(c) },
          actions.canReassign(c) && { label: "Change owner", onSelect: () => actions.onReassign(c) },
          actions.canRestore(c) && { label: "Restore", onSelect: () => actions.onRestore(c) },
        ].filter(Boolean) as { label: string; onSelect: () => void }[];
        const archive = actions.canArchive(c);
        return (
          <div onClick={stop} onKeyDown={stop}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Actions for ${c.displayName}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/contacts/${c.id}`}>Open</Link>
                </DropdownMenuItem>
                {items.map((i) => (
                  <DropdownMenuItem key={i.label} onSelect={i.onSelect}>
                    {i.label}
                  </DropdownMenuItem>
                ))}
                {archive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => actions.onArchive(c)}>
                      Archive
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
