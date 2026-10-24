import { z } from "zod";
import { isPlausiblePhone, normalizeEmail, normalizePhone } from "@/lib/utils/normalize";
import type { Contact } from "../types";

const optionalText = (max = 120) => z.string().trim().max(max, `Keep this under ${max} characters.`);

export const contactMethodSchema = z.object({
  id: z.string(),
  kind: z.enum(["phone", "email", "whatsapp"]),
  value: z.string().trim(),
  label: z.enum(["mobile", "work", "home", "personal", "other"]),
  isPrimary: z.boolean(),
});

export const contactFormSchema = z
  .object({
    title: optionalText(20),
    firstName: optionalText(60),
    middleName: optionalText(60),
    lastName: optionalText(60),
    displayName: z.string().trim().min(1, "Display name is required.").max(120),
    methods: z.array(contactMethodSchema),
    accountId: z.string(),
    jobTitle: optionalText(80),
    ownerId: z.string(), // "" = unassigned
    gender: z.enum(["", "female", "male", "other", "undisclosed"]),
    dateOfBirth: z.string(),
    address: optionalText(200),
    city: optionalText(80),
    region: optionalText(80),
    country: optionalText(80),
    tags: z.array(z.string().trim().min(1)).max(20, "Up to 20 tags."),
    notes: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (!v.firstName && !v.lastName) {
      ctx.addIssue({ code: "custom", path: ["firstName"], message: "Enter a first name or a last name." });
    }
    const seen = new Map<string, number>();
    v.methods.forEach((m, i) => {
      if (!m.value) {
        ctx.addIssue({ code: "custom", path: ["methods", i, "value"], message: "Enter a value or remove this row." });
        return;
      }
      if (m.kind === "email") {
        if (!z.email().safeParse(m.value).success) ctx.addIssue({ code: "custom", path: ["methods", i, "value"], message: "Enter a valid email address, like name@company.com." });
      } else if (!isPlausiblePhone(m.value)) {
        ctx.addIssue({
          code: "custom",
          path: ["methods", i, "value"],
          message: "Enter a valid number. Ghanaian numbers can start with 0 (024 123 4567); other countries need their + code.",
        });
      }
      const key = `${m.kind}:${m.kind === "email" ? normalizeEmail(m.value) : normalizePhone(m.value)}`;
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["methods", i, "value"], message: "This value is already listed above." });
      else seen.set(key, i);
    });
    if (v.dateOfBirth) {
      const d = new Date(v.dateOfBirth);
      if (Number.isNaN(d.getTime())) ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Enter a valid date." });
      else if (d.getTime() > Date.now()) ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Date of birth can't be in the future." });
      else if (d.getFullYear() < 1900) ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Enter a year after 1900." });
    }
  });

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export function emptyContactForm(ownerId: string): ContactFormValues {
  return {
    title: "",
    firstName: "",
    middleName: "",
    lastName: "",
    displayName: "",
    methods: [],
    accountId: "",
    jobTitle: "",
    ownerId,
    gender: "",
    dateOfBirth: "",
    address: "",
    city: "",
    region: "",
    country: "Ghana",
    tags: [],
    notes: "",
  };
}

/**
 * Map a stored contact to form values. Every stored method is copied
 * verbatim — including its value — so the edit form can never show an empty
 * phone input for a number that the profile displays (defect seen in the
 * existing CRM). Covered by contact-form.test.ts.
 */
export function contactToForm(c: Contact): ContactFormValues {
  return {
    title: c.title ?? "",
    firstName: c.firstName ?? "",
    middleName: c.middleName ?? "",
    lastName: c.lastName ?? "",
    displayName: c.displayName,
    methods: c.methods.map((m) => ({ id: m.id, kind: m.kind, value: m.value, label: m.label, isPrimary: m.isPrimary })),
    accountId: c.accountId ?? "",
    jobTitle: c.jobTitle ?? "",
    ownerId: c.ownerId ?? "",
    gender: c.gender ?? "",
    dateOfBirth: c.dateOfBirth ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    region: c.region ?? "",
    country: c.country ?? "",
    tags: [...c.tags],
    notes: c.notes ?? "",
  };
}

/** Ensure exactly one primary per kind among the submitted methods. */
export function normalizePrimaries<T extends { kind: string; isPrimary: boolean }>(methods: T[]): T[] {
  const out = methods.map((m) => ({ ...m }));
  for (const kind of ["phone", "email", "whatsapp"]) {
    const ofKind = out.filter((m) => m.kind === kind);
    const primaries = ofKind.filter((m) => m.isPrimary);
    if (ofKind.length && primaries.length !== 1) {
      ofKind.forEach((m) => (m.isPrimary = false));
      (primaries[0] ?? ofKind[0]).isPrimary = true;
    }
  }
  return out;
}
