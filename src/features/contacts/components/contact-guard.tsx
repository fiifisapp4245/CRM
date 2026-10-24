"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { GitMerge, SearchX } from "lucide-react";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { useContact } from "../hooks/use-contacts";
import type { Contact } from "../types";
import type { ContactCapabilities } from "../lib/access";

/** Resolves a contact id and renders the right state: not found, merged, no access, or the content. */
export function ContactGuard({ id, children }: { id: string; children: (contact: Contact, caps: ContactCapabilities) => ReactNode }) {
  const lookup = useContact(id);
  if (lookup.state === "ok") return <>{children(lookup.contact, lookup.caps)}</>;
  return (
    <PageContainer>
      {lookup.state === "not_found" && (
        <EmptyState icon={SearchX} title="Contact not found" description="It may have been removed, or the link is wrong." action={<Button asChild variant="outline"><Link href="/contacts">Back to contacts</Link></Button>} />
      )}
      {lookup.state === "forbidden" && (
        <PermissionNotice title="You can't view this contact" description="It belongs to someone outside your access. Ask its owner or an admin if you need it." action={<Button asChild variant="outline"><Link href="/contacts">Back to contacts</Link></Button>} />
      )}
      {lookup.state === "merged" && (
        <EmptyState icon={GitMerge} title="This contact was merged" description="Its details, history and related records now live on another contact." action={<Button asChild><Link href={`/contacts/${lookup.mergedIntoId}`}>Open merged contact</Link></Button>} />
      )}
    </PageContainer>
  );
}
