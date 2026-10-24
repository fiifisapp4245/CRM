"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { useSales } from "@/features/sales/hooks/use-sales";
import { QuoteForm } from "@/features/sales/components/quote-form";

function NewQuote() {
  const { db, user, deals } = useSales();
  const dealId = useSearchParams().get("dealId");
  const deal = deals.find((d) => d.id === dealId);
  if (!deal)
    return (
      <PageContainer>
        <EmptyState icon={FileText} title="Choose a deal first" description="Quotes are created from a deal so the customer and prices come with them. Open a deal and choose New quote." action={<Button asChild variant="outline"><Link href="/deals">Go to deals</Link></Button>} />
      </PageContainer>
    );
  if (!hasPermission(user, "quotes.manage") || !canWriteRecord(user, deal, db.users))
    return <PageContainer><PermissionNotice title="You can't create quotes for this deal" action={<Button asChild variant="outline"><Link href={`/deals/${deal.id}`}>Back to deal</Link></Button>} /></PageContainer>;
  return <QuoteForm deal={deal} />;
}

export default function Page() {
  return (
    <Suspense>
      <NewQuote />
    </Suspense>
  );
}
