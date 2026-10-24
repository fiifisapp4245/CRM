"use client";

import { useState } from "react";
import Link from "next/link";
import { BookMarked, CheckCircle2, FlaskConical, Lock, Mail, MessageSquareReply, Phone, RotateCcw, Search, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { formatInTz } from "@/lib/business/time";
import { cn } from "@/lib/utils";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { OwnerSelect } from "@/components/forms/owner-select";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { InlineNotice } from "@/components/feedback/states";
import { useFeatureGate } from "@/components/entitlements/upgrade";
import { Segmented } from "@/components/shared/segmented";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { primaryMethod } from "@/features/contacts/lib/filters";
import { LinkedDocuments } from "@/features/documents/components/linked-documents";
import { useTicketsData } from "../hooks";
import { canWorkTicket } from "../lib/access";
import { isLateNow, TICKET_TRANSITIONS } from "../lib/tickets";
import { addTicketEntry, recordRating, setTicketStatus, updateTicket } from "../services/tickets-service";
import { TICKET_PRIORITY_LABELS, TICKET_SOURCE_LABELS, TICKET_STATUS_LABELS, type Ticket, type TicketPriority, type TicketStatus } from "../types";
import { LatePill, TicketPriorityBadge, TicketStatusBadge } from "./badges";
import { responseTarget, resolutionTarget, TargetState } from "./targets";

export function TicketDetailPage({ ticket }: { ticket: Ticket }) {
  const { db, user, now, contacts, users, assignable, categories, tz } = useTicketsData();
  const gate = useFeatureGate("tickets");
  const t = db.tickets.find((x) => x.id === ticket.id) ?? ticket;
  const can = gate.allowed && canWorkTicket(db, user, t);
  const contact = contacts.get(t.contactId);
  const account = t.accountId ? db.accounts.find((a) => a.id === t.accountId) : undefined;
  const [kind, setKind] = useState<"reply" | "note">("reply");
  const [draft, setDraft] = useState("");
  const [wait, setWait] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [summary, setSummary] = useState("");
  const [rating, setRating] = useState(false);
  const [answerQ, setAnswerQ] = useState("");
  const fmt = (iso: string) => formatInTz(iso, tz, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const who = (by: string) => (by === "customer" ? (contact?.displayName ?? "Customer") : by === "system" ? "System" : (users.get(by)?.name ?? "Unknown"));
  const answers = db.savedAnswers.filter((a) => `${a.title} ${a.body} ${a.category ?? ""}`.toLowerCase().includes(answerQ.trim().toLowerCase()));

  const run = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success(msg);
    return true;
  };
  const statusAction = (to: TicketStatus) => (to === "resolved" ? setResolving(true) : run(setTicketStatus(t.id, to), `Ticket ${TICKET_STATUS_LABELS[to].toLowerCase()}`));
  const actionLabel: Record<TicketStatus, string> = { open: t.status === "waiting" ? "Back to open" : "Reopen", waiting: "Waiting on customer", resolved: "Resolve…", closed: "Close" };

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Tickets", href: "/tickets" }, { label: t.number }]} />}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="text-muted-foreground tabular-nums">{t.number}</span> {t.subject}
          </span>
        }
        meta={
          <span className="flex flex-wrap items-center gap-1.5">
            <TicketStatusBadge status={t.status} />
            <TicketPriorityBadge priority={t.priority} />
            {isLateNow(t, now) && <LatePill label="Late now" />}
          </span>
        }
        actions={
          can &&
          TICKET_TRANSITIONS[t.status].map((to) => (
            <Button key={to} variant={to === "resolved" ? "default" : "outline"} disabled={busy} onClick={() => statusAction(to)}>
              {to === "resolved" ? <CheckCircle2 /> : to === "open" ? <RotateCcw /> : null} {actionLabel[to]}
            </Button>
          ))
        }
      />
      {gate.allowed && !can && (
        <InlineNotice tone="neutral" icon={Lock}>
          You can read this ticket but not change it — {t.ownerId ? `it's owned by ${users.get(t.ownerId)?.name ?? "someone"}, outside your team` : "your role can't work on tickets"}.
        </InlineNotice>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          {t.status === "resolved" || t.status === "closed" ? (
            <InlineNotice tone="success" icon={CheckCircle2}>
              Resolved {t.resolvedAt && fmt(t.resolvedAt)}
              {t.resolutionSummary && ` — ${t.resolutionSummary}`}
            </InlineNotice>
          ) : null}
          <section className="rounded-2xl border border-border bg-card" aria-label="Conversation">
            <h2 className="border-b border-border/70 px-5 py-3 text-[0.9375rem] font-semibold">Conversation</h2>
            <ol className="space-y-4 px-5 py-5">
              {t.entries.map((e) =>
                e.kind === "event" ? (
                  <li key={e.id} className="text-center text-xs text-muted-foreground">
                    {e.body} · {who(e.by)} · {fmt(e.at)}
                  </li>
                ) : (
                  <li key={e.id} className={cn("flex gap-3", e.kind !== "customer" && "flex-row-reverse")}>
                    <UserAvatar name={who(e.by)} size="sm" />
                    <div className={cn("max-w-[85%] rounded-2xl border px-4 py-3 text-sm", e.kind === "customer" ? "border-border bg-card" : e.kind === "note" ? "border-amber-200 bg-amber-50" : "border-brand-200 bg-brand-50")}>
                      <p className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{who(e.by)}</span>
                        {e.kind === "note" && (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-800">
                            <Lock className="size-3" /> Internal note — customer can&apos;t see this
                          </span>
                        )}
                        {e.kind === "reply" && (
                          <span className="inline-flex items-center gap-1">
                            <MessageSquareReply className="size-3" /> Reply to customer{e.simulated && " (simulated — not delivered)"}
                          </span>
                        )}
                        <span>· {fmt(e.at)}</span>
                      </p>
                      <p className="whitespace-pre-line">{e.body}</p>
                    </div>
                  </li>
                ),
              )}
            </ol>
            {can && t.status !== "closed" && (
              <div className="border-t border-border/70 px-5 py-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <Segmented label="Reply or note" value={kind} onChange={setKind} options={[{ value: "reply", label: "Reply to customer" }, { value: "note", label: "Internal note" }]} />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <BookMarked /> Saved answers
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-2">
                      <div className="relative">
                        <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                        <Input value={answerQ} onChange={(e) => setAnswerQ(e.target.value)} placeholder="Search saved answers" className="pl-8" aria-label="Search saved answers" />
                      </div>
                      <ul className="mt-2 max-h-64 overflow-y-auto">
                        {answers.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">No matching saved answers.</li>}
                        {answers.map((a) => (
                          <li key={a.id}>
                            <button type="button" className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary" onClick={() => (setKind("reply"), setDraft((d) => (d ? `${d}\n\n${a.body}` : a.body)), toast.info("Inserted — edit it before sending"))}>
                              <span className="block font-medium">{a.title}</span>
                              <span className="line-clamp-2 block text-xs text-muted-foreground">{a.body}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>
                <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={kind === "reply" ? "Reply to customer" : "Internal note"} placeholder={kind === "reply" ? "Write to the customer…" : "Only your team can see this"} className={cn(kind === "note" && "border-amber-300 bg-amber-50/40")} />
                {draft.includes("{{") && <p className="mt-1 text-xs text-destructive">Replace the {"{{…}}"} placeholders before sending.</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  {kind === "reply" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={wait} onCheckedChange={(c) => setWait(c === true)} disabled={t.status !== "open"} /> Wait for the customer after replying
                    </label>
                  ) : (
                    <span />
                  )}
                  <Button
                    disabled={busy || !draft.trim() || draft.includes("{{")}
                    onClick={async () => {
                      if (await run(addTicketEntry(t.id, kind, draft, { waitForCustomer: wait }), kind === "reply" ? "Reply recorded (simulated — not delivered)" : "Note added")) {
                        setDraft("");
                        setWait(false);
                      }
                    }}
                  >
                    {kind === "reply" ? "Send reply (demo)" : "Add note"}
                  </Button>
                </div>
                {kind === "reply" && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FlaskConical className="size-3.5" /> Demo: the reply is recorded here and in Messaging; no email or SMS is delivered. The first reply sets the first-response time.
                  </p>
                )}
              </div>
            )}
          </section>
          <LinkedDocuments link={{ kind: "ticket", id: t.id }} title="Attachments" />
        </div>

        <aside className="flex flex-col gap-4" aria-label="Ticket details">
          <section className="rounded-2xl border border-border bg-card p-5 text-sm">
            <h2 className="mb-3 text-[0.9375rem] font-semibold">Customer</h2>
            {contact ? (
              <div className="space-y-1.5">
                <Link href={`/contacts/${contact.id}`} className="flex items-center gap-2 font-medium hover:underline">
                  <UserAvatar name={contact.displayName} size="sm" /> {contact.displayName}
                </Link>
                {account && <p className="text-muted-foreground">{account.name}</p>}
                {primaryMethod(contact, "phone") && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-3.5" /> {primaryMethod(contact, "phone")!.value}</p>}
                {primaryMethod(contact, "email") && <p className="flex items-center gap-2 truncate text-muted-foreground"><Mail className="size-3.5" /> {primaryMethod(contact, "email")!.value}</p>}
              </div>
            ) : (
              <p className="text-muted-foreground">Customer no longer available.</p>
            )}
          </section>
          <section className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
            <h2 className="text-[0.9375rem] font-semibold">Handling</h2>
            <div className="grid gap-1.5">
              <Label htmlFor="tk-owner">Owner</Label>
              {can ? <OwnerSelect id="tk-owner" value={t.ownerId ?? ""} onChange={(v) => run(updateTicket(t.id, { ownerId: v || null }), v ? `Assigned to ${users.get(v)?.name}` : "Unassigned")} owners={assignable} /> : <p>{t.ownerId ? users.get(t.ownerId)?.name : "Nobody"}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tk-cat">Category</Label>
                {can ? (
                  <Select value={t.category} onValueChange={(v) => run(updateTicket(t.id, { category: v }), "Category changed")}>
                    <SelectTrigger id="tk-cat"><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <p>{t.category}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tk-pri">Priority</Label>
                {can ? (
                  <Select value={t.priority} onValueChange={(v) => run(updateTicket(t.id, { priority: v as TicketPriority }), "Priority changed — targets recalculated")}>
                    <SelectTrigger id="tk-pri"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map((p) => <SelectItem key={p} value={p}>{TICKET_PRIORITY_LABELS[p]}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <p>{TICKET_PRIORITY_LABELS[t.priority]}</p>}
              </div>
            </div>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 pt-1">
              <dt className="text-muted-foreground">Came in by</dt>
              <dd>{TICKET_SOURCE_LABELS[t.source]}</dd>
              <dt className="text-muted-foreground">Opened</dt>
              <dd>{fmt(t.openedAt)}</dd>
            </dl>
          </section>
          <section className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
            <h2 className="text-[0.9375rem] font-semibold">Targets</h2>
            <div>
              <p className="text-xs text-muted-foreground">First reply · due {fmt(t.firstResponseDueAt)}</p>
              <TargetState {...responseTarget(t)} now={now} tz={tz} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resolve · due {fmt(t.resolutionDueAt)}</p>
              <TargetState {...resolutionTarget(t)} now={now} tz={tz} />
            </div>
            <p className="text-xs text-muted-foreground">Prototype targets for {TICKET_PRIORITY_LABELS[t.priority].toLowerCase()} priority, in calendar hours from when it was opened.</p>
          </section>
          {(t.status === "resolved" || t.status === "closed") && (
            <section className="space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
              <h2 className="text-[0.9375rem] font-semibold">Customer rating</h2>
              {t.rating ? (
                <p className="flex items-center gap-2">
                  {t.rating.score === "good" ? <ThumbsUp className="size-4 text-success" /> : <ThumbsDown className="size-4 text-destructive" />}
                  {t.rating.score === "good" ? "Good" : "Poor"}
                  {t.rating.comment && <span className="text-muted-foreground">— “{t.rating.comment}”</span>}
                </p>
              ) : (
                <p className="text-muted-foreground">Not rated yet.</p>
              )}
              {can && !t.rating && (
                <Button size="sm" variant="outline" onClick={() => setRating(true)}>
                  <Star /> Record rating (demo)
                </Button>
              )}
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={resolving}
        onOpenChange={setResolving}
        title="Resolve this ticket?"
        description="Say how it was resolved. The customer is not notified in this prototype."
        confirmLabel="Resolve ticket"
        onConfirm={async () => {
          const ok = await run(setTicketStatus(t.id, "resolved", summary), "Ticket resolved");
          if (!ok) throw new Error("not resolved");
          setSummary("");
        }}
      >
        <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Replacement castors fitted on site" aria-label="Resolution summary" />
      </ConfirmDialog>
      <ConfirmDialog open={rating} onOpenChange={setRating} title="Record the customer's rating" description="Simulates the customer answering the satisfaction question." confirmLabel="Good" onConfirm={() => run(recordRating(t.id, "good"), "Rated Good (simulated)")}>
        <Button variant="outline" onClick={async () => (await run(recordRating(t.id, "poor"), "Rated Poor (simulated)")) && setRating(false)}>
          Record Poor instead
        </Button>
      </ConfirmDialog>
      {gate.dialog}
    </PageContainer>
  );
}
