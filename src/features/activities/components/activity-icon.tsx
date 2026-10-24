import { CalendarClock, CheckSquare, Mail, MapPin, MessageSquare, PhoneCall, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityType } from "../types";

export const ACTIVITY_ICONS = { note: StickyNote, call: PhoneCall, meeting: CalendarClock, visit: MapPin, task: CheckSquare, email: Mail, message: MessageSquare } as const;

export function ActivityIcon({ type, className }: { type: ActivityType; className?: string }) {
  const Icon = ACTIVITY_ICONS[type];
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground", className)}>
      <Icon className="size-4" />
    </span>
  );
}
