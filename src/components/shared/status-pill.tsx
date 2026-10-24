import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PillTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "muted";

const TONES: Record<PillTone, string> = {
  neutral: "bg-secondary text-[#3b5560]",
  brand: "bg-brand-50 text-brand-800",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-destructive",
  info: "bg-info-soft text-info",
  muted: "bg-transparent text-muted-foreground ring-1 ring-inset ring-border",
};

export function StatusPill({ tone = "neutral", children, className, dot }: { tone?: PillTone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap", TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
