"use client";

import Link from "next/link";
import { Plus, Workflow } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { useNow } from "@/lib/hooks/use-now";
import { useDbStore } from "@/lib/mock-data/db-store";
import { dealAttention, dealValue, stageOf } from "../lib/calc";
import type { Deal } from "../types";
import { AttentionBadge, DealStatusBadge, Money } from "./badges";

/** Compact deal list used on contact and account pages. */
export function RelatedDeals({ deals, newHref }: { deals: Deal[]; newHref?: string }) {
  const { pipelines, taxes } = useDbStore((s) => s.db);
  const now = useNow();
  return (
    <section className="rounded-2xl border border-border bg-card" aria-label="Deals">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
        <h3 className="text-[0.9375rem] font-semibold">
          Deals {deals.length > 0 && <span className="font-normal text-muted-foreground">{deals.length}</span>}
        </h3>
        {newHref && (
          <Button size="sm" variant="outline" asChild>
            <Link href={newHref}>
              <Plus /> New deal
            </Link>
          </Button>
        )}
      </div>
      {deals.length === 0 ? (
        <EmptyState compact icon={Workflow} title="No deals yet" />
      ) : (
        <ul className="divide-y divide-border/70">
          {deals
            .slice()
            .sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || a.expectedClose.localeCompare(b.expectedClose))
            .map((d) => {
              const att = dealAttention(d, now);
              return (
                <li key={d.id}>
                  <Link href={`/deals/${d.id}`} className="flex items-start gap-3 px-5 py-3.5 text-sm hover:bg-[#fafcfc] focus-visible:bg-brand-50/60 focus-visible:outline-none">
                    <Workflow className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        <Money amount={dealValue(d, taxes)} currency={d.currency} /> · {d.status === "open" ? `expected ${formatDate(d.expectedClose)}` : `closed ${formatDate(d.closedAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <DealStatusBadge status={d.status} stageName={stageOf(pipelines, d)?.name} />
                      <AttentionBadge kind={att.kind} reason={att.reason} link={false} />
                    </div>
                  </Link>
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}
