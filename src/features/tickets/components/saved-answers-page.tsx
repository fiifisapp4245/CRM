"use client";

import { useState } from "react";
import Link from "next/link";
import { BookMarked, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDbStore } from "@/lib/mock-data/db-store";
import { formatRelative } from "@/lib/utils/format";
import { usePermission } from "@/features/permissions";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { SearchField } from "@/components/data-table/search-field";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { deleteAnswer } from "../services/tickets-service";
import type { SavedAnswer } from "../types";

export function SavedAnswersPage() {
  const answers = useDbStore((s) => s.db.savedAnswers);
  const users = useDbStore((s) => s.db.users);
  const canManage = usePermission("answers.manage");
  const [q, setQ] = useState("");
  const [deleting, setDeleting] = useState<SavedAnswer | null>(null);
  const rows = answers.filter((a) => `${a.title} ${a.body} ${a.category ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Tickets", href: "/tickets" }, { label: "Saved answers" }]} />}
        title="Saved answers"
        description="Reusable replies for common questions. Inserting one only fills the reply box — it's never sent on its own."
        actions={
          canManage && (
            <Button asChild>
              <Link href="/tickets/answers/new">
                <Plus /> New saved answer
              </Link>
            </Button>
          )
        }
      />
      <div className="w-full sm:w-80">
        <SearchField value={q} onChange={setQ} placeholder="Search saved answers" label="Search saved answers" />
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState icon={BookMarked} title={answers.length ? "No saved answers match" : "No saved answers yet"} />
        </div>
      ) : (
        <ul className="divide-y divide-border/70 rounded-2xl border border-border bg-card">
          {rows.map((a) => (
            <li key={a.id} className="flex items-start gap-4 px-5 py-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {a.title} {a.category && <span className="ml-1 text-xs font-normal text-muted-foreground">· {a.category}</span>}
                </p>
                <p className="mt-1 line-clamp-2 max-w-3xl text-muted-foreground">{a.body}</p>
                <p className="mt-1 text-xs text-subtle-foreground">Updated {formatRelative(a.updatedAt)} by {users.find((u) => u.id === a.createdBy)?.name ?? "someone"}</p>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" asChild aria-label={`Edit ${a.title}`}>
                    <Link href={`/tickets/answers/${a.id}`}>
                      <Pencil />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${a.title}`} onClick={() => setDeleting(a)}>
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this saved answer?"
        description={`"${deleting?.title}" will no longer be offered in the reply box. Replies already sent are not affected.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          const r = await deleteAnswer(deleting!.id);
          if (!r.ok) {
            toast.error(r.error);
            throw new Error(r.error);
          }
          toast.success("Saved answer deleted");
        }}
      />
    </PageContainer>
  );
}
