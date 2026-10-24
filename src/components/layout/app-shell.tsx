"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useSessionStore } from "@/features/permissions";
import { useUiStore } from "@/lib/stores/ui-store";
import { Sidebar, NavContent, WorkspaceBadge } from "@/components/navigation/sidebar";
import { GlobalSearch } from "@/components/navigation/global-search";
import { NotificationsMenu } from "@/components/navigation/notifications-menu";
import { UserMenu } from "@/components/navigation/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { processDueCampaigns } from "@/features/messaging/services/campaigns-service";
import { purgeExpired } from "@/features/documents/services/documents-service";
import { TooltipProvider } from "@/components/ui/tooltip";

export function useRehydrateStores() {
  const hydrated = useDbStore((s) => s.hydrated);
  useEffect(() => {
    useSessionStore.persist.rehydrate();
    useUiStore.persist.rehydrate();
    useDbStore.persist.rehydrate();
  }, []);
  // Housekeeping that a server would do in the background; here it runs when the app opens.
  useEffect(() => {
    if (!hydrated) return;
    processDueCampaigns();
    void purgeExpired();
  }, [hydrated]);
  return hydrated;
}

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useRehydrateStores();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <TooltipProvider delayDuration={300}>
      <a href="#main" className="sr-only z-50 rounded bg-card px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-2 focus:ring-ring">
        Skip to content
      </a>
      <div className="flex min-h-dvh" style={{ "--sidebar-w": collapsed ? "72px" : "16rem" } as React.CSSProperties}>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-panel px-4 sm:px-6 lg:px-10">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
              <Menu />
            </Button>
            <div className="flex min-w-0 flex-1 items-center">{hydrated && <GlobalSearch />}</div>
            {hydrated && (
              <div className="flex shrink-0 items-center gap-1">
                <NotificationsMenu />
                <UserMenu />
              </div>
            )}
          </header>
          <main id="main" className="flex-1">
            {hydrated ? children : <ShellSkeleton />}
          </main>
        </div>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 gap-0 overflow-y-auto bg-sidebar p-0">
          <SheetHeader className="px-5 py-4">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <WorkspaceBadge />
          </SheetHeader>
          <div className="px-3 pb-6">{hydrated && <NavContent onNavigate={() => setMobileOpen(false)} />}</div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 px-4 pt-7 sm:px-6 lg:px-10" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
