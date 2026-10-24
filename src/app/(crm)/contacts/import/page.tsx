import type { Metadata } from "next";
import { ContactsImport } from "@/features/contacts/components/import-wizard";

export const metadata: Metadata = { title: "Import contacts" };

export default function Page() {
  return <ContactsImport />;
}
