export type FolderColor = "default" | "cyan" | "emerald" | "amber" | "rose" | "violet" | "sky";
export const FOLDER_COLORS: FolderColor[] = ["default", "cyan", "emerald", "amber", "rose", "violet", "sky"];
export const FOLDER_COLOR_LABELS: Record<FolderColor, string> = { default: "Default", cyan: "Cyan", emerald: "Emerald", amber: "Amber", rose: "Rose", violet: "Violet", sky: "Sky" };

export type FileCategory = "pictures" | "videos" | "audio" | "pdfs" | "documents" | "spreadsheets" | "presentations" | "other";
export const FILE_CATEGORY_LABELS: Record<Exclude<FileCategory, "other">, string> = {
  pictures: "Pictures",
  videos: "Videos",
  audio: "Music & audio",
  pdfs: "PDFs",
  documents: "Documents",
  spreadsheets: "Spreadsheets",
  presentations: "Presentations",
};

export type LinkKind = "contact" | "account" | "deal" | "quote" | "ticket";
export interface RecordLink {
  kind: LinkKind;
  id: string;
}

export interface Folder {
  id: string;
  orgId: string;
  name: string;
  parentId: string | null;
  color: FolderColor;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  /** Top-level item that was binned, for restoring nested content together. */
  binnedWith?: string;
}

export interface DocumentFile {
  id: string;
  orgId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string | null;
  ownerId: string;
  starred: boolean;
  links: RecordLink[];
  /** "idb:<id>" when the bytes are in this browser's IndexedDB; null for metadata-only demo records. */
  storageRef: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  binnedWith?: string;
}
