"use client";

import { useState, type ReactNode } from "react";
import { Check, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { FEATURES, PLAN_LABELS, type Feature, type Plan } from "@/lib/entitlements";
import { useEntitlement } from "@/features/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PlanBadge({ plan, className }: { plan: Plan; className?: string }) {
  if (plan === "basic") return null;
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-md bg-violet-50 px-1.5 text-[11px] font-medium text-violet-800", className)}>
      <Sparkles className="size-3" /> {PLAN_LABELS[plan]}
    </span>
  );
}

/** The one upgrade explanation used by every restricted action. */
export function UpgradeDialog({ feature, open, onOpenChange }: { feature: Feature; open: boolean; onOpenChange: (o: boolean) => void }) {
  const f = FEATURES[feature];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-800">
            <Lock className="size-5" />
          </span>
          <DialogTitle>
            {f.name} requires {PLAN_LABELS[f.plan]}
          </DialogTitle>
          <DialogDescription>{f.value}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5 text-sm">
          {f.points.map((p) => (
            <li key={p} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" /> {p}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Upgrading is handled in TroveSuite billing, which this prototype doesn&apos;t include.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast.info(`Upgrade to ${PLAN_LABELS[f.plan]}`, { description: "Billing isn't part of this prototype — nothing was changed." });
            }}
          >
            Upgrade to {PLAN_LABELS[f.plan]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Wraps restricted actions: when the plan includes the feature, `guard(fn)`
 * runs fn; otherwise it opens the upgrade dialog. Render `dialog` once.
 */
export function useFeatureGate(feature: Feature) {
  const ent = useEntitlement(feature);
  const [open, setOpen] = useState(false);
  return {
    ...ent,
    guard:
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        if (ent.allowed) fn(...args);
        else setOpen(true);
      },
    dialog: <UpgradeDialog feature={feature} open={open} onOpenChange={setOpen} />,
  };
}

/** Banner for read-only plan states (shown only when the organisation's plan lacks the feature). */
export function PlanNotice({ feature, children }: { feature: Feature; children?: ReactNode }) {
  const { allowed, required } = useEntitlement(feature);
  const [open, setOpen] = useState(false);
  if (allowed) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-2 text-violet-950">
        <Lock className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-medium">Read-only on Basic.</span> {children ?? `${FEATURES[feature].name} requires the ${PLAN_LABELS[required]} plan to create or change anything.`}
        </span>
      </span>
      <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpen(true)}>
        See {PLAN_LABELS[required]}
      </Button>
      <UpgradeDialog feature={feature} open={open} onOpenChange={setOpen} />
    </div>
  );
}
