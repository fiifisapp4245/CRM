import { z } from "zod";
import { isPlausiblePhone } from "@/lib/utils/normalize";
import type { Lead } from "../types";

export const leadFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the lead's name.").max(120),
    phone: z.string().trim(),
    email: z.string().trim(),
    city: z.string().trim().max(80),
    company: z.string().trim().max(120),
    jobTitle: z.string().trim().max(80),
    need: z.string().trim().max(500),
    estimatedValue: z.string().trim(),
    currency: z.enum(["GHS", "USD"]),
    source: z.enum(["walk_in", "referral", "website", "social_media", "whatsapp", "phone_call", "event", "advert", "import", "other"]),
    sourceDetail: z.string().trim().max(160),
    rating: z.enum(["", "hot", "warm", "cold"]),
    /** "" = unassigned, "auto" = assign automatically */
    ownerId: z.string(),
    notes: z.string().trim().max(2000),
  })
  .superRefine((v, ctx) => {
    if (v.email && !z.email().safeParse(v.email).success) ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address." });
    if (v.phone && !isPlausiblePhone(v.phone)) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid phone number, e.g. 024 123 4567." });
    if (v.estimatedValue && (Number.isNaN(Number(v.estimatedValue.replace(/,/g, ""))) || Number(v.estimatedValue.replace(/,/g, "")) < 0)) ctx.addIssue({ code: "custom", path: ["estimatedValue"], message: "Use a positive number, e.g. 25000." });
  });

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export function emptyLeadForm(ownerId: string): LeadFormValues {
  return { name: "", phone: "", email: "", city: "", company: "", jobTitle: "", need: "", estimatedValue: "", currency: "GHS", source: "walk_in", sourceDetail: "", rating: "", ownerId, notes: "" };
}

export function leadToForm(l: Lead): LeadFormValues {
  return {
    name: l.name, phone: l.phone ?? "", email: l.email ?? "", city: l.city ?? "", company: l.company ?? "", jobTitle: l.jobTitle ?? "", need: l.need ?? "",
    estimatedValue: l.estimatedValue?.toString() ?? "", currency: l.currency, source: l.source, sourceDetail: l.sourceDetail ?? "", rating: l.rating ?? "", ownerId: l.ownerId ?? "", notes: l.notes ?? "",
  };
}
