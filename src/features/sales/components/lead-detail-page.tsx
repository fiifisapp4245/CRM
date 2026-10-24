"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Ban, CalendarClock, CheckCircle2, Mail, MessageSquare, Pencil, Phone, PhoneCall, RotateCcw, StickyNote, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, formatRelative } from "@/lib/utils/format";
import { Breadcrumbs, PageContainer } from "@/components/layout/page-header";
import { ProfileBanner } from "@/components/shared/profile-banner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { InlineNotice } from "@/components/feedback/states";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSales } from "../hooks/use-sales";
import { leadCaps } from "../lib/access";
import { leadScore } from "../lib/lead-score";
import { logLeadInteraction, setLeadStatus, setNextAction } from "../services/leads-service";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, RATING_LABELS, type Lead, type LeadStatus } from "../types";
import { LeadStatusBadge, Money } from "./badges";
import { StatusStepper } from "./status-stepper";

const STEPS: LeadStatus[] = ["new", "contacted", "qualified", "converted"];
const DISQUALIFY_REASONS = ["Not a buyer", "No budget", "Can't be reached", "Duplicate of another lead", "Outside our service area", "Other"];

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <h2 className="text-[0.9375rem] font-semibold">{title}</h2>
        {action}
      </div>
      <div className="px-5 pb-4 text-sm">{children}</div>
    </section>
  );
}

export function LeadDetailPage({ lead }: { lead: Lead }) {
  const { db, user, now, users, contacts, accounts } = useSales();
  const caps = leadCaps(db, user, lead);
  const score = leadScore(lead, now);
  const owner = lead.ownerId ? users.get(lead.ownerId) : undefined;
  const [disqualifyOpen, setDisqualifyOpen] = useState(false);
  const [kind, setKind] = useState<"note" | "call">("note");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [nextLabel, setNextLabel] = useState(lead.nextAction?.label ?? "");
  const [nextDue, setNextDue] = useState(lead.nextAction?.dueAt.slice(0, 10) ?? "");
  const events = useMemo(() => [...lead.events].sort((a, b) => b.at.localeCompare(a.at)), [lead.events]);

  const move = async (status: LeadStatus, note?: string) => {
    const r = await setLeadStatus(lead.id, status, note);
    if (r.ok) toast.success(`Marked ${LEAD_STATUS_LABELS[status].toLowerCase()}`);
    else toast.error(r.error);
    return r.ok;
  };
  const log = async () => {
    setBusy(true);
    const r = await logLeadInteraction(lead.id, kind, text);
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    setText("");
    toast.success(kind === "note" ? "Note added" : "Call logged");
  };
  const saveNext = async () => {
    const r = await setNextAction(lead.id, nextLabel.trim() ? { label: nextLabel.trim(), dueAt: new Date(`${nextDue || new Date(now).toISOString().slice(0, 10)}T09:00:00`).toISOString() } : null);
    if (r.ok) toast.success(nextLabel.trim() ? "Next action saved" : "Next action cleared");
    else toast.error(r.error);
  };

  const stepIndex = lead.status === "disqualified" ? -1 : STEPS.indexOf(lead.status);
  const conv = lead.converted;

  return (
    <PageContainer>
      <div className="-mb-2">
        <Breadcrumbs items={[{ label: "Leads", href: "/leads" }, { label: lead.name }]} />
      </div>
      <ProfileBanner
        muted={lead.status === "disqualified"}
        media={<UserAvatar name={lead.name} size="2xl" muted={lead.status === "disqualified"} className="ring-4 ring-card" />}
        actions={
          <>
            {caps.changeStatus && lead.status === "new" && (
              <Button variant="outline" onClick={() => move("contacted")}>
                <PhoneCall /> Mark contacted
              </Button>
            )}
            {caps.changeStatus && lead.status !== "qualified" && (
              <Button variant="outline" onClick={() => move("qualified")}>
                <UserCheck /> Qualify
              </Button>
            )}
            {caps.changeStatus && (
              <Button variant="outline" onClick={() => setDisqualifyOpen(true)}>
                <Ban /> Disqualify
              </Button>
            )}
            {caps.reopen && (
              <Button variant="outline" onClick={() => move("new")}>
                <RotateCcw /> Reopen
              </Button>
            )}
            {caps.edit && (
              <Button variant="outline" asChild>
                <Link href={`/leads/${lead.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {caps.convert && (
              <Button asChild>
                <Link href={`/leads/${lead.id}/convert`}>
                  <ArrowRightLeft /> Convert
                </Link>
              </Button>
            )}
          </>
        }
        title={
          <>
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">{lead.name}</h1>
            <LeadStatusBadge status={lead.status} />
          </>
        }
        subtitle={[lead.jobTitle, lead.company, lead.city].filter(Boolean).join(" · ") || "No company details yet"}
        facts={[
          { label: "Score (prototype)", value: <span className="font-medium tabular-nums">{score.score} / 100</span> },
          { label: "Estimated value", value: lead.estimatedValue ? <Money amount={lead.estimatedValue} currency={lead.currency} className="font-medium" /> : <span className="text-subtle-foreground">Not set</span> },
          { label: "Source", value: <span className="font-medium">{LEAD_SOURCE_LABELS[lead.source]}</span> },
          { label: "Owner", value: owner ? <><UserAvatar name={owner.name} size="xs" /><span className="font-medium">{owner.name}</span></> : <span className="font-medium">Unassigned</span> },
        ]}
      />

      {lead.status === "disqualified" ? (
        <InlineNotice tone="neutral" icon={Ban}>
          Disqualified{lead.disqualifyReason ? `: ${lead.disqualifyReason}` : ""}. Reopen it if circumstances change.
        </InlineNotice>
      ) : (
        <StatusStepper label="Lead progress" steps={STEPS.map((s) => LEAD_STATUS_LABELS[s])} currentIndex={stepIndex} />
      )}

      {conv && (
        <InlineNotice tone="success" icon={CheckCircle2}>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Converted {formatDate(conv.at)}.</span>
            <Link href={`/contacts/${conv.contactId}`} className="font-medium underline underline-offset-4">Contact: {contacts.get(conv.contactId)?.displayName ?? "Open contact"}</Link>
            {conv.accountId && <Link href={`/accounts/${conv.accountId}`} className="font-medium underline underline-offset-4">Account: {accounts.get(conv.accountId)?.name ?? "Open account"}</Link>}
            {conv.dealId && <Link href={`/deals/${conv.dealId}`} className="font-medium underline underline-offset-4">Deal: {db.deals.find((d) => d.id === conv.dealId)?.title ?? "Open deal"}</Link>}
          </span>
        </InlineNotice>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {caps.log && (
            <Card title="Next action">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input aria-label="Next action" value={nextLabel} onChange={(e) => setNextLabel(e.target.value)} placeholder="e.g. Send price list" className="flex-1" />
                <Input aria-label="Due date" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className="sm:w-44" />
                <Button variant="outline" onClick={saveNext}>
                  <CalendarClock /> Save
                </Button>
              </div>
              {lead.nextAction && (
                <p className={cn("mt-2 text-xs", Date.parse(lead.nextAction.dueAt) < now ? "text-destructive" : "text-muted-foreground")}>
                  Due {formatRelative(lead.nextAction.dueAt, now)}
                </p>
              )}
            </Card>
          )}

          <section className="rounded-2xl border border-border bg-card" aria-label="Lead timeline">
            <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-[0.9375rem] font-semibold">
                Activity <span className="font-normal text-muted-foreground">{events.length}</span>
              </h2>
              {caps.log && <Segmented label="Add to timeline" value={kind} onChange={setKind} options={[{ value: "note", label: "Note" }, { value: "call", label: "Log call" }]} />}
            </div>
            {caps.log && (
              <div className="space-y-2 border-b border-border/70 px-5 py-4">
                <Textarea aria-label={kind === "note" ? "Note" : "Call summary"} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "note" ? "What should the team know?" : "What was discussed?"} />
                <div className="flex justify-end">
                  <Button size="sm" onClick={log} disabled={busy || !text.trim()}>
                    {kind === "note" ? <><StickyNote /> Add note</> : <><PhoneCall /> Log call</>}
                  </Button>
                </div>
              </div>
            )}
            <ol className="space-y-4 px-5 py-5">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                    {e.kind === "status" ? <ArrowRightLeft className="size-4" /> : e.kind === "call" ? <PhoneCall className="size-4" /> : <MessageSquare className="size-4" />}
                  </span>
                  <div className="min-w-0 pt-1">
                    <p>
                      {e.kind === "status" ? (
                        <>
                          Status set to <span className="font-medium">{LEAD_STATUS_LABELS[e.status!]}</span>
                          {e.text && <span className="text-muted-foreground"> — {e.text}</span>}
                        </>
                      ) : (
                        <span className="whitespace-pre-line">{e.text}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.kind === "call" ? "Call · " : e.kind === "note" ? "Note · " : ""}
                      {formatDateTime(e.at)} · {users.get(e.by)?.name ?? "Unknown"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-4" aria-label="Lead information">
          <Card title="Contact details">
            <ul className="space-y-2">
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 text-subtle-foreground" />
                {lead.phone ? <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="hover:underline">{lead.phone}</a> : <span className="text-subtle-foreground">No phone</span>}
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 text-subtle-foreground" />
                {lead.email ? <a href={`mailto:${lead.email}`} className="truncate hover:underline">{lead.email}</a> : <span className="text-subtle-foreground">No email</span>}
              </li>
            </ul>
          </Card>
          <Card title="Opportunity">
            <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2">
              <dt className="text-muted-foreground">Wants</dt>
              <dd>{lead.need || <span className="text-subtle-foreground">Not captured</span>}</dd>
              <dt className="text-muted-foreground">Rating</dt>
              <dd>{lead.rating ? RATING_LABELS[lead.rating] : "Not rated"}</dd>
              <dt className="text-muted-foreground">Source detail</dt>
              <dd>{lead.sourceDetail || "—"}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDate(lead.createdAt)}</dd>
            </dl>
          </Card>
          <Card title="Why this score">
            <ul className="space-y-1.5">
              {score.factors.length ? (
                score.factors.map((f) => (
                  <li key={f.label} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className={cn("tabular-nums", f.points < 0 ? "text-destructive" : "text-foreground")}>{f.points > 0 ? `+${f.points}` : f.points}</span>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">No scoring signals yet.</li>
              )}
            </ul>
            <p className="mt-3 border-t border-border/70 pt-2 text-xs text-muted-foreground">Prototype scoring model, capped at 100. Not TroveSuite&apos;s production formula.</p>
          </Card>
          {lead.notes && (
            <Card title="Notes">
              <p className="whitespace-pre-line">{lead.notes}</p>
            </Card>
          )}
        </aside>
      </div>

      <DisqualifyDialog open={disqualifyOpen} onOpenChange={setDisqualifyOpen} onConfirm={(reason) => move("disqualified", reason)} />
    </PageContainer>
  );
}

function DisqualifyDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: (reason: string) => Promise<boolean> }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DisqualifyBody onCancel={() => onOpenChange(false)} onConfirm={async (r) => (await onConfirm(r)) && onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function DisqualifyBody({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const full = reason === "Other" ? detail.trim() : [reason, detail.trim()].filter(Boolean).join(" — ");
  return (
    <>
      <DialogHeader>
        <DialogTitle>Disqualify this lead?</DialogTitle>
        <DialogDescription>The lead stays on record with your reason, and can be reopened later.</DialogDescription>
      </DialogHeader>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Reason</legend>
        <div className="flex flex-wrap gap-2">
          {DISQUALIFY_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r} className={cn("h-8 cursor-pointer rounded-md border px-3 text-sm", reason === r ? "border-brand-700 bg-brand-50 text-brand-800" : "border-border hover:bg-secondary")}>
              {r}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="dq-detail">Details {reason !== "Other" && <span className="font-normal text-muted-foreground">(optional)</span>}</Label>
        <Textarea id="dq-detail" rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onConfirm(full)} disabled={!full}>Disqualify</Button>
      </DialogFooter>
    </>
  );
}
