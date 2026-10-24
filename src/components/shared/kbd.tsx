import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd className={cn("inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-sans text-[11px] font-medium text-muted-foreground", className)} {...props} />;
}
