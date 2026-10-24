import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface BannerFact {
  label: string;
  value: ReactNode;
}

/**
 * Record header used by contact and account pages: tinted cover band, a 96 px
 * mark overlapping it, actions on the right, identity below, then a row of
 * key facts. `muted` greys the cover for inactive records.
 */
export function ProfileBanner({ media, actions, title, subtitle, facts, muted }: { media: ReactNode; actions?: ReactNode; title: ReactNode; subtitle?: ReactNode; facts: BannerFact[]; muted?: boolean }) {
  return (
    <header className="overflow-hidden rounded-2xl border border-border bg-card">
      <div
        aria-hidden
        className={cn("h-28 border-b border-border/70", muted ? "bg-secondary" : "bg-brand-50")}
        style={{ backgroundImage: "radial-gradient(var(--brand-200) 1px, transparent 1px)", backgroundSize: "16px 16px", backgroundPosition: "-8px -8px" }}
      />
      <div className="px-6 pb-5">
        <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          {media}
          {actions && <div className="flex flex-wrap items-center gap-2 sm:pb-1">{actions}</div>}
        </div>
        <div className="mt-4 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">{title}</div>
          {subtitle && <p className="text-[0.9375rem] text-muted-foreground">{subtitle}</p>}
        </div>
        <dl className={cn("mt-5 grid gap-x-8 gap-y-3 border-t border-border/70 pt-4 text-sm sm:grid-cols-2", facts.length >= 4 && "lg:grid-cols-4", facts.length === 3 && "lg:grid-cols-3")}>
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="mt-0.5 flex min-w-0 items-center gap-2 truncate">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
