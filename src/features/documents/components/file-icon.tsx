import { File, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileCategory } from "../lib/documents";

const ICONS = { pictures: FileImage, videos: FileVideo, audio: FileAudio, pdfs: FileText, documents: FileText, spreadsheets: FileSpreadsheet, presentations: Presentation, other: File } as const;
const TONES = { pictures: "text-violet-700 bg-violet-50", videos: "text-rose-700 bg-rose-50", audio: "text-amber-700 bg-amber-50", pdfs: "text-red-700 bg-red-50", documents: "text-sky-700 bg-sky-50", spreadsheets: "text-emerald-700 bg-emerald-50", presentations: "text-orange-700 bg-orange-50", other: "text-muted-foreground bg-secondary" } as const;

export function FileIcon({ mime, name, className, size = "md" }: { mime: string; name: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const cat = fileCategory(mime, name);
  const Icon = ICONS[cat];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-lg", TONES[cat], size === "sm" ? "size-7" : size === "md" ? "size-9" : "size-14 rounded-xl", className)}>
      <Icon className={size === "lg" ? "size-7" : "size-4"} />
    </span>
  );
}
