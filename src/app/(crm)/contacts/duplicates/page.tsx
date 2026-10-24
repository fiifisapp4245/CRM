import type { Metadata } from "next";
import { DuplicatesPage } from "@/features/contacts/components/duplicates-page";

export const metadata: Metadata = { title: "Duplicate contacts" };

export default function Page() {
  return <DuplicatesPage />;
}
