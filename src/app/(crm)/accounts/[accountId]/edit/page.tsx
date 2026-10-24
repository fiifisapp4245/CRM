"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AccountGuard } from "@/features/accounts/components/account-guard";
import { AccountForm } from "@/features/accounts/components/account-form";
import { useAccountCaps } from "@/features/accounts/hooks/use-accounts";
import type { Account } from "@/features/accounts/types";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";

function EditGate({ account }: { account: Account }) {
  const caps = useAccountCaps(account);
  if (!caps.edit)
    return (
      <PageContainer>
        <PermissionNotice title="You can't edit this account" action={<Button asChild variant="outline"><Link href={`/accounts/${account.id}`}>Back to account</Link></Button>} />
      </PageContainer>
    );
  return (
    <Suspense>
      <AccountForm mode="edit" account={account} />
    </Suspense>
  );
}

export default function Page() {
  const { accountId } = useParams<{ accountId: string }>();
  return <AccountGuard id={accountId}>{(a) => <EditGate key={a.id} account={a} />}</AccountGuard>;
}
