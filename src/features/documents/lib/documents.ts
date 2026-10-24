/** Pure file-manager rules: categories, bin retention, storage, folder trees, search and sort. */
import type { DocumentFile, FileCategory, Folder } from "../types";

const EXT: Record<string, FileCategory> = {
  jpg: "pictures", jpeg: "pictures", png: "pictures", gif: "pictures", webp: "pictures", svg: "pictures", heic: "pictures",
  mp4: "videos", mov: "videos", webm: "videos", avi: "videos", mkv: "videos",
  mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio", aac: "audio",
  pdf: "pdfs",
  doc: "documents", docx: "documents", txt: "documents", rtf: "documents", odt: "documents", md: "documents",
  xls: "spreadsheets", xlsx: "spreadsheets", csv: "spreadsheets", ods: "spreadsheets",
  ppt: "presentations", pptx: "presentations", odp: "presentations", key: "presentations",
};

export function fileCategory(mime: string, name: string): FileCategory {
  if (mime.startsWith("image/")) return "pictures";
  if (mime.startsWith("video/")) return "videos";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdfs";
  if (/spreadsheet|excel|csv/.test(mime)) return "spreadsheets";
  if (/presentation|powerpoint/.test(mime)) return "presentations";
  if (/word|opendocument\.text|text\/plain|rtf/.test(mime)) return "documents";
  return EXT[name.split(".").pop()?.toLowerCase() ?? ""] ?? "other";
}

/** Previews this prototype can render from local bytes. */
export function previewKind(mime: string): "image" | "pdf" | "text" | "video" | "audio" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

const DAY = 86_400_000;
export const retentionDeadline = (deletedAt: string, days: number) => new Date(Date.parse(deletedAt) + days * DAY).toISOString();
export const daysLeft = (deletedAt: string, days: number, now: number) => Math.max(0, Math.ceil((Date.parse(retentionDeadline(deletedAt, days)) - now) / DAY));
export const isExpired = (deletedAt: string, days: number, now: number) => now >= Date.parse(retentionDeadline(deletedAt, days));

/** Prototype rule: binned files keep counting toward storage until deleted for good. */
export const storageUsed = (docs: DocumentFile[]) => docs.reduce((a, d) => a + d.sizeBytes, 0);

export function descendantFolderIds(folders: Folder[], rootId: string): Set<string> {
  const out = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

export function folderPath(folders: Folder[], id: string | null): Folder[] {
  const path: Folder[] = [];
  let cur = id ? folders.find((f) => f.id === id) : undefined;
  for (let i = 0; cur && i < 20; i++) {
    path.unshift(cur);
    cur = cur.parentId ? folders.find((f) => f.id === cur!.parentId) : undefined;
  }
  return path;
}

export const nameTaken = (folders: Folder[], parentId: string | null, name: string, exceptId?: string) =>
  folders.some((f) => !f.deletedAt && f.parentId === parentId && f.id !== exceptId && f.name.trim().toLowerCase() === name.trim().toLowerCase());

/** "Report.pdf" → "Report (2).pdf" when the name exists in the same folder. */
export function uniqueFileName(existing: string[], name: string): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let i = 2; ; i++) if (!taken.has(`${base} (${i})${ext}`.toLowerCase())) return `${base} (${i})${ext}`;
}

export type DocSort = "name" | "changed" | "size" | "type";

export function sortDocs(list: DocumentFile[], sort: DocSort): DocumentFile[] {
  const by: Record<DocSort, (a: DocumentFile, b: DocumentFile) => number> = {
    name: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
    changed: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    size: (a, b) => b.sizeBytes - a.sizeBytes,
    type: (a, b) => fileCategory(a.mimeType, a.name).localeCompare(fileCategory(b.mimeType, b.name)) || a.name.localeCompare(b.name),
  };
  return [...list].sort(by[sort]);
}

export function sortFolders(list: Folder[], sort: DocSort): Folder[] {
  return [...list].sort(sort === "changed" ? (a, b) => b.updatedAt.localeCompare(a.updatedAt) : (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
