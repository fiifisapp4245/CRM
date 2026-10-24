import { Ban, CheckCheck, CircleSlash, Clock, Send, XCircle } from "lucide-react";
import { StatusPill } from "@/components/shared/status-pill";
import { CAMPAIGN_STATUS_LABELS, COMM_STATUS_LABELS, type CampaignStatus, type CommStatus } from "../types";

const ICON = { waiting: Clock, sent: Send, delivered: CheckCheck, failed: XCircle, not_sent: CircleSlash, cancelled: Ban } as const;
const TONE = { waiting: "neutral", sent: "info", delivered: "success", failed: "danger", not_sent: "muted", cancelled: "muted" } as const;

export function CommStatusBadge({ status }: { status: CommStatus }) {
  const Icon = ICON[status];
  return (
    <StatusPill tone={TONE[status]}>
      <Icon className="size-3" /> {COMM_STATUS_LABELS[status]}
    </StatusPill>
  );
}

const C_TONE = { draft: "neutral", scheduled: "info", going_out: "warning", sent: "success", stopped: "muted" } as const;
export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <StatusPill tone={C_TONE[status]}>{CAMPAIGN_STATUS_LABELS[status]}</StatusPill>;
}

export const formatGhs = (v: number | null) => (v === null ? "—" : `GHS ${v.toFixed(2)}`);
