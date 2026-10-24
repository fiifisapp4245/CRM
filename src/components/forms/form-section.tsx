import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormSection({ title, description, children, aside, className }: { title: string; description?: ReactNode; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-sm", className)}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-1">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="px-6 pt-4 pb-6">{children}</div>
    </section>
  );
}

export function Field({ label, htmlFor, error, hint, children, className, optional }: { label: string; htmlFor?: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string; optional?: boolean }) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
