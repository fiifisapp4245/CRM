export type RoleId =
  | "crm_sales_manager"
  | "crm_user"
  | "crm_viewer"
  | "crm_admin"
  | "suite_admin";

export interface Organization {
  id: string;
  name: string;
}

export interface User {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: RoleId;
  /** Sales manager this user reports to, used for "team" record scope. */
  managerId?: string;
  jobTitle?: string;
  status: "active" | "inactive";
  /** QA / automation accounts are hidden from owner pickers. */
  isTestAccount?: boolean;
  /** Set when this identity duplicates another user (e.g. a re-invited account). */
  duplicateOfUserId?: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: "forbidden" | "not_found" | "invalid" | "conflict" | "upgrade" };
