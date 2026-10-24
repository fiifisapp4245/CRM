/**
 * Documents mock service. Metadata lives in the prototype db; bytes in this
 * browser's IndexedDB (lib/storage/file-store). FUTURE INTEGRATION POINT.
 */
import { commitDb, getDb, latency } from "@/lib/mock-data/db-store";
import { forbidden, invalid, newId, notFound, nowIso, ok } from "@/lib/mock-data/service-helpers";
import { hasPermission } from "@/lib/permissions";
import { deleteFile, putFile } from "@/lib/storage/file-store";
import type { Result } from "@/lib/types";
import { getCurrentUser, requireFeature } from "@/features/permissions";
import { auditEvent } from "@/features/sales/services/helpers";
import { descendantFolderIds, isExpired, nameTaken, storageUsed, uniqueFileName } from "../lib/documents";
import type { DocumentFile, Folder, FolderColor, RecordLink } from "../types";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function guard(): Result<never> | null {
  const gate = requireFeature("documents");
  if (gate) return gate;
  return hasPermission(getCurrentUser(), "documents.manage") ? null : forbidden("Your role can't change documents.");
}

export async function createFolder(input: { name: string; color: FolderColor; parentId: string | null }): Promise<Result<Folder>> {
  await latency(150);
  const g = guard();
  if (g) return g;
  const actor = getCurrentUser();
  const db = getDb();
  const name = input.name.trim();
  if (!name) return invalid("Give the folder a name.");
  if (name.length > 80) return invalid("Keep folder names under 80 characters.");
  if (nameTaken(db.folders.filter((f) => f.orgId === actor.orgId), input.parentId, name)) return invalid(`There's already a folder called "${name}" here.`);
  const now = nowIso();
  const f: Folder = { id: newId("fld"), orgId: actor.orgId, name, parentId: input.parentId, color: input.color, ownerId: actor.id, createdAt: now, updatedAt: now };
  commitDb({ ...db, folders: [...db.folders, f], audit: [...db.audit, auditEvent(actor.orgId, "folder", f.id, "created", actor.id, name)] });
  return ok(f);
}

export async function updateFolder(id: string, input: { name: string; color: FolderColor }): Promise<Result<Folder>> {
  await latency(120);
  const g = guard();
  if (g) return g;
  const actor = getCurrentUser();
  const db = getDb();
  const f = db.folders.find((x) => x.id === id && x.orgId === actor.orgId && !x.deletedAt);
  if (!f) return notFound();
  const name = input.name.trim();
  if (!name) return invalid("Give the folder a name.");
  if (nameTaken(db.folders, f.parentId, name, id)) return invalid(`There's already a folder called "${name}" here.`);
  const after = { ...f, name, color: input.color, updatedAt: nowIso() };
  commitDb({ ...db, folders: db.folders.map((x) => (x.id === id ? after : x)), audit: [...db.audit, auditEvent(actor.orgId, "folder", id, name !== f.name ? "renamed" : "updated", actor.id, name)] });
  return ok(after);
}

/**
 * Uploads: bytes go to IndexedDB first; metadata is written only for files
 * whose bytes were stored, so the workspace never lists a file it can't open.
 */
export async function uploadFiles(files: File[], folderId: string | null, links: RecordLink[] = [], onProgress?: (name: string, state: "storing" | "done" | "failed", error?: string) => void): Promise<Result<DocumentFile[]>> {
  const g = guard();
  if (g) return g;
  const actor = getCurrentUser();
  const created: DocumentFile[] = [];
  for (const file of files) {
    onProgress?.(file.name, "storing");
    const db = getDb();
    const quota = db.settings.storageQuotaBytes;
    if (file.size === 0) {
      onProgress?.(file.name, "failed", "The file is empty.");
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      onProgress?.(file.name, "failed", "Larger than the 50 MB demo limit per file.");
      continue;
    }
    if (storageUsed(db.documents.filter((d) => d.orgId === actor.orgId)) + file.size > quota) {
      onProgress?.(file.name, "failed", "Not enough storage left.");
      continue;
    }
    const id = newId("doc");
    try {
      await putFile(id, file);
    } catch (e) {
      onProgress?.(file.name, "failed", e instanceof Error ? e.message : "Couldn't store the file in this browser.");
      continue;
    }
    await latency(120);
    const fresh = getDb();
    const siblings = fresh.documents.filter((d) => !d.deletedAt && d.folderId === folderId && d.orgId === actor.orgId).map((d) => d.name);
    const now = nowIso();
    const doc: DocumentFile = { id, orgId: actor.orgId, name: uniqueFileName(siblings, file.name), mimeType: file.type || "application/octet-stream", sizeBytes: file.size, folderId, ownerId: actor.id, starred: false, links, storageRef: `idb:${id}`, createdAt: now, updatedAt: now };
    commitDb({ ...fresh, documents: [doc, ...fresh.documents], audit: [...fresh.audit, auditEvent(actor.orgId, "document", id, "uploaded", actor.id, doc.name)] });
    created.push(doc);
    onProgress?.(file.name, "done");
  }
  return ok(created);
}

function loadDoc(id: string) {
  const actor = getCurrentUser();
  const db = getDb();
  return { actor, db, doc: db.documents.find((d) => d.id === id && d.orgId === actor.orgId) };
}

export async function updateDocument(id: string, patch: Partial<Pick<DocumentFile, "name" | "starred" | "folderId" | "links">>): Promise<Result<DocumentFile>> {
  await latency(80);
  const g = guard();
  if (g) return g;
  const { actor, db, doc } = loadDoc(id);
  if (!doc || doc.deletedAt) return notFound();
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return invalid("A file needs a name.");
    const folderId = patch.folderId !== undefined ? patch.folderId : doc.folderId;
    if (db.documents.some((d) => d.id !== id && !d.deletedAt && d.folderId === folderId && d.name.toLowerCase() === name.toLowerCase())) return invalid(`There's already a file called "${name}" in this folder.`);
    patch = { ...patch, name };
  }
  if (patch.folderId !== undefined && patch.folderId !== null && !db.folders.some((f) => f.id === patch.folderId && !f.deletedAt)) return invalid("That folder no longer exists.");
  if (patch.folderId !== undefined && patch.name === undefined && db.documents.some((d) => d.id !== id && !d.deletedAt && d.folderId === patch.folderId && d.name.toLowerCase() === doc.name.toLowerCase())) {
    patch = { ...patch, name: uniqueFileName(db.documents.filter((d) => !d.deletedAt && d.folderId === patch.folderId).map((d) => d.name), doc.name) };
  }
  const after: DocumentFile = { ...doc, ...patch, updatedAt: patch.starred !== undefined && Object.keys(patch).length === 1 ? doc.updatedAt : nowIso() };
  const action = patch.name && patch.name !== doc.name ? "renamed" : patch.folderId !== undefined ? "moved" : "updated";
  commitDb({ ...db, documents: db.documents.map((d) => (d.id === id ? after : d)), audit: patch.starred !== undefined ? db.audit : [...db.audit, auditEvent(actor.orgId, "document", id, action, actor.id, after.name)] });
  return ok(after);
}

/** Link or unlink a document to a CRM record (contact, account, deal, quote, ticket). */
export async function setLinked(id: string, link: RecordLink, linked: boolean): Promise<Result<DocumentFile>> {
  const { doc } = loadDoc(id);
  if (!doc) return notFound();
  const has = doc.links.some((l) => l.kind === link.kind && l.id === link.id);
  if (has === linked) return ok(doc);
  return updateDocument(id, { links: linked ? [...doc.links, link] : doc.links.filter((l) => !(l.kind === link.kind && l.id === link.id)) });
}

/** Move to recycle bin. Binning a folder bins everything inside it, so it can be restored together. */
export async function binItem(kind: "folder" | "document", id: string): Promise<Result<true>> {
  await latency(120);
  const g = guard();
  if (g) return g;
  const actor = getCurrentUser();
  const db = getDb();
  const now = nowIso();
  if (kind === "document") {
    const d = db.documents.find((x) => x.id === id && !x.deletedAt);
    if (!d) return notFound();
    commitDb({ ...db, documents: db.documents.map((x) => (x.id === id ? { ...x, deletedAt: now, binnedWith: id } : x)), audit: [...db.audit, auditEvent(actor.orgId, "document", id, "deleted", actor.id, `${d.name} (moved to recycle bin)`)] });
    return ok(true);
  }
  const f = db.folders.find((x) => x.id === id && !x.deletedAt);
  if (!f) return notFound();
  const ids = descendantFolderIds(db.folders, id);
  commitDb({
    ...db,
    folders: db.folders.map((x) => (ids.has(x.id) && !x.deletedAt ? { ...x, deletedAt: now, binnedWith: id } : x)),
    documents: db.documents.map((x) => (x.folderId && ids.has(x.folderId) && !x.deletedAt ? { ...x, deletedAt: now, binnedWith: id } : x)),
    audit: [...db.audit, auditEvent(actor.orgId, "folder", id, "deleted", actor.id, `${f.name} (moved to recycle bin)`)],
  });
  return ok(true);
}

/** Restores a binned item and everything binned with it. If its parent is gone, it returns to My documents. */
export async function restoreItem(id: string): Promise<Result<{ toRoot: boolean }>> {
  await latency(120);
  const g = guard();
  if (g) return g;
  const actor = getCurrentUser();
  const db = getDb();
  const top = db.folders.find((f) => f.id === id) ?? db.documents.find((d) => d.id === id);
  if (!top?.deletedAt) return notFound();
  const parent = "parentId" in top ? top.parentId : top.folderId;
  const parentLive = !parent || db.folders.some((f) => f.id === parent && !f.deletedAt);
  const fix = <T extends { id: string; binnedWith?: string; deletedAt?: string }>(x: T, parentKey: "parentId" | "folderId"): T => {
    if (x.binnedWith !== id) return x;
    const restored = { ...x, deletedAt: undefined, binnedWith: undefined };
    return x.id === id && !parentLive ? { ...restored, [parentKey]: null } : restored;
  };
  let folders = db.folders.map((f) => fix(f, "parentId"));
  // A restored folder must not clash with a live sibling of the same name.
  const tf = folders.find((f) => f.id === id);
  if (tf && nameTaken(folders.filter((f) => f.id !== id), tf.parentId, tf.name)) folders = folders.map((f) => (f.id === id ? { ...f, name: `${f.name} (restored)` } : f));
  commitDb({ ...db, folders, documents: db.documents.map((d) => fix(d, "folderId")), audit: [...db.audit, auditEvent(actor.orgId, "parentId" in top ? "folder" : "document", id, "restored", actor.id, top.name)] });
  return ok({ toRoot: !parentLive });
}

async function removeForever(db: ReturnType<typeof getDb>, ids: Set<string>) {
  const docs = db.documents.filter((d) => ids.has(d.binnedWith ?? "") || ids.has(d.id));
  for (const d of docs) if (d.storageRef) await deleteFile(d.id).catch(() => undefined);
  return {
    ...db,
    folders: db.folders.filter((f) => !(f.deletedAt && (ids.has(f.binnedWith ?? "") || ids.has(f.id)))),
    documents: db.documents.filter((d) => !(d.deletedAt && (ids.has(d.binnedWith ?? "") || ids.has(d.id)))),
  };
}

export async function deleteForever(id: string): Promise<Result<true>> {
  await latency(150);
  const g = guard();
  if (g) return g;
  const actor = getCurrentUser();
  const db = getDb();
  const top = db.folders.find((f) => f.id === id && f.deletedAt) ?? db.documents.find((d) => d.id === id && d.deletedAt);
  if (!top) return notFound();
  const next = await removeForever(getDb(), new Set([id]));
  commitDb({ ...next, audit: [...next.audit, auditEvent(actor.orgId, "parentId" in top ? "folder" : "document", id, "deleted", actor.id, `${top.name} (deleted for good)`)] });
  return ok(true);
}

export async function emptyBin(): Promise<Result<number>> {
  const g = guard();
  if (g) return g;
  const actor = getCurrentUser();
  const db = getDb();
  const tops = [...db.folders, ...db.documents].filter((x) => x.orgId === actor.orgId && x.deletedAt && x.binnedWith === x.id);
  const next = await removeForever(db, new Set(tops.map((t) => t.id)));
  commitDb(next);
  return ok(tops.length);
}

/**
 * Retention: items binned more than N days ago are removed the next time
 * the app runs this check (there is no background process while closed).
 */
export async function purgeExpired(now = Date.now()): Promise<number> {
  const db = getDb();
  const days = db.settings?.recycleRetentionDays ?? 30;
  const expired = [...db.folders, ...db.documents].filter((x) => x.deletedAt && x.binnedWith === x.id && isExpired(x.deletedAt, days, now));
  if (!expired.length) return 0;
  commitDb(await removeForever(db, new Set(expired.map((x) => x.id))));
  return expired.length;
}
