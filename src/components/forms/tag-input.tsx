"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

/** Type a tag and press Enter or comma. Backspace on an empty input removes the last tag. */
export function TagInput({ id, value, onChange, suggestions = [], placeholder = "Add a tag…" }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, "");
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase())) return setDraft("");
    onChange([...value, t]);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
  };
  const open = suggestions.filter((s) => !value.includes(s) && (!draft || s.toLowerCase().includes(draft.toLowerCase()))).slice(0, 8);
  return (
    <div className="space-y-2">
      <div className={cn("flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50")}>
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pr-1 pl-2 text-xs font-medium text-slate-700">
            {t}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} className="rounded p-0.5 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`Remove tag ${t}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="h-6 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Suggestions:</span>
          {open.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:border-solid hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
