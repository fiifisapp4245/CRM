"use client";

import { useEffect } from "react";

/**
 * Warns before the tab is closed or reloaded while `dirty` is true. In-app
 * navigation (Cancel, breadcrumbs, back) is guarded by the form itself via
 * a confirm dialog, because the App Router has no route-change blocking API.
 */
export function useBeforeUnload(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
