import { Folder as FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FolderColor } from "../types";

/** Subtle folder colours; the folder name always identifies it, never colour alone. */
export const FOLDER_TONE: Record<FolderColor, string> = {
  default: "text-slate-500 bg-slate-100",
  cyan: "text-cyan-700 bg-cyan-50",
  emerald: "text-emerald-700 bg-emerald-50",
  amber: "text-amber-700 bg-amber-50",
  rose: "text-rose-700 bg-rose-50",
  violet: "text-violet-700 bg-violet-50",
  sky: "text-sky-700 bg-sky-50",
};

export function FolderGlyph({ color, size = "md" }: { color: FolderColor; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-lg", FOLDER_TONE[color], size === "sm" ? "size-7" : size === "md" ? "size-9" : "size-14 rounded-xl")}>
      <FolderIcon className={size === "lg" ? "size-7" : "size-4"} fill="currentColor" fillOpacity={0.18} />
    </span>
  );
}
