"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { dayKey, timeKey, zonedIso } from "@/lib/business/time";
import { Field } from "@/components/forms/form-section";
import { MultiSelect } from "@/components/forms/multi-select";
import { OwnerSelect } from "@/components/forms/owner-select";
import { InlineNotice } from "@/components/feedback/states";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ContactSelect } from "@/features/sales/components/contact-select";
import { useActivitiesData } from "../hooks/use-activities";
import { DEFAULT_MINUTES } from "../lib/activities";
import { saveActivity, type ActivityInput } from "../services/activities-service";
import { CALL_OUTCOME_LABELS, DIRECTION_LABELS, PRIORITY_LABELS, RECURRENCE_LABELS, REMINDER_OPTIONS, type Activity, type CallOutcome, type Priority, type Recurrence } from "../types";

type FormType = "task" | "call" | "meeting" | "visit" | "note" | "email";
const TYPES: { value: FormType; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "visit", label: "Visit" },
  { value: "note", label: "Note" },
  { value: "email", label: "Email" },
];
const NO_DEAL = "__none";

export interface ActivityPreset {
  type?: FormType;
  mode?: "plan" | "log";
  start?: string;
  end?: string;
  contactId?: string;
  dealId?: string;
  title?: string;
}

/**
 * One form for planning and logging every kind of activity. `variant="calendar"`
 * shows Starts/Ends, Where and Also attending up front (reference calendar form).
 */
export function ActivityFormDialog({ open, onOpenChange, activity, preset, variant = "list", onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; activity?: Activity; preset?: ActivityPreset; variant?: "list" | "calendar"; onSaved?: (a: Activity) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-xl">{open && <FormBody activity={activity} preset={preset} variant={variant} onClose={() => onOpenChange(false)} onSaved={onSaved} />}</DialogContent>
    </Dialog>
  );
}

function FormBody({ activity, preset, variant, onClose, onSaved }: { activity?: Activity; preset?: ActivityPreset; variant: "list" | "calendar"; onClose: () => void; onSaved?: (a: Activity) => void }) {
  const { user, contacts, deals, accountName, assignable, people, tz, settings, now } = useActivitiesData();
  const initial = useMemo(() => {
    const type = (activity?.type === "message" ? "email" : activity?.type) ?? preset?.type ?? "task";
    const mode: "plan" | "log" = activity ? (activity.status ? "plan" : "log") : (preset?.mode ?? (type === "note" ? "log" : "plan"));
    const startIso = activity ? (activity.dueAt ?? activity.occurredAt) : (preset?.start ?? (mode === "log" ? new Date(now).toISOString() : undefined));
    const endIso = activity?.endAt ?? preset?.end;
    return {
      type: type as FormType,
      mode,
      subject: activity?.subject ?? "",
      body: activity?.body ?? "",
      date: startIso ? dayKey(startIso, tz) : mode === "plan" && variant === "calendar" ? dayKey(now, tz) : "",
      time: startIso ? timeKey(startIso, tz) : "",
      endTime: endIso ? timeKey(endIso, tz) : startIso && (type === "meeting" || type === "visit" || variant === "calendar") ? timeKey(Date.parse(startIso) + DEFAULT_MINUTES[type] * 60_000, tz) : "",
      priority: (activity?.priority ?? "normal") as Priority,
      contactId: activity?.contactId ?? preset?.contactId ?? "",
      dealId: activity?.dealId ?? preset?.dealId ?? "",
      assigneeId: activity ? (activity.assigneeId ?? "") : user.id,
      reminder: String(activity?.reminder ?? "default"),
      smsReminder: !!activity?.smsReminder,
      recurrence: (activity?.recurrence ?? "none") as Recurrence,
      location: activity?.location ?? "",
      attendeeIds: activity?.attendeeIds ?? [],
      callOutcome: (activity?.callOutcome ?? "connected") as CallOutcome,
      direction: (activity?.direction ?? "outbound") as "inbound" | "outbound",
      minutes: activity?.durationMinutes !== undefined ? String(activity.durationMinutes) : "",
    };
  }, [activity, preset, user.id, tz, now, variant]);
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof v>) => setV((s) => ({ ...s, ...p }));
  const planning = v.mode === "plan";
  const scheduled = v.type === "meeting" || v.type === "visit" || variant === "calendar";
  const dealOptions = useMemo(() => deals.filter((d) => d.status === "open" && (!v.contactId || d.contactId === v.contactId || d.id === v.dealId)), [deals, v.contactId, v.dealId]);
  const title = activity ? `Edit ${v.type}` : preset?.title ?? (planning ? "Plan an activity" : "Log an activity");
  const today = dayKey(now, tz);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.subject.trim()) return setError("Add a subject.");
    if (!planning && !v.date) return setError("Say when it happened.");
    if (v.time && !v.date) return setError("Pick a date for this time.");
    const start = v.date ? zonedIso(v.date, v.time || (planning ? "09:00" : timeKey(now, tz)), tz) : undefined;
    const end = planning && start && v.endTime && v.time ? zonedIso(v.date, v.endTime, tz) : undefined;
    if (end && start && end <= start) return setError("The end time must be after the start.");
    const minutes = v.minutes.trim() ? Number(v.minutes) : undefined;
    if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 0)) return setError("Minutes must be a positive number.");
    const input: ActivityInput = {
      type: v.type,
      mode: v.mode,
      subject: v.subject,
      body: v.body,
      start,
      end,
      priority: v.priority,
      contactId: v.contactId || null,
      dealId: v.dealId || undefined,
      assigneeId: v.assigneeId || null,
      reminder: v.reminder === "default" || v.reminder === "none" ? v.reminder : Number(v.reminder),
      smsReminder: v.smsReminder,
      recurrence: v.recurrence,
      location: v.location,
      attendeeIds: v.attendeeIds,
      callOutcome: v.type === "call" ? v.callOutcome : undefined,
      direction: v.type === "call" ? v.direction : undefined,
      durationMinutes: minutes,
    };
    setBusy(true);
    setError(null);
    const r = await saveActivity(input, activity?.id);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(activity ? "Activity saved" : planning ? "Activity planned" : v.type === "call" ? "Call logged" : "Activity logged", { description: r.data.subject });
    onSaved?.(r.data);
    onClose();
  };

  return (
    <form onSubmit={submit} className="flex max-h-[92vh] flex-col" noValidate>
      <DialogHeader className="border-b border-border/70 px-6 py-4">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{planning ? "Something to do. It shows in Tasks & Calls and the calendar until it's done." : "Something that already happened. It's saved as done on the customer's history."}</DialogDescription>
      </DialogHeader>
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {!preset?.title && (
          <div className="flex flex-wrap gap-2">
            <Segmented label="Activity type" value={v.type} onChange={(type) => set({ type, mode: type === "note" ? "log" : v.mode })} options={TYPES} />
          </div>
        )}
        {v.type !== "note" && !preset?.title && (
          <Segmented
            label="Planned or already happened"
            value={v.mode}
            onChange={(mode) => set({ mode, date: mode === "log" && v.date > today ? today : v.date })}
            options={[
              { value: "plan", label: "To do" },
              { value: "log", label: "Already happened" },
            ]}
          />
        )}
        <Field label="Subject" htmlFor="act-subject">
          <Input id="act-subject" autoFocus value={v.subject} onChange={(e) => set({ subject: e.target.value })} placeholder={v.type === "call" ? "e.g. Follow-up on quotation" : "e.g. Send revised delivery schedule"} aria-invalid={error === "Add a subject." || undefined} />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={planning ? "Date" : "When"} htmlFor="act-date" optional={planning && !scheduled}>
            <Input id="act-date" type="date" value={v.date} max={planning ? undefined : today} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label={scheduled && planning ? "Starts" : "Time"} htmlFor="act-time" optional>
            <Input id="act-time" type="time" value={v.time} onChange={(e) => set({ time: e.target.value })} />
          </Field>
          {planning && scheduled && (
            <Field label="Ends" htmlFor="act-end" optional>
              <Input id="act-end" type="time" value={v.endTime} onChange={(e) => set({ endTime: e.target.value })} />
            </Field>
          )}
          {!planning && (v.type === "call" || v.type === "meeting" || v.type === "visit") && (
            <Field label="Minutes" htmlFor="act-mins" optional>
              <Input id="act-mins" inputMode="numeric" value={v.minutes} onChange={(e) => set({ minutes: e.target.value })} />
            </Field>
          )}
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">Times are business time ({tz.replace("_", " ")}).</p>

        {!planning && v.type === "call" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="What happened" htmlFor="act-outcome">
              <Select value={v.callOutcome} onValueChange={(c) => set({ callOutcome: c as CallOutcome })}>
                <SelectTrigger id="act-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CALL_OUTCOME_LABELS) as CallOutcome[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {CALL_OUTCOME_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Direction" htmlFor="act-dir">
              <Select value={v.direction} onValueChange={(d) => set({ direction: d as "inbound" | "outbound" })}>
                <SelectTrigger id="act-dir">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">{DIRECTION_LABELS.outbound}</SelectItem>
                  <SelectItem value="inbound">{DIRECTION_LABELS.inbound}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact" htmlFor="act-contact" optional>
            <ContactSelect id="act-contact" value={v.contactId} onChange={(contactId) => set({ contactId, dealId: deals.find((d) => d.id === v.dealId)?.contactId === contactId ? v.dealId : "" })} contacts={contacts} accountName={accountName} />
          </Field>
          <Field label="Deal" htmlFor="act-deal" optional>
            <Select value={v.dealId || NO_DEAL} onValueChange={(d) => set({ dealId: d === NO_DEAL ? "" : d, contactId: d !== NO_DEAL && !v.contactId ? (deals.find((x) => x.id === d)?.contactId ?? "") : v.contactId })}>
              <SelectTrigger id="act-deal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEAL}>No deal</SelectItem>
                {dealOptions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Owner" htmlFor="act-owner">
            <OwnerSelect id="act-owner" value={v.assigneeId} onChange={(assigneeId) => set({ assigneeId })} owners={assignable} />
          </Field>
          {planning && (
            <Field label="Priority" htmlFor="act-priority">
              <Select value={v.priority} onValueChange={(p) => set({ priority: p as Priority })}>
                <SelectTrigger id="act-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["low", "normal", "high"] as Priority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {(scheduled || v.location) && (
            <Field label="Where" htmlFor="act-where" optional>
              <Input id="act-where" value={v.location} onChange={(e) => set({ location: e.target.value })} placeholder="Address or meeting link" />
            </Field>
          )}
          {(scheduled || v.attendeeIds.length > 0) && (
            <Field label="Also attending" optional>
              <MultiSelect label="Also attending" placeholder="Add colleagues" options={people.filter((p) => p.id !== v.assigneeId).map((p) => ({ value: p.id, label: p.name }))} value={v.attendeeIds} onChange={(attendeeIds) => set({ attendeeIds })} />
            </Field>
          )}
        </div>

        {planning && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Remind me" htmlFor="act-reminder" hint={v.reminder === "default" ? `Business default: ${settings.defaultReminderMinutes} minutes before.` : undefined}>
              <Select value={v.reminder} onValueChange={(reminder) => set({ reminder })}>
                <SelectTrigger id="act-reminder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.value === "default" ? `${o.label} (${settings.defaultReminderMinutes} min)` : o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Repeat" htmlFor="act-repeat">
              <Select value={v.recurrence} onValueChange={(r) => set({ recurrence: r as Recurrence })}>
                <SelectTrigger id="act-repeat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {RECURRENCE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-start gap-2 sm:col-span-2">
              <Checkbox id="act-sms" checked={v.smsReminder} disabled={!settings.smsRemindersEnabled} onCheckedChange={(c) => set({ smsReminder: c === true })} />
              <Label htmlFor="act-sms" className="grid gap-0.5 leading-snug font-normal">
                <span className={settings.smsRemindersEnabled ? undefined : "text-muted-foreground"}>Also remind me by SMS</span>
                {!settings.smsRemindersEnabled && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Info className="size-3" /> Not available — SMS reminders aren&apos;t enabled in this business&apos;s settings.
                  </span>
                )}
              </Label>
            </div>
          </div>
        )}

        <Field label="Notes" htmlFor="act-notes" optional>
          <Textarea id="act-notes" rows={3} value={v.body} onChange={(e) => set({ body: e.target.value })} />
        </Field>
        {!planning && v.type === "call" && <p className="text-xs text-muted-foreground">This records a call you made or took. The CRM doesn&apos;t place or record phone calls.</p>}
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      </div>
      <DialogFooter className="border-t border-border/70 px-6 py-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : activity ? "Save changes" : planning ? "Plan it" : "Log it"}
        </Button>
      </DialogFooter>
    </form>
  );
}
