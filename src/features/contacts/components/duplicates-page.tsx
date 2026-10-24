"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, GitMerge, Lock } from "lucide-react";
import { toast } from "sonner";
import { canWriteRecord } from "@/lib/permissions";
import { formatDate } from "@/lib/utils/format";
import { useCurrentUser, usePermission } from "@/features/permissions";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { StatusPill } from "@/components/shared/status-pill";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { useDb, useUserLookup, useVisibleContacts } from "../hooks/use-contacts";
import { findDuplicateGroups, type DuplicateGroup } from "../lib/duplicates";
import { primaryMethod } from "../lib/filters";
import { dismissDuplicatePair } from "../services/contacts-service";
import { SOURCE_LABELS } from "../types";
import { MergeDialog } from "./merge-dialog";

export function DuplicatesPage() {
  const router = useRouter();
  const allowed = usePermission("contacts.merge");
  const user = useCurrentUser();
  const db = useDb();
  const users = useUserLookup();
  const contacts = useVisibleContacts();
  const groups = useMemo(() => findDuplicateGroups(contacts, db.dismissedDuplicatePairs), [contacts, db.dismissedDuplicatePairs]);
  const [active, setActive] = useState<DuplicateGroup | null>(null);
  const byId = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  if (!allowed)
    return (
      <PageContainer>
        <PermissionNotice title="Only sales managers and admins can merge contacts" action={<Button asChild variant="outline"><Link href="/contacts">Back to contacts</Link></Button>} />
      </PageContainer>
    );

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Contacts", href: "/contacts" }, { label: "Duplicates" }]} />}
        title="Possible duplicates"
        description="Contacts in your organisation that share an email address or phone number (compared after normalising, so 024… and +233 24… match). Review each group before merging."
      />

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <EmptyState icon={CheckCircle2} title="No duplicates found" description="Every contact you can access has a unique email address and phone number." action={<Button asChild variant="outline"><Link href="/contacts">Back to contacts</Link></Button>} />
        </div>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="Duplicate groups">
          {groups.map((g) => {
            const members = g.contactIds.map((id) => byId.get(id)!).filter(Boolean);
            const canMerge = members.every((c) => canWriteRecord(user, c, db.users));
            return (
              <li key={g.key} className="rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {g.reasons.map((r) => (
                      <StatusPill key={r} tone="warning">{r}</StatusPill>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        const res = await dismissDuplicatePair(g.contactIds);
                        if (res.ok) toast.success("Marked as not duplicates", { description: "This group won't be suggested again." });
                        else toast.error(res.error);
                      }}
                    >
                      Not duplicates
                    </Button>
                    <Button onClick={() => setActive(g)} disabled={!canMerge} title={canMerge ? undefined : "You need access to every record in the group"}>
                      {canMerge ? <GitMerge /> : <Lock />} Review and merge
                    </Button>
                  </div>
                </div>
                <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
                  {members.map((c) => {
                    const email = primaryMethod(c, "email")?.value;
                    const phone = primaryMethod(c, "phone")?.value;
                    return (
                      <div key={c.id} className="flex gap-3 p-4 text-sm">
                        <UserAvatar name={c.displayName} />
                        <div className="min-w-0 space-y-0.5">
                          <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">{c.displayName}</Link>
                          <p className="truncate text-muted-foreground">{email ?? "No email"}</p>
                          <p className="text-muted-foreground">{phone ?? "No phone"}</p>
                          <p className="text-xs text-muted-foreground">
                            {SOURCE_LABELS[c.source]} · {c.ownerId ? users.get(c.ownerId)?.name : "Unassigned"} · added {formatDate(c.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {active && (
        <MergeDialog
          open={!!active}
          onOpenChange={(o) => !o && setActive(null)}
          contacts={active.contactIds.map((id) => byId.get(id)!).filter(Boolean)}
          reasons={active.reasons}
          onMerged={(primary) => router.push(`/contacts/${primary.id}`)}
        />
      )}
    </PageContainer>
  );
}
