"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useEntitlement, usePermission } from "@/features/permissions";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { TicketForm } from "@/features/tickets/components/ticket-form";

export default function Page() {
  const allowed = useEntitlement("tickets").allowed;
  const canManage = usePermission("tickets.manage");
  if (!allowed || !canManage)
    return (
      <PageContainer>
        <PermissionNotice title={!allowed ? "Tickets require the Advance plan" : "Your role can't open tickets"}  action={<Button asChild variant="outline"><Link href="/tickets">Back to tickets</Link></Button>} />
      </PageContainer>
    );
  return (
    <Suspense>
      <TicketForm />
    </Suspense>
  );
}
