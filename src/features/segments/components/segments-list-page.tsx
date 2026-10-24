"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Filter, Lock, MoreHorizontal, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { formatRelative } from "@/lib/utils/format";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useCurrentUser, usePermission } from "@/features/permissions";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { SearchField } from "@/components/data-table/search-field";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { StatusPill } from "@/components/shared/status-pill";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { canEditSegment, describeCondition, segmentAudience, visibleSegments } from "../lib/match";
import { deleteSegment } from "../services/segments-service";
import type { Segment } from "../types";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function SegmentsListPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const canView = usePermission("segments.view");
  const canCreate = usePermission("segments.create");
  const db = useDbStore((s) => s.db);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]);
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<Segment | null>(null);
  const segments = useMemo(() => visibleSegments(db, user), [db, user]);
  const counts = useMemo(() => new Map(segments.map((s) => [s.id, segmentAudience(db, user, s.conditions).length])), [segments, db, user]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return segments.filter((s) => !q || `${s.name} ${s.description ?? ""}`.toLowerCase().includes(q)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [segments, search]);

  const columns = useMemo<ColumnDef<Segment, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Segment",
        cell: ({ row: { original: s } }) => (
          <div className="min-w-56">
            <Link href={`/segments/${s.id}`} onClick={stop} className="font-medium hover:underline">
              {s.name}
            </Link>
            <p className="line-clamp-1 text-xs text-muted-foreground">{s.conditions.length ? s.conditions.map((c) => describeCondition(c, users)).join(" · ") : "No conditions — all contacts"}</p>
          </div>
        ),
      },
      {
        id: "audience",
        header: "Matching contacts",
        meta: { className: "tabular-nums" },
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 font-medium">
            <Users className="size-3.5 text-subtle-foreground" /> {counts.get(row.original.id) ?? 0}
          </span>
        ),
      },
      {
        id: "visibility",
        header: "Visibility",
        cell: ({ row }) =>
          row.original.isPrivate ? (
            <StatusPill tone="neutral">
              <Lock className="size-3" /> Private
            </StatusPill>
          ) : (
            <StatusPill tone="brand">Shared</StatusPill>
          ),
      },
      {
        id: "owner",
        header: "Created by",
        cell: ({ row }) => {
          const u = users.get(row.original.ownerUserId);
          return (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <UserAvatar name={u?.name ?? "?"} size="xs" /> {u?.name}
            </span>
          );
        },
      },
      { id: "updated", header: "Updated", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatRelative(row.original.updatedAt)}</span> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { className: "w-12 pl-0 text-right" },
        cell: ({ row: { original: s } }) =>
          canEditSegment(user, s) ? (
            <div onClick={stop} onKeyDown={stop}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Actions for ${s.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/segments/${s.id}`}>Edit</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(s)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null,
      },
    ],
    [counts, users, user],
  );

  if (!canView) return <PageContainer><PermissionNotice /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title="Segments"
        description="Groups of contacts defined by conditions. Membership updates automatically as contacts change."
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/segments/new">
                <Plus /> New segment
              </Link>
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-4">
        <SearchField value={search} onChange={setSearch} placeholder="Search segments" label="Search segments" />
        <DataTable
          label="Segments"
          columns={columns}
          data={filtered}
          getRowId={(s) => s.id}
          onRowClick={(s) => router.push(`/segments/${s.id}`)}
          empty={
            <EmptyState
              icon={Filter}
              title={segments.length ? "No segments match" : "No segments yet"}
              description={segments.length ? "Try another search." : "Create a segment to group contacts by location, source, tags, permissions and more."}
              action={!segments.length && canCreate ? <Button asChild><Link href="/segments/new">New segment</Link></Button> : undefined}
            />
          }
        />
        <p className="text-xs text-muted-foreground">Counts include only active contacts you can access, so colleagues may see different numbers.</p>
      </div>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete “${toDelete?.name}”?`}
        description="The segment definition is removed. Contacts are not affected."
        confirmLabel="Delete segment"
        destructive
        onConfirm={async () => {
          const r = await deleteSegment(toDelete!.id);
          if (r.ok) toast.success("Segment deleted");
          else toast.error(r.error);
        }}
      />
    </PageContainer>
  );
}
