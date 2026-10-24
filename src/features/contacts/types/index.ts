export type ContactSource = "manual" | "import" | "mystoreguard" | "loandrift";
export type ContactStatus = "active" | "archived" | "merged";
export type MethodKind = "phone" | "email" | "whatsapp";
export type MethodLabel = "mobile" | "work" | "home" | "personal" | "other";

export interface ContactMethod {
  id: string;
  kind: MethodKind;
  value: string;
  label: MethodLabel;
  isPrimary: boolean;
}

export interface Contact {
  id: string;
  orgId: string;
  title?: string;
  firstName: string;
  middleName?: string;
  lastName?: string;
  displayName: string;
  methods: ContactMethod[];
  accountId?: string | null;
  jobTitle?: string;
  ownerId: string | null;
  gender?: "female" | "male" | "other" | "undisclosed";
  dateOfBirth?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  tags: string[];
  notes?: string;
  /** Values from unrecognised import columns the user chose to keep. */
  customFields?: Record<string, string>;
  source: ContactSource;
  status: ContactStatus;
  archivedAt?: string;
  archivedBy?: string;
  mergedIntoId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  lastActivityAt?: string;
}

export const SOURCE_LABELS: Record<ContactSource, string> = {
  manual: "Manually added",
  import: "Imported",
  mystoreguard: "MyStoreGuard",
  loandrift: "LoanDrift",
};

export const STATUS_LABELS: Record<ContactStatus, string> = {
  active: "Active",
  archived: "Archived",
  merged: "Merged",
};

export const METHOD_KIND_LABELS: Record<MethodKind, string> = {
  phone: "Phone",
  email: "Email",
  whatsapp: "WhatsApp",
};

export const METHOD_LABEL_LABELS: Record<MethodLabel, string> = {
  mobile: "Mobile",
  work: "Work",
  home: "Home",
  personal: "Personal",
  other: "Other",
};

/* ------------------------------------------------------------------ */
/* Communication preferences & consent                                  */
/* ------------------------------------------------------------------ */

export type ConsentChannel = "sms" | "whatsapp" | "email" | "phone";
export type ConsentDecision = "agreed" | "declined" | "withdrawn";
export type ConsentStatus = ConsentDecision | "unknown";
export type ConsentPurpose = "marketing" | "service_updates";

export type ConsentMethod =
  | "verbal_call"
  | "in_person"
  | "signed_form"
  | "web_form"
  | "replied_yes"
  | "replied_stop"
  | "unsubscribe_link"
  | "email_request"
  | "verbal_request";

export interface ConsentRecord {
  id: string;
  orgId: string;
  contactId: string;
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  decision: ConsentDecision;
  method: ConsentMethod;
  recordedAt: string;
  recordedBy: string;
  note?: string;
  evidenceRef?: string;
  /** Set when this record was carried over from a merged contact. */
  carriedFromContactId?: string;
}

export const CONSENT_CHANNEL_LABELS: Record<ConsentChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
  phone: "Phone calls",
};

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  unknown: "Not asked",
  agreed: "Agreed",
  declined: "Refused",
  withdrawn: "Withdrawn",
};

export const CONSENT_PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  marketing: "Marketing",
  service_updates: "Service updates",
};

export const CONSENT_METHOD_LABELS: Record<ConsentMethod, string> = {
  verbal_call: "Said so on a phone call",
  in_person: "Told us in person",
  signed_form: "Signed a paper form",
  web_form: "Ticked a box on a web form",
  replied_yes: "Replied YES to a message",
  replied_stop: "Replied STOP",
  unsubscribe_link: "Used an unsubscribe link",
  email_request: "Asked by email",
  verbal_request: "Asked verbally",
};

/** Which capture methods make sense for each decision. */
export const CONSENT_METHODS_BY_DECISION: Record<ConsentDecision, ConsentMethod[]> = {
  agreed: ["verbal_call", "in_person", "signed_form", "web_form", "replied_yes"],
  declined: ["verbal_call", "in_person", "signed_form", "web_form", "email_request"],
  withdrawn: ["replied_stop", "unsubscribe_link", "email_request", "verbal_request", "in_person"],
};

/* ------------------------------------------------------------------ */
/* Audit, imports, views                                                */
/* ------------------------------------------------------------------ */

export type AuditAction =
  | "created"
  | "updated"
  | "archived"
  | "restored"
  | "reassigned"
  | "merged"
  | "merged_into"
  | "imported"
  | "import_updated"
  | "consent_recorded"
  | "exported"
  | "deleted"
  | "stage_changed"
  | "opened"
  | "resolved"
  | "synced"
  | "won"
  | "lost"
  | "reopened"
  | "converted"
  | "status_changed"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "paid"
  | "completed"
  | "rescheduled"
  | "deleted"
  | "restored"
  | "scheduled"
  | "stopped"
  | "assigned"
  | "replied"
  | "uploaded"
  | "moved"
  | "renamed";

export interface FieldChange {
  /** Human label, or a raw technical key from a sync (humanised for display by the activity feed). */
  field: string;
  from: string;
  to: string;
}

export type AuditEntityType = "contact" | "account" | "segment" | "deal" | "ticket" | "setting" | "lead" | "quote" | "product" | "activity" | "campaign" | "template" | "document" | "folder";

export interface AuditEvent {
  id: string;
  orgId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actorId: string;
  at: string;
  changes?: FieldChange[];
  summary?: string;
}

export type DuplicateMode = "update" | "skip";

export interface ImportJob {
  id: string;
  /** Which module the import belonged to. Older jobs default to contacts. */
  entityType?: "contact" | "account" | "deal" | "activity";
  /** Related records an import created (deal import can add contacts/accounts). */
  relatedCreated?: { contacts: number; accounts: number };
  orgId: string;
  fileName: string;
  fileSize: number;
  startedAt: string;
  actorId: string;
  duplicateMode: DuplicateMode;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errorReportCsv?: string;
}

export type ContactSortKey = "recent" | "name" | "newest";

export interface ContactFilters {
  search: string;
  ownerIds: string[]; // "unassigned" is a valid pseudo-id
  sources: ContactSource[];
  statuses: Array<"active" | "archived">;
  tags: string[];
  sort: ContactSortKey;
}

export interface SavedView {
  id: string;
  name: string;
  /** null for built-in views. */
  ownerUserId: string | null;
  filters: ContactFilters;
  builtIn?: "all" | "mine" | "unassigned" | "recent" | "archived";
}
