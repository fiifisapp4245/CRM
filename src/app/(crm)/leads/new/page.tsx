"use client";

import Link from "next/link";
import { usePermission } from "@/features/permissions";
import { LeadForm } from "@/features/sales/components/lead-form";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";

export default function Page() {
  if (!usePermission("leads.manage"))
    return (
      <PageContainer>
        <PermissionNotice title="Your role can't add leads" action={<Button asChild variant="outline"><Link href="/leads">Back to leads</Link></Button>} />
      </PageContainer>
    );
  return <LeadForm />;
}
