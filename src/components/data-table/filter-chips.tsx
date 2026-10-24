"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/** Visible, removable active filters plus optional trailing actions (reset, save view). */
export function FilterChips({ chips, children }: { chips: FilterChip[]; children?: ReactNode }) {
  if (!chips.length && !children) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-50 py-0.5 pr-1 pl-3 text-xs font-medium text-brand-800">
          {c.label}
          <button type="button" onClick={c.onRemove} className="rounded p-1 text-brand-700 hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`Remove filter ${c.label}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      {children}
      <span className="sr-only" aria-live="polite">
        {chips.length === 1 ? "1 filter active" : `${chips.length} filters active`}
      </span>
    </div>
  );
}
