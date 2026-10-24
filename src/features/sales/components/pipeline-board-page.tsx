"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, CalendarDays, List, Plus, ThumbsDown, Trophy } from "lucide-react";
import { toast } from "sonner";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/format";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { FilterPopover } from "@/components/data-table/filter-popover";
import { SearchField } from "@/components/data-table/search-field";
import { PermissionNotice } from "@/components/feedback/states";
import { Segmented } from "@/components/shared/segmented";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSales } from "../hooks/use-sales";
import { dealCaps } from "../lib/access";
import { dealAttention, dealProbability, dealValue, formatAmount, sumByCurrency, weightedValue } from "../lib/calc";
import { moveDealStage } from "../services/deals-service";
import type { Currency, Deal, PipelineStage } from "../types";
import { AttentionBadge } from "./badges";
import { CloseDealDialog } from "./close-deal-dialog";

type Drop = string | "won" | "lost";

export function PipelineBoardPage() {
  const { db, user, now, deals, users, contacts, accounts, pipelines, taxes } = useSales();
  const pipeline = pipelines[0];
  const stages = pipeline.stages.filter((s) => s.kind === "open");
  const [search, setSearch] = useState("");
  const [owners, setOwners] = useState<string[]>([]);
  const [currency, setCurrency] = useState<"all" | Currency>("all");
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Drop | null>(null);
  const [closing, setClosing] = useState<{ deal: Deal; outcome: "won" | "lost" } | null>(null);
  const [announce, setAnnounce] = useState("");

  const ownerOptions = useMemo(() => {
    const ids = new Set(deals.map((d) => d.ownerId));
    return db.users.filter((u) => ids.has(u.id)).map((u) => ({ value: u.id, label: u.id === user.id ? `${u.name} (you)` : u.name }));
  }, [deals, db.users, user.id]);

  const open = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (d.status !== "open" || d.pipelineId !== pipeline.id) return false;
      if (owners.length && !owners.includes(d.ownerId ?? "")) return false;
      if (currency !== "all" && d.currency !== currency) return false;
      if (!q) return true;
      return [d.title, d.contactId && contacts.get(d.contactId)?.displayName, d.accountId && accounts.get(d.accountId)?.name].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [deals, pipeline.id, owners, currency, search, contacts, accounts]);

  if (!hasPermission(user, "sales.view")) return <PageContainer><PermissionNotice /></PageContainer>;

  const dealById = (id: string) => open.find((d) => d.id === id);

  const move = async (deal: Deal, to: Drop) => {
    if (to === "won" || to === "lost") {
      // The board never closes a deal silently — the outcome dialog asks for the date, value and reason.
      setClosing({ deal, outcome: to });
      return;
    }
    if (to === deal.stageId) return;
    const stage = stages.find((s) => s.id === to)!;
    const r = await moveDealStage(deal.id, to);
    if (r.ok) {
      const msg = `${deal.title} moved to ${stage.name}. Chance now ${dealProbability(r.data, pipelines)}%.`;
      setAnnounce(msg);
      toast.success(`Moved to ${stage.name}`, { description: deal.title });
    } else toast.error(r.error);
  };

  const onDrop = (to: Drop) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const deal = dealById(id);
    setDragging(null);
    setOver(null);
    if (deal) void move(deal, to);
  };
  const dropTarget = (to: Drop) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== to) setOver(to);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === to ? null : o));
    },
    onDrop: onDrop(to),
  });

  return (
    <PageContainer width="full">
      <PageHeader
        title="Pipeline"
        description="Open deals by stage. Drag a card to move it, or use its Move menu. Closing a deal always asks for the outcome."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/deals">
                <List /> List
              </Link>
            </Button>
            {hasPermission(user, "deals.manage") && (
              <Button asChild>
                <Link href="/deals/new">
                  <Plus /> New deal
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchField value={search} onChange={setSearch} placeholder="Search deal, contact or company" label="Search pipeline" />
        <div className="flex flex-wrap items-center gap-2">
          <FilterPopover label="Owner" options={ownerOptions} selected={owners} onChange={setOwners} searchable />
          <Segmented
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={[
              { value: "all", label: "All currencies" },
              { value: "GHS", label: "GHS" },
              { value: "USD", label: "USD" },
            ]}
          />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex min-w-max gap-3" role="list" aria-label={`${pipeline.name} stages`}>
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={open.filter((d) => d.stageId === stage.id).sort((a, b) => a.expectedClose.localeCompare(b.expectedClose))}
              highlighted={over === stage.id}
              dropProps={dropTarget(stage.id)}
              renderCard={(d) => {
                const caps = dealCaps(db, user, d);
                const c = d.contactId ? contacts.get(d.contactId) : undefined;
                const a = d.accountId ? accounts.get(d.accountId) : undefined;
                const owner = d.ownerId ? users.get(d.ownerId) : undefined;
                const att = dealAttention(d, now);
                return (
                  <li
                    key={d.id}
                    draggable={caps.move}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", d.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(d.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={cn(
                      "group relative rounded-xl border border-border bg-card p-3 text-sm transition-[border-color,opacity] hover:border-border-strong",
                      caps.move && "cursor-grab active:cursor-grabbing",
                      dragging === d.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Link href={`/deals/${d.id}`} className="min-w-0 flex-1 font-medium leading-snug after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring" draggable={false}>
                        {d.title}
                      </Link>
                      {caps.move && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-xs" className="relative z-10 -mt-0.5 -mr-1 text-muted-foreground" aria-label={`Move ${d.title}`}>
                              <ArrowRightLeft />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-52">
                            <DropdownMenuLabel>Move to</DropdownMenuLabel>
                            {stages.map((s) => (
                              <DropdownMenuItem key={s.id} disabled={s.id === d.stageId} onSelect={() => move(d, s.id)}>
                                {s.name} <span className="ml-auto pl-4 text-xs text-muted-foreground tabular-nums">{s.probability}%</span>
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => move(d, "won")}>
                              <Trophy /> Mark won…
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => move(d, "lost")}>
                              <ThumbsDown /> Mark lost…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{[c?.displayName, a?.name].filter(Boolean).join(" · ") || "No customer linked"}</p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div>
                        <p className="font-semibold tabular-nums">{formatAmount(dealValue(d, taxes), d.currency)}</p>
                        <p className={cn("mt-0.5 flex items-center gap-1 text-xs", att.kind === "past_close" ? "text-destructive" : "text-muted-foreground")}>
                          <CalendarDays className="size-3" /> {formatDate(d.expectedClose)}
                          {d.probability !== undefined && <span className="text-muted-foreground"> · {d.probability}%</span>}
                        </p>
                      </div>
                      {owner && <UserAvatar name={owner.name} size="sm" className="relative" />}
                    </div>
                    {(att.kind === "going_cold" || att.kind === "past_close") && (
                      <div className="relative z-10 mt-2">
                        <AttentionBadge kind={att.kind} reason={att.reason} />
                      </div>
                    )}
                  </li>
                );
              }}
              totals={(list) => ({
                value: sumByCurrency(list, (d) => d.currency, (d) => dealValue(d, taxes)),
                weighted: sumByCurrency(list, (d) => d.currency, (d) => weightedValue(d, pipelines, taxes)),
              })}
            />
          ))}
        </div>
      </div>

      {/* Outcome zones appear only while dragging; dropping opens the Won/Lost dialog instead of closing the deal. */}
      <div className={cn("sticky bottom-4 z-20 grid grid-cols-2 gap-3 transition-opacity", dragging ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!dragging}>
        {(["won", "lost"] as const).map((o) => (
          <div
            key={o}
            {...dropTarget(o)}
            className={cn(
              "flex h-16 items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card text-sm font-medium shadow-md",
              o === "won" ? "border-success/50 text-success" : "border-border-strong text-muted-foreground",
              over === o && (o === "won" ? "bg-success/10" : "bg-muted"),
            )}
          >
            {o === "won" ? <Trophy className="size-4" /> : <ThumbsDown className="size-4" />} Drop to mark {o}
          </div>
        ))}
      </div>

      <CloseDealDialog deal={closing?.deal ?? null} outcome={closing?.outcome ?? "won"} onOpenChange={(o) => !o && setClosing(null)} onDone={(d) => setAnnounce(`${d.title} marked ${d.status}.`)} />
    </PageContainer>
  );
}

function StageColumn({
  stage,
  deals,
  highlighted,
  dropProps,
  renderCard,
  totals,
}: {
  stage: PipelineStage;
  deals: Deal[];
  highlighted: boolean;
  dropProps: React.HTMLAttributes<HTMLDivElement>;
  renderCard: (d: Deal) => React.ReactNode;
  totals: (list: Deal[]) => { value: Record<Currency, number>; weighted: Record<Currency, number> };
}) {
  const t = totals(deals);
  const currencies = (Object.keys(t.value) as Currency[]).filter((c) => deals.some((d) => d.currency === c));
  return (
    <div role="listitem" aria-label={`${stage.name}, ${deals.length} deals`} className={cn("flex w-72 shrink-0 flex-col rounded-2xl border bg-panel transition-colors", highlighted ? "border-brand-600 bg-brand-50" : "border-border")} {...dropProps}>
      <div className="border-b border-border/70 px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {stage.name} {deals.length > 0 && <span className="font-normal text-muted-foreground tabular-nums">{deals.length}</span>}
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums" title="Default chance of winning at this stage">
            {stage.probability}%
          </span>
        </div>
        <div className="mt-1 min-h-4 space-y-0.5 text-xs text-muted-foreground">
          {currencies.length === 0 && <p>No deals</p>}
          {currencies.map((c) => (
            <p key={c} className="tabular-nums">
              <span className="font-medium text-foreground">{formatAmount(t.value[c], c, { compact: true })}</span> · weighted {formatAmount(t.weighted[c], c, { compact: true })}
            </p>
          ))}
        </div>
      </div>
      <ul className="flex min-h-40 flex-1 flex-col gap-2 p-2">
        {deals.map(renderCard)}
        {deals.length === 0 && <li className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">Drop a deal here</li>}
      </ul>
    </div>
  );
}
