"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { usePermission } from "@/features/permissions";
import { PageContainer } from "@/components/layout/page-header";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { TemplateForm } from "@/features/messaging/components/template-form";

export default function Page() {
  const { templateId } = useParams<{ templateId: string }>();
  const t = useDbStore((s) => s.db.templates.find((x) => x.id === templateId));
  const can = usePermission("templates.manage");
  const back = <Button asChild variant="outline"><Link href="/messaging?tab=templates">Back to templates</Link></Button>;
  if (!t) return <PageContainer><EmptyState icon={SearchX} title="Template not found" action={back} /></PageContainer>;
  if (!can) return <PageContainer><PermissionNotice title="Your role can't manage templates" action={back} /></PageContainer>;
  return <TemplateForm key={t.id} template={t} />;
}
