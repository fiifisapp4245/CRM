"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDb } from "../hooks/use-contacts";
import { consentStatus } from "../lib/consent";
import { recordConsent } from "../services/contacts-service";
import {
  CONSENT_CHANNEL_LABELS,
  CONSENT_METHOD_LABELS,
  CONSENT_METHODS_BY_DECISION,
  CONSENT_PURPOSE_LABELS,
  CONSENT_STATUS_LABELS,
  type ConsentChannel,
  type ConsentDecision,
  type ConsentMethod,
  type ConsentPurpose,
} from "../types";
import { ConsentBadge } from "./contact-badges";

function Choice<T extends string>({ name, legend, options, value, onChange, labels, describe }: { name: string; legend: string; options: T[]; value: T | ""; onChange: (v: T) => void; labels: Record<T, string>; describe?: (v: T) => string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {options.map((o) => (
          <label
            key={o}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
              value === o ? "border-brand-700 bg-brand-50 text-brand-900" : "bg-card hover:bg-muted",
            )}
          >
            <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} className="sr-only" />
            <span>{labels[o]}</span>
            {describe && <span className="text-xs text-muted-foreground">{describe(o)}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactId: string;
  contactName: string;
  initialChannel?: ConsentChannel;
  initialPurpose?: ConsentPurpose;
}

/**
 * Dedicated, auditable workflow for communication preferences. Nothing is
 * preselected for the decision — the user must record what the customer said.
 */
export function RecordConsentDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <RecordConsentBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function RecordConsentBody({ onOpenChange, contactId, contactName, initialChannel, initialPurpose = "marketing" }: Props) {
  const db = useDb();
  const [channel, setChannel] = useState<ConsentChannel | "">(initialChannel ?? "");
  const [purpose, setPurpose] = useState<ConsentPurpose>(initialPurpose);
  const [decision, setDecision] = useState<ConsentDecision | "">("");
  const [method, setMethod] = useState<ConsentMethod | "">("");
  const [note, setNote] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Methods depend on the decision (e.g. "Replied STOP" only for a withdrawal), so changing it clears an incompatible method.
  const chooseDecision = (d: ConsentDecision) => {
    setDecision(d);
    if (method && !CONSENT_METHODS_BY_DECISION[d].includes(method)) setMethod("");
  };

  const current = channel ? consentStatus(db.consents, contactId, channel, purpose) : null;

  const submit = async () => {
    if (!channel || !decision || !method) {
      setError("Choose the channel, what the customer decided, and how they told you.");
      return;
    }
    setBusy(true);
    const res = await recordConsent({ contactId, channel, purpose, decision, method, note: note.trim(), evidenceRef: evidenceRef.trim() });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success("Preference recorded", { description: `${CONSENT_CHANNEL_LABELS[channel]} · ${CONSENT_PURPOSE_LABELS[purpose]}: ${CONSENT_STATUS_LABELS[decision]}` });
    onOpenChange(false);
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>Record communication preference</DialogTitle>
          <DialogDescription>Record what {contactName} told you. Earlier decisions are kept in the history — nothing is overwritten.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <Choice name="channel" legend="Channel" options={["sms", "whatsapp", "email", "phone"]} value={channel} onChange={setChannel} labels={CONSENT_CHANNEL_LABELS} />
          <Choice name="purpose" legend="What it covers" options={["marketing", "service_updates"]} value={purpose} onChange={setPurpose} labels={CONSENT_PURPOSE_LABELS} />
          {current && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              Currently: <ConsentBadge status={current} />
            </p>
          )}
          <Choice name="decision" legend="Customer's decision" options={["agreed", "declined", "withdrawn"]} value={decision} onChange={chooseDecision} labels={{ agreed: "Agreed", declined: "Refused", withdrawn: "Withdrew (previously agreed)" }} />
          <div className="space-y-1.5">
            <Label htmlFor="consent-method">How did they tell you?</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as ConsentMethod)} disabled={!decision}>
              <SelectTrigger id="consent-method" className="w-full">
                <SelectValue placeholder={decision ? "Choose a method" : "Choose a decision first"} />
              </SelectTrigger>
              <SelectContent>
                {decision &&
                  CONSENT_METHODS_BY_DECISION[decision].map((m) => (
                    <SelectItem key={m} value={m}>
                      {CONSENT_METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="consent-evidence">
                Evidence reference <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="consent-evidence" value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} placeholder="Form no., message ID…" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="consent-note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea id="consent-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Record preference
          </Button>
        </DialogFooter>
    </>
  );
}
