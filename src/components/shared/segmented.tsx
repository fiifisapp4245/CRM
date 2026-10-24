"use client";

import { cn } from "@/lib/utils";
import { tabListClass, tabTriggerActiveClass, tabTriggerClass } from "@/components/ui/tabs";

/**
 * Single-choice control in the shared tab style (see components/ui/tabs.tsx).
 * Use for views, categories and filters that switch what a list shows.
 */
export function Segmented<T extends string>({ options, value, onChange, label, className }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn(tabListClass, className)}>
      {options.map((o) => (
        <button key={o.value} role="tab" type="button" aria-selected={o.value === value} onClick={() => onChange(o.value)} className={cn(tabTriggerClass, o.value === value && tabTriggerActiveClass)}>
          {o.label}
          {o.count !== undefined && <span className="text-xs font-normal text-subtle-foreground tabular-nums">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
