export type TicketPriority = "urgent" | "high" | "normal" | "low";
export type TicketStatus = "open" | "waiting" | "resolved" | "closed";
export type TicketSource = "phone" | "email" | "whatsapp" | "walk_in" | "web";

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = { open: "Open", waiting: "Waiting on customer", resolved: "Resolved", closed: "Closed" };
export const TICKET_SOURCE_LABELS: Record<TicketSource, string> = { phone: "Phone", email: "Email", whatsapp: "WhatsApp", walk_in: "Walk-in", web: "Website" };
export const TICKET_CATEGORIES = ["Delivery", "Billing", "Product fault", "Installation", "General enquiry"];

export type TicketEntryKind = "reply" | "note" | "customer" | "event";

export interface TicketEntry {
  id: string;
  kind: TicketEntryKind;
  body: string;
  at: string;
  /** User id, "customer" or "system". */
  by: string;
  /** Replies are simulated in this prototype — nobody receives them. */
  simulated?: boolean;
}

export interface Ticket {
  id: string;
  orgId: string;
  number: string;
  subject: string;
  description: string;
  contactId: string;
  accountId: string | null;
  ownerId: string | null;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  source: TicketSource;
  openedAt: string;
  firstResponseDueAt: string;
  firstRespondedAt?: string;
  resolutionDueAt: string;
  resolvedAt?: string;
  closedAt?: string;
  resolutionSummary?: string;
  rating?: { score: "good" | "poor"; comment?: string; at: string };
  entries: TicketEntry[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedAnswer {
  id: string;
  orgId: string;
  title: string;
  body: string;
  category?: string;
  createdBy: string;
  updatedAt: string;
}
