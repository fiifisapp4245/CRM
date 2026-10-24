import type { ReactNode } from "react";
import { AlertTriangle, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function EmptyState({ icon: Icon, title, description, action, className, compact }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-14", className)}>
      {Icon && (
        <span className={cn("flex items-center justify-center rounded-full bg-brand-50 text-brand-700", compact ? "size-10" : "size-12")}>
          <Icon className={compact ? "size-4" : "size-5"} />
        </span>
      )}
      <div className="max-w-sm space-y-1">
        <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>{title}</p>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, action }: { title?: string; description?: ReactNode; action?: ReactNode }) {
  return <EmptyState icon={AlertTriangle} title={title} description={description} action={action} />;
}

export function PermissionNotice({ title = "You don't have access to this", description = "Your role doesn't include this capability. Switch role from the profile menu to explore other permissions.", action }: { title?: string; description?: ReactNode; action?: ReactNode }) {
  return <EmptyState icon={Lock} title={title} description={description} action={action} />;
}

export function InlineNotice({ tone = "info", icon: Icon, children, className }: { tone?: "info" | "warning" | "danger" | "success" | "neutral"; icon?: LucideIcon; children: ReactNode; className?: string }) {
  const tones = {
    info: "bg-info-soft text-[#1f4a9e] border-transparent",
    warning: "bg-warning-soft text-[#7a4206] border-transparent",
    danger: "bg-danger-soft text-[#9b2229] border-transparent",
    success: "bg-success-soft text-[#145f38] border-transparent",
    neutral: "bg-card text-muted-foreground border-border shadow-xs",
  } as const;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
