"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { useSales } from "../hooks/use-sales";
import type { Lead } from "../types";

export function LeadGuard({ id, children }: { id: string; children: (l: Lead) => ReactNode }) {
  const lead = useSales().leads.find((l) => l.id === id);
  if (lead) return <>{children(lead)}</>;
  return (
    <PageContainer>
      <EmptyState icon={SearchX} title="Lead not found" description="It may belong to someone outside your access, or the link is wrong." action={<Button asChild variant="outline"><Link href="/leads">Back to leads</Link></Button>} />
    </PageContainer>
  );
}
