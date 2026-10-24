"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { CampaignWorkspace } from "@/features/messaging/components/campaign-workspace";

export default function Page() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const c = useDbStore((s) => s.db.campaigns.find((x) => x.id === campaignId));
  if (!c)
    return (
      <PageContainer>
        <EmptyState icon={SearchX} title="Campaign not found" action={<Button asChild variant="outline"><Link href="/campaigns">Back to campaigns</Link></Button>} />
      </PageContainer>
    );
  return <CampaignWorkspace key={c.id} campaign={c} />;
}
