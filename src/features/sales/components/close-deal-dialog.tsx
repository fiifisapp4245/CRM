"use client";

import { useState } from "react";
import { Loader2, ThumbsDown, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDbStore } from "@/lib/mock-data/db-store";
import { dealValue, formatAmount } from "../lib/calc";
import { closeDeal } from "../services/deals-service";
import { LOST_REASONS, WON_REASONS, type Deal } from "../types";

/**
 * Explicit Won / Lost workflow — a deal never closes as a side effect of a
 * drag or a quote. Prototype assumption: a loss reason is required, a win
 * reason is optional.
 */
export function CloseDealDialog({ deal, outcome, onOpenChange, onDone }: { deal: Deal | null; outcome: "won" | "lost"; onOpenChange: (o: boolean) => void; onDone?: (d: Deal) => void }) {
  return (
    <Dialog open={!!deal} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{deal && <Body deal={deal} outcome={outcome} onClose={() => onOpenChange(false)} onDone={onDone} />}</DialogContent>
    </Dialog>
  );
}

function Body({ deal, outcome, onClose, onDone }: { deal: Deal; outcome: "won" | "lost"; onClose: () => void; onDone?: (d: Deal) => void }) {
  const taxes = useDbStore((s) => s.db.taxes);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [closedOn, setClosedOn] = useState(today);
  const [finalValue, setFinalValue] = useState(String(dealValue(deal, taxes)));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const reasons = outcome === "won" ? WON_REASONS : LOST_REASONS;
  const fv = Number(finalValue.replace(/,/g, ""));
  const invalid = !closedOn || closedOn > today || (outcome === "lost" && !reason) || (outcome === "won" && deal.valuation === "manual" && (Number.isNaN(fv) || fv < 0));

  const submit = async () => {
    setBusy(true);
    const r = await closeDeal(deal.id, { outcome, closedOn, reason, note, finalValue: deal.valuation === "manual" ? fv : undefined });
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(outcome === "won" ? `“${deal.title}” won` : `“${deal.title}” marked lost`, { description: "It has left the open pipeline and the forecast is updated." });
    onClose();
    onDone?.(r.data);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {outcome === "won" ? <Trophy className="size-5 text-success" /> : <ThumbsDown className="size-5 text-muted-foreground" />}
          Mark “{deal.title}” as {outcome}
        </DialogTitle>
        <DialogDescription>This closes the deal and records the outcome in its history. You can reopen it later if needed.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="close-date">Closing date</Label>
            <Input id="close-date" type="date" max={today} value={closedOn} onChange={(e) => setClosedOn(e.target.value)} aria-invalid={!closedOn || closedOn > today} />
          </div>
          {outcome === "won" && (
            <div className="space-y-1.5">
              <Label htmlFor="final-value">Final value ({deal.currency})</Label>
              {deal.valuation === "manual" ? (
                <Input id="final-value" inputMode="decimal" value={finalValue} onChange={(e) => setFinalValue(e.target.value)} aria-invalid={Number.isNaN(fv) || fv < 0} />
              ) : (
                <p id="final-value" className="flex h-9 items-center text-sm font-medium tabular-nums">
                  {formatAmount(dealValue(deal, taxes), deal.currency)} <span className="ml-2 text-xs font-normal text-muted-foreground">from products</span>
                </p>
              )}
            </div>
          )}
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            {outcome === "won" ? "Why did we win?" : "Why was it lost?"} {outcome === "won" && <span className="font-normal text-muted-foreground">(optional)</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(reason === r ? "" : r)} className={cn("h-8 cursor-pointer rounded-md border px-3 text-sm", reason === r ? "border-brand-700 bg-brand-50 text-brand-800" : "border-border hover:bg-secondary")}>
                {r}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="close-note">Details <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea id="close-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={outcome === "lost" ? "e.g. which competitor, what price" : "e.g. what made the difference"} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={invalid || busy} className={outcome === "lost" ? "bg-foreground hover:bg-foreground/90" : undefined}>
          {busy && <Loader2 className="animate-spin" />} Mark {outcome}
        </Button>
      </DialogFooter>
    </>
  );
}
