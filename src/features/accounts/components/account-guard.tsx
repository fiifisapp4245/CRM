"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { useVisibleAccounts } from "../hooks/use-accounts";
import type { Account } from "../types";

export function AccountGuard({ id, children }: { id: string; children: (a: Account) => ReactNode }) {
  const account = useVisibleAccounts().find((a) => a.id === id);
  if (account) return <>{children(account)}</>;
  return (
    <PageContainer>
      <EmptyState icon={SearchX} title="Account not found" description="It may not exist in your organisation, or the link is wrong." action={<Button asChild variant="outline"><Link href="/accounts">Back to accounts</Link></Button>} />
    </PageContainer>
  );
}
