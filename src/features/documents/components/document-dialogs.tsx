"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { useDbStore } from "@/lib/mock-data/db-store";
import { getFile } from "@/lib/storage/file-store";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/utils/format";
import { Field } from "@/components/forms/form-section";
import { InlineNotice } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { folderPath, previewKind } from "../lib/documents";
import { createFolder, setLinked, updateDocument, updateFolder } from "../services/documents-service";
import { FOLDER_COLOR_LABELS, FOLDER_COLORS, type DocumentFile, type Folder, type FolderColor, type LinkKind } from "../types";
import { FileIcon } from "./file-icon";
import { FOLDER_TONE } from "./folder-visuals";

/* ---------------- New / edit folder ---------------- */

export function FolderDialog({ open, onOpenChange, parentId, folder }: { open: boolean; onOpenChange: (o: boolean) => void; parentId: string | null; folder?: Folder }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{open && <FolderBody parentId={parentId} folder={folder} onClose={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function FolderBody({ parentId, folder, onClose }: { parentId: string | null; folder?: Folder; onClose: () => void }) {
  const [name, setName] = useState(folder?.name ?? "");
  const [color, setColor] = useState<FolderColor>(folder?.color ?? "default");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = folder ? await updateFolder(folder.id, { name, color }) : await createFolder({ name, color, parentId });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(folder ? "Folder updated" : `Folder "${r.data.name}" made`);
    onClose();
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{folder ? "Rename folder" : "New folder"}</DialogTitle>
      </DialogHeader>
      <Field label="Name" htmlFor="fld-name" error={error ?? undefined}>
        <Input id="fld-name" autoFocus value={name} onChange={(e) => (setName(e.target.value), setError(null))} aria-invalid={!!error || undefined} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Colour</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Folder colour">
          {FOLDER_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} onClick={() => setColor(c)} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs", color === c ? "border-brand-700 ring-2 ring-brand-700/20" : "border-border hover:border-border-strong")}>
              <span className={cn("size-3.5 rounded", FOLDER_TONE[c])} style={{ boxShadow: "inset 0 0 0 1px currentColor" }} />
              {FOLDER_COLOR_LABELS[c]}
            </button>
          ))}
        </div>
      </fieldset>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {folder ? "Save" : "Make folder"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* ---------------- Rename file ---------------- */

export function RenameDialog({ doc, onOpenChange }: { doc: DocumentFile | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{doc && <RenameBody doc={doc} onClose={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function RenameBody({ doc, onClose }: { doc: DocumentFile; onClose: () => void }) {
  const [name, setName] = useState(doc.name);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await updateDocument(doc.id, { name });
        if (!r.ok) return setError(r.error);
        toast.success("Renamed");
        onClose();
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename file</DialogTitle>
      </DialogHeader>
      <Field label="Name" htmlFor="doc-name" error={error ?? undefined}>
        <Input id="doc-name" autoFocus value={name} onChange={(e) => (setName(e.target.value), setError(null))} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Rename</Button>
      </DialogFooter>
    </form>
  );
}

/* ---------------- Move ---------------- */

export function MoveDialog({ doc, onOpenChange }: { doc: DocumentFile | null; onOpenChange: (o: boolean) => void }) {
  const folders = useDbStore((s) => s.db.folders);
  const live = folders.filter((f) => !f.deletedAt);
  const [target, setTarget] = useState<string>("__root");
  const options = useMemo(() => live.map((f) => ({ id: f.id, label: folderPath(live, f.id).map((p) => p.name).join(" / ") })).sort((a, b) => a.label.localeCompare(b.label)), [live]);
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {doc?.name}</DialogTitle>
          <DialogDescription>Choose where it should live. Links to customers and deals stay the same.</DialogDescription>
        </DialogHeader>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger aria-label="Destination folder">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__root">My documents (top level)</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              const r = await updateDocument(doc!.id, { folderId: target === "__root" ? null : target });
              if (!r.ok) return toast.error(r.error);
              toast.success("Moved", { description: target === "__root" ? "My documents" : options.find((o) => o.id === target)?.label });
              onOpenChange(false);
            }}
          >
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Link to a CRM record ---------------- */

const KIND_LABEL: Record<LinkKind, string> = { contact: "Contact", account: "Account", deal: "Deal", quote: "Quote", ticket: "Ticket" };

export function LinkDialog({ doc, onOpenChange }: { doc: DocumentFile | null; onOpenChange: (o: boolean) => void }) {
  const db = useDbStore((s) => s.db);
  const [kind, setKind] = useState<LinkKind>("contact");
  const [q, setQ] = useState("");
  const options = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list: { id: string; label: string }[] =
      kind === "contact"
        ? db.contacts.filter((c) => c.status === "active").map((c) => ({ id: c.id, label: c.displayName }))
        : kind === "account"
          ? db.accounts.map((a) => ({ id: a.id, label: a.name }))
          : kind === "deal"
            ? db.deals.map((d) => ({ id: d.id, label: d.title }))
            : kind === "quote"
              ? db.quotes.map((x) => ({ id: x.id, label: `${x.number} — ${x.customer.name}` }))
              : db.tickets.map((t) => ({ id: t.id, label: `${t.number} ${t.subject}` }));
    return list.filter((o) => !s || o.label.toLowerCase().includes(s)).slice(0, 12);
  }, [db, kind, q]);
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link {doc?.name}</DialogTitle>
          <DialogDescription>The file stays in Documents and also appears on the record. Prototype enhancement.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Select value={kind} onValueChange={(v) => (setKind(v as LinkKind), setQ(""))}>
            <SelectTrigger className="w-36" aria-label="Record type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABEL) as LinkKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search records" />
        </div>
        <ul className="max-h-64 overflow-y-auto rounded-xl border border-border">
          {options.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Nothing matches.</li>}
          {options.map((o) => {
            const linked = !!doc?.links.some((l) => l.kind === kind && l.id === o.id);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={linked}
                  onClick={async () => {
                    const r = await setLinked(doc!.id, { kind, id: o.id }, true);
                    if (!r.ok) return toast.error(r.error);
                    toast.success(`Linked to ${o.label}`);
                    onOpenChange(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary disabled:text-muted-foreground"
                >
                  {o.label} {linked && <span className="text-xs">Linked</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Preview ---------------- */

export function PreviewDialog({ doc, onOpenChange }: { doc: DocumentFile | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-3xl">{doc && <PreviewBody doc={doc} />}</DialogContent>
    </Dialog>
  );
}

/** Loads bytes from this browser's storage; shows a useful fallback when there are none or the type can't be previewed. */
function PreviewBody({ doc }: { doc: DocumentFile }) {
  const [state, setState] = useState<{ url?: string; text?: string; missing?: boolean }>({});
  const kind = previewKind(doc.mimeType);
  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    if (!doc.storageRef) return;
    getFile(doc.id)
      .then(async (blob) => {
        if (cancelled) return;
        if (!blob) return setState({ missing: true });
        if (kind === "text") return setState({ text: (await blob.text()).slice(0, 20000) });
        url = URL.createObjectURL(blob);
        setState({ url });
      })
      .catch(() => !cancelled && setState({ missing: true }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.id, doc.storageRef, kind]);

  const fallback = (title: string, body: string) => (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <FileIcon mime={doc.mimeType} name={doc.name} size="lg" />
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle className="truncate pr-6">{doc.name}</DialogTitle>
        <DialogDescription>{formatBytes(doc.sizeBytes)}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-panel/50">
        {!doc.storageRef ? (
          fallback("Demo record — no file content", "This sample document only has details (name, size, links). Upload a real file to preview or download it.")
        ) : state.missing ? (
          fallback("File not found in this browser", "Uploads are kept in this browser only. It may have been cleared, or uploaded on another device.")
        ) : !kind ? (
          fallback("No preview for this type", "Download it to open it in the right app.")
        ) : kind === "image" && state.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.url} alt={doc.name} className="mx-auto max-h-[70vh] object-contain" />
        ) : kind === "pdf" && state.url ? (
          <iframe src={state.url} title={doc.name} className="h-[70vh] w-full" />
        ) : kind === "video" && state.url ? (
          <video src={state.url} controls className="mx-auto max-h-[70vh]" />
        ) : kind === "audio" && state.url ? (
          <div className="p-8">
            <audio src={state.url} controls className="w-full" />
          </div>
        ) : kind === "text" && state.text !== undefined ? (
          <pre className="p-4 text-xs whitespace-pre-wrap">{state.text}</pre>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
        )}
      </div>
      {doc.storageRef && !state.missing && (
        <DialogFooter>
          <Button variant="outline" onClick={() => downloadDoc(doc)}>
            <Download /> Download
          </Button>
        </DialogFooter>
      )}
      {!doc.storageRef && (
        <InlineNotice tone="neutral" icon={FlaskConical}>
          Download isn&apos;t offered for demo records because there&apos;s no file behind them.
        </InlineNotice>
      )}
    </>
  );
}

export async function downloadDoc(doc: DocumentFile) {
  const blob = doc.storageRef ? await getFile(doc.id).catch(() => undefined) : undefined;
  if (!blob) return toast.error("This file's content isn't available in this browser.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
