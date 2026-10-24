import { CONSENT_STATUS_LABELS, type ConsentChannel, type ConsentPurpose, type ConsentRecord, type ConsentStatus } from "../types";

export const CONSENT_CHANNELS: ConsentChannel[] = ["sms", "whatsapp", "email", "phone"];
export const CONSENT_PURPOSES: ConsentPurpose[] = ["marketing", "service_updates"];

/** Latest record for a channel + purpose (history is never overwritten). */
export function latestConsent(records: ConsentRecord[], contactId: string, channel: ConsentChannel, purpose: ConsentPurpose): ConsentRecord | undefined {
  let latest: ConsentRecord | undefined;
  for (const r of records) {
    if (r.contactId !== contactId || r.channel !== channel || r.purpose !== purpose) continue;
    if (!latest || r.recordedAt > latest.recordedAt) latest = r;
  }
  return latest;
}

export function consentStatus(records: ConsentRecord[], contactId: string, channel: ConsentChannel, purpose: ConsentPurpose): ConsentStatus {
  return latestConsent(records, contactId, channel, purpose)?.decision ?? "unknown";
}

export type MessagePurpose = "marketing" | "operational";

/**
 * Prototype sending rule. Marketing messages require an explicit "agreed"
 * marketing record for that channel. Operational/transactional messages are
 * allowed unless the customer has refused or withdrawn service updates on
 * that channel. This is a product assumption — NOT legal advice and NOT a
 * claim of compliance with any specific regulation.
 */
export function messageAllowed(records: ConsentRecord[], contactId: string, channel: Exclude<ConsentChannel, "phone">, purpose: MessagePurpose): { allowed: boolean; reason: string } {
  if (purpose === "marketing") {
    const status = consentStatus(records, contactId, channel, "marketing");
    if (status === "agreed") return { allowed: true, reason: "Customer agreed to marketing on this channel." };
    if (status === "unknown") return { allowed: false, reason: "No marketing permission recorded for this channel. Ask the customer first." };
    return { allowed: false, reason: `Marketing on this channel is ${CONSENT_STATUS_LABELS[status].toLowerCase()}.` };
  }
  const status = consentStatus(records, contactId, channel, "service_updates");
  if (status === "declined" || status === "withdrawn") return { allowed: false, reason: `Service updates on this channel are ${CONSENT_STATUS_LABELS[status].toLowerCase()}.` };
  return { allowed: true, reason: "Operational message — not marketing." };
}
