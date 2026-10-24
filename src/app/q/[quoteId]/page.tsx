"use client";

import { useParams } from "next/navigation";
import { CustomerQuotePage } from "@/features/sales/components/customer-quote-page";

export default function Page() {
  const { quoteId } = useParams<{ quoteId: string }>();
  return <CustomerQuotePage quoteId={quoteId} />;
}
