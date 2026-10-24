"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logActivity } from "../services/activities-service";
import { CALL_OUTCOME_LABELS, type CallOutcome } from "../types";

export type ComposerKind = "note" | "call" | "task" | "meeting";

const TABS: { kind: ComposerKind; label: string }[] = [
  { kind: "note", label: "Note" },
  { kind: "call", label: "Log call" },
  { kind: "task", label: "Task" },
  { kind: "meeting", label: "Meeting" },
];

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tomorrowAt(hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

interface ComposerProps {
  contactId: string;
  contactName: string;
  ownerId: string | null;
  kind: ComposerKind;
  onKindChange: (k: ComposerKind) => void;
  focusKey?: number;
  /** Logs the interaction against a deal as well as the contact. */
  dealId?: string;
}

/**
 * Inline composer: every submit writes to the prototype store and appears in
 * the timeline / up-next list. The summary and details survive switching
 * tabs; type-specific fields reset because the inner form is keyed by kind.
 */
export function ActivityComposer({ contactId, contactName, ownerId, kind, onKindChange, focusKey, dealId }: ComposerProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (focusKey) document.getElementById("composer-main")?.focus();
  }, [focusKey]);

  return (
    <Tabs value={kind} onValueChange={(v) => onKindChange(v as ComposerKind)} className="gap-0 rounded-2xl border border-border bg-card">
      <div className="border-b border-border/70 px-4 py-3">
        <TabsList aria-label="Add to timeline">
        {TABS.map((t) => (
          <TabsTrigger key={t.kind} value={t.kind}>
            {t.label}
          </TabsTrigger>
        ))}
        </TabsList>
      </div>
      <TabsContent value={kind}>
        <ComposerForm
          key={kind}
          kind={kind}
          contactId={contactId}
          dealId={dealId}
          contactName={contactName}
          ownerId={ownerId}
          subject={subject}
          setSubject={setSubject}
          body={body}
          setBody={setBody}
        />
      </TabsContent>
    </Tabs>
  );
}

interface ComposerFormProps {
  dealId?: string;
  kind: ComposerKind;
  contactId: string;
  contactName: string;
  ownerId: string | null;
  subject: string;
  setSubject: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
}

function ComposerForm({ kind, contactId, dealId, contactName, ownerId, subject, setSubject, body, setBody }: ComposerFormProps) {
  const [outcome, setOutcome] = useState<CallOutcome>("connected");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [duration, setDuration] = useState(kind === "meeting" ? "45" : "10");
  const [when, setWhen] = useState(() => localInput(kind === "call" ? new Date() : tomorrowAt(kind === "meeting" ? 10 : 9)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setSubject("");
    setBody("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const summary = kind === "note" ? body.trim().split("\n")[0].slice(0, 80) : subject.trim();
    if (kind === "note" ? !body.trim() : !subject.trim()) {
      setError(kind === "note" ? "Write the note first." : "Add a short summary.");
      return;
    }
    const at = new Date(when);
    if ((kind === "task" || kind === "meeting") && Number.isNaN(at.getTime())) return setError("Choose a date and time.");
    if (kind === "call" && at.getTime() > Date.now() + 60_000) return setError("A logged call can't be in the future. Create a task to call later.");
    setBusy(true);
    const res = await logActivity({
      contactId,
      dealId,
      type: kind,
      subject: summary,
      body: kind === "note" ? body.trim() : body.trim() || undefined,
      occurredAt: kind === "note" ? new Date().toISOString() : kind === "call" ? at.toISOString() : undefined,
      dueAt: kind === "task" || kind === "meeting" ? at.toISOString() : undefined,
      status: kind === "task" || kind === "meeting" ? "open" : undefined,
      callOutcome: kind === "call" ? outcome : undefined,
      direction: kind === "call" ? direction : undefined,
      durationMinutes: kind === "call" || kind === "meeting" ? Number(duration) || undefined : undefined,
      assigneeId: ownerId,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success({ note: "Note added", call: "Call logged", task: "Task created", meeting: "Meeting scheduled" }[kind], {
      description: kind === "task" || kind === "meeting" ? `Shown under “Up next” for ${contactName}.` : undefined,
    });
    reset();
  };

  return (
      <form onSubmit={submit} className="space-y-3 p-4">
        {kind === "note" ? (
          <Textarea id="composer-main" value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={`What should the team know about ${contactName}?`} aria-label="Note" aria-invalid={!!error} />
        ) : (
          <Input
            id="composer-main"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Summary"
            aria-invalid={!!error}
            placeholder={kind === "call" ? "What was the call about?" : kind === "task" ? "e.g. Send revised quotation" : "e.g. Proposal review at their office"}
          />
        )}
        {kind === "call" && (
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="call-outcome">Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as CallOutcome)}>
                <SelectTrigger id="call-outcome" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CALL_OUTCOME_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-direction">Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as "outbound" | "inbound")}>
                <SelectTrigger id="call-direction" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">We called them</SelectItem>
                  <SelectItem value="inbound">They called us</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-duration">Minutes</Label>
              <Input id="call-duration" type="number" min={0} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="call-when">When</Label>
              <Input id="call-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
          </div>
        )}
        {(kind === "task" || kind === "meeting") && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="due-when">{kind === "task" ? "Due" : "Starts"}</Label>
              <Input id="due-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            {kind === "meeting" && (
              <div className="space-y-1.5">
                <Label htmlFor="meeting-duration">Minutes</Label>
                <Input id="meeting-duration" type="number" min={5} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
            )}
          </div>
        )}
        {kind !== "note" && (
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Details (optional)" aria-label="Details" />
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {{ note: "Add note", call: "Log call", task: "Create task", meeting: "Schedule meeting" }[kind]}
          </Button>
        </div>
      </form>
  );
}
