import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils/format";

const SIZES = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-[11px]", lg: "size-12 text-base", xl: "size-16 text-xl", "2xl": "size-24 text-[1.75rem]" } as const;
const TINTS = 6;

/** Stable, soft identity tint per name so people are recognisable at a glance. */
function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (h % TINTS) + 1;
}

export function UserAvatar({ name, size = "md", className, muted }: { name: string; size?: keyof typeof SIZES; className?: string; muted?: boolean }) {
  const t = tintFor(name);
  return (
    <span
      aria-hidden
      style={muted ? undefined : { background: `var(--tint-${t}-bg)`, color: `var(--tint-${t}-fg)` }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight select-none", muted && "bg-muted text-muted-foreground", SIZES[size], className)}
    >
      {initials(name)}
    </span>
  );
}
