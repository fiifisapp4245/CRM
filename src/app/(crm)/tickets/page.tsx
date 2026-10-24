import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketsListPage } from "@/features/tickets/components/tickets-list-page";

export const metadata: Metadata = { title: "Tickets" };

export default function Page() {
  return (
    <Suspense>
      <TicketsListPage />
    </Suspense>
  );
}
