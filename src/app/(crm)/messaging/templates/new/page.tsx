"use client";

import Link from "next/link";
import { usePermission } from "@/features/permissions";
import { PageContainer } from "@/components/layout/page-header";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { TemplateForm } from "@/features/messaging/components/template-form";

export default function Page() {
  if (!usePermission("templates.manage"))
    return <PageContainer><PermissionNotice title="Your role can't manage templates" action={<Button asChild variant="outline"><Link href="/messaging?tab=templates">Back to templates</Link></Button>} /></PageContainer>;
  return <TemplateForm />;
}
