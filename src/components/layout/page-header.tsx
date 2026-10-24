import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, onNavigate }: { items: Crumb[]; onNavigate?: (href: string) => boolean | void }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
            {c.href && i < items.length - 1 ? (
              <Link
                href={c.href}
                className="rounded-md px-1 -mx-1 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={(e) => {
                  if (onNavigate && onNavigate(c.href!) === false) e.preventDefault();
                }}
              >
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className={cn(i === items.length - 1 && "text-foreground")}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, description, actions, breadcrumbs, meta, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumbs?: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {breadcrumbs}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
          {description && <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">{description}</p>}
          {meta}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function PageContainer({ children, className, width = "wide" }: { children: ReactNode; className?: string; width?: "wide" | "narrow" | "full" }) {
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-7 px-4 pt-7 pb-12 sm:px-6 lg:px-10", width === "wide" && "max-w-[1360px]", width === "narrow" && "max-w-4xl", className)}>
      {children}
    </div>
  );
}
