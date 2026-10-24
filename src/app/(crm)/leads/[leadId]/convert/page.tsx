"use client";

import { useParams } from "next/navigation";
import { LeadGuard } from "@/features/sales/components/lead-guard";
import { LeadConvertPage } from "@/features/sales/components/lead-convert-page";

export default function Page() {
  const { leadId } = useParams<{ leadId: string }>();
  return <LeadGuard id={leadId}>{(l) => <LeadConvertPage key={l.id} lead={l} />}</LeadGuard>;
}
