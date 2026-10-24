"use client";

import { useParams } from "next/navigation";
import { LeadGuard } from "@/features/sales/components/lead-guard";
import { LeadDetailPage } from "@/features/sales/components/lead-detail-page";

export default function Page() {
  const { leadId } = useParams<{ leadId: string }>();
  return <LeadGuard id={leadId}>{(l) => <LeadDetailPage key={l.id} lead={l} />}</LeadGuard>;
}
