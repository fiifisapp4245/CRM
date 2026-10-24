"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronRight, Clock, Download, Eye, FolderOpen, FolderPlus, Info, Link2, Loader2, MoreHorizontal, Move, Pencil, RotateCcw, Search, Star, Trash2, Upload, UserRound, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatBytes, formatDate, formatRelative } from "@/lib/utils/format";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useNow } from "@/lib/hooks/use-now";
import { useCurrentUser } from "@/features/permissions";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { SearchField } from "@/components/data-table/search-field";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState, InlineNotice } from "@/components/feedback/states";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { daysLeft, fileCategory, folderPath, retentionDeadline, sortDocs, sortFolders, storageUsed, type DocSort } from "../lib/documents";
import { binItem, deleteForever, emptyBin, restoreItem, setLinked, updateDocument, uploadFiles } from "../services/documents-service";
import { FILE_CATEGORY_LABELS, type DocumentFile, type FileCategory, type Folder, type LinkKind } from "../types";
import { downloadDoc, FolderDialog, LinkDialog, MoveDialog, PreviewDialog, RenameDialog } from "./document-dialogs";
import { FileIcon } from "./file-icon";
import { FolderGlyph } from "./folder-visuals";

type Section = "mine" | "recent" | "starred" | "added" | "bin";
const SECTIONS: { key: Section; label: string; icon: typeof FolderOpen }[] = [
  { key: "mine", label: "My documents", icon: FolderOpen },
  { key: "recent", label: "Recent", icon: Clock },
  { key: "starred", label: "Starred", icon: Star },
  { key: "added", label: "Added by me", icon: UserRound },
  { key: "bin", label: "Recycle bin", icon: Trash2 },
];
interface QueueItem {
  name: string;
  size: number;
  state: "storing" | "done" | "failed";
  error?: string;
}

export function DocumentsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const db = useDbStore((s) => s.db);
  const user = useCurrentUser();
  const now = useNow();
  const canManage = hasPermission(user, "documents.manage");
  const section = (SECTIONS.some((s) => s.key === params.get("s")) ? params.get("s") : "mine") as Section;
  const folderId = section === "mine" ? params.get("folder") : null;
  const go = (s: Section, folder?: string | null) => router.push(`/documents?s=${s}${folder ? `&folder=${folder}` : ""}`);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | Exclude<FileCategory, "other">>("all");
  const [sort, setSort] = useState<DocSort>("name");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [folderDialog, setFolderDialog] = useState<{ folder?: Folder } | null>(null);
  const [rename, setRename] = useState<DocumentFile | null>(null);
  const [move, setMove] = useState<DocumentFile | null>(null);
  const [linking, setLinking] = useState<DocumentFile | null>(null);
  const [preview, setPreview] = useState<DocumentFile | null>(null);
  const [binConfirm, setBinConfirm] = useState<{ kind: "folder" | "document"; id: string; name: string } | null>(null);
  const [forever, setForever] = useState<{ id: string; name: string } | "all" | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const orgDocs = useMemo(() => db.documents.filter((d) => d.orgId === user.orgId), [db.documents, user.orgId]);
  const orgFolders = useMemo(() => db.folders.filter((f) => f.orgId === user.orgId), [db.folders, user.orgId]);
  const liveFolders = orgFolders.filter((f) => !f.deletedAt);
  const current = folderId ? liveFolders.find((f) => f.id === folderId) : undefined;
  const used = storageUsed(orgDocs);
  const quota = db.settings.storageQuotaBytes;
  const retention = db.settings.recycleRetentionDays;
  const shownDetailsId = detailsId ?? params.get("file");
  const details = shownDetailsId ? orgDocs.find((d) => d.id === shownDetailsId) : undefined;

  const q = search.trim().toLowerCase();
  const matchDoc = (d: DocumentFile) => (category === "all" || fileCategory(d.mimeType, d.name) === category) && (!q || d.name.toLowerCase().includes(q));
  const live = orgDocs.filter((d) => !d.deletedAt);
  const files = sortDocs(
    section === "mine" ? live.filter((d) => d.folderId === (folderId ?? null) && matchDoc(d))
      : section === "recent" ? live.filter((d) => Date.parse(d.updatedAt) > now - 30 * 86_400_000 && matchDoc(d)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        : section === "starred" ? live.filter((d) => d.starred && matchDoc(d))
          : section === "added" ? live.filter((d) => d.ownerId === user.id && matchDoc(d))
            : [],
    section === "recent" && sort === "name" ? "changed" : sort,
  );
  const folders = section === "mine" && category === "all" ? sortFolders(liveFolders.filter((f) => f.parentId === (folderId ?? null) && (!q || f.name.toLowerCase().includes(q))), sort) : [];
  const binned = [...orgFolders, ...orgDocs].filter((x) => x.deletedAt && x.binnedWith === x.id && (!q || x.name.toLowerCase().includes(q))).sort((a, b) => b.deletedAt!.localeCompare(a.deletedAt!));

  const upload = async (list: FileList | File[] | null) => {
    const arr = list ? [...list] : [];
    if (!arr.length) return;
    if (!canManage) return toast.error("Your role can't upload documents.");
    const target = section === "mine" ? (folderId ?? null) : null;
    setQueue((qs) => [...arr.map((f) => ({ name: f.name, size: f.size, state: "storing" as const })), ...qs].slice(0, 12));
    const r = await uploadFiles(arr, target, [], (name, state, error) => setQueue((qs) => qs.map((x) => (x.name === name && x.state === "storing" ? { ...x, state, error } : x))));
    if (!r.ok) return toast.error(r.error);
    if (r.data.length) toast.success(`${r.data.length} file${r.data.length === 1 ? "" : "s"} uploaded`, { description: target ? `To ${liveFolders.find((f) => f.id === target)?.name}` : "To My documents" });
    if (section !== "mine") go("mine", target);
  };

  const star = async (d: DocumentFile) => {
    const r = await updateDocument(d.id, { starred: !d.starred });
    if (!r.ok) toast.error(r.error);
  };

  const docMenu = (d: DocumentFile) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Actions for ${d.name}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setPreview(d)}>
          <Eye /> Preview
        </DropdownMenuItem>
        {d.storageRef && (
          <DropdownMenuItem onSelect={() => void downloadDoc(d)}>
            <Download /> Download
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => setDetailsId(d.id)}>
          <Info /> Details
        </DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => star(d)}>
              <Star /> {d.starred ? "Unstar" : "Star"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRename(d)}>
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMove(d)}>
              <Move /> Move to…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLinking(d)}>
              <Link2 /> Link to a record…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onSelect={() => setBinConfirm({ kind: "document", id: d.id, name: d.name })}>
              <Trash2 /> Move to recycle bin
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const folderMenu = (f: Folder) =>
    canManage && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Actions for folder ${f.name}`} onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => go("mine", f.id)}>
            <FolderOpen /> Open
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFolderDialog({ folder: f })}>
            <Pencil /> Rename or change colour
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onSelect={() => setBinConfirm({ kind: "folder", id: f.id, name: f.name })}>
            <Trash2 /> Move to recycle bin
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

  const count = (f: Folder) => live.filter((d) => d.folderId === f.id).length + liveFolders.filter((x) => x.parentId === f.id).length;
  const path = folderPath(liveFolders, folderId ?? null);
  const nothing = section === "bin" ? binned.length === 0 : files.length + folders.length === 0;

  return (
    <PageContainer width="full">
      <PageHeader
        title="Documents"
        description="Files and folders for your business. Drop files anywhere on this page to upload."
        actions={
          canManage && section !== "bin" && (
            <>
              <Button variant="outline" onClick={() => setFolderDialog({})} disabled={section !== "mine"} title={section !== "mine" ? "Folders are made in My documents" : undefined}>
                <FolderPlus /> New folder
              </Button>
              <Button onClick={() => input.current?.click()}>
                <Upload /> Upload
              </Button>
              <input ref={input} type="file" multiple hidden onChange={(e) => (upload(e.target.files), (e.target.value = ""))} />
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4" aria-label="Document sections">
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map((s) => (
              <button key={s.key} type="button" onClick={() => go(s.key)} aria-current={section === s.key ? "page" : undefined} className={cn("flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm", section === s.key ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")}>
                <s.icon className="size-4" /> {s.label}
                {s.key === "bin" && binned.length > 0 && <span className="ml-auto text-xs tabular-nums">{binned.length}</span>}
              </button>
            ))}
          </nav>
          <div className="rounded-xl border border-border p-3 text-xs">
            <p className="font-medium text-foreground">Storage</p>
            <Progress value={Math.max(0.5, (used / quota) * 100)} className="my-2 h-1.5" aria-label="Storage used" />
            <p className="text-muted-foreground">
              {formatBytes(used)} of {formatBytes(quota)} used
            </p>
            <p className="mt-1 text-muted-foreground">Includes files in the recycle bin until they&apos;re deleted for good. 20 GB is the quota seen on the audited account.</p>
          </div>
        </aside>

        <section
          className={cn("relative flex min-w-0 flex-col gap-4 rounded-2xl", dragOver && "ring-2 ring-brand-600 ring-offset-4")}
          aria-label={SECTIONS.find((s) => s.key === section)!.label}
          onDragOver={(e) => {
            if (!canManage || section === "bin" || !e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragOver(false)}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            setDragOver(false);
            void upload(e.dataTransfer.files);
          }}
        >
          {dragOver && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-brand-50/90 text-sm font-medium text-brand-800">
              <Upload className="mr-2 size-5" /> Drop to upload {current ? `to ${current.name}` : "to My documents"}
            </div>
          )}
          {section === "mine" && (
            <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-sm">
              <button type="button" onClick={() => go("mine")} className={cn("rounded px-1 hover:underline", !folderId && "font-semibold")}>
                My documents
              </button>
              {path.map((f, i) => (
                <span key={f.id} className="flex items-center gap-1">
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                  <button type="button" onClick={() => go("mine", f.id)} className={cn("rounded px-1 hover:underline", i === path.length - 1 && "font-semibold")} aria-current={i === path.length - 1 ? "page" : undefined}>
                    {f.name}
                  </button>
                </span>
              ))}
            </nav>
          )}
          {section === "bin" && (
            <InlineNotice tone="neutral" icon={Trash2}>
              Files and folders you binned. Restore them, or they are deleted for good after {retention} days. Removal happens the next time the CRM is opened after that date.
            </InlineNotice>
          )}
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <SearchField value={search} onChange={setSearch} placeholder={section === "mine" ? `Search in ${current?.name ?? "My documents"}` : "Search"} label="Search documents" />
            {section !== "bin" && (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                  <SelectTrigger className="w-auto min-w-40 px-3.5" aria-label="File type">
                    <span className="text-muted-foreground">Type:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everything</SelectItem>
                    {(Object.keys(FILE_CATEGORY_LABELS) as Exclude<FileCategory, "other">[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {FILE_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(v) => setSort(v as DocSort)}>
                  <SelectTrigger className="w-auto min-w-40 px-3.5" aria-label="Sort">
                    <span className="text-muted-foreground">Sort:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="changed">Last changed</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                    <SelectItem value="type">Type</SelectItem>
                  </SelectContent>
                </Select>
                <Segmented label="Layout" value={layout} onChange={setLayout} options={[{ value: "grid" as const, label: "Grid" }, { value: "list" as const, label: "List" }]} />
              </div>
            )}
            {section === "bin" && binned.length > 0 && canManage && (
              <Button variant="outline" className="xl:ml-auto" onClick={() => setForever("all")}>
                Empty recycle bin
              </Button>
            )}
          </div>

          {nothing ? (
            <div className="rounded-2xl border border-dashed border-border">
              <EmptyState
                icon={q || category !== "all" ? Search : section === "bin" ? Trash2 : FolderOpen}
                title={q || category !== "all" ? "Nothing matches" : section === "bin" ? "The recycle bin is empty" : section === "starred" ? "Nothing starred yet" : current ? "This folder is empty" : "No documents yet"}
                description={q || category !== "all" ? "Try another search or type." : section === "mine" && canManage ? "Upload files or drag them here." : undefined}
                action={section === "mine" && canManage && !q ? <Button variant="outline" onClick={() => input.current?.click()}>Upload files</Button> : undefined}
              />
            </div>
          ) : section === "bin" ? (
            <ul className="divide-y divide-border/70 rounded-2xl border border-border bg-card">
              {binned.map((x) => {
                const isFolder = "parentId" in x;
                const inside = isFolder ? orgDocs.filter((d) => d.binnedWith === x.id && d.id !== x.id).length : 0;
                return (
                  <li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    {isFolder ? <FolderGlyph color={(x as Folder).color} size="sm" /> : <FileIcon mime={(x as DocumentFile).mimeType} name={x.name} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{x.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Binned {formatDate(x.deletedAt)} · deleted for good on {formatDate(retentionDeadline(x.deletedAt!, retention))} ({daysLeft(x.deletedAt!, retention, now)} days left)
                        {isFolder && ` · ${inside} file${inside === 1 ? "" : "s"} inside`}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={async () => {
                          const r = await restoreItem(x.id);
                          if (!r.ok) return toast.error(r.error);
                          toast.success(`Restored ${x.name}`, { description: r.data.toRoot ? "Its folder is gone, so it's back in My documents." : undefined });
                        }}>
                          <RotateCcw /> Restore
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setForever({ id: x.id, name: x.name })}>
                          Delete for good
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : layout === "grid" ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {folders.map((f) => (
                <li key={f.id} className="group relative rounded-xl border border-border bg-card p-3 hover:border-border-strong">
                  <button type="button" onClick={() => go("mine", f.id)} className="flex w-full items-center gap-3 text-left after:absolute after:inset-0" aria-label={`Open folder ${f.name}`}>
                    <FolderGlyph color={f.color} />
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-sm font-medium break-words pr-6">{f.name}</span>
                      <span className="block text-xs text-muted-foreground">{count(f)} item{count(f) === 1 ? "" : "s"}</span>
                    </span>
                  </button>
                  <span className="absolute top-2 right-2 z-10">{folderMenu(f)}</span>
                </li>
              ))}
              {files.map((d) => (
                <li key={d.id} className="group relative flex flex-col rounded-xl border border-border bg-card p-3 hover:border-border-strong">
                  <button type="button" onClick={() => setPreview(d)} className="flex flex-1 flex-col items-start gap-3 text-left after:absolute after:inset-0" aria-label={`Preview ${d.name}`}>
                    <FileIcon mime={d.mimeType} name={d.name} size="lg" />
                    <span className="w-full min-w-0">
                      <span className="line-clamp-2 block text-sm font-medium break-words">{d.name}</span>
                      <span className="block text-xs text-muted-foreground">{formatBytes(d.sizeBytes)} · {formatRelative(d.updatedAt, now)}</span>
                    </span>
                  </button>
                  <span className="absolute top-2 right-2 z-10 flex items-center gap-0.5">
                    {d.starred && <Star className="size-3.5 fill-amber-400 text-amber-500" aria-label="Starred" />}
                    {docMenu(d)}
                  </span>
                  {d.links.length > 0 && <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><Link2 className="size-3" /> {d.links.length} linked</span>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/70">
                    <th scope="col" className="px-4 py-2 text-left font-medium">Name</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Type</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Size</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Last changed</th>
                    <th scope="col" className="w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {folders.map((f) => (
                    <tr key={f.id} className="hover:bg-[#fafcfc]">
                      <td className="px-4 py-2">
                        <button type="button" onClick={() => go("mine", f.id)} className="flex items-center gap-2.5 font-medium hover:underline">
                          <FolderGlyph color={f.color} size="sm" /> {f.name}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">Folder</td>
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{count(f)} items</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(f.updatedAt)}</td>
                      <td className="px-2 py-2 text-right">{folderMenu(f)}</td>
                    </tr>
                  ))}
                  {files.map((d) => (
                    <tr key={d.id} className="hover:bg-[#fafcfc]">
                      <td className="px-4 py-2">
                        <button type="button" onClick={() => setPreview(d)} className="flex min-w-0 items-center gap-2.5 text-left font-medium hover:underline">
                          <FileIcon mime={d.mimeType} name={d.name} size="sm" /> <span className="truncate">{d.name}</span>
                          {d.starred && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Starred" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{fileCategory(d.mimeType, d.name) === "other" ? "Other" : FILE_CATEGORY_LABELS[fileCategory(d.mimeType, d.name) as Exclude<FileCategory, "other">]}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBytes(d.sizeBytes)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(d.updatedAt)}</td>
                      <td className="px-2 py-2 text-right">{docMenu(d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {section === "mine" && (q || category !== "all") && <p className="text-xs text-muted-foreground">Searching and filtering this folder only{category !== "all" ? "; folders are hidden while a type is chosen" : ""}.</p>}
        </section>
      </div>

      {queue.length > 0 && (
        <div className="fixed right-4 bottom-4 z-40 w-80 rounded-2xl border border-border bg-card p-3 shadow-md" role="status" aria-live="polite">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Uploads</p>
            <Button variant="ghost" size="icon-sm" aria-label="Close uploads" onClick={() => setQueue([])} disabled={queue.some((x) => x.state === "storing")}>
              <X />
            </Button>
          </div>
          <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">
            {queue.map((x, i) => (
              <li key={`${x.name}-${i}`} className="flex items-start gap-2">
                {x.state === "storing" ? <Loader2 className="mt-0.5 size-4 animate-spin text-muted-foreground" /> : x.state === "done" ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : <XCircle className="mt-0.5 size-4 text-destructive" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{x.name}</span>
                  <span className={cn("block text-xs", x.state === "failed" ? "text-destructive" : "text-muted-foreground")}>{x.state === "failed" ? x.error : `${formatBytes(x.size)} · ${x.state === "done" ? "Stored in this browser" : "Storing…"}`}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Sheet open={!!details} onOpenChange={(o) => !o && (setDetailsId(null), params.get("file") && router.replace("/documents"))}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          {details && <DetailsBody doc={details} canManage={canManage} onLink={() => setLinking(details)} onPreview={() => setPreview(details)} />}
        </SheetContent>
      </Sheet>
      <FolderDialog open={!!folderDialog} onOpenChange={(o) => !o && setFolderDialog(null)} parentId={folderId ?? null} folder={folderDialog?.folder} />
      <RenameDialog doc={rename} onOpenChange={(o) => !o && setRename(null)} />
      <MoveDialog key={move?.id} doc={move} onOpenChange={(o) => !o && setMove(null)} />
      <LinkDialog key={linking?.id} doc={linking ? (orgDocs.find((d) => d.id === linking.id) ?? linking) : null} onOpenChange={(o) => !o && setLinking(null)} />
      <PreviewDialog doc={preview} onOpenChange={(o) => !o && setPreview(null)} />
      <ConfirmDialog
        open={!!binConfirm}
        onOpenChange={(o) => !o && setBinConfirm(null)}
        title={`Move ${binConfirm?.kind === "folder" ? "folder" : "file"} to the recycle bin?`}
        description={binConfirm?.kind === "folder" ? `"${binConfirm.name}" and everything inside it can be restored for ${retention} days.` : `"${binConfirm?.name}" can be restored for ${retention} days. It stays linked to its records until it's deleted for good.`}
        confirmLabel="Move to recycle bin"
        destructive
        onConfirm={async () => {
          const r = await binItem(binConfirm!.kind, binConfirm!.id);
          if (!r.ok) {
            toast.error(r.error);
            throw new Error(r.error);
          }
          toast.success("Moved to the recycle bin", { action: { label: "Undo", onClick: () => void restoreItem(binConfirm!.id) } });
          if (binConfirm!.kind === "folder" && binConfirm!.id === folderId) go("mine", current?.parentId);
        }}
      />
      <ConfirmDialog
        open={!!forever}
        onOpenChange={(o) => !o && setForever(null)}
        title={forever === "all" ? "Empty the recycle bin?" : `Delete "${forever && typeof forever === "object" ? forever.name : ""}" for good?`}
        description="This can't be undone. Files are removed from this browser's storage and from any records they were linked to."
        confirmLabel={forever === "all" ? "Empty recycle bin" : "Delete for good"}
        destructive
        onConfirm={async () => {
          const r = forever === "all" ? await emptyBin() : await deleteForever((forever as { id: string }).id);
          if (!r.ok) {
            toast.error(r.error);
            throw new Error(r.error);
          }
          toast.success(forever === "all" ? "Recycle bin emptied" : "Deleted for good");
        }}
      />
    </PageContainer>
  );
}

const LINK_LABEL: Record<LinkKind, string> = { contact: "Contact", account: "Account", deal: "Deal", quote: "Quote", ticket: "Ticket" };

function DetailsBody({ doc, canManage, onLink, onPreview }: { doc: DocumentFile; canManage: boolean; onLink: () => void; onPreview: () => void }) {
  const db = useDbStore((s) => s.db);
  const live = db.folders.filter((f) => !f.deletedAt);
  const owner = db.users.find((u) => u.id === doc.ownerId)?.name ?? "Unknown";
  const target = (l: { kind: LinkKind; id: string }) => {
    switch (l.kind) {
      case "contact":
        return { label: db.contacts.find((c) => c.id === l.id)?.displayName, href: `/contacts/${l.id}` };
      case "account":
        return { label: db.accounts.find((a) => a.id === l.id)?.name, href: `/accounts/${l.id}` };
      case "deal":
        return { label: db.deals.find((d) => d.id === l.id)?.title, href: `/deals/${l.id}` };
      case "quote":
        return { label: db.quotes.find((q) => q.id === l.id)?.number, href: `/quotes/${l.id}` };
      case "ticket": {
        const t = db.tickets.find((x) => x.id === l.id);
        return { label: t && `${t.number} ${t.subject}`, href: `/tickets/${l.id}` };
      }
    }
  };
  return (
    <>
      <SheetHeader className="border-b border-border/70 px-6 py-5">
        <div className="flex items-center gap-3">
          <FileIcon mime={doc.mimeType} name={doc.name} />
          <div className="min-w-0">
            <SheetTitle className="truncate">{doc.name}</SheetTitle>
            <SheetDescription>{formatBytes(doc.sizeBytes)}</SheetDescription>
          </div>
        </div>
      </SheetHeader>
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onPreview}>
            <Eye /> Preview
          </Button>
          {doc.storageRef && (
            <Button size="sm" variant="outline" onClick={() => void downloadDoc(doc)}>
              <Download /> Download
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
          <dt className="text-muted-foreground">Type</dt>
          <dd>{doc.mimeType || "Unknown"}</dd>
          <dt className="text-muted-foreground">Location</dt>
          <dd>{["My documents", ...folderPath(live, doc.folderId).map((f) => f.name)].join(" / ")}</dd>
          <dt className="text-muted-foreground">Added by</dt>
          <dd>{owner}</dd>
          <dt className="text-muted-foreground">Added</dt>
          <dd>{formatDate(doc.createdAt)}</dd>
          <dt className="text-muted-foreground">Last changed</dt>
          <dd>{formatDate(doc.updatedAt)}</dd>
          <dt className="text-muted-foreground">Stored</dt>
          <dd>{doc.storageRef ? "In this browser only (prototype)" : "Demo record — details only, no file content"}</dd>
        </dl>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Linked to</h3>
            {canManage && (
              <Button size="sm" variant="outline" onClick={onLink}>
                <Link2 /> Link
              </Button>
            )}
          </div>
          {doc.links.length === 0 ? (
            <p className="text-muted-foreground">Not linked to any customer, deal or ticket.</p>
          ) : (
            <ul className="divide-y divide-border/70 rounded-xl border border-border">
              {doc.links.map((l) => {
                const t = target(l);
                return (
                  <li key={`${l.kind}-${l.id}`} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-16 text-xs text-muted-foreground">{LINK_LABEL[l.kind]}</span>
                    {t.label ? <Link href={t.href} className="min-w-0 flex-1 truncate font-medium hover:underline">{t.label}</Link> : <span className="flex-1 text-muted-foreground">Record no longer exists</span>}
                    {canManage && (
                      <Button variant="ghost" size="icon-sm" aria-label={`Unlink from ${t.label ?? l.kind}`} onClick={async () => {
                        const r = await setLinked(doc.id, l, false);
                        if (!r.ok) toast.error(r.error);
                      }}>
                        <X />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
