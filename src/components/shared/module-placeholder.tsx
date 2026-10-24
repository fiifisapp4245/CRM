"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { usePathname } from "next/navigation";
import { findNavItem } from "@/components/navigation/nav-config";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { useCurrentUser } from "@/features/permissions";
import { hasPermission } from "@/lib/permissions";
import { PermissionNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";

/** Route placeholder for modules whose UX audit hasn't happened yet. Deliberately shows no invented business UI. */
export function ModulePlaceholder() {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const user = useCurrentUser();
  if (!item) return null;
  if (item.permission && !hasPermission(user, item.permission)) {
    return (
      <PageContainer>
        <PermissionNotice />
      </PageContainer>
    );
  }
  return (
    <PageContainer width="narrow">
      <PageHeader title={item.label} description={item.description} />
      <section className="rounded-2xl border border-border bg-card shadow-sm p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ClipboardList className="size-5" />
          </span>
          <div className="space-y-2">
            <h2 className="font-semibold">UX audit and implementation pending</h2>
            <p className="text-sm text-muted-foreground">
              This route is reserved so navigation, permissions and the shared design system already work. The {item.label} experience will be designed after its
              UX audit — nothing here is a guess at how it should work.
            </p>
            <p className="text-sm text-muted-foreground">
              Route: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{item.href}</code>
            </p>
            <div className="pt-2">
              <Button asChild variant="outline">
                <Link href="/contacts">Go to Contacts</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
