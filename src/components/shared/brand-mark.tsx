import { cn } from "@/lib/utils";

/** CRM mark, redrawn from the existing CRM favicon. Provisional until official assets are supplied. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="64" height="64" rx="14" fill="var(--brand-600)" />
      <circle cx="24" cy="25" r="8" fill="var(--brand-50)" />
      <path d="M10 48c1.5-8 7-12 14-12s12.5 4 14 12" fill="var(--brand-50)" />
      <circle cx="43" cy="22" r="6" fill="var(--brand-200)" />
      <path d="M34 36c2-4 5.5-6 9-6 6 0 10 3.5 11 10" fill="none" stroke="var(--brand-200)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
