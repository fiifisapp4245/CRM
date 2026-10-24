"use client";

import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { formatRelative } from "@/lib/utils/format";
import { EmptyState } from "@/components/feedback/states";
import { TicketPriorityBadge, TicketStatusBadge } from "@/features/tickets/components/badges";
import type { Ticket } from "@/features/tickets/types";

/** Tickets for one customer; each opens the ticket workspace. */
export function TicketsList({ tickets, newHref }: { tickets: Ticket[]; newHref?: string }) {
  if (!tickets.length)
    return (
      <div className="rounded-2xl border border-border bg-card">
        <EmptyState compact icon={LifeBuoy} title="No support tickets" action={newHref ? <Link href={newHref} className="text-sm font-medium text-brand-700 hover:underline">New ticket</Link> : undefined} />
      </div>
    );
  return (
    <ul className="divide-y divide-border/70 rounded-2xl border border-border bg-card">
      {[...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((t) => (
        <li key={t.id}>
          <Link href={`/tickets/${t.id}`} className="flex items-start gap-3 px-5 py-3.5 text-sm hover:bg-[#fafcfc]">
            <LifeBuoy className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                <span className="text-muted-foreground tabular-nums">{t.number}</span> {t.subject}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t.category} · updated {formatRelative(t.updatedAt)}
              </span>
            </span>
            <TicketPriorityBadge priority={t.priority} />
            <TicketStatusBadge status={t.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
