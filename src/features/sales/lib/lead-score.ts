import type { Lead } from "../types";

/**
 * PROTOTYPE lead score (0–100). The TroveSuite formula is not verified;
 * these rules are ours and are shown to users in full so the number is
 * never a black box.
 */
export interface ScoreFactor {
  label: string;
  points: number;
}

export function leadScore(lead: Pick<Lead, "rating" | "email" | "phone" | "estimatedValue" | "currency" | "source" | "status" | "company" | "need" | "lastInteractionAt">, now: number): { score: number; factors: ScoreFactor[] } {
  const f: ScoreFactor[] = [];
  if (lead.rating === "hot") f.push({ label: "Rated hot", points: 25 });
  else if (lead.rating === "warm") f.push({ label: "Rated warm", points: 12 });
  if (lead.phone) f.push({ label: "Has a phone number", points: 10 });
  if (lead.email) f.push({ label: "Has an email address", points: 8 });
  if (lead.company) f.push({ label: "Company known", points: 7 });
  if (lead.need) f.push({ label: "Need described", points: 5 });
  // Thresholds are per currency; amounts are never converted.
  const [high, mid] = lead.currency === "USD" ? [4_000, 800] : [50_000, 10_000];
  const v = lead.estimatedValue ?? 0;
  if (v >= high) f.push({ label: `Estimated value ≥ ${lead.currency} ${high.toLocaleString()}`, points: 20 });
  else if (v >= mid) f.push({ label: `Estimated value ≥ ${lead.currency} ${mid.toLocaleString()}`, points: 10 });
  if (lead.source === "referral") f.push({ label: "Referral", points: 10 });
  else if (lead.source === "walk_in" || lead.source === "phone_call" || lead.source === "whatsapp") f.push({ label: "Reached out directly", points: 6 });
  if (lead.status === "qualified") f.push({ label: "Qualified", points: 15 });
  else if (lead.status === "contacted") f.push({ label: "Contacted", points: 5 });
  if (lead.lastInteractionAt && now - Date.parse(lead.lastInteractionAt) > 21 * 86_400_000) f.push({ label: "No interaction for 3+ weeks", points: -10 });
  const score = Math.max(0, Math.min(100, f.reduce((a, b) => a + b.points, 0)));
  return { score, factors: f };
}
