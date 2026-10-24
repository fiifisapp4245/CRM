"use client";

import { useParams } from "next/navigation";
import { DealGuard } from "@/features/sales/components/deal-guard";
import { DealDetailPage } from "@/features/sales/components/deal-detail-page";

export default function Page() {
  const { dealId } = useParams<{ dealId: string }>();
  return <DealGuard id={dealId}>{(d) => <DealDetailPage key={d.id} deal={d} />}</DealGuard>;
}
