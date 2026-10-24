import { StatusPill, type PillTone } from "@/components/shared/status-pill";
import { CONSENT_STATUS_LABELS, SOURCE_LABELS, STATUS_LABELS, type ConsentStatus, type ContactSource, type ContactStatus } from "../types";

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  const tone: PillTone = status === "active" ? "success" : status === "archived" ? "neutral" : "muted";
  return (
    <StatusPill tone={tone} dot>
      {STATUS_LABELS[status]}
    </StatusPill>
  );
}

/** Source is provenance only — it does not grant access to the other application's records. */
export function SourceBadge({ source }: { source: ContactSource }) {
  return <span className="text-sm text-muted-foreground">{SOURCE_LABELS[source]}</span>;
}

const CONSENT_TONE: Record<ConsentStatus, PillTone> = { agreed: "success", declined: "warning", withdrawn: "danger", unknown: "muted" };

export function ConsentBadge({ status }: { status: ConsentStatus }) {
  return <StatusPill tone={CONSENT_TONE[status]}>{CONSENT_STATUS_LABELS[status]}</StatusPill>;
}
