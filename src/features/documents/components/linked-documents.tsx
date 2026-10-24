"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Link2, Paperclip, Search, Unlink, Upload } from "lucide-react";
import { toast } from "sonner";
import { useDbStore } from "@/lib/mock-data/db-store";
import { formatBytes, formatDate } from "@/lib/utils/format";
import { usePermission } from "@/features/permissions";
import { EmptyState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setLinked, uploadFiles } from "../services/documents-service";
import type { RecordLink } from "../types";
import { FileIcon } from "./file-icon";

/**
 * Files attached to a CRM record, read from the shared Documents repository —
 * one file can be linked to a contact, a deal and a ticket at once. Prototype
 * enhancement: linking was not visible in the (empty) audited workspace.
 */
export function LinkedDocuments({ link, title = "Files" }: { link: RecordLink; title?: string }) {
  const db = useDbStore((s) => s.db);
  const canManage = usePermission("documents.manage");
  const docs = useMemo(() => db.documents.filter((d) => !d.deletedAt && d.links.some((l) => l.kind === link.kind && l.id === link.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [db.documents, link.kind, link.id]);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u.name])), [db.users]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const candidates = db.documents.filter((d) => !d.deletedAt && !docs.includes(d) && d.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const errors: string[] = [];
    const r = await uploadFiles([...files], null, [link], (name, state, err) => state === "failed" && errors.push(`${name}: ${err}`));
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    if (r.data.length) toast.success(`${r.data.length} file${r.data.length === 1 ? "" : "s"} attached`, { description: "Stored in this browser only (prototype)." });
    if (errors.length) toast.error("Some files weren't attached", { description: errors.join(" · ") });
  };

  return (
    <section className="rounded-2xl border border-border bg-card" aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
        <h3 className="text-[0.9375rem] font-semibold">
          {title} {docs.length > 0 && <span className="font-normal text-muted-foreground">{docs.length}</span>}
        </h3>
        {canManage && (
          <div className="flex gap-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline">
                  <Link2 /> Link existing
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-2">
                <div className="relative">
                  <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents" className="pl-8" aria-label="Search documents to link" />
                </div>
                <ul className="mt-2 max-h-64 overflow-y-auto">
                  {candidates.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">No matching documents.</li>}
                  {candidates.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary"
                        onClick={async () => {
                          const r = await setLinked(d.id, link, true);
                          if (r.ok) toast.success(`Linked ${d.name}`);
                          else toast.error(r.error);
                          setOpen(false);
                        }}
                      >
                        <FileIcon mime={d.mimeType} name={d.name} size="sm" />
                        <span className="min-w-0 flex-1 truncate">{d.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              <Upload /> {busy ? "Uploading…" : "Upload"}
            </Button>
            <input ref={input} type="file" multiple hidden onChange={(e) => (upload(e.target.files), (e.target.value = ""))} />
          </div>
        )}
      </div>
      {docs.length === 0 ? (
        <EmptyState compact icon={Paperclip} title="No files attached" description={canManage ? "Upload a file or link one from Documents." : undefined} />
      ) : (
        <ul className="divide-y divide-border/70">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <FileIcon mime={d.mimeType} name={d.name} size="sm" />
              <Link href={`/documents?file=${d.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-medium hover:underline">{d.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatBytes(d.sizeBytes)} · {users.get(d.ownerId) ?? "Unknown"} · {formatDate(d.updatedAt)}
                  {!d.storageRef && " · demo record, no file content"}
                </span>
              </Link>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Unlink ${d.name}`}
                  title="Unlink (the file stays in Documents)"
                  onClick={async () => {
                    const r = await setLinked(d.id, link, false);
                    if (r.ok) toast.success("File unlinked", { description: "It's still in Documents." });
                    else toast.error(r.error);
                  }}
                >
                  <Unlink />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
