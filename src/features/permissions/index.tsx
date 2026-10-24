"use client";

import type { ReactNode } from "react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { hasPermission, type Permission, ROLE_DEFINITIONS } from "@/lib/permissions";
import type { Result, User } from "@/lib/types";
import { FEATURES, hasFeature, upgradeMessage, type Feature, type Plan } from "@/lib/entitlements";
import { useSessionStore } from "./session-store";

export { useSessionStore } from "./session-store";

export function getCurrentUser(): User {
  const id = useSessionStore.getState().currentUserId;
  const users = useDbStore.getState().db.users;
  return users.find((u) => u.id === id) ?? users[0];
}

export function useCurrentUser(): User {
  const id = useSessionStore((s) => s.currentUserId);
  const users = useDbStore((s) => s.db.users);
  return users.find((u) => u.id === id) ?? users[0];
}

export function useRole() {
  return ROLE_DEFINITIONS[useCurrentUser().role];
}

export function usePermission(permission: Permission): boolean {
  return hasPermission(useCurrentUser(), permission);
}

/** Renders children only when the current user holds the permission. UI convenience — services still enforce. */
export function Can({ permission, children, fallback = null }: { permission: Permission; children: ReactNode; fallback?: ReactNode }) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>;
}

/* ---------------- Plan entitlements (separate from roles) ---------------- */

/** The organisation's plan, from business settings. */
export function getEffectivePlan(): Plan {
  return useDbStore.getState().db.settings?.plan ?? "premium";
}

export function useEffectivePlan(): { plan: Plan; demo: boolean } {
  const plan = useDbStore((s) => s.db.settings?.plan ?? "premium");
  return { plan, demo: false };
}

export function useEntitlement(feature: Feature): { allowed: boolean; required: Plan; plan: Plan; demo: boolean } {
  const { plan, demo } = useEffectivePlan();
  return { allowed: hasFeature(plan, feature), required: FEATURES[feature].plan, plan, demo };
}

/** Service guard: returns an "upgrade" failure when the plan lacks the feature, else null. */
export function requireFeature(feature: Feature): Result<never> | null {
  return hasFeature(getEffectivePlan(), feature) ? null : { ok: false, error: upgradeMessage(feature), code: "upgrade" };
}
