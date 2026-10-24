/**
 * Prototype-only shapes for records owned by modules that have NOT been
 * audited yet (Deals/Pipeline, Tickets, Documents, Messaging, Accounts).
 * They exist so the contact workspace can show relationships. Replace with
 * each module's real types when that module is implemented.
 */

/** Minimal account shape other modules depend on. Full model: features/accounts/types. */
export interface AccountRef {
  id: string;
  orgId: string;
  name: string;
  industry?: string;
}

export interface TicketRef {
  id: string;
  contactId: string;
  subject: string;
  status: "Open" | "Pending" | "Resolved";
  priority: "Low" | "Normal" | "High";
  updatedAt: string;
}

export interface DocumentRef {
  id: string;
  contactId: string;
  name: string;
  kind: "pdf" | "image" | "sheet" | "doc";
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}
