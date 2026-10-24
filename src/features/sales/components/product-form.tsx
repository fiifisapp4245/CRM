"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { formatRelative } from "@/lib/utils/format";
import { hasPermission } from "@/lib/permissions";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { useBeforeUnload } from "@/components/forms/use-unsaved-changes";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { InlineNotice } from "@/components/feedback/states";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSales } from "../hooks/use-sales";
import { customerPrice, formatAmount } from "../lib/calc";
import { createProduct, setProductActive, updateProduct } from "../services/products-service";
import { SOLD_PER, type Currency, type Product } from "../types";
import { FormFooter } from "./form-footer";

const NO_TAX = "__none";

/** Full-page product form (create and edit), laid out like the deal form. */
export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const { db, user, taxes, now } = useSales();
  const canManage = hasPermission(user, "products.manage");
  const locked = product?.origin === "mystoreguard";
  const readOnly = !canManage || locked;
  const initial = useMemo(
    () => ({
      name: product?.name ?? "",
      priceText: product ? String(product.price) : "",
      currency: (product?.currency ?? "GHS") as Currency,
      taxId: product ? product.taxId : (taxes[0]?.id ?? null),
      taxInclusive: product?.taxInclusive ?? false,
      soldPer: product?.soldPer ?? "each",
      sku: product?.sku ?? "",
      category: product?.category ?? "",
      description: product?.description ?? "",
      active: product?.active ?? true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product?.id],
  );
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  useBeforeUnload(dirty && !saved);
  const set = (p: Partial<typeof v>) => setV((s) => ({ ...s, ...p }));
  const price = Number(v.priceText.replace(/,/g, ""));
  const priceOk = v.priceText.trim() !== "" && Number.isFinite(price);
  const openDeals = product ? db.deals.filter((d) => d.status === "open" && d.lineItems.some((li) => li.productId === product.id)).length : 0;
  const current = product ? (db.products.find((p) => p.id === product.id) ?? product) : undefined;
  const cancelHref = "/products";
  const guarded = (href: string) => {
    if (dirty && !saved) {
      setLeaveTo(href);
      return false;
    }
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const input = { ...v, price: priceOk ? price : NaN, sku: v.sku, category: v.category, description: v.description };
    const r = product ? await updateProduct(product.id, input) : await createProduct(input);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return toast.error("Some details need attention");
    }
    setSaved(true);
    toast.success(product ? "Product saved" : `“${r.data.name}” added`, { description: r.data.active ? "Available on deals and quotes." : "Switched off — not offered on new deals or quotes." });
    router.push("/products");
  };

  const toggle = async (active: boolean) => {
    if (!product) return set({ active });
    const r = await setProductActive(product.id, active);
    if (r.ok) toast.success(active ? "Product switched on" : "Product switched off");
    else toast.error(r.error);
  };

  return (
    <PageContainer width="narrow" className="pb-28">
      <PageHeader
        breadcrumbs={<Breadcrumbs onNavigate={guarded} items={[{ label: "Products", href: "/products" }, { label: product ? product.name : "New product" }]} />}
        title={product ? (readOnly ? product.name : `Edit ${product.name}`) : "New product"}
        description={product ? (openDeals ? `Used in ${openDeals} open deal${openDeals === 1 ? "" : "s"}. Changing the price doesn't change deals or quotes already priced.` : undefined) : "Something you sell. It becomes available on deals and quotes. Only the name and price are required."}
      />
      {locked && (
        <InlineNotice tone="info" icon={Lock}>
          Managed in MyStoreGuard{product?.externalRef ? ` (${product.externalRef})` : ""}. Name, price, tax and SKU change there; you can switch it on or off and add a category or description here.
          {product?.lastSyncedAt && ` Last checked ${formatRelative(product.lastSyncedAt, now)}.`}
        </InlineNotice>
      )}
      <form id="product-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <FormSection title="Product">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="p-name" className="sm:col-span-2">
              <Input id="p-name" autoFocus={!product} value={v.name} onChange={(e) => set({ name: e.target.value })} disabled={readOnly} placeholder="e.g. Ergonomic office chair" />
            </Field>
            <Field label="SKU" htmlFor="p-sku" optional hint="Must be unique.">
              <Input id="p-sku" value={v.sku} onChange={(e) => set({ sku: e.target.value })} disabled={readOnly} />
            </Field>
            <Field label="Category" htmlFor="p-cat" optional>
              <Input id="p-cat" value={v.category} onChange={(e) => set({ category: e.target.value })} disabled={!canManage} placeholder="e.g. Seating" />
            </Field>
            <Field label="Description" htmlFor="p-desc" optional hint="Shown on quotes under the product name." className="sm:col-span-2">
              <Textarea id="p-desc" rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} disabled={!canManage} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Price and tax" description="What you charge, per unit you sell it in.">
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Price" htmlFor="p-price" className="sm:col-span-3">
              <Input id="p-price" inputMode="decimal" value={v.priceText} onChange={(e) => set({ priceText: e.target.value })} disabled={readOnly} aria-invalid={(!!v.priceText && !priceOk) || undefined} />
            </Field>
            <Field label="Currency" htmlFor="p-cur" className="sm:col-span-1" hint={product && openDeals ? "Fixed while it's on open deals." : undefined}>
              <Select value={v.currency} onValueChange={(c) => set({ currency: c as Currency })} disabled={readOnly || (!!product && openDeals > 0)}>
                <SelectTrigger id="p-cur"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GHS">GHS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sold per" htmlFor="p-per" className="sm:col-span-2">
              <Select value={v.soldPer} onValueChange={(soldPer) => set({ soldPer })} disabled={readOnly}>
                <SelectTrigger id="p-per"><SelectValue /></SelectTrigger>
                <SelectContent>{SOLD_PER.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Tax" htmlFor="p-tax" className="sm:col-span-3">
              <Select value={v.taxId ?? NO_TAX} onValueChange={(t) => set({ taxId: t === NO_TAX ? null : t, taxInclusive: t === NO_TAX ? false : v.taxInclusive })} disabled={readOnly}>
                <SelectTrigger id="p-tax"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TAX}>No tax</SelectItem>
                  {taxes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} {t.rate}%</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end sm:col-span-3">
              {v.taxId && (
                <div className="flex items-start gap-2 pb-2">
                  <Checkbox id="p-incl" checked={v.taxInclusive} onCheckedChange={(c) => set({ taxInclusive: c === true })} disabled={readOnly} />
                  <Label htmlFor="p-incl" className="font-normal">Price already includes tax</Label>
                </div>
              )}
            </div>
          </div>
          {priceOk && (
            <p className="mt-4 rounded-xl bg-secondary/60 px-4 py-3 text-sm">
              Customer pays <span className="font-semibold tabular-nums">{formatAmount(customerPrice(price, v.taxId, v.taxInclusive, taxes), v.currency)}</span> per {v.soldPer}
              {v.taxId && <span className="text-muted-foreground"> ({v.taxInclusive ? "tax included" : "tax added"})</span>}
            </p>
          )}
        </FormSection>

        <FormSection title="Availability">
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">On sale</span>
              <span className="block text-sm text-muted-foreground">Switched-off products stay on existing deals and quotes but can&apos;t be added to new ones.</span>
            </span>
            <Switch checked={product ? (current?.active ?? true) : v.active} onCheckedChange={toggle} disabled={!canManage} aria-label="On sale" />
          </label>
        </FormSection>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      </form>
      {canManage && <FormFooter dirty={dirty} busy={busy} onCancel={() => guarded(cancelHref) && router.push(cancelHref)} submitLabel={product ? "Save changes" : "Add product"} formId="product-form" disabled={!!product && !dirty} />}
      <ConfirmDialog
        open={!!leaveTo}
        onOpenChange={(o) => !o && setLeaveTo(null)}
        title="Discard unsaved changes?"
        description="Your changes to this product haven't been saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setSaved(true);
          router.push(leaveTo!);
        }}
      />
    </PageContainer>
  );
}
