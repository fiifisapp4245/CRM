import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadsListPage } from "@/features/sales/components/leads-list-page";

export const metadata: Metadata = { title: "Leads" };

export default function Page() {
  return (
    <Suspense>
      <LeadsListPage />
    </Suspense>
  );
}
