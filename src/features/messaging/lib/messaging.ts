/** Pure messaging rules: template variables, SMS cost, addresses and campaign eligibility. */
import { isPlausiblePhone } from "@/lib/utils/normalize";
import type { ConsentRecord, Contact } from "@/features/contacts/types";
import { consentStatus, messageAllowed } from "@/features/contacts/lib/consent";
import type { Channel, Communication, CommStatus, ExclusionReason } from "../types";

/* ---------------- Template variables ---------------- */

/** Only variables the CRM can actually fill from its own records. */
export const TEMPLATE_VARIABLES = [
  { key: "first_name", label: "Contact first name" },
  { key: "full_name", label: "Contact full name" },
  { key: "company", label: "Company name" },
  { key: "deal", label: "Deal name" },
] as const;
export type TemplateVar = (typeof TEMPLATE_VARIABLES)[number]["key"];

export interface TemplateContext {
  firstName?: string;
  fullName?: string;
  company?: string;
  deal?: string;
}

const VAR_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function templateVariables(body: string): string[] {
  return [...new Set([...body.matchAll(VAR_RE)].map((m) => m[1]))];
}

export function unknownVariables(body: string): string[] {
  const known = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));
  return templateVariables(body).filter((v) => !known.has(v));
}

/** Fills variables; returns the text plus which variables had no value for this person. */
export function renderTemplate(body: string, ctx: TemplateContext): { text: string; missing: TemplateVar[] } {
  const values: Record<TemplateVar, string | undefined> = { first_name: ctx.firstName, full_name: ctx.fullName, company: ctx.company, deal: ctx.deal };
  const missing = new Set<TemplateVar>();
  const text = body.replace(VAR_RE, (whole, key: string) => {
    if (!(key in values)) return whole;
    const v = values[key as TemplateVar];
    if (!v) {
      missing.add(key as TemplateVar);
      return "";
    }
    return v;
  });
  return { text: text.replace(/ {2,}/g, " ").replace(/ ([,.!?])/g, "$1"), missing: [...missing] };
}

/* ---------------- SMS cost ---------------- */

/** GSM-7 style parts: 160 chars, or 153 per part when split. Unicode is not modelled. */
export function smsParts(text: string): number {
  const n = text.length;
  if (n === 0) return 0;
  return n <= 160 ? 1 : Math.ceil(n / 153);
}

/** Prototype cost: SMS only, at the demo rate; other channels' costs are unknown (null). */
export function messageCost(channel: Channel, text: string, smsRate: number): number | null {
  return channel === "sms" ? Math.round(smsParts(text) * smsRate * 100) / 100 : null;
}

/* ---------------- Addresses ---------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function addressFor(contact: Contact, channel: Channel): string | null {
  const kind = channel === "email" ? "email" : channel === "whatsapp" ? "whatsapp" : "phone";
  const methods = contact.methods.filter((m) => m.kind === kind || (channel === "whatsapp" && m.kind === "phone"));
  const ordered = [...methods.filter((m) => m.isPrimary), ...methods.filter((m) => !m.isPrimary)];
  const usable = ordered.find((m) => (channel === "email" ? EMAIL_RE.test(m.value) : isPlausiblePhone(m.value)));
  return usable?.value ?? null;
}

/* ---------------- Campaign eligibility ---------------- */

export interface Eligibility {
  eligible: { contact: Contact; to: string }[];
  excluded: { contact: Contact; reason: ExclusionReason }[];
  byReason: Record<ExclusionReason, number>;
}

/**
 * Campaigns are marketing: a contact is eligible only with a usable address
 * for the channel AND an explicit "agreed" marketing record for it. Declined
 * or withdrawn = opted out; no record = no permission. Never "everyone in the segment".
 */
export function campaignEligibility(audience: Contact[], channel: "sms" | "email", consents: ConsentRecord[]): Eligibility {
  const out: Eligibility = { eligible: [], excluded: [], byReason: { no_address: 0, opted_out: 0, no_permission: 0 } };
  for (const c of audience) {
    const status = consentStatus(consents, c.id, channel, "marketing");
    let reason: ExclusionReason | null = null;
    if (status === "declined" || status === "withdrawn") reason = "opted_out";
    else if (!messageAllowed(consents, c.id, channel, "marketing").allowed) reason = "no_permission";
    const to = addressFor(c, channel);
    if (!reason && !to) reason = "no_address";
    if (reason) {
      out.excluded.push({ contact: c, reason });
      out.byReason[reason]++;
    } else out.eligible.push({ contact: c, to: to! });
  }
  return out;
}

/* ---------------- History filters ---------------- */

export interface CommFilters {
  search: string;
  /** Empty = every channel / status. */
  channels: Channel[];
  statuses: CommStatus[];
  kind: "all" | "one_to_one" | "campaign";
  from: string; // YYYY-MM-DD or ""
  to: string;
}

export const DEFAULT_COMM_FILTERS: CommFilters = { search: "", channels: [], statuses: [], kind: "all", from: "", to: "" };

export function filterComms(list: Communication[], f: CommFilters, nameOf: (contactId: string) => string): Communication[] {
  const q = f.search.trim().toLowerCase();
  return list
    .filter((m) => (!f.channels.length || f.channels.includes(m.channel)) && (!f.statuses.length || f.statuses.includes(m.status)) && (f.kind === "all" || m.kind === f.kind))
    .filter((m) => (!f.from || m.createdAt.slice(0, 10) >= f.from) && (!f.to || m.createdAt.slice(0, 10) <= f.to))
    .filter((m) => !q || [nameOf(m.contactId), m.to, m.subject, m.body].filter(Boolean).join(" ").toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function commSummary(list: Communication[]) {
  const costs = list.filter((m) => m.channel === "sms" && m.cost !== null);
  return {
    messages: list.length,
    delivered: list.filter((m) => m.status === "delivered").length,
    failed: list.filter((m) => m.status === "failed").length,
    /** null when no SMS cost is known — shown as "—". */
    smsCost: costs.length ? Math.round(costs.reduce((a, m) => a + (m.cost ?? 0), 0) * 100) / 100 : null,
  };
}
