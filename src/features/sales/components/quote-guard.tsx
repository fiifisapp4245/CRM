"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { useSales } from "../hooks/use-sales";
import type { Quote } from "../types";

export function QuoteGuard({ id, children }: { id: string; children: (q: Quote) => ReactNode }) {
  const quote = useSales().quotes.find((q) => q.id === id);
  if (quote) return <>{children(quote)}</>;
  return (
    <PageContainer>
      <EmptyState icon={SearchX} title="Quote not found" description="It may belong to a deal outside your access, or the link is wrong." action={<Button asChild variant="outline"><Link href="/quotes">Back to quotes</Link></Button>} />
    </PageContainer>
  );
}
