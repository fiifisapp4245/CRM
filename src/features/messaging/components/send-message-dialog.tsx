"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDbStore } from "@/lib/mock-data/db-store";
import { FEATURES, PLAN_LABELS } from "@/lib/entitlements";
import { useEntitlement } from "@/features/permissions";
import { messageAllowed, type MessagePurpose } from "@/features/contacts/lib/consent";
import type { Contact } from "@/features/contacts/types";
import { InlineNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addressFor, messageCost, renderTemplate, smsParts, TEMPLATE_VARIABLES } from "../lib/messaging";
import { sendMessage } from "../services/messaging-service";
import { CHANNEL_LABELS, type Channel } from "../types";

const NO_TEMPLATE = "__none";

/**
 * One-to-one message from a contact or deal. Advance plan. Nothing is
 * delivered: the message is recorded on the timeline and in Messaging, and
 * its delivery is simulated. The consent rule is enforced before sending.
 */
export function SendMessageDialog({ open, onOpenChange, contact, dealId }: { open: boolean; onOpenChange: (o: boolean) => void; contact: Contact; dealId?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open && <Body onOpenChange={onOpenChange} contact={contact} dealId={dealId} />}</DialogContent>
    </Dialog>
  );
}

function Body({ onOpenChange, contact, dealId }: { onOpenChange: (o: boolean) => void; contact: Contact; dealId?: string }) {
  const db = useDbStore((s) => s.db);
  const ent = useEntitlement("messaging");
  const available = useMemo(() => (["sms", "whatsapp", "email"] as Channel[]).filter((c) => addressFor(contact, c)), [contact]);
  const [channel, setChannel] = useState<Channel | "">(() => available[0] ?? "");
  const [purpose, setPurpose] = useState<MessagePurpose>("operational");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const deal = dealId ? db.deals.find((d) => d.id === dealId) : undefined;
  const company = contact.accountId ? db.accounts.find((a) => a.id === contact.accountId)?.name : undefined;
  const ctx = { firstName: contact.firstName, fullName: contact.displayName, company, deal: deal?.title };
  const templates = db.templates.filter((t) => t.orgId === contact.orgId && t.channel === channel);
  const rendered = renderTemplate(body, ctx);
  const renderedSubject = renderTemplate(subject, ctx);
  const missing = [...new Set([...rendered.missing, ...renderedSubject.missing])];
  const check = channel ? messageAllowed(db.consents, contact.id, channel, purpose) : null;
  const to = channel ? addressFor(contact, channel) : null;

  if (!ent.allowed)
    return (
      <>
        <DialogHeader>
          <DialogTitle>Messaging requires {PLAN_LABELS[FEATURES.messaging.plan]}</DialogTitle>
          <DialogDescription>{FEATURES.messaging.value}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
        </DialogFooter>
      </>
    );

  const send = async () => {
    if (!channel) return;
    setBusy(true);
    const r = await sendMessage({ contactId: contact.id, channel, purpose, subject: channel === "email" ? renderedSubject.text : undefined, body: rendered.text, templateId: templateId || undefined, dealId });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`${CHANNEL_LABELS[channel]} recorded as sent`, { description: "Demo: no message was delivered. Its status will update as a simulated receipt arrives." });
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Send a message to {contact.displayName}</DialogTitle>
        <DialogDescription className="flex items-center gap-1.5">
          <FlaskConical className="size-3.5" /> Demo — recorded on the timeline and in Messaging; nothing is delivered.
        </DialogDescription>
      </DialogHeader>
      {available.length === 0 ? (
        <InlineNotice tone="warning">{contact.displayName} has no usable phone number or email address. Add one by editing the contact.</InlineNotice>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="msg-channel">Channel</Label>
              <Select value={channel} onValueChange={(v) => (setChannel(v as Channel), setTemplateId(""))}>
                <SelectTrigger id="msg-channel" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {available.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CHANNEL_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {to && <p className="text-xs text-muted-foreground">To {to}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msg-purpose">Type of message</Label>
              <Select value={purpose} onValueChange={(v) => setPurpose(v as MessagePurpose)}>
                <SelectTrigger id="msg-purpose" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational (order, delivery, account)</SelectItem>
                  <SelectItem value="marketing">Marketing (offers, promotions)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {check && (
            <InlineNotice tone={check.allowed ? "success" : "danger"} icon={check.allowed ? CheckCircle2 : Ban}>
              {check.allowed ? check.reason : (
                <>
                  <strong className="font-medium">Can&apos;t send.</strong> {check.reason}
                </>
              )}
            </InlineNotice>
          )}
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="msg-template">Template</Label>
              <Select
                value={templateId || NO_TEMPLATE}
                onValueChange={(v) => {
                  const t = templates.find((x) => x.id === v);
                  setTemplateId(t?.id ?? "");
                  if (t) {
                    setBody(t.body);
                    setSubject(t.subject ?? "");
                  }
                }}
              >
                <SelectTrigger id="msg-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>Write my own</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {channel === "email" && (
            <div className="space-y-1.5">
              <Label htmlFor="msg-subject">Subject</Label>
              <Input id="msg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!check?.allowed} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="msg-body">Message</Label>
            <Textarea id="msg-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} disabled={!check?.allowed} />
            <p className="text-xs text-muted-foreground">
              Fields you can use: {TEMPLATE_VARIABLES.map((v) => `{{${v.key}}}`).join(", ")}
              {channel === "sms" && body && ` · ${smsParts(rendered.text)} SMS part${smsParts(rendered.text) === 1 ? "" : "s"}, about GHS ${messageCost("sms", rendered.text, db.settings.smsCostPerPartGhs)?.toFixed(2)} at the demo rate`}
            </p>
          </div>
          {missing.length > 0 && (
            <InlineNotice tone="warning" icon={AlertTriangle}>
              No value for {missing.map((m) => TEMPLATE_VARIABLES.find((v) => v.key === m)?.label.toLowerCase()).join(", ")} — {missing.length === 1 ? "it" : "they"} will be left out. Edit the wording or add the details first.
            </InlineNotice>
          )}
          {body && rendered.text !== body && (
            <div className="rounded-xl border border-border bg-panel/60 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Preview</p>
              <p className="whitespace-pre-line">{rendered.text}</p>
            </div>
          )}
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={send} disabled={busy || !check?.allowed || !body.trim() || (channel === "email" && !subject.trim())}>
          {busy && <Loader2 className="animate-spin" />} Send (demo)
        </Button>
      </DialogFooter>
    </>
  );
}
