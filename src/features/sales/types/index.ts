export type Currency = "GHS" | "USD";
export const CURRENCIES: Currency[] = ["GHS", "USD"];

/* ---------------- Leads ---------------- */

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "disqualified";
export type LeadSource = "walk_in" | "referral" | "website" | "social_media" | "whatsapp" | "phone_call" | "event" | "advert" | "import" | "other";
export type Rating = "hot" | "warm" | "cold";

export interface LeadEvent {
  id: string;
  kind: "status" | "note" | "call";
  at: string;
  by: string;
  status?: LeadStatus;
  text?: string;
}

export interface Lead {
  id: string;
  orgId: string;
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  company?: string;
  jobTitle?: string;
  need?: string;
  estimatedValue?: number;
  currency: Currency;
  source: LeadSource;
  sourceDetail?: string;
  rating?: Rating;
  ownerId: string | null;
  notes?: string;
  status: LeadStatus;
  disqualifyReason?: string;
  events: LeadEvent[];
  nextAction?: { label: string; dueAt: string };
  lastInteractionAt?: string;
  converted?: { at: string; by: string; contactId: string; accountId?: string; dealId?: string };
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  disqualified: "Disqualified",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  walk_in: "Walk-in",
  referral: "Referral",
  website: "Website",
  social_media: "Social media",
  whatsapp: "WhatsApp",
  phone_call: "Phone call",
  event: "Event",
  advert: "Advert",
  import: "Import",
  other: "Other",
};

export const RATING_LABELS: Record<Rating, string> = { hot: "Hot", warm: "Warm", cold: "Cold" };

/* ---------------- Pipeline & deals ---------------- */

export interface PipelineStage {
  id: string;
  name: string;
  /** Default chance of winning, 0–100. */
  probability: number;
  kind: "open" | "won" | "lost";
}

export interface Pipeline {
  id: string;
  orgId: string;
  name: string;
  stages: PipelineStage[];
}

export interface Tax {
  id: string;
  name: string;
  /** Percent, e.g. 2 for 2%. */
  rate: number;
}

export interface LineItem {
  id: string;
  productId: string | null;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  /** 0–100 */
  discountPct: number;
  taxId: string | null;
  /** Unit price already includes the tax. */
  taxInclusive: boolean;
}

export type DealStatus = "open" | "won" | "lost";

export interface Deal {
  id: string;
  orgId: string;
  title: string;
  pipelineId: string;
  stageId: string;
  contactId: string | null;
  accountId: string | null;
  leadId?: string;
  ownerId: string | null;
  currency: Currency;
  valuation: "manual" | "products";
  amount: number;
  lineItems: LineItem[];
  /** Explicit chance of winning; falls back to the stage default. */
  probability?: number;
  expectedClose: string; // YYYY-MM-DD
  status: DealStatus;
  closedAt?: string;
  wonReason?: string;
  lostReason?: string;
  closeNote?: string;
  notes?: string;
  stageChangedAt: string;
  lastActivityAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export const WON_REASONS = ["Best price", "Product quality", "Existing relationship", "Fast delivery", "Other"];
export const LOST_REASONS = ["Price too high", "Chose a competitor", "No budget", "Went quiet / no decision", "Timing not right", "Other"];

/* ---------------- Products ---------------- */

export interface Product {
  id: string;
  orgId: string;
  name: string;
  price: number;
  currency: Currency;
  taxId: string | null;
  /** Selling price already includes tax. */
  taxInclusive: boolean;
  soldPer: string;
  sku?: string;
  category?: string;
  description?: string;
  active: boolean;
  origin: "crm" | "mystoreguard";
  externalRef?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const SOLD_PER = ["each", "box", "pack", "set", "metre", "hour", "day", "month", "year", "trip"];

/* ---------------- Quotes ---------------- */

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired" | "paid";

export interface QuoteEvent {
  at: string;
  by: string; // user id or "customer"
  kind: "created" | "edited" | "sent" | "opened" | "accepted" | "declined" | "expired" | "paid";
  note?: string;
}

export interface Quote {
  id: string;
  orgId: string;
  number: string;
  dealId: string;
  customer: { name: string; company?: string; email?: string; phone?: string; address?: string };
  contactId: string | null;
  accountId: string | null;
  currency: Currency;
  issueDate: string;
  validUntil: string;
  /** Snapshot: later product price changes never alter a quote. */
  lineItems: LineItem[];
  notes?: string;
  terms?: string;
  status: QuoteStatus;
  sentTo?: string;
  sentAt?: string;
  openedAt?: string;
  decidedAt?: string;
  declineReason?: string;
  paidAt?: string;
  paymentRef?: string;
  history: QuoteEvent[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  paid: "Paid",
};

/* ---------------- Targets ---------------- */

export interface SalesTarget {
  id: string;
  orgId: string;
  month: string; // YYYY-MM
  currency: Currency;
  amount: number;
  /** null = whole team */
  ownerId: string | null;
}
