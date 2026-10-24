"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ContactGuard } from "@/features/contacts/components/contact-guard";
import { ContactForm } from "@/features/contacts/components/contact-form";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";

export default function EditContactPage() {
  const { contactId } = useParams<{ contactId: string }>();
  return (
    <ContactGuard id={contactId}>
      {(contact, caps) =>
        caps.edit ? (
          <Suspense>
            <ContactForm key={contact.id} mode="edit" contact={contact} />
          </Suspense>
        ) : (
          <PageContainer>
            <PermissionNotice
              title={contact.status === "archived" ? "Archived contacts can't be edited" : "You can't edit this contact"}
              description={contact.status === "archived" ? "Restore it first, then make your changes." : "Your role or access doesn't allow changes to this record."}
              action={<Button asChild variant="outline"><Link href={`/contacts/${contact.id}`}>Back to contact</Link></Button>}
            />
          </PageContainer>
        )
      }
    </ContactGuard>
  );
}
