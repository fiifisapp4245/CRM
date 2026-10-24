"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { useTicketsData } from "@/features/tickets/hooks";
import { TicketDetailPage } from "@/features/tickets/components/ticket-detail-page";

export default function Page() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const t = useTicketsData().tickets.find((x) => x.id === ticketId);
  if (!t)
    return (
      <PageContainer>
        <EmptyState icon={SearchX} title="Ticket not found" description="It may be about a customer outside your access, or the link is wrong." action={<Button asChild variant="outline"><Link href="/tickets">Back to tickets</Link></Button>} />
      </PageContainer>
    );
  return <TicketDetailPage key={t.id} ticket={t} />;
}
