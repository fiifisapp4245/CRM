import type { Metadata } from "next";
import { AccountsListPage } from "@/features/accounts/components/accounts-list-page";

export const metadata: Metadata = { title: "Accounts" };

export default function Page() {
  return <AccountsListPage />;
}
