/**
 * Browser-local file bytes for the Documents demo (IndexedDB). Files never
 * leave this browser; clearing site data or using another device loses them.
 * FUTURE INTEGRATION POINT: replace with the suite's storage service.
 */
const DB_NAME = "trovesuite-crm-files";
const STORE = "blobs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("This browser can't store files locally."));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Couldn't open local file storage."));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? new Error("Local file storage failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Local file storage is full or unavailable."));
  });
}

export const putFile = (key: string, blob: Blob) => run("readwrite", (s) => s.put(blob, key)).then(() => undefined);
export const getFile = (key: string) => run<Blob | undefined>("readonly", (s) => s.get(key) as IDBRequest<Blob | undefined>);
export const deleteFile = (key: string) => run("readwrite", (s) => s.delete(key)).then(() => undefined);
export const clearFiles = () => run("readwrite", (s) => s.clear()).then(() => undefined);
