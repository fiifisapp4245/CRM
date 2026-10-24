import { AlarmClock, ArrowUp, ChevronsUp, Minus } from "lucide-react";
import { StatusPill } from "@/components/shared/status-pill";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS, type TicketPriority, type TicketStatus } from "../types";

const STATUS_TONE = { open: "warning", waiting: "info", resolved: "success", closed: "muted" } as const;

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <StatusPill tone={STATUS_TONE[status]}>{TICKET_STATUS_LABELS[status]}</StatusPill>;
}

/** Priority is shown with text and an icon, never colour alone. */
export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const Icon = priority === "urgent" ? ChevronsUp : priority === "high" ? ArrowUp : Minus;
  return (
    <StatusPill tone={priority === "urgent" ? "danger" : priority === "high" ? "warning" : "neutral"}>
      <Icon className="size-3" /> {TICKET_PRIORITY_LABELS[priority]}
    </StatusPill>
  );
}

export function LatePill({ label = "Late" }: { label?: string }) {
  return (
    <StatusPill tone="danger">
      <AlarmClock className="size-3" /> {label}
    </StatusPill>
  );
}
