export type Channel = "sms" | "email" | "whatsapp";
export type CommStatus = "waiting" | "sent" | "delivered" | "failed" | "not_sent" | "cancelled";
export type CommKind = "one_to_one" | "campaign";

export const CHANNEL_LABELS: Record<Channel, string> = { sms: "SMS", email: "Email", whatsapp: "WhatsApp" };
export const COMM_STATUS_LABELS: Record<CommStatus, string> = { waiting: "Waiting", sent: "Sent", delivered: "Delivered", failed: "Failed", not_sent: "Not sent", cancelled: "Cancelled" };

/**
 * One outgoing message. One-to-one messages are also logged on the contact's
 * timeline (`activityId`); campaign messages point at their campaign.
 * Every record in this prototype is SIMULATED (`mode: "demo"`).
 */
export interface Communication {
  id: string;
  orgId: string;
  channel: Channel;
  kind: CommKind;
  contactId: string;
  /** Address used: phone number or email. */
  to: string;
  dealId?: string;
  leadId?: string;
  ticketId?: string;
  activityId?: string;
  campaignId?: string;
  templateId?: string;
  subject?: string;
  body: string;
  status: CommStatus;
  history: { status: CommStatus; at: string; note?: string }[];
  failureReason?: string;
  /** GHS; null when the provider cost is unknown (shown as "—", never 0). */
  cost: number | null;
  consent: { purpose: "marketing" | "operational"; allowed: boolean; reason: string };
  mode: "demo";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  orgId: string;
  name: string;
  channel: Channel;
  subject?: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = "draft" | "scheduled" | "going_out" | "sent" | "stopped";
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = { draft: "Draft", scheduled: "Scheduled", going_out: "Going out", sent: "Sent", stopped: "Stopped" };

export type ExclusionReason = "no_address" | "opted_out" | "no_permission";
export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  no_address: "No usable address for this channel",
  opted_out: "Opted out or declined marketing",
  no_permission: "No marketing permission recorded",
};

export interface Campaign {
  id: string;
  orgId: string;
  name: string;
  channel: Extract<Channel, "sms" | "email">;
  segmentId: string;
  subject?: string;
  body: string;
  templateId?: string;
  status: CampaignStatus;
  /** Snapshot taken when scheduled/sent; drafts recompute live. */
  eligibleCount: number;
  excludedCount: number;
  exclusions?: Partial<Record<ExclusionReason, number>>;
  scheduledAt?: string;
  timezone: string;
  sentAt?: string;
  stoppedAt?: string;
  communicationIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
