"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePermission } from "@/features/permissions";
import { DealForm } from "@/features/sales/components/deal-form";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";

export default function Page() {
  if (!usePermission("deals.manage"))
    return (
      <PageContainer>
        <PermissionNotice title="Your role can't create deals" action={<Button asChild variant="outline"><Link href="/deals">Back to deals</Link></Button>} />
      </PageContainer>
    );
  return (
    <Suspense>
      <DealForm />
    </Suspense>
  );
}
