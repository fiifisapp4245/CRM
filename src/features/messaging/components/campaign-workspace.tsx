"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Braces, CalendarClock, ChevronRight, CheckCircle2, FlaskConical, Send, Square, Trash2, Undo2, Users } from "lucide-react";
import { toast } from "sonner";
import { hasPermission } from "@/lib/permissions";
import { dayKey, formatInTz, timeKey, zonedIso } from "@/lib/business/time";
import { useNow } from "@/lib/hooks/use-now";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { Field, FormSection } from "@/components/forms/form-section";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { InlineNotice } from "@/components/feedback/states";
import { useFeatureGate } from "@/components/entitlements/upgrade";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMessagingData } from "../hooks";
import { campaignAudience, checkSchedule, missingFieldCount, renderFor } from "../lib/campaigns";
import { messageCost, smsParts, TEMPLATE_VARIABLES } from "../lib/messaging";
import { deleteDraft, saveCampaign, scheduleCampaign, sendCampaignNow, stopCampaign, unscheduleCampaign, type CampaignInput } from "../services/campaigns-service";
import { CHANNEL_LABELS, COMM_STATUS_LABELS, EXCLUSION_LABELS, type Campaign, type CommStatus, type ExclusionReason } from "../types";
import { CampaignStatusBadge, CommStatusBadge, formatGhs } from "./status";

const NO_TEMPLATE = "__none";

export function CampaignWorkspace({ campaign }: { campaign?: Campaign }) {
  const router = useRouter();
  const now = useNow();
  const { db, user, tz, contacts } = useMessagingData();
  const gate = useFeatureGate("campaigns");
  const live = campaign ? (db.campaigns.find((c) => c.id === campaign.id) ?? campaign) : undefined;
  const editable = !live || live.status === "draft";
  const canEdit = editable && gate.allowed && hasPermission(user, "campaigns.manage");
  const segments = db.segments.filter((s) => s.orgId === user.orgId && !s.isPrivate);
  const [v, setV] = useState<CampaignInput>(() => ({ name: live?.name ?? "", channel: live?.channel ?? "email", segmentId: live?.segmentId ?? segments[0]?.id ?? "", subject: live?.subject ?? "", body: live?.body ?? "", templateId: live?.templateId }));
  const settings = db.settings;
  const suggestedDay = dayKey(now + 86_400_000, tz);
  const [date, setDate] = useState(() => (live?.scheduledAt ? dayKey(live.scheduledAt, tz) : suggestedDay));
  const [time, setTime] = useState(() => (live?.scheduledAt ? timeKey(live.scheduledAt, tz) : "10:00"));
  const [busy, setBusy] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const set = (p: Partial<CampaignInput>) => setV((s) => ({ ...s, ...p }));

  const el = useMemo(() => (v.segmentId ? campaignAudience(db, { orgId: user.orgId, segmentId: v.segmentId, channel: v.channel }) : null), [db, user.orgId, v.segmentId, v.channel]);
  const total = el ? el.eligible.length + el.excluded.length : 0;
  const sampleId = el?.eligible[0]?.contact.id;
  const preview = sampleId ? renderFor(db, v.body, sampleId) : null;
  const missing = el ? missingFieldCount(db, v.body, el) : 0;
  const estCost = el && v.channel === "sms" && preview ? Math.round(el.eligible.length * (messageCost("sms", preview.text, settings.smsCostPerPartGhs) ?? 0) * 100) / 100 : null;
  const scheduleIso = date && time ? zonedIso(date, time, tz) : "";
  const check = scheduleIso ? checkSchedule(scheduleIso, now, settings) : null;
  const fmt = (iso: string) => formatInTz(iso, tz, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const comms = live ? db.communications.filter((m) => m.campaignId === live.id) : [];
  const byStatus = (s: CommStatus) => comms.filter((m) => m.status === s).length;
  const templates = db.templates.filter((t) => t.channel === v.channel);

  const save = async (): Promise<Campaign | null> => {
    setBusy(true);
    const r = await saveCampaign(v, live?.id);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return null;
    }
    if (!live) router.replace(`/campaigns/${r.data.id}`);
    return r.data;
  };
  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success(msg);
    return true;
  };

  return (
    <PageContainer width="narrow" className="pb-16">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Campaigns", href: "/campaigns" }, { label: live?.name || "New campaign" }]} />}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {live?.name || "New campaign"} {live && <CampaignStatusBadge status={live.status} />}
          </span>
        }
        description={live && live.status !== "draft" ? `${CHANNEL_LABELS[live.channel]} to ${db.segments.find((s) => s.id === live.segmentId)?.name ?? "a deleted segment"}` : "Pick a segment, write one message, and send it only to people who may receive it."}
      />

      {live && live.status !== "draft" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{live.status === "scheduled" ? "Scheduled" : live.status === "going_out" ? "Going out now" : live.status === "sent" ? "Sent" : "Stopped"}</h2>
              <p className="text-sm text-muted-foreground">
                {live.status === "scheduled" && live.scheduledAt && `Starts ${fmt(live.scheduledAt)} (business time). It starts the next time the CRM is open after that — there's no background sender in this prototype.`}
                {(live.status === "going_out" || live.status === "sent") && live.sentAt && `Started ${fmt(live.sentAt)}.`}
                {live.status === "stopped" && live.stoppedAt && `Stopped ${fmt(live.stoppedAt)}. Messages not yet sent were cancelled.`}
              </p>
            </div>
            {gate.allowed && hasPermission(user, "campaigns.manage") && (
              <div className="flex flex-wrap gap-2">
                {live.status === "scheduled" && (
                  <Button variant="outline" disabled={busy} onClick={() => act(() => unscheduleCampaign(live.id), "Moved back to draft")}>
                    <Undo2 /> Back to draft
                  </Button>
                )}
                {(live.status === "scheduled" || live.status === "going_out") && (
                  <Button variant="outline" disabled={busy} onClick={() => setConfirmStop(true)}>
                    <Square /> Stop
                  </Button>
                )}
              </div>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Recipients", live.eligibleCount],
              ["Excluded", live.excludedCount],
              ["Delivered", comms.length ? byStatus("delivered") : "—"],
              ["Failed", comms.length ? byStatus("failed") : "—"],
              ["Not sent yet", comms.length ? byStatus("waiting") + byStatus("cancelled") : "—"],
            ].map(([l, n]) => (
              <div key={l as string} className="rounded-xl border border-border p-3">
                <dt className="text-xs text-muted-foreground">{l}</dt>
                <dd className="text-xl font-semibold tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
          {live.exclusions && live.excludedCount > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Excluded:{" "}
              {(Object.keys(live.exclusions) as ExclusionReason[])
                .filter((k) => live.exclusions![k])
                .map((k) => `${live.exclusions![k]} — ${EXCLUSION_LABELS[k].toLowerCase()}`)
                .join("; ")}
            </p>
          )}
          {comms.length > 0 && (
            <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                  <tr className="border-b border-border/70">
                    <th scope="col" className="px-3 py-2 text-left font-medium">Recipient</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {comms.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-1.5">
                        <Link href={`/contacts/${m.contactId}`} className="hover:underline">{contacts.get(m.contactId)?.displayName ?? "Unknown"}</Link> <span className="text-xs text-muted-foreground">{m.to}</span>
                      </td>
                      <td className="px-3 py-1.5"><CommStatusBadge status={m.status} /></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatGhs(m.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <FlaskConical className="size-3.5" /> Simulated: no SMS or email left the CRM. Statuses: {(["waiting", "sent", "delivered", "failed", "cancelled"] as CommStatus[]).map((s) => `${COMM_STATUS_LABELS[s]} ${byStatus(s)}`).join(" · ")}. Each message is also in <Link href="/messaging" className="underline">Messaging</Link>.
          </p>
        </section>
      )}

      {(editable || live) && (
        <>
          <FormSection title="Name and channel">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="Campaign name" htmlFor="cmp-name">
                <Input id="cmp-name" value={v.name} onChange={(e) => set({ name: e.target.value })} disabled={!canEdit} placeholder="e.g. November price update" />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Channel</span>
                <Segmented label="Channel" value={v.channel} onChange={(channel) => canEdit && set({ channel, templateId: undefined })} options={[{ value: "email" as const, label: "Email" }, { value: "sms" as const, label: "SMS" }]} />
              </div>
            </div>
          </FormSection>

          <FormSection title="Audience" description="Built from a shared segment. Only people who agreed to marketing on this channel, with a usable address, receive it.">
            <Field label="Segment" htmlFor="cmp-seg">
              <Select value={v.segmentId} onValueChange={(segmentId) => set({ segmentId })} disabled={!canEdit}>
                <SelectTrigger id="cmp-seg">
                  <SelectValue placeholder="Choose a segment" />
                </SelectTrigger>
                <SelectContent>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {el && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">In the segment</p>
                  <p className="text-2xl font-semibold tabular-nums">{total}</p>
                </div>
                <div className="rounded-xl border border-success/40 bg-success-soft p-3">
                  <p className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" /> Will receive it</p>
                  <p className="text-2xl font-semibold tabular-nums">{el.eligible.length}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Left out</p>
                  <p className="text-2xl font-semibold tabular-nums">{el.excluded.length}</p>
                </div>
              </div>
            )}
            {el && el.excluded.length > 0 && (
              <details className="group mt-3 rounded-xl border border-border px-4 py-3 text-sm">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" /> Why people are left out
                </summary>
                <ul className="mt-2 space-y-1">
                  {(Object.keys(el.byReason) as ExclusionReason[]).filter((k) => el.byReason[k]).map((k) => (
                    <li key={k}>
                      <span className="font-medium tabular-nums">{el.byReason[k]}</span> — {EXCLUSION_LABELS[k]}
                    </li>
                  ))}
                </ul>
                <ul className="mt-3 max-h-48 divide-y divide-border/60 overflow-y-auto text-xs">
                  {el.excluded.slice(0, 50).map((x) => (
                    <li key={x.contact.id} className="flex justify-between gap-3 py-1">
                      <Link href={`/contacts/${x.contact.id}`} className="hover:underline">{x.contact.displayName}</Link>
                      <span className="text-muted-foreground">{EXCLUSION_LABELS[x.reason]}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {el && el.eligible.length === 0 && <InlineNotice tone="warning" className="mt-3">Nobody in this segment may receive a {CHANNEL_LABELS[v.channel]} campaign. Choose another segment or channel.</InlineNotice>}
          </FormSection>

          <FormSection title="Message">
            <div className="space-y-4">
              {templates.length > 0 && canEdit && (
                <Field label="Start from a template" htmlFor="cmp-tpl" optional>
                  <Select
                    value={v.templateId ?? NO_TEMPLATE}
                    onValueChange={(id) => {
                      const t = templates.find((x) => x.id === id);
                      set(t ? { templateId: t.id, body: t.body, subject: t.subject ?? v.subject } : { templateId: undefined });
                    }}
                  >
                    <SelectTrigger id="cmp-tpl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TEMPLATE}>No template</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {v.channel === "email" && (
                <Field label="Subject" htmlFor="cmp-subject">
                  <Input id="cmp-subject" value={v.subject ?? ""} onChange={(e) => set({ subject: e.target.value })} disabled={!canEdit} />
                </Field>
              )}
              <Field label="Message" htmlFor="cmp-body" hint={v.channel === "sms" && preview ? `${smsParts(preview.text)} SMS part${smsParts(preview.text) === 1 ? "" : "s"} per person · about ${formatGhs(estCost)} in total at the demo rate. Include how to opt out.` : undefined}>
                <Textarea id="cmp-body" rows={6} value={v.body} onChange={(e) => set({ body: e.target.value })} disabled={!canEdit} />
              </Field>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <Braces /> Insert field
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {TEMPLATE_VARIABLES.filter((x) => x.key !== "deal").map((x) => (
                      <DropdownMenuItem key={x.key} onSelect={() => set({ body: `${v.body}{{${x.key}}}` })}>
                        {x.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {preview && v.body && (
                <div className="rounded-xl border border-border bg-panel/60 p-4 text-sm">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Preview for {el?.eligible[0]?.contact.displayName}</p>
                  {v.channel === "email" && v.subject && <p className="mb-2 font-medium">{renderFor(db, v.subject, sampleId!).text}</p>}
                  <p className="whitespace-pre-line">{preview.text}</p>
                </div>
              )}
              {missing > 0 && (
                <InlineNotice tone="warning" icon={AlertTriangle}>
                  {missing} recipient{missing === 1 ? " has" : "s have"} no value for a field in this message; it will be left blank for them.
                </InlineNotice>
              )}
              {v.body.includes("{{deal}}") && <InlineNotice tone="warning">Deal name can&apos;t be filled in a campaign — it&apos;s for one-to-one messages.</InlineNotice>}
            </div>
          </FormSection>

          <FormSection title="When to send" description={`Your business hours: ${settings.businessHours.start}–${settings.businessHours.end}, Monday to Friday (${tz.replace("_", " ")}). Campaigns only go out inside them.`}>
            <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr] sm:items-end">
              <Field label="Date" htmlFor="cmp-date">
                <Input id="cmp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Time" htmlFor="cmp-time">
                <Input id="cmp-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!canEdit} />
              </Field>
              {canEdit && check && !check.ok && (
                <InlineNotice tone="warning" icon={CalendarClock}>
                  {check.reason}
                  {check.suggestion && (
                    <>
                      {" "}
                      <button type="button" className="font-medium underline" onClick={() => (setDate(dayKey(check.suggestion!, tz)), setTime(timeKey(check.suggestion!, tz)))}>
                        Use {fmt(check.suggestion)}
                      </button>
                    </>
                  )}
                </InlineNotice>
              )}
            </div>
          </FormSection>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={busy} onClick={async () => (await save()) && toast.success("Draft saved")}>
                Save draft
              </Button>
              <Button
                variant="outline"
                disabled={busy || !check?.ok || !el?.eligible.length}
                onClick={async () => {
                  const c = await save();
                  if (c) await act(() => scheduleCampaign(c.id, scheduleIso), `Scheduled for ${fmt(scheduleIso)}`);
                }}
              >
                <CalendarClock /> Schedule
              </Button>
              <Button disabled={busy || !el?.eligible.length || !v.body.trim()} onClick={() => setConfirmSend(true)}>
                <Send /> Send now (demo)
              </Button>
              {live && (
                <Button variant="ghost" className="ml-auto text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete draft
                </Button>
              )}
            </div>
          )}
          {!gate.allowed && editable && (
            <Button className="self-start" onClick={gate.guard(() => undefined)}>
              Edit campaign
            </Button>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title={`Send to ${el?.eligible.length ?? 0} people now?`}
        description={
          <div className="space-y-2">
            <p>This is a demo: messages are created in Messaging with simulated statuses. Nobody receives anything.</p>
            <p className="flex items-center gap-1.5 font-medium text-foreground"><Users className="size-4" /> First recipients</p>
            <ul className="list-disc pl-5">
              {el?.eligible.slice(0, 6).map((e) => (
                <li key={e.contact.id}>
                  {e.contact.displayName} <span className="text-xs">({e.to})</span>
                </li>
              ))}
              {(el?.eligible.length ?? 0) > 6 && <li>and {el!.eligible.length - 6} more</li>}
            </ul>
            <p>{el?.excluded.length ?? 0} people in the segment are left out because of their preferences or missing details.</p>
          </div>
        }
        confirmLabel="Send now (demo)"
        onConfirm={async () => {
          const c = await save();
          if (!c) throw new Error("save failed");
          const ok = await act(() => sendCampaignNow(c.id), "Campaign is going out (simulated)");
          if (!ok) throw new Error("send failed");
        }}
      />
      <ConfirmDialog open={confirmStop} onOpenChange={setConfirmStop} title="Stop this campaign?" description="Messages that haven't gone out yet are cancelled. Messages already sent stay in Messaging." confirmLabel="Stop campaign" destructive onConfirm={async () => void (await act(() => stopCampaign(live!.id), "Campaign stopped"))} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this draft?"
        description="The draft is removed. Nothing has been sent."
        confirmLabel="Delete draft"
        destructive
        onConfirm={async () => {
          if (await act(() => deleteDraft(live!.id), "Draft deleted")) router.push("/campaigns");
        }}
      />
      {gate.dialog}
    </PageContainer>
  );
}
