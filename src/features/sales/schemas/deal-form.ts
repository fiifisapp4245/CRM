import { z } from "zod";
import type { Deal } from "../types";

export const lineItemSchema = z.object({
  id: z.string(),
  productId: z.string().nullable(),
  name: z.string().trim().min(1, "Name the item."),
  description: z.string().optional(),
  quantity: z.number({ message: "Enter a quantity." }).gt(0, "Quantity must be more than 0."),
  unitPrice: z.number({ message: "Enter a price." }).min(0, "Price can't be negative."),
  discountPct: z.number({ message: "Enter a discount." }).min(0, "Discount can't be negative.").max(100, "Discount can't exceed 100%."),
  taxId: z.string().nullable(),
  taxInclusive: z.boolean(),
});

export const dealFormSchema = z
  .object({
    title: z.string().trim().min(1, "Give the deal a title.").max(160),
    pipelineId: z.string(),
    stageId: z.string().min(1),
    contactId: z.string(),
    accountId: z.string(),
    expectedClose: z.string().min(1, "Choose an expected close date."),
    probability: z.string(),
    ownerId: z.string(),
    valuation: z.enum(["manual", "products"]),
    currency: z.enum(["GHS", "USD"]),
    amount: z.string(),
    lineItems: z.array(lineItemSchema),
    notes: z.string().trim().max(2000),
  })
  .superRefine((v, ctx) => {
    if (v.valuation === "manual" && (v.amount === "" || Number.isNaN(Number(v.amount.replace(/,/g, ""))) || Number(v.amount.replace(/,/g, "")) < 0))
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter the deal value, e.g. 25000." });
    if (v.valuation === "products" && v.lineItems.length === 0) ctx.addIssue({ code: "custom", path: ["lineItems"], message: "Add at least one product or item." });
    if (v.probability !== "" && (Number.isNaN(Number(v.probability)) || Number(v.probability) < 0 || Number(v.probability) > 100))
      ctx.addIssue({ code: "custom", path: ["probability"], message: "Use a percentage from 0 to 100." });
  });

export type DealFormValues = z.infer<typeof dealFormSchema>;

export function dealToForm(d: Deal): DealFormValues {
  return {
    title: d.title, pipelineId: d.pipelineId, stageId: d.stageId, contactId: d.contactId ?? "", accountId: d.accountId ?? "", expectedClose: d.expectedClose,
    probability: d.probability?.toString() ?? "", ownerId: d.ownerId ?? "", valuation: d.valuation, currency: d.currency, amount: d.amount ? String(d.amount) : "",
    lineItems: d.lineItems.map((l) => ({ ...l })), notes: d.notes ?? "",
  };
}
