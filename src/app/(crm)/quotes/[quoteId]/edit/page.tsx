"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { canWriteRecord, hasPermission } from "@/lib/permissions";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { useSales } from "@/features/sales/hooks/use-sales";
import { QuoteGuard } from "@/features/sales/components/quote-guard";
import { QuoteForm } from "@/features/sales/components/quote-form";
import type { Quote } from "@/features/sales/types";

function Gate({ quote }: { quote: Quote }) {
  const { db, user } = useSales();
  const deal = db.deals.find((d) => d.id === quote.dealId);
  const back = <Button asChild variant="outline"><Link href={`/quotes/${quote.id}`}>Back to quote</Link></Button>;
  if (!deal || !hasPermission(user, "quotes.manage") || !canWriteRecord(user, deal, db.users)) return <PageContainer><PermissionNotice title="You can't edit this quote" action={back} /></PageContainer>;
  if (quote.status !== "draft") return <PageContainer><PermissionNotice title="Only drafts can be edited" description="This quote has been sent. Create a new quote for a revised offer." action={back} /></PageContainer>;
  return <QuoteForm deal={deal} quote={quote} />;
}

export default function Page() {
  const { quoteId } = useParams<{ quoteId: string }>();
  return <QuoteGuard id={quoteId}>{(q) => <Gate key={q.id} quote={q} />}</QuoteGuard>;
}
