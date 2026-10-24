"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { useSales } from "../hooks/use-sales";
import type { Deal } from "../types";

export function DealGuard({ id, children }: { id: string; children: (d: Deal) => ReactNode }) {
  const deal = useSales().deals.find((d) => d.id === id);
  if (deal) return <>{children(deal)}</>;
  return (
    <PageContainer>
      <EmptyState icon={SearchX} title="Deal not found" description="It may belong to someone outside your access, or the link is wrong." action={<Button asChild variant="outline"><Link href="/deals">Back to deals</Link></Button>} />
    </PageContainer>
  );
}
