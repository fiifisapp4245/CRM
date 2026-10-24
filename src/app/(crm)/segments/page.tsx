import type { Metadata } from "next";
import { SegmentsListPage } from "@/features/segments/components/segments-list-page";

export const metadata: Metadata = { title: "Segments" };

export default function Page() {
  return <SegmentsListPage />;
}
