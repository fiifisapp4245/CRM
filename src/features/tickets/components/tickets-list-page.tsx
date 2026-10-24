"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { BookMarked, LifeBuoy, Plus, Search } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatInTz } from "@/lib/business/time";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { FilterPopover } from "@/components/data-table/filter-popover";
import { SearchField } from "@/components/data-table/search-field";
import { EmptyState } from "@/components/feedback/states";
import { useFeatureGate } from "@/components/entitlements/upgrade";
import { Segmented } from "@/components/shared/segmented";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTicketsData } from "../hooks";
import { inView, isLateNow, type TicketView } from "../lib/tickets";
import { TICKET_PRIORITY_LABELS, type Ticket, type TicketPriority } from "../types";
import { LatePill, TicketPriorityBadge, TicketStatusBadge } from "./badges";
import { responseTarget, resolutionTarget, TargetState } from "./targets";
import { TicketsDashboard } from "./tickets-dashboard";

type View = TicketView | "dashboard";
const VIEWS: { value: View; label: string }[] = [
  { value: "mine", label: "Mine" },
  { value: "nobody", label: "Nobody has" },
  { value: "late", label: "Late" },
  { value: "open", label: "All open" },
  { value: "waiting", label: "Waiting on customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "dashboard", label: "Dashboard" },
];
const PR_ORDER: Record<TicketPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
type Sort = "newest" | "oldest" | "priority" | "due";

export function TicketsListPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, now, tickets, contacts, users, categories, tz } = useTicketsData();
  const gate = useFeatureGate("tickets");
  const view = (VIEWS.some((v) => v.value === params.get("view")) ? params.get("view") : "open") as View;
  const setView = (v: View) => router.replace(`/tickets?view=${v}`);
  const [search, setSearch] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("due");
  const canManage = hasPermission(user, "tickets.manage");

  const counts = useMemo(() => Object.fromEntries(VIEWS.filter((v) => v.value !== "dashboard").map((v) => [v.value, tickets.filter((t) => inView(t, v.value as TicketView, user.id, now)).length])), [tickets, user.id, now]);
  const rows = useMemo(() => {
    if (view === "dashboard") return [];
    const q = search.trim().toLowerCase();
    const list = tickets
      .filter((t) => inView(t, view, user.id, now))
      .filter((t) => (!priorities.length || priorities.includes(t.priority)) && (!cats.length || cats.includes(t.category)))
      .filter((t) => !q || [t.number, t.subject, contacts.get(t.contactId)?.displayName].filter(Boolean).join(" ").toLowerCase().includes(q));
    const by: Record<Sort, (a: Ticket, b: Ticket) => number> = {
      newest: (a, b) => b.openedAt.localeCompare(a.openedAt),
      oldest: (a, b) => a.openedAt.localeCompare(b.openedAt),
      priority: (a, b) => PR_ORDER[a.priority] - PR_ORDER[b.priority] || a.resolutionDueAt.localeCompare(b.resolutionDueAt),
      due: (a, b) => (a.firstRespondedAt ? a.resolutionDueAt : a.firstResponseDueAt).localeCompare(b.firstRespondedAt ? b.resolutionDueAt : b.firstResponseDueAt),
    };
    return list.sort(by[sort]);
  }, [tickets, view, user.id, now, search, priorities, cats, contacts, sort]);

  const columns = useMemo<ColumnDef<Ticket, unknown>[]>(
    () => [
      {
        id: "subject",
        header: "Ticket",
        cell: ({ row: { original: t } }) => (
          <div className="min-w-56">
            <Link href={`/tickets/${t.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">
              <span className="text-muted-foreground tabular-nums">{t.number}</span> {t.subject}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {contacts.get(t.contactId)?.displayName ?? "Unknown customer"} · {t.category}
            </p>
          </div>
        ),
      },
      { id: "priority", header: "Priority", cell: ({ row }) => <TicketPriorityBadge priority={row.original.priority} /> },
      { id: "status", header: "Status", cell: ({ row: { original: t } }) => <span className="flex flex-wrap gap-1"><TicketStatusBadge status={t.status} />{isLateNow(t, now) && <LatePill />}</span> },
      {
        id: "owner",
        header: "Owner",
        meta: { className: "hidden md:table-cell", headerClassName: "hidden md:table-cell" },
        cell: ({ row: { original: t } }) => (t.ownerId ? <span className="flex items-center gap-2 whitespace-nowrap"><UserAvatar name={users.get(t.ownerId)?.name ?? "?"} size="xs" />{users.get(t.ownerId)?.name}</span> : <span className="text-muted-foreground">Nobody</span>),
      },
      { id: "reply", header: "First reply", meta: { className: "hidden lg:table-cell whitespace-nowrap text-xs", headerClassName: "hidden lg:table-cell" }, cell: ({ row }) => <TargetState {...responseTarget(row.original)} now={now} tz={tz} compact /> },
      { id: "resolve", header: "Resolve", meta: { className: "hidden xl:table-cell whitespace-nowrap text-xs", headerClassName: "hidden xl:table-cell" }, cell: ({ row }) => <TargetState {...resolutionTarget(row.original)} now={now} tz={tz} compact /> },
      { id: "opened", header: "Opened", meta: { className: "hidden md:table-cell whitespace-nowrap", headerClassName: "hidden md:table-cell" }, cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{formatInTz(row.original.openedAt, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> },
    ],
    [contacts, users, now, tz],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Tickets"
        description="Complaints and requests, owned by someone, answered on time, and rated by the customer."
        actions={
          <>
            {hasPermission(user, "answers.manage") && (
              <Button variant="outline" onClick={gate.guard(() => router.push("/tickets/answers"))}>
                <BookMarked /> Saved answers
              </Button>
            )}
            {canManage && (
              <Button onClick={gate.guard(() => router.push("/tickets/new"))}>
                <Plus /> New ticket
              </Button>
            )}
          </>
        }
      />
      <div className="overflow-x-auto">
        <Segmented label="Ticket view" value={view} onChange={setView} options={VIEWS.map((v) => ({ ...v, count: v.value === "dashboard" ? undefined : counts[v.value] || undefined }))} />
      </div>
      {view === "dashboard" ? (
        <TicketsDashboard tickets={tickets} now={now} tz={tz} users={users} onOpenView={setView} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchField value={search} onChange={setSearch} placeholder="Search number, subject or customer" label="Search tickets" />
            <div className="flex flex-wrap gap-2">
              <FilterPopover label="Priority" options={(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map((p) => ({ value: p, label: TICKET_PRIORITY_LABELS[p] }))} selected={priorities} onChange={setPriorities} />
              <FilterPopover label="Category" options={categories.map((c) => ({ value: c, label: c }))} selected={cats} onChange={setCats} />
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger className="w-auto min-w-44 px-3.5" aria-label="Sort tickets">
                  <span className="text-muted-foreground">Sort:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due">Next target first</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
              {(search || priorities.length > 0 || cats.length > 0) && (
                <Button variant="ghost" onClick={() => (setSearch(""), setPriorities([]), setCats([]))}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>
          <DataTable
            label="Tickets"
            columns={columns}
            data={rows}
            getRowId={(t) => t.id}
            onRowClick={(t) => router.push(`/tickets/${t.id}`)}
            empty={tickets.length === 0 ? <EmptyState icon={LifeBuoy} title="No tickets yet" /> : <EmptyState icon={Search} title="No tickets in this view" description={view === "late" ? "Nothing has missed its target." : "Try another view or clear the filters."} />}
          />
        </div>
      )}
      {gate.dialog}
    </PageContainer>
  );
}
