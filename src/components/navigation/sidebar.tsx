"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useCurrentUser } from "@/features/permissions";
import { useDbStore } from "@/lib/mock-data/db-store";
import { hasPermission } from "@/lib/permissions";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/shared/brand-mark";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_GROUPS, type NavItem } from "./nav-config";

export function useVisibleNav() {
  const user = useCurrentUser();
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || hasPermission(user, i.permission)) })).filter((g) => g.items.length);
}

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground transition-[background-color,color,box-shadow] duration-150 outline-none",
        "hover:bg-white/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-card font-medium text-foreground ring-1 ring-border hover:bg-card",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0 transition-colors", active ? "text-brand-700" : "text-subtle-foreground group-hover:text-foreground")} strokeWidth={active ? 2.1 : 1.8} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.status === "pending" && <span className="ml-auto size-1.5 rounded-full bg-border-strong" title="UX audit pending" aria-label="(pending)" />}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function NavContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const groups = useVisibleNav();
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            <div className="mx-auto mb-1.5 h-px w-5 bg-border-strong" aria-hidden />
          ) : (
            <p className="px-3 pb-1.5 text-xs font-medium text-subtle-foreground">{group.label}</p>
          )}
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}

export function WorkspaceBadge({ collapsed = false }: { collapsed?: boolean }) {
  const user = useCurrentUser();
  const org = useDbStore((s) => s.db.orgs.find((o) => o.id === user.orgId));
  return (
    <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
      <BrandMark className="size-8 rounded-[10px]" />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[0.9375rem] font-semibold tracking-tight text-foreground">TroveSuite CRM</p>
          <p className="truncate text-xs text-muted-foreground">{org?.name}</p>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  return (
    <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out lg:flex", collapsed ? "w-[72px]" : "w-64")}>
      <div className={cn("flex h-16 items-center px-5", collapsed && "justify-center px-0")}>
        <WorkspaceBadge collapsed={collapsed} />
      </div>
      <div className={cn("flex-1 overflow-y-auto px-3 pt-3 pb-4", collapsed && "px-3")}>
        <NavContent collapsed={collapsed} />
      </div>
      <div className="border-t border-border px-3 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={cn(
            "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}

