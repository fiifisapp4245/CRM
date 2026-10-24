"use client";

import Link from "next/link";
import { usePermission } from "@/features/permissions";
import { SegmentBuilder } from "@/features/segments/components/segment-builder";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";

export default function Page() {
  const allowed = usePermission("segments.create");
  if (!allowed)
    return (
      <PageContainer>
        <PermissionNotice title="Your role can't create segments" action={<Button asChild variant="outline"><Link href="/segments">Back to segments</Link></Button>} />
      </PageContainer>
    );
  return <SegmentBuilder />;
}
