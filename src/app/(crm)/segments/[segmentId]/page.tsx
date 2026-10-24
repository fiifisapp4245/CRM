"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useCurrentUser } from "@/features/permissions";
import { canEditSegment, visibleSegments } from "@/features/segments/lib/match";
import { SegmentBuilder } from "@/features/segments/components/segment-builder";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";

export default function Page() {
  const { segmentId } = useParams<{ segmentId: string }>();
  const db = useDbStore((s) => s.db);
  const user = useCurrentUser();
  const segment = visibleSegments(db, user).find((s) => s.id === segmentId);
  if (!segment)
    return (
      <PageContainer>
        <EmptyState icon={SearchX} title="Segment not found" description="It may have been deleted, or it's private to someone else." action={<Button asChild variant="outline"><Link href="/segments">Back to segments</Link></Button>} />
      </PageContainer>
    );
  return <SegmentBuilder key={`${segment.id}-${user.id}`} segment={segment} readOnly={!canEditSegment(user, segment)} />;
}
