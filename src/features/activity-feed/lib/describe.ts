import type { User } from "@/lib/types";
import { formatDate } from "@/lib/utils/format";
import type { AuditAction, AuditEntityType } from "@/features/contacts/types";

/**
 * Translations for raw field keys that syncs and older services record
 * (e.g. MyStoreGuard sends `owner_user_id`). Anything not listed is turned
 * into sentence case, so a new key never reaches people as snake_case.
 */
export const TECHNICAL_FIELD_LABELS: Record<string, string> = {
  first_name: "First name",
  middle_names: "Middle names",
  middle_name: "Middle name",
  last_name: "Last name",
  full_name: "Full name",
  display_name: "Display name",
  owner_user_id: "Owner",
  account_id: "Account",
  parent_account_id: "Parent account",
  tag_ids: "Tags",
  job_title: "Job title",
  date_of_birth: "Date of birth",
  primary_email: "Primary email",
  primary_phone: "Primary phone",
  whatsapp_number: "WhatsApp number",
  city_town: "City / town",
  created_at: "Created",
  updated_at: "Last updated",
};

/** Known tag ids from synced systems; unknown ids stay as recorded. */
const TAG_ID_NAMES: Record<string, string> = {
  tag_vip: "VIP",
  tag_wholesale: "Wholesale",
  tag_retail: "Retail",
  tag_newsletter: "Newsletter",
};

/** Fields whose values are personal; only roles that can see change history see their values. */
const SENSITIVE = new Set(["Date of birth", "Notes", "Background notes"]);

export function isTechnicalKey(field: string) {
  return /^[a-z]+(_[a-z0-9]+)+$/.test(field) || field in TECHNICAL_FIELD_LABELS;
}

export function humanizeField(field: string): string {
  if (TECHNICAL_FIELD_LABELS[field]) return TECHNICAL_FIELD_LABELS[field];
  if (!isTechnicalKey(field)) return field;
  const words = field.replace(/_ids?$/, "").split("_");
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function isSensitiveField(label: string) {
  return SENSITIVE.has(label);
}

export function humanizeValue(field: string, value: string, users: Map<string, User>, accountNames: Map<string, string>): string {
  if (!value) return "";
  switch (field) {
    case "owner_user_id":
      return users.get(value)?.name ?? value;
    case "account_id":
    case "parent_account_id":
      return accountNames.get(value) ?? value;
    case "tag_ids":
      return value
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((id) => TAG_ID_NAMES[id] ?? id)
        .join(", ");
    case "date_of_birth":
      return formatDate(value);
    default:
      return value;
  }
}

export const SYSTEM_ACTORS: Record<string, string> = {
  "system:mystoreguard": "MyStoreGuard sync",
  "system:loandrift": "LoanDrift sync",
  "system:customer": "Customer (via quote link)",
  "system:system": "System",
};

export function actorName(actorId: string, users: Map<string, User>) {
  return SYSTEM_ACTORS[actorId] ?? users.get(actorId)?.name ?? "Unknown user";
}

export const ENTITY_LABELS: Record<AuditEntityType, string> = {
  contact: "contact",
  account: "account",
  segment: "segment",
  deal: "deal",
  ticket: "ticket",
  setting: "setting",
  lead: "lead",
  quote: "quote",
  product: "product",
  activity: "activity",
  campaign: "campaign",
  template: "message template",
  document: "document",
  folder: "folder",
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  created: "Created",
  updated: "Edited",
  archived: "Archived",
  restored: "Restored",
  reassigned: "Changed the owner of",
  merged: "Merged duplicates into",
  merged_into: "Merged away",
  imported: "Imported",
  import_updated: "Updated by import",
  consent_recorded: "Recorded a communication preference for",
  exported: "Exported",
  deleted: "Deleted",
  stage_changed: "Moved",
  opened: "Opened",
  resolved: "Resolved",
  synced: "Synced",
  won: "Won",
  lost: "Lost",
  reopened: "Reopened",
  converted: "Converted",
  status_changed: "Updated the status of",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  paid: "Recorded payment for",
  completed: "Completed",
  rescheduled: "Rescheduled",
  scheduled: "Scheduled",
  stopped: "Stopped",
  assigned: "Assigned",
  replied: "Replied to",
  uploaded: "Uploaded",
  moved: "Moved",
  renamed: "Renamed",
};
