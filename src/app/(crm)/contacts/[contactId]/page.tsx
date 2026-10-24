"use client";

import { useParams } from "next/navigation";
import { ContactGuard } from "@/features/contacts/components/contact-guard";
import { ContactDetailPage } from "@/features/contacts/components/contact-detail-page";

export default function ContactPage() {
  const { contactId } = useParams<{ contactId: string }>();
  return <ContactGuard id={contactId}>{(contact, caps) => <ContactDetailPage contact={contact} caps={caps} />}</ContactGuard>;
}
