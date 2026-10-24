import { z } from "zod";
import { isPlausiblePhone } from "@/lib/utils/normalize";
import type { Account } from "../types";

const text = (max = 120) => z.string().trim().max(max, `Keep this under ${max} characters.`);
const address = z.object({ line1: text(160), city: text(80), region: text(80), country: text(80), postalCode: text(20) });

export const accountFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the account name.").max(160),
    type: z.enum(["customer", "prospect", "partner", "supplier", "reseller", "other"]),
    ownerId: z.string(),
    rating: z.enum(["", "hot", "warm", "cold"]),
    parentId: z.string(),
    phone: text(40),
    email: text(120),
    website: text(160),
    industry: text(80),
    ownership: z.enum(["", "private", "public", "government", "ngo", "other"]),
    employees: z.string().trim(),
    size: z.enum(["", "micro", "small", "medium", "large", "enterprise"]),
    annualRevenue: z.string().trim(),
    accountNumber: text(40),
    billingAddress: address,
    shippingSame: z.boolean(),
    shippingAddress: address,
    tags: z.array(z.string()).max(20),
    notes: text(2000),
  })
  .superRefine((v, ctx) => {
    if (v.email && !z.email().safeParse(v.email).success) ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address." });
    if (v.phone && !isPlausiblePhone(v.phone)) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid phone number, e.g. 030 255 0100 or +44 20 7946 0000." });
    if (v.website && !/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v.website)) ctx.addIssue({ code: "custom", path: ["website"], message: "Enter a web address like company.com." });
    if (v.employees && !/^\d+$/.test(v.employees.replace(/,/g, ""))) ctx.addIssue({ code: "custom", path: ["employees"], message: "Use a whole number." });
    if (v.annualRevenue && Number.isNaN(Number(v.annualRevenue.replace(/,/g, "")))) ctx.addIssue({ code: "custom", path: ["annualRevenue"], message: "Use a number, e.g. 1250000." });
  });

export type AccountFormValues = z.infer<typeof accountFormSchema>;

const emptyAddress = { line1: "", city: "", region: "", country: "", postalCode: "" };

export function emptyAccountForm(ownerId: string, parentId = ""): AccountFormValues {
  return {
    name: "", type: "customer", ownerId, rating: "", parentId, phone: "", email: "", website: "", industry: "", ownership: "",
    employees: "", size: "", annualRevenue: "", accountNumber: "", billingAddress: { ...emptyAddress, country: "Ghana" }, shippingSame: true,
    shippingAddress: { ...emptyAddress }, tags: [], notes: "",
  };
}

export function accountToForm(a: Account): AccountFormValues {
  const addr = (x?: Account["billingAddress"]) => ({ line1: x?.line1 ?? "", city: x?.city ?? "", region: x?.region ?? "", country: x?.country ?? "", postalCode: x?.postalCode ?? "" });
  return {
    name: a.name, type: a.type, ownerId: a.ownerId ?? "", rating: a.rating ?? "", parentId: a.parentId ?? "", phone: a.phone ?? "", email: a.email ?? "",
    website: a.website ?? "", industry: a.industry ?? "", ownership: a.ownership ?? "", employees: a.employees?.toString() ?? "", size: a.size ?? "",
    annualRevenue: a.annualRevenue?.toString() ?? "", accountNumber: a.accountNumber ?? "", billingAddress: addr(a.billingAddress),
    shippingSame: !a.shippingAddress, shippingAddress: addr(a.shippingAddress), tags: [...a.tags], notes: a.notes ?? "",
  };
}
