import type { Metadata } from "next";
import { Suspense } from "react";
import { DealsListPage } from "@/features/sales/components/deals-list-page";

export const metadata: Metadata = { title: "Deals" };

export default function Page() {
  return (
    <Suspense>
      <DealsListPage />
    </Suspense>
  );
}
