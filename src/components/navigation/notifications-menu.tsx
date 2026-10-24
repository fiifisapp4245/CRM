"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { markNotificationsRead } from "@/lib/mock-data/notifications-service";
import { useCurrentUser } from "@/features/permissions";
import { formatRelative } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function NotificationsMenu() {
  const user = useCurrentUser();
  const items = useDbStore((s) => s.db.notifications).filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at));
  const unread = items.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => markNotificationsRead(user.id)}>
              Mark all as read
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((n) => {
              const body = (
                <div className="flex gap-3 px-4 py-3">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-600")} aria-hidden />
                  <div className="min-w-0">
                    <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatRelative(n.at)}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link href={n.href} onClick={() => markNotificationsRead(user.id, [n.id])} className="block hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
