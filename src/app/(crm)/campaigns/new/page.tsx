"use client";

import Link from "next/link";
import { useEntitlement, usePermission } from "@/features/permissions";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { CampaignWorkspace } from "@/features/messaging/components/campaign-workspace";

export default function Page() {
  const allowed = useEntitlement("campaigns").allowed;
  const canManage = usePermission("campaigns.manage");
  // No back door: the editor route enforces the same plan and role checks as the button.
  if (!allowed || !canManage)
    return (
      <PageContainer>
        <PermissionNotice title={!allowed ? "Campaigns require the Premium plan" : "Your role can't create campaigns"}  action={<Button asChild variant="outline"><Link href="/campaigns">Back to campaigns</Link></Button>} />
      </PageContainer>
    );
  return <CampaignWorkspace />;
}
