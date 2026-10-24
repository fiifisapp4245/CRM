"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Sticky save bar shared by sales forms (same pattern as contact and account forms). */
export function FormFooter({ dirty, busy, onCancel, submitLabel, formId, disabled, extra, width = "max-w-4xl" }: { dirty: boolean; busy: boolean; onCancel: () => void; submitLabel: string; formId?: string; disabled?: boolean; extra?: ReactNode; width?: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur lg:left-[var(--sidebar-w,0)]">
      <div className={`mx-auto flex ${width} items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8`}>
        <p className="hidden text-sm text-muted-foreground sm:block" aria-live="polite">
          {dirty ? "You have unsaved changes." : ""}
        </p>
        <div className="ml-auto flex gap-2">
          {extra}
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={busy || disabled}>
            {busy && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
