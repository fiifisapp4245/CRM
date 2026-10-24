/**
 * Business settings used by Engagement, Service and Files. Values are
 * PROTOTYPE configuration (some observed in the audited account, noted
 * inline) — not production policy.
 */
import type { Plan } from "@/lib/entitlements";
import type { TicketPriority } from "@/features/tickets/types";

export interface BusinessSettings {
  /** The organisation's plan. The audited account was Basic; the prototype runs with every module open (Premium). */
  plan: Plan;
  /** IANA timezone; the audited business is in Ghana (GMT, no daylight saving). */
  timezone: string;
  /** ISO weekdays (1 = Monday) and local wall-clock hours. Prototype values. */
  businessHours: { days: number[]; start: string; end: string };
  /** Observed: "Business default (15 minutes)". */
  defaultReminderMinutes: number;
  /** Observed: SMS reminder offered but unavailable in the audited account. */
  smsRemindersEnabled: boolean;
  /** Observed: 20 GB shown in the audited account. */
  storageQuotaBytes: number;
  /** Observed copy: deleted for good after 30 days. */
  recycleRetentionDays: number;
  /** Prototype ticket targets per priority, in hours (calendar hours, not business hours). */
  ticketTargets: Record<TicketPriority, { firstResponseHours: number; resolutionHours: number }>;
  /** Prototype SMS price used for cost tracking (GHS per 160-character part). */
  smsCostPerPartGhs: number;
}

export const DEFAULT_SETTINGS: BusinessSettings = {
  plan: "premium",
  timezone: "Africa/Accra",
  businessHours: { days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00" },
  defaultReminderMinutes: 15,
  smsRemindersEnabled: false,
  storageQuotaBytes: 20 * 1024 ** 3,
  recycleRetentionDays: 30,
  ticketTargets: {
    urgent: { firstResponseHours: 1, resolutionHours: 8 },
    high: { firstResponseHours: 4, resolutionHours: 24 },
    normal: { firstResponseHours: 8, resolutionHours: 72 },
    low: { firstResponseHours: 24, resolutionHours: 120 },
  },
  smsCostPerPartGhs: 0.05,
};
