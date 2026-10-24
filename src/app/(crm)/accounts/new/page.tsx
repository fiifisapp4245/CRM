"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePermission } from "@/features/permissions";
import { AccountForm } from "@/features/accounts/components/account-form";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";

export default function Page() {
  const allowed = usePermission("accounts.create");
  if (!allowed)
    return (
      <PageContainer>
        <PermissionNotice title="Your role can't create accounts" action={<Button asChild variant="outline"><Link href="/accounts">Back to accounts</Link></Button>} />
      </PageContainer>
    );
  return (
    <Suspense>
      <AccountForm mode="create" />
    </Suspense>
  );
}
