"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { usePermission } from "@/features/permissions";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { SavedAnswerForm } from "@/features/tickets/components/saved-answer-form";

export default function Page() {
  const { answerId } = useParams<{ answerId: string }>();
  const a = useDbStore((s) => s.db.savedAnswers.find((x) => x.id === answerId));
  const can = usePermission("answers.manage");
  const back = <Button asChild variant="outline"><Link href="/tickets/answers">Back to saved answers</Link></Button>;
  if (!a) return <PageContainer><EmptyState icon={SearchX} title="Saved answer not found" action={back} /></PageContainer>;
  if (!can) return <PageContainer><PermissionNotice title="Your role can't manage saved answers" action={back} /></PageContainer>;
  return <SavedAnswerForm key={a.id} answer={a} />;
}
