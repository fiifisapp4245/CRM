/** Products mock service. MyStoreGuard sync is SIMULATED — no API call is made. */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { hasPermission } from "@/lib/permissions";
import type { Result } from "@/lib/types";
import { getCurrentUser } from "@/features/permissions";
import type { Product } from "../types";
import { auditEvent } from "./helpers";

export interface ProductInput {
  name: string;
  price: number;
  currency: Product["currency"];
  taxId: string | null;
  taxInclusive: boolean;
  soldPer: string;
  sku?: string;
  category?: string;
  description?: string;
  active: boolean;
}

function check(input: ProductInput, id?: string): string | null {
  if (!input.name.trim()) return "Enter the product name.";
  if (!Number.isFinite(input.price) || input.price < 0) return "Enter a valid price.";
  const db = getDb();
  if (input.sku && db.products.some((p) => p.id !== id && p.sku?.toLowerCase() === input.sku!.trim().toLowerCase())) return `SKU ${input.sku} is already used by another product.`;
  if (input.taxId && !db.taxes.some((t) => t.id === input.taxId)) return "Choose a configured tax.";
  return null;
}

export async function createProduct(input: ProductInput): Promise<Result<Product>> {
  await latency();
  const actor = getCurrentUser();
  if (!hasPermission(actor, "products.manage")) return forbidden("Your role can't manage products.");
  const err = check(input);
  if (err) return invalid(err);
  const now = nowIso();
  const db = getDb();
  const p: Product = { ...input, name: input.name.trim(), sku: input.sku?.trim() || undefined, id: newId("prd"), orgId: actor.orgId, origin: "crm", createdAt: now, updatedAt: now };
  commitDb({ ...db, products: [p, ...db.products], audit: [...db.audit, auditEvent(actor.orgId, "product", p.id, "created", actor.id, p.name)] });
  return ok(p);
}

/**
 * Ownership policy (prototype): MyStoreGuard is the source of truth for the
 * products it syncs. In the CRM you may only switch them on or off; name,
 * price, tax and SKU change in MyStoreGuard.
 */
export async function updateProduct(id: string, input: ProductInput): Promise<Result<Product>> {
  await latency();
  const actor = getCurrentUser();
  if (!hasPermission(actor, "products.manage")) return forbidden("Your role can't manage products.");
  const db = getDb();
  const before = db.products.find((p) => p.id === id && p.orgId === actor.orgId);
  if (!before) return notFound();
  if (before.origin === "mystoreguard") {
    const changedLocked = before.name !== input.name || before.price !== input.price || before.taxId !== input.taxId || (before.sku ?? "") !== (input.sku ?? "") || before.currency !== input.currency;
    if (changedLocked) return forbidden("This product is managed in MyStoreGuard. Change its name, price, tax or SKU there.");
  }
  const err = check(input, id);
  if (err) return invalid(err);
  const after: Product = { ...before, ...input, name: input.name.trim(), sku: input.sku?.trim() || undefined, updatedAt: nowIso() };
  const changes = before.price !== after.price ? [{ field: "Price", from: String(before.price), to: String(after.price) }] : undefined;
  commitDb({ ...db, products: db.products.map((p) => (p.id === id ? after : p)), audit: [...db.audit, auditEvent(actor.orgId, "product", id, "updated", actor.id, after.name, changes)] });
  return ok(after);
}

export async function setProductActive(id: string, active: boolean): Promise<Result<Product>> {
  const db = getDb();
  const p = db.products.find((x) => x.id === id);
  if (!p) return notFound();
  return updateProduct(id, { ...p, active, sku: p.sku, category: p.category, description: p.description });
}

/** Simulated sync: refreshes the "last synced" time only. */
export async function simulateCatalogueSync(): Promise<Result<{ count: number; at: string }>> {
  await latency(700);
  const actor = getCurrentUser();
  if (!hasPermission(actor, "products.manage")) return forbidden("Your role can't sync the catalogue.");
  const db = getDb();
  const at = nowIso();
  const products = db.products.map((p) => (p.origin === "mystoreguard" && p.orgId === actor.orgId ? { ...p, lastSyncedAt: at } : p));
  commitDb({ ...db, products });
  return ok({ count: products.filter((p) => p.origin === "mystoreguard").length, at });
}
