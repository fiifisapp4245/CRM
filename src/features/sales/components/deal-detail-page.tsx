"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilePlus2, Handshake, Mail, MessageSquare, Pencil, Phone, RotateCcw, ThumbsDown, Trophy } from "lucide-react";
import { useFeatureGate } from "@/components/entitlements/upgrade";
import { SendMessageDialog } from "@/features/messaging/components/send-message-dialog";
import { LinkedDocuments } from "@/features/documents/components/linked-documents";
import { toast } from "sonner";
import { formatDate, formatRelative } from "@/lib/utils/format";
import { Breadcrumbs, PageContainer } from "@/components/layout/page-header";
import { ProfileBanner } from "@/components/shared/profile-banner";
import { UserAvatar } from "@/components/shared/user-avatar";
import { InlineNotice } from "@/components/feedback/states";
import { EmptyState } from "@/components/feedback/states";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityComposer, type ComposerKind } from "@/features/activities/components/activity-composer";
import { ActivityTimeline } from "@/features/activities/components/activity-timeline";
import { AuditHistory } from "@/features/contacts/components/audit-history";
import { primaryMethod } from "@/features/contacts/lib/filters";
import { hasPermission } from "@/lib/permissions";
import { useSales } from "../hooks/use-sales";
import { dealCaps } from "../lib/access";
import { dealAttention, dealProbability, dealValue, formatAmount, lineResult, lineTotals, stageOf, weightedValue } from "../lib/calc";
import { moveDealStage, reopenDeal } from "../services/deals-service";
import { effectiveStatus } from "../services/quotes-service";
import type { Deal } from "../types";
import { AttentionBadge, DealStatusBadge, Money, QuoteStatusBadge } from "./badges";
import { CloseDealDialog } from "./close-deal-dialog";
import { TotalsSummary } from "./line-item-editor";
import { StatusStepper } from "./status-stepper";

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

export function DealDetailPage({ deal }: { deal: Deal }) {
  const { db, user, now, users, contacts, accounts, pipelines, taxes } = useSales();
  const caps = dealCaps(db, user, deal);
  const [closing, setClosing] = useState<"won" | "lost" | null>(null);
  const [reopen, setReopen] = useState(false);
  const [composer, setComposer] = useState<ComposerKind>("note");
  const [messageOpen, setMessageOpen] = useState(false);
  const messaging = useFeatureGate("messaging");
  const pipeline = pipelines.find((p) => p.id === deal.pipelineId) ?? pipelines[0];
  const openStages = pipeline.stages.filter((s) => s.kind === "open");
  const stage = stageOf(pipelines, deal);
  const contact = deal.contactId ? contacts.get(deal.contactId) : undefined;
  const account = deal.accountId ? accounts.get(deal.accountId) : undefined;
  const owner = deal.ownerId ? users.get(deal.ownerId) : undefined;
  const value = dealValue(deal, taxes);
  const prob = dealProbability(deal, pipelines);
  const att = dealAttention(deal, now);
  const activities = useMemo(() => db.activities.filter((a) => a.dealId === deal.id), [db.activities, deal.id]);
  const quotes = useMemo(() => db.quotes.filter((q) => q.dealId === deal.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.quotes, deal.id]);
  const lead = deal.leadId ? db.leads.find((l) => l.id === deal.leadId) : undefined;
  const totals = lineTotals(deal.lineItems, taxes);

  const move = async (i: number) => {
    const target = openStages[i];
    const r = await moveDealStage(deal.id, target.id);
    if (r.ok) toast.success(`Moved to ${target.name}`, { description: `Chance of winning now ${target.probability}% (stage default).` });
    else toast.error(r.error);
  };

  return (
    <PageContainer>
      <div className="-mb-2">
        <Breadcrumbs items={[{ label: "Deals", href: "/deals" }, { label: deal.title }]} />
      </div>
      <ProfileBanner
        muted={deal.status === "lost"}
        media={
          <span className="flex size-24 shrink-0 items-center justify-center rounded-2xl bg-card ring-4 ring-card">
            <span className="flex size-full items-center justify-center rounded-2xl border border-border bg-brand-50 text-brand-700">
              <Handshake className="size-10" />
            </span>
          </span>
        }
        actions={
          <>
            {caps.log && hasPermission(user, "messages.send") && (
              <Button variant="outline" onClick={messaging.guard(() => setMessageOpen(true))}>
                <MessageSquare /> Message
              </Button>
            )}
            {caps.quote && (
              <Button variant="outline" asChild>
                <Link href={`/quotes/new?dealId=${deal.id}`}>
                  <FilePlus2 /> New quote
                </Link>
              </Button>
            )}
            {caps.edit && (
              <Button variant="outline" asChild>
                <Link href={`/deals/${deal.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {caps.close && (
              <>
                <Button variant="outline" onClick={() => setClosing("lost")}>
                  <ThumbsDown /> Mark lost
                </Button>
                <Button onClick={() => setClosing("won")}>
                  <Trophy /> Mark won
                </Button>
              </>
            )}
            {caps.reopen && (
              <Button variant="outline" onClick={() => setReopen(true)}>
                <RotateCcw /> Reopen
              </Button>
            )}
          </>
        }
        title={
          <>
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">{deal.title}</h1>
            <DealStatusBadge status={deal.status} stageName={stage?.name} />
            <AttentionBadge kind={att.kind} reason={att.reason} />
          </>
        }
        subtitle={
          <>
            {contact ? <Link href={`/contacts/${contact.id}`} className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground">{contact.displayName}</Link> : "No contact"}
            {account && (
              <>
                {" · "}
                <Link href={`/accounts/${account.id}`} className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground">{account.name}</Link>
              </>
            )}
            {" · "}
            {pipeline.name}
          </>
        }
        facts={[
          { label: "Value", value: <Money amount={value} currency={deal.currency} className="font-medium" /> },
          { label: deal.status === "open" ? "Chance · weighted" : "Outcome", value: deal.status === "open" ? <span className="font-medium">{prob}% <span className="font-normal text-muted-foreground">· {formatAmount(weightedValue(deal, pipelines, taxes), deal.currency, { compact: true })}</span></span> : <span className="font-medium">{deal.status === "won" ? "Won" : "Lost"}{deal.status === "won" ? (deal.wonReason ? ` — ${deal.wonReason}` : "") : deal.lostReason ? ` — ${deal.lostReason}` : ""}</span> },
          { label: deal.status === "open" ? "Expected close" : "Closed", value: <span className="font-medium">{formatDate(deal.status === "open" ? deal.expectedClose : deal.closedAt)}</span> },
          { label: "Owner", value: owner ? <><UserAvatar name={owner.name} size="xs" /><span className="font-medium">{owner.name}</span></> : <span className="font-medium">Unassigned</span> },
        ]}
      />

      {deal.status === "open" ? (
        <>
          <StatusStepper label="Deal stage" steps={openStages.map((s) => s.name)} currentIndex={openStages.findIndex((s) => s.id === deal.stageId)} onSelect={caps.move ? move : undefined} />
          {att.kind !== "healthy" && (
            <InlineNotice tone={att.kind === "past_close" ? "danger" : "info"}>
              {att.reason}. {att.kind === "past_close" ? "Update the expected close date, or close the deal as won or lost." : "Log an interaction or move the stage to keep it warm."}
            </InlineNotice>
          )}
        </>
      ) : (
        <InlineNotice tone={deal.status === "won" ? "success" : "neutral"} icon={deal.status === "won" ? Trophy : ThumbsDown}>
          {deal.status === "won" ? "Won" : "Lost"} on {formatDate(deal.closedAt)}
          {deal.status === "won" ? (deal.wonReason ? ` · ${deal.wonReason}` : "") : ` · ${deal.lostReason}`}
          {deal.closeNote ? ` — “${deal.closeNote}”` : ""}. Closed deals are excluded from the open and weighted pipeline.
        </InlineNotice>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs defaultValue="overview" className="min-w-0">
          <TabsList aria-label="Deal sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">
              Activity {activities.length > 0 && <span className="text-xs font-normal text-subtle-foreground tabular-nums">{activities.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="quotes">
              Quotes {quotes.length > 0 && <span className="text-xs font-normal text-subtle-foreground tabular-nums">{quotes.length}</span>}
            </TabsTrigger>
            {hasPermission(user, "contacts.viewAudit") && <TabsTrigger value="history">History</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-5">
            <Card title={deal.valuation === "products" ? "Products and services" : "Value"}>
              {deal.valuation === "products" ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b border-border/70">
                          <th scope="col" className="py-2 pr-3 text-left font-medium">Item</th>
                          <th scope="col" className="py-2 pr-3 text-right font-medium">Qty</th>
                          <th scope="col" className="py-2 pr-3 text-right font-medium">Unit price</th>
                          <th scope="col" className="py-2 pr-3 text-right font-medium">Discount</th>
                          <th scope="col" className="py-2 pr-3 text-left font-medium">Tax</th>
                          <th scope="col" className="py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {deal.lineItems.map((li) => (
                          <tr key={li.id} className="align-top">
                            <td className="py-2 pr-3">
                              <p className="font-medium">{li.name}</p>
                              {li.description && <p className="text-xs text-muted-foreground">{li.description}</p>}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">{li.quantity}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{formatAmount(li.unitPrice, deal.currency)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{li.discountPct ? `${li.discountPct}%` : "—"}</td>
                            <td className="py-2 pr-3">{li.taxId ? `${taxes.find((t) => t.id === li.taxId)?.name}${li.taxInclusive ? " (incl.)" : ""}` : "—"}</td>
                            <td className="py-2 text-right font-medium tabular-nums">{formatAmount(lineResult(li, taxes).total, deal.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TotalsSummary totals={totals} currency={deal.currency} />
                </div>
              ) : (
                <p className="text-2xl font-semibold tabular-nums">{formatAmount(deal.amount, deal.currency)}</p>
              )}
            </Card>
            <Card title="Notes">{deal.notes ? <p className="whitespace-pre-line">{deal.notes}</p> : <p className="text-muted-foreground">No notes.</p>}</Card>
            <LinkedDocuments link={{ kind: "deal", id: deal.id }} />
          </TabsContent>

          <TabsContent value="activity" className="flex flex-col gap-5">
            {caps.log && contact && <ActivityComposer contactId={contact.id} contactName={contact.displayName} ownerId={deal.ownerId} kind={composer} onKindChange={setComposer} dealId={deal.id} />}
            {!deal.contactId && <InlineNotice tone="neutral">Add a contact to this deal to log calls, notes and meetings.</InlineNotice>}
            <ActivityTimeline activities={activities} users={users} />
          </TabsContent>

          <TabsContent value="quotes">
            <section className="rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
                <h3 className="text-[0.9375rem] font-semibold">Quotes</h3>
                {caps.quote && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/quotes/new?dealId=${deal.id}`}>
                      <FilePlus2 /> New quote
                    </Link>
                  </Button>
                )}
              </div>
              {quotes.length === 0 ? (
                <EmptyState compact icon={FilePlus2} title="No quotes yet" description="Create a quote from this deal's products and pricing." />
              ) : (
                <ul className="divide-y divide-border/70">
                  {quotes.map((q) => (
                    <li key={q.id}>
                      <Link href={`/quotes/${q.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-[#fafcfc]">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{q.number}</span>
                          <span className="block text-xs text-muted-foreground">
                            Valid until {formatDate(q.validUntil)} · {q.openedAt ? `opened ${formatRelative(q.openedAt, now)}` : q.status === "sent" ? "not opened yet" : `updated ${formatRelative(q.updatedAt, now)}`}
                          </span>
                        </span>
                        <Money amount={lineTotals(q.lineItems, taxes).total} currency={q.currency} className="font-medium" />
                        <QuoteStatusBadge status={effectiveStatus(q)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </TabsContent>

          {hasPermission(user, "contacts.viewAudit") && (
            <TabsContent value="history">
              <AuditHistory contactId={deal.id} users={users} noun="deal" />
            </TabsContent>
          )}
        </Tabs>

        <aside className="flex flex-col gap-4" aria-label="Deal information">
          <Card title="Customer">
            {contact ? (
              <div className="space-y-2">
                <Link href={`/contacts/${contact.id}`} className="flex items-center gap-2 font-medium hover:underline">
                  <UserAvatar name={contact.displayName} size="sm" /> {contact.displayName}
                </Link>
                {primaryMethod(contact, "phone") && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-3.5" /> {primaryMethod(contact, "phone")!.value}</p>}
                {primaryMethod(contact, "email") && <p className="flex items-center gap-2 truncate text-muted-foreground"><Mail className="size-3.5" /> {primaryMethod(contact, "email")!.value}</p>}
              </div>
            ) : (
              <p className="text-muted-foreground">No contact linked.</p>
            )}
            {account && (
              <p className="mt-3 border-t border-border/70 pt-3">
                Company: <Link href={`/accounts/${account.id}`} className="font-medium hover:underline">{account.name}</Link>
              </p>
            )}
          </Card>
          <Card title="Details">
            <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2">
              <dt className="text-muted-foreground">Stage</dt>
              <dd>{stage?.name}</dd>
              <dt className="text-muted-foreground">Chance</dt>
              <dd>{prob}% {deal.status === "open" && deal.probability === undefined && <span className="text-xs text-muted-foreground">(stage default)</span>}</dd>
              <dt className="text-muted-foreground">Valuation</dt>
              <dd>{deal.valuation === "products" ? "Products" : "Entered value"}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDate(deal.createdAt)}</dd>
              <dt className="text-muted-foreground">Last activity</dt>
              <dd>{deal.lastActivityAt ? formatRelative(deal.lastActivityAt, now) : "None"}</dd>
              {lead && (
                <>
                  <dt className="text-muted-foreground">From lead</dt>
                  <dd><Link href={`/leads/${lead.id}`} className="hover:underline">{lead.name}</Link></dd>
                </>
              )}
            </dl>
          </Card>
        </aside>
      </div>

      {contact && <SendMessageDialog open={messageOpen} onOpenChange={setMessageOpen} contact={contact} dealId={deal.id} />}
      {messaging.dialog}
      <CloseDealDialog deal={closing ? deal : null} outcome={closing ?? "won"} onOpenChange={(o) => !o && setClosing(null)} />
      <ConfirmDialog
        open={reopen}
        onOpenChange={setReopen}
        title="Reopen this deal?"
        description="It returns to the open pipeline at the last open stage. The original outcome stays in the history."
        confirmLabel="Reopen deal"
        onConfirm={async () => {
          const r = await reopenDeal(deal.id);
          if (r.ok) toast.success("Deal reopened");
          else toast.error(r.error);
        }}
      />
    </PageContainer>
  );
}
