"use client";

import { useParams } from "next/navigation";
import { AccountGuard } from "@/features/accounts/components/account-guard";
import { AccountDetailPage } from "@/features/accounts/components/account-detail-page";

export default function Page() {
  const { accountId } = useParams<{ accountId: string }>();
  return <AccountGuard id={accountId}>{(a) => <AccountDetailPage key={a.id} account={a} />}</AccountGuard>;
}
