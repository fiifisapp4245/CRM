"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText, FlaskConical, Inbox, Mail, MessageCircle, MessageSquare, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { hasPermission } from "@/lib/permissions";
import { dayKey, formatInTz } from "@/lib/business/time";
import { cn } from "@/lib/utils";
import { FilterPopover } from "@/components/data-table/filter-popover";
import { FilterChips, type FilterChip } from "@/components/data-table/filter-chips";
import { DateRangeFilter, dateRangeLabel } from "@/components/data-table/date-range-filter";
import { FilterSelect } from "@/components/data-table/filter-select";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { SearchField } from "@/components/data-table/search-field";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/states";
import { useFeatureGate } from "@/components/entitlements/upgrade";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMessagingData } from "../hooks";
import { commSummary, DEFAULT_COMM_FILTERS, filterComms, type CommFilters } from "../lib/messaging";
import { deleteTemplate } from "../services/messaging-service";
import { CHANNEL_LABELS, COMM_STATUS_LABELS, type Channel, type Communication, type CommStatus, type MessageTemplate } from "../types";
import { CommStatusBadge, formatGhs } from "./status";
import { TemplateText } from "./template-text";

export function MessagingPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { db, user, now, contacts, comms, tz } = useMessagingData();
  const [f, setF] = useState<CommFilters>(DEFAULT_COMM_FILTERS);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [delTpl, setDelTpl] = useState<MessageTemplate | null>(null);
  const gate = useFeatureGate("messaging");
  const canTemplates = hasPermission(user, "templates.manage");
  const tab = params.get("tab") === "templates" ? "templates" : "sent";
  const set = (p: Partial<CommFilters>) => setF((s) => ({ ...s, ...p }));
  const nameOf = (id: string) => contacts.get(id)?.displayName ?? "Unknown";
  const rows = useMemo(() => filterComms(comms, f, (id) => contacts.get(id)?.displayName ?? ""), [comms, f, contacts]);
  const sum = commSummary(rows);
  const detail = detailId ? comms.find((m) => m.id === detailId) : undefined;
  const fmt = (iso: string) => formatInTz(iso, tz, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const dirty = JSON.stringify(f) !== JSON.stringify(DEFAULT_COMM_FILTERS);
  const today = dayKey(now, tz);
  const chips: FilterChip[] = [
    ...f.channels.map((c) => ({ key: `c${c}`, label: CHANNEL_LABELS[c], onRemove: () => set({ channels: f.channels.filter((x) => x !== c) }) })),
    ...f.statuses.map((st) => ({ key: `s${st}`, label: COMM_STATUS_LABELS[st], onRemove: () => set({ statuses: f.statuses.filter((x) => x !== st) }) })),
    ...(f.from || f.to ? [{ key: "date", label: `Sent: ${dateRangeLabel({ from: f.from, to: f.to }, today)}`, onRemove: () => set({ from: "", to: "" }) }] : []),
    ...(f.kind !== "all" ? [{ key: "kind", label: f.kind === "campaign" ? "Campaigns only" : "One-to-one only", onRemove: () => set({ kind: "all" }) }] : []),
  ];

  const related = (m: Communication) => {
    if (m.campaignId) {
      const c = db.campaigns.find((x) => x.id === m.campaignId);
      return c ? { label: c.name, href: `/campaigns/${c.id}` } : null;
    }
    if (m.ticketId) {
      const t = db.tickets.find((x) => x.id === m.ticketId);
      return t ? { label: `${t.number} ${t.subject}`, href: `/tickets/${t.id}` } : null;
    }
    if (m.dealId) {
      const d = db.deals.find((x) => x.id === m.dealId);
      return d ? { label: d.title, href: `/deals/${d.id}` } : null;
    }
    return null;
  };

  const columns = useMemo<ColumnDef<Communication, unknown>[]>(
    () => [
      {
        id: "to",
        header: "Recipient",
        cell: ({ row: { original: m } }) => (
          <div className="min-w-40">
            <Link href={`/contacts/${m.contactId}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">
              {nameOf(m.contactId)}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{m.to}</p>
          </div>
        ),
      },
      {
        id: "channel",
        header: "Channel",
        meta: { className: "whitespace-nowrap" },
        cell: ({ row: { original: m } }) => {
          const Icon = m.channel === "email" ? Mail : m.channel === "whatsapp" ? MessageCircle : MessageSquare;
          return (
            <div>
              <p className="flex items-center gap-1.5">
                <Icon className="size-3.5 text-subtle-foreground" /> {CHANNEL_LABELS[m.channel]}
              </p>
              <p className="text-xs text-muted-foreground">{m.kind === "campaign" ? "Campaign" : "One-to-one"}</p>
            </div>
          );
        },
      },
      {
        id: "message",
        header: "Message",
        meta: { className: "hidden lg:table-cell", headerClassName: "hidden lg:table-cell" },
        cell: ({ row: { original: m } }) => {
          const r = related(m);
          return (
            <div className="max-w-80 min-w-56">
              <p className="line-clamp-1">{m.subject ?? m.body}</p>
              {r ? (
                <Link href={r.href} onClick={(e) => e.stopPropagation()} className="line-clamp-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
                  {r.label}
                </Link>
              ) : (
                <p className="text-xs text-subtle-foreground">Not linked to a deal, ticket or campaign</p>
              )}
            </div>
          );
        },
      },
      { id: "status", header: "Status", cell: ({ row }) => <CommStatusBadge status={row.original.status} /> },
      { id: "at", header: "Created", meta: { className: "whitespace-nowrap" }, cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{fmt(row.original.createdAt)}</span> },
      { id: "cost", header: "Cost", meta: { className: "whitespace-nowrap text-right", headerClassName: "text-right" }, cell: ({ row }) => <span className="tabular-nums">{formatGhs(row.original.cost)}</span> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, contacts, tz],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Messaging"
        description="SMS, email and WhatsApp sent from the CRM — with delivery and cost tracking. In this prototype every message and status is simulated."
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(v === "templates" ? "/messaging?tab=templates" : "/messaging")}>
        <TabsList aria-label="Messaging sections">
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filter sent messages">
              <div className="w-full sm:w-72">
                <SearchField value={f.search} onChange={(search) => set({ search })} placeholder="Search recipient, number or message" label="Search messages" />
              </div>
              <FilterPopover label="Channel" options={(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => ({ value: c, label: CHANNEL_LABELS[c], hint: String(comms.filter((m) => m.channel === c).length) }))} selected={f.channels} onChange={(v) => set({ channels: v as Channel[] })} />
              <FilterPopover label="Status" options={(Object.keys(COMM_STATUS_LABELS) as CommStatus[]).map((st) => ({ value: st, label: COMM_STATUS_LABELS[st], hint: String(comms.filter((m) => m.status === st).length) }))} selected={f.statuses} onChange={(v) => set({ statuses: v as CommStatus[] })} />
              <FilterSelect
                label="Kind"
                value={f.kind}
                baseline="all"
                onChange={(kind) => set({ kind })}
                options={[
                  { value: "all", label: "One-to-one and campaigns" },
                  { value: "one_to_one", label: "One-to-one" },
                  { value: "campaign", label: "Campaigns" },
                ]}
              />
              <DateRangeFilter value={{ from: f.from, to: f.to }} onChange={(r) => set(r)} today={today} label="Sent" />
              <p className="ml-auto hidden text-sm text-muted-foreground tabular-nums md:block" aria-live="polite">
                {rows.length} of {comms.length} messages
              </p>
            </div>
            <FilterChips chips={chips}>
              {dirty && (
                <Button variant="ghost" size="sm" onClick={() => setF(DEFAULT_COMM_FILTERS)}>
                  Clear all
                </Button>
              )}
            </FilterChips>
          </div>

          <dl className="grid grid-cols-2 divide-border/70 rounded-2xl border border-border bg-card sm:grid-cols-4 sm:divide-x">
            {[
              { label: "Messages", value: String(sum.messages), sub: f.kind === "campaign" ? "Campaign messages" : f.kind === "one_to_one" ? "One-to-one" : "One-to-one and campaigns" },
              { label: "Delivered", value: String(sum.delivered), sub: sum.messages ? `${Math.round((sum.delivered / sum.messages) * 100)}% of messages` : "—" },
              { label: "Failed", value: String(sum.failed), sub: sum.failed ? "Open a message to see why" : "None failed", danger: sum.failed > 0 },
              { label: "SMS cost", value: formatGhs(sum.smsCost), sub: "Demo rate · WhatsApp and email unknown" },
            ].map((m, i) => (
              <div key={m.label} className={cn("px-5 py-4", i < 2 && "border-b border-border/70 sm:border-b-0", i === 1 && "border-l border-border/70 sm:border-l-0", i === 3 && "border-l border-border/70 sm:border-l-0")}>
                <dt className="text-sm text-muted-foreground">{m.label}</dt>
                <dd className={cn("mt-1 text-2xl font-semibold tracking-[-0.01em] tabular-nums", m.danger && "text-destructive")}>{m.value}</dd>
                <dd className="mt-0.5 text-xs text-muted-foreground">{m.sub}</dd>
              </div>
            ))}
          </dl>
          <DataTable
            label="Sent messages"
            columns={columns}
            data={rows}
            getRowId={(m) => m.id}
            onRowClick={(m) => setDetailId(m.id)}
            empty={
              comms.length === 0 ? (
                <EmptyState icon={Inbox} title="No messages yet" description="Send messages from a contact or a deal. They'll be listed here with their delivery status." />
              ) : (
                <EmptyState icon={Search} title="No messages match" description="Try another channel, status or date range." action={<Button variant="outline" onClick={() => setF(DEFAULT_COMM_FILTERS)}>Reset filters</Button>} />
              )
            }
          />
        </TabsContent>

        <TabsContent value="templates" className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Wording you use again and again, with fields filled in for each person.</p>
            {canTemplates && (
              <Button onClick={gate.guard(() => router.push("/messaging/templates/new"))}>
                <Plus /> New template
              </Button>
            )}
          </div>
          {db.templates.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card">
              <EmptyState icon={FileText} title="No templates yet" />
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {db.templates.map((t) => (
                <li key={t.id} className="flex flex-col rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{CHANNEL_LABELS[t.channel]}</p>
                    </div>
                    {canTemplates && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`} onClick={gate.guard(() => router.push(`/messaging/templates/${t.id}`))}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${t.name}`} onClick={gate.guard(() => setDelTpl(t))}>
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </div>
                  {t.subject && <p className="mt-3 text-sm font-medium"><TemplateText text={t.subject} /></p>}
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground"><TemplateText text={t.body} /></p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          {detail && (
            <>
              <SheetHeader className="border-b border-border/70 px-6 py-5">
                <SheetTitle className="flex items-center gap-2">
                  <MessageSquare className="size-4" /> {CHANNEL_LABELS[detail.channel]} to {nameOf(detail.contactId)}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-1.5">
                  <FlaskConical className="size-3.5" /> Demo record — not delivered by any provider.
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <CommStatusBadge status={detail.status} />
                  <span className="text-muted-foreground">{detail.kind === "campaign" ? "Campaign message" : "One-to-one"}</span>
                </div>
                <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2">
                  <dt className="text-muted-foreground">To</dt>
                  <dd>{detail.to}</dd>
                  {related(detail) && (
                    <>
                      <dt className="text-muted-foreground">Related to</dt>
                      <dd>
                        <Link href={related(detail)!.href} className="hover:underline">{related(detail)!.label}</Link>
                      </dd>
                    </>
                  )}
                  {detail.templateId && (
                    <>
                      <dt className="text-muted-foreground">Template</dt>
                      <dd>{db.templates.find((t) => t.id === detail.templateId)?.name ?? "Deleted template"}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Cost</dt>
                  <dd>{formatGhs(detail.cost)}{detail.cost !== null && " (demo rate)"}</dd>
                  <dt className="text-muted-foreground">Permission</dt>
                  <dd>
                    {detail.consent.purpose === "marketing" ? "Marketing" : "Operational"} — {detail.consent.reason}
                  </dd>
                </dl>
                <div className="rounded-xl border border-border bg-panel/60 p-4">
                  {detail.subject && <p className="mb-2 font-medium">{detail.subject}</p>}
                  <p className="whitespace-pre-line">{detail.body}</p>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Status history (simulated)</h3>
                  <ol className="space-y-2">
                    {detail.history.map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CommStatusBadge status={h.status} />
                        <span className="text-xs text-muted-foreground">
                          {fmt(h.at)}
                          {h.note && ` · ${h.note}`}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={!!delTpl}
        onOpenChange={(o) => !o && setDelTpl(null)}
        title="Delete this template?"
        description={delTpl ? `"${delTpl.name}" will no longer be offered when sending. Messages already sent keep their wording.` : ""}
        confirmLabel="Delete template"
        destructive
        onConfirm={async () => {
          const r = await deleteTemplate(delTpl!.id);
          if (!r.ok) {
            toast.error(r.error);
            throw new Error(r.error);
          }
          toast.success("Template deleted");
        }}
      />
      {gate.dialog}
    </PageContainer>
  );
}
