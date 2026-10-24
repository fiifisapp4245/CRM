"use client";

import { useParams } from "next/navigation";
import { QuoteGuard } from "@/features/sales/components/quote-guard";
import { QuoteDetailPage } from "@/features/sales/components/quote-detail-page";

export default function Page() {
  const { quoteId } = useParams<{ quoteId: string }>();
  return <QuoteGuard id={quoteId}>{(q) => <QuoteDetailPage key={q.id} quote={q} />}</QuoteGuard>;
}
