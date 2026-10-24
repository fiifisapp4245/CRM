"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useCurrentUser } from "@/features/permissions";
import { dealCaps } from "@/features/sales/lib/access";
import { DealGuard } from "@/features/sales/components/deal-guard";
import { DealForm } from "@/features/sales/components/deal-form";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import type { Deal } from "@/features/sales/types";

function Gate({ deal }: { deal: Deal }) {
  const db = useDbStore((s) => s.db);
  const user = useCurrentUser();
  if (!dealCaps(db, user, deal).edit)
    return (
      <PageContainer>
        <PermissionNotice title="You can't edit this deal" action={<Button asChild variant="outline"><Link href={`/deals/${deal.id}`}>Back to deal</Link></Button>} />
      </PageContainer>
    );
  return (
    <Suspense>
      <DealForm deal={deal} />
    </Suspense>
  );
}

export default function Page() {
  const { dealId } = useParams<{ dealId: string }>();
  return <DealGuard id={dealId}>{(d) => <Gate key={d.id} deal={d} />}</DealGuard>;
}
