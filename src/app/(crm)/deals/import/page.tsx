import type { Metadata } from "next";
import { DealsImport } from "@/features/sales/components/deals-import";

export const metadata: Metadata = { title: "Import deals" };

export default function Page() {
  return <DealsImport />;
}
