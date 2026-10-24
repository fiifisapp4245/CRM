import type { Metadata } from "next";
import { QuotesListPage } from "@/features/sales/components/quotes-list-page";

export const metadata: Metadata = { title: "Quotes" };

export default function Page() {
  return <QuotesListPage />;
}
