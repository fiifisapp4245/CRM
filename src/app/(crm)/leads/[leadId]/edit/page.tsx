"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useCurrentUser } from "@/features/permissions";
import { leadCaps } from "@/features/sales/lib/access";
import { LeadGuard } from "@/features/sales/components/lead-guard";
import { LeadForm } from "@/features/sales/components/lead-form";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/features/sales/types";

function Gate({ lead }: { lead: Lead }) {
  const db = useDbStore((s) => s.db);
  const user = useCurrentUser();
  if (!leadCaps(db, user, lead).edit)
    return (
      <PageContainer>
        <PermissionNotice title="You can't edit this lead" description={lead.status === "converted" ? "Converted leads are kept as history. Edit the contact or deal instead." : undefined} action={<Button asChild variant="outline"><Link href={`/leads/${lead.id}`}>Back to lead</Link></Button>} />
      </PageContainer>
    );
  return <LeadForm lead={lead} />;
}

export default function Page() {
  const { leadId } = useParams<{ leadId: string }>();
  return <LeadGuard id={leadId}>{(l) => <Gate key={l.id} lead={l} />}</LeadGuard>;
}
