import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentsPage } from "@/features/documents/components/documents-page";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return (
    <Suspense>
      <DocumentsPage />
    </Suspense>
  );
}
