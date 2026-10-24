import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactsListPage } from "@/features/contacts/components/contacts-list-page";

export const metadata: Metadata = { title: "Contacts" };

export default function Page() {
  return (
    <Suspense>
      <ContactsListPage />
    </Suspense>
  );
}
