/**
 * Subscription entitlements — ONE place that decides whether a plan includes a
 * feature. Separate from role permissions: a role says *who* may act, the plan
 * says *whether the organisation has the feature at all*. Pages, buttons and
 * services all call these functions; never compare plan names inline.
 *
 * Observed in the audited reference account (Basic): Messaging and Tickets are
 * marked Advance, Campaigns Premium; Tasks & Calls, Calendar and Documents
 * showed no plan label.
 */
export type Plan = "basic" | "advance" | "premium";
export const PLAN_ORDER: Plan[] = ["basic", "advance", "premium"];
export const PLAN_LABELS: Record<Plan, string> = { basic: "Basic", advance: "Advance", premium: "Premium" };

export type Feature = "activities" | "calendar" | "documents" | "messaging" | "tickets" | "campaigns";

export interface FeatureInfo {
  plan: Plan;
  name: string;
  /** Upgrade-dialog copy: what the feature does for the business. */
  value: string;
  points: string[];
}

export const FEATURES: Record<Feature, FeatureInfo> = {
  activities: { plan: "basic", name: "Tasks & calls", value: "", points: [] },
  calendar: { plan: "basic", name: "Calendar", value: "", points: [] },
  documents: { plan: "basic", name: "Documents", value: "", points: [] },
  messaging: {
    plan: "advance",
    name: "Messaging",
    value: "Send SMS, WhatsApp and email from the CRM and keep every message, its delivery status and its cost with the customer.",
    points: ["Message templates with each person's details filled in", "Delivery and cost tracking", "Respects each customer's message preferences"],
  },
  tickets: {
    plan: "advance",
    name: "Tickets",
    value: "Track complaints and requests from first contact to resolution, with an owner, a category and targets for replying and resolving.",
    points: ["Customer replies and internal notes in one place", "Categories, priorities and reply/resolve targets", "Saved answers for common questions"],
  },
  campaigns: {
    plan: "premium",
    name: "Email & SMS Campaigns",
    value: "Send one message to a whole segment — only to people who may receive it — in your business hours.",
    points: ["Audience from your segments", "Automatic consent and opt-out checks", "Scheduling within business hours"],
  },
};

export function planIncludes(plan: Plan, required: Plan): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(required);
}

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return planIncludes(plan, FEATURES[feature].plan);
}

export function upgradeMessage(feature: Feature): string {
  const f = FEATURES[feature];
  return `${f.name} requires the ${PLAN_LABELS[f.plan]} plan.`;
}
