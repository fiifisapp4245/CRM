import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Horizontal progress through ordered steps. Optional click handler makes reachable steps buttons. */
export function StatusStepper({ steps, currentIndex, onSelect, canSelect, label }: { steps: string[]; currentIndex: number; onSelect?: (i: number) => void; canSelect?: (i: number) => boolean; label: string }) {
  return (
    <ol className="flex w-full overflow-x-auto rounded-xl border border-border bg-card p-1 [scrollbar-width:none]" aria-label={label}>
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const clickable = !!onSelect && (canSelect?.(i) ?? true) && !current;
        const inner = (
          <>
            <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", done ? "bg-brand-700 text-white" : current ? "bg-brand-50 text-brand-800 ring-2 ring-brand-700" : "bg-secondary text-muted-foreground")}>
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={cn("truncate", current ? "font-medium text-foreground" : "text-muted-foreground")}>{s}</span>
          </>
        );
        return (
          <li key={s} className="min-w-28 flex-1" aria-current={current ? "step" : undefined}>
            {clickable ? (
              <button type="button" onClick={() => onSelect!(i)} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" title={`Move to ${s}`}>
                {inner}
              </button>
            ) : (
              <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm", current && "bg-brand-50/60")}>{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
