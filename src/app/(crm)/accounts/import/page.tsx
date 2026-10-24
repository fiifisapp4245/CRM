import type { Metadata } from "next";
import { AccountsImport } from "@/features/accounts/components/accounts-import";

export const metadata: Metadata = { title: "Import accounts" };

export default function Page() {
  return <AccountsImport />;
}
