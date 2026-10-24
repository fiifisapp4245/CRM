"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, PackagePlus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createId } from "@/lib/utils/id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatAmount, lineResult, lineTotals } from "../lib/calc";
import type { Currency, LineItem, Product, Tax } from "../types";

const NO_TAX = "__none";
const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));
const shown = (n: number) => (Number.isFinite(n) ? String(n) : "");

function ProductPicker({ products, value, onPick, onCustom, label }: { products: Product[]; value: string | null; onPick: (p: Product) => void; onCustom: () => void; label: string }) {
  const [open, setOpen] = useState(false);
  const current = products.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-label={label} className="w-full justify-between font-normal">
          <span className={cn("truncate", !current && "text-muted-foreground")}>{current ? current.name : value === null ? "Custom item" : "Choose product"}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search products or SKU…" />
          <CommandList>
            <CommandEmpty>No active products in this currency.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="custom item" onSelect={() => (onCustom(), setOpen(false))}>
                <PackagePlus className="text-muted-foreground" /> Custom item
              </CommandItem>
              {products.map((p) => (
                <CommandItem key={p.id} value={`${p.name} ${p.sku ?? ""}`} onSelect={() => (onPick(p), setOpen(false))}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatAmount(p.price, p.currency)} per {p.soldPer}
                      {p.sku ? ` · ${p.sku}` : ""}
                    </span>
                  </span>
                  <Check className={cn(value === p.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Shared deal/quote line-item editor. Products set the name, price and tax;
 * the price can be overridden per line (the catalogue price is shown).
 * Totals use the same calc module as the rest of the CRM.
 */
export function LineItemEditor({ items, onChange, currency, products, taxes, error }: { items: LineItem[]; onChange: (items: LineItem[]) => void; currency: Currency; products: Product[]; taxes: Tax[]; error?: string }) {
  const usable = products.filter((p) => p.active && p.currency === currency);
  const set = (id: string, patch: Partial<LineItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const add = () => onChange([...items, { id: createId("li"), productId: "", name: "", quantity: 1, unitPrice: 0, discountPct: 0, taxId: null, taxInclusive: false } as unknown as LineItem]);
  const totals = lineTotals(items, taxes);
  const otherCurrency = products.some((p) => p.active && p.currency !== currency);

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="rounded-xl border border-dashed border-border-strong px-4 py-5 text-center text-sm text-muted-foreground">No items yet. Add a product from the catalogue or a custom item.</p>}
      <ol className="space-y-3">
        {items.map((it, idx) => {
          const r = lineResult(it, taxes);
          const product = it.productId ? products.find((p) => p.id === it.productId) : undefined;
          const overridden = product && product.price !== it.unitPrice;
          return (
            <li key={it.id} className="rounded-xl border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <ProductPicker
                    label={`Product for line ${idx + 1}`}
                    products={usable}
                    value={it.productId}
                    onPick={(p) => set(it.id, { productId: p.id, name: p.name, description: p.description, unitPrice: p.price, taxId: p.taxId, taxInclusive: p.taxInclusive })}
                    onCustom={() => set(it.id, { productId: null, name: it.productId ? "" : it.name })}
                  />
                </div>
                <div className="sm:col-span-8">
                  <Input aria-label={`Item name, line ${idx + 1}`} value={it.name} onChange={(e) => set(it.id, { name: e.target.value })} placeholder="Item name" aria-invalid={!it.name.trim() && !!error} readOnly={!!it.productId} className={cn(it.productId && "bg-secondary/50")} />
                </div>
                <div className="sm:col-span-12">
                  <Input aria-label={`Description, line ${idx + 1}`} value={it.description ?? ""} onChange={(e) => set(it.id, { description: e.target.value })} placeholder="Description (optional)" />
                </div>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Qty</span>
                  <Input type="number" min={0} step="any" value={shown(it.quantity)} onChange={(e) => set(it.id, { quantity: num(e.target.value) })} aria-invalid={!(it.quantity > 0)} />
                </label>
                <label className="space-y-1 sm:col-span-3">
                  <span className="text-xs text-muted-foreground">Unit price ({currency})</span>
                  <Input type="number" min={0} step="0.01" value={shown(it.unitPrice)} onChange={(e) => set(it.id, { unitPrice: num(e.target.value) })} aria-invalid={!(it.unitPrice >= 0)} />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Discount %</span>
                  <Input type="number" min={0} max={100} step="0.5" value={shown(it.discountPct)} onChange={(e) => set(it.id, { discountPct: num(e.target.value) })} aria-invalid={!(it.discountPct >= 0 && it.discountPct <= 100)} />
                </label>
                <label className="space-y-1 sm:col-span-3">
                  <span className="text-xs text-muted-foreground">Tax</span>
                  <Select value={it.taxId ?? NO_TAX} onValueChange={(v) => set(it.id, { taxId: v === NO_TAX ? null : v, taxInclusive: v === NO_TAX ? false : it.taxInclusive })}>
                    <SelectTrigger className="w-full" aria-label={`Tax, line ${idx + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TAX}>No tax</SelectItem>
                      {taxes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} {t.rate}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <div className="flex items-end justify-end gap-1 sm:col-span-2">
                  <div className="text-right">
                    <span className="block text-xs text-muted-foreground">Line total</span>
                    <span className="text-sm font-medium tabular-nums">{formatAmount(r.total, currency)}</span>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(items.filter((x) => x.id !== it.id))} aria-label={`Remove line ${idx + 1}`}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <label className="flex items-center gap-2">
                  <Checkbox checked={it.taxInclusive} disabled={!it.taxId} onCheckedChange={(v) => set(it.id, { taxInclusive: !!v })} aria-label={`Price includes tax, line ${idx + 1}`} />
                  Price includes tax
                </label>
                {overridden && <span>Catalogue price {formatAmount(product!.price, product!.currency)} — overridden for this deal</span>}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus /> Add item
        </Button>
        {otherCurrency && <span className="text-xs text-muted-foreground">Only {currency} products are listed. Change the deal currency to use others.</span>}
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <TotalsSummary totals={totals} currency={currency} />
    </div>
  );
}

export function TotalsSummary({ totals, currency }: { totals: ReturnType<typeof lineTotals>; currency: Currency }) {
  return (
    <dl className="ml-auto w-full max-w-xs space-y-1.5 rounded-xl bg-secondary/60 p-4 text-sm">
      <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatAmount(totals.subtotal, currency)}</dd></div>
      {totals.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{formatAmount(totals.discount, currency)}</dd></div>}
      {totals.taxByName.map((t) => (
        <div key={t.name} className="flex justify-between"><dt className="text-muted-foreground">{t.name}</dt><dd className="tabular-nums">{formatAmount(t.amount, currency)}</dd></div>
      ))}
      <div className="flex justify-between border-t border-border pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatAmount(totals.total, currency)}</dd></div>
    </dl>
  );
}
