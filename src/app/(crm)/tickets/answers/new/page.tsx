"use client";

import Link from "next/link";
import { usePermission } from "@/features/permissions";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { SavedAnswerForm } from "@/features/tickets/components/saved-answer-form";

export default function Page() {
  if (!usePermission("answers.manage"))
    return <PageContainer><PermissionNotice title="Your role can't manage saved answers" action={<Button asChild variant="outline"><Link href="/tickets/answers">Back to saved answers</Link></Button>} /></PageContainer>;
  return <SavedAnswerForm />;
}
