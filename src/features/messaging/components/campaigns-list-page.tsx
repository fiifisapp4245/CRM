"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Megaphone, Plus } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatInTz } from "@/lib/business/time";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data-table/data-table";
import { FilterPopover } from "@/components/data-table/filter-popover";
import { SearchField } from "@/components/data-table/search-field";
import { EmptyState } from "@/components/feedback/states";
import { useFeatureGate } from "@/components/entitlements/upgrade";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useMessagingData } from "../hooks";
import { CAMPAIGN_STATUS_LABELS, CHANNEL_LABELS, type Campaign, type CampaignStatus } from "../types";
import { CampaignStatusBadge } from "./status";

export function CampaignsListPage() {
  const router = useRouter();
  const { db, user, tz } = useMessagingData();
  const gate = useFeatureGate("campaigns");
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");
  const [search, setSearch] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const canManage = hasPermission(user, "campaigns.manage");
  const campaigns = useMemo(() => db.campaigns.filter((c) => c.orgId === user.orgId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [db.campaigns, user.orgId]);
  const q = search.trim().toLowerCase();
  const segName = (id: string) => db.segments.find((x) => x.id === id)?.name ?? "";
  const rows = campaigns.filter((c) => (status === "all" || c.status === status) && (!channels.length || channels.includes(c.channel)) && (!q || `${c.name} ${segName(c.segmentId)}`.toLowerCase().includes(q)));
  const fmt = (iso?: string) => (iso ? formatInTz(iso, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

  const columns = useMemo<ColumnDef<Campaign, unknown>[]>(
    () => [
      { id: "name", header: "Campaign", cell: ({ row: { original: c } }) => <div className="min-w-48"><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{CHANNEL_LABELS[c.channel]} · {db.segments.find((s) => s.id === c.segmentId)?.name ?? "Deleted segment"}</p></div> },
      { id: "status", header: "Status", cell: ({ row }) => <CampaignStatusBadge status={row.original.status} /> },
      {
        id: "recipients",
        header: "Recipients",
        meta: { className: "whitespace-nowrap", headerClassName: "" },
        cell: ({ row: { original: c } }) => (c.status === "draft" ? <span className="text-muted-foreground">Worked out when scheduled</span> : <span className="tabular-nums">{c.eligibleCount} <span className="text-xs text-muted-foreground">· {c.excludedCount} excluded</span></span>),
      },
      {
        id: "delivered",
        header: "Delivered",
        meta: { className: "hidden md:table-cell whitespace-nowrap", headerClassName: "hidden md:table-cell" },
        cell: ({ row: { original: c } }) => {
          if (!c.communicationIds.length) return <span className="text-subtle-foreground">—</span>;
          const ms = db.communications.filter((m) => m.campaignId === c.id);
          const d = ms.filter((m) => m.status === "delivered").length;
          return (
            <span className="tabular-nums">
              {d} of {ms.length} <span className="text-xs text-muted-foreground">· {Math.round((d / ms.length) * 100)}%</span>
            </span>
          );
        },
      },
      { id: "when", header: "Send time", meta: { className: "whitespace-nowrap" }, cell: ({ row: { original: c } }) => <span className="text-muted-foreground tabular-nums">{c.status === "sent" || c.status === "going_out" ? fmt(c.sentAt) : fmt(c.scheduledAt)}</span> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, tz],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Campaigns"
        description="One message to a whole segment, only to people who may receive it, sent in your business hours."
        actions={
          canManage && (
            <Button onClick={gate.guard(() => router.push("/campaigns/new"))}>
              <Plus /> New campaign
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchField value={search} onChange={setSearch} placeholder="Search campaign or segment" label="Search campaigns" />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-auto min-w-44 px-3.5" aria-label="Status">
              <span className="text-muted-foreground">Status:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses ({campaigns.length})</SelectItem>
              {(Object.keys(CAMPAIGN_STATUS_LABELS) as CampaignStatus[]).map((st) => (
                <SelectItem key={st} value={st}>
                  {CAMPAIGN_STATUS_LABELS[st]} ({campaigns.filter((c) => c.status === st).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FilterPopover label="Channel" options={[{ value: "email", label: "Email" }, { value: "sms", label: "SMS" }]} selected={channels} onChange={setChannels} />
          {(search || status !== "all" || channels.length > 0) && (
            <Button variant="ghost" onClick={() => (setSearch(""), setStatus("all"), setChannels([]))}>
              Clear filters
            </Button>
          )}
        </div>
      </div>
      <DataTable
        label="Campaigns"
        columns={columns}
        data={rows}
        getRowId={(c) => c.id}
        onRowClick={(c) => router.push(`/campaigns/${c.id}`)}
        empty={<EmptyState icon={Megaphone} title={campaigns.length ? "No campaigns match" : "No campaigns yet"} description="Pick a segment, write one message, and send it only to people who agreed to hear from you." />}
      />
      {gate.dialog}
    </PageContainer>
  );
}
