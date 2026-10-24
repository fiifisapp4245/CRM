"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePermission } from "@/features/permissions";
import { ContactForm } from "@/features/contacts/components/contact-form";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";

export default function NewContactPage() {
  const allowed = usePermission("contacts.create");
  if (!allowed)
    return (
      <PageContainer>
        <PermissionNotice title="Your role can't create contacts" action={<Button asChild variant="outline"><Link href="/contacts">Back to contacts</Link></Button>} />
      </PageContainer>
    );
  return (
    <Suspense>
      <ContactForm mode="create" />
    </Suspense>
  );
}
