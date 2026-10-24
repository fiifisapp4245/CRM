import type { RoleId } from "@/lib/types";

/**
 * PROTOTYPE PERMISSION MATRIX — single source of truth.
 *
 * These are initial interpretations of the existing CRM roles, NOT a verified
 * copy of the backend permission matrix. Revise this file when the real
 * access rules are available; UI and mock services both read from it.
 * See docs/permissions.md for the assumptions behind each value.
 */

export const PERMISSIONS = [
  "contacts.view",
  "contacts.create",
  "contacts.edit",
  "contacts.archive",
  "contacts.restore",
  "contacts.reassign",
  "contacts.import",
  "contacts.export",
  "contacts.merge",
  "contacts.viewAudit",
  "consent.record",
  "consent.viewEvidence",
  "activities.create",
  "messages.send",
  "activities.import",
  "templates.manage",
  "campaigns.manage",
  "tickets.manage",
  "answers.manage",
  "documents.manage",
  "accounts.view",
  "accounts.create",
  "accounts.edit",
  "accounts.import",
  "accounts.export",
  "segments.view",
  "segments.create",
  "segments.manage",
  "sales.view",
  "leads.manage",
  "deals.manage",
  "deals.import",
  "quotes.manage",
  "products.manage",
  "dashboard.team",
  "dashboard.admin",
  "reports.view",
  "forecast.view",
  "settings.view",
  "suite.admin",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Record scope: which contacts a role may see / change.
 * - "all"  — every record in the user's organisation
 * - "team" — records owned by the user or their direct reports, plus unassigned
 * - "own"  — records owned by the user, plus unassigned
 */
export type RecordScope = "all" | "team" | "own" | "none";

export interface RoleDefinition {
  id: RoleId;
  label: string;
  shortLabel: string;
  description: string;
  permissions: Permission[];
  readScope: RecordScope;
  writeScope: RecordScope;
}

export const ROLE_DEFINITIONS: Record<RoleId, RoleDefinition> = {
  crm_sales_manager: {
    id: "crm_sales_manager",
    label: "CRM Sales Manager",
    shortLabel: "Sales Manager",
    description: "Oversees the sales team's customers, activity and pipeline. Can reassign and merge contacts.",
    permissions: [
      "sales.view",
      "leads.manage",
      "deals.manage",
      "deals.import",
      "quotes.manage",
      "products.manage",
      "accounts.view",
      "accounts.create",
      "accounts.edit",
      "accounts.import",
      "accounts.export",
      "segments.view",
      "segments.create",
      "contacts.view",
      "contacts.create",
      "contacts.edit",
      "contacts.archive",
      "contacts.restore",
      "contacts.reassign",
      "contacts.import",
      "contacts.export",
      "contacts.merge",
      "contacts.viewAudit",
      "consent.record",
      "consent.viewEvidence",
      "activities.create",
      "activities.import",
      "messages.send",
      "templates.manage",
      "campaigns.manage",
      "tickets.manage",
      "answers.manage",
      "documents.manage",
      "dashboard.team",
      "reports.view",
      "forecast.view",
    ],
    readScope: "team",
    writeScope: "team",
  },
  crm_user: {
    id: "crm_user",
    label: "CRM User",
    shortLabel: "User",
    description: "Manages their own customers, records interactions and follow-ups.",
    permissions: [
      "sales.view",
      "leads.manage",
      "deals.manage",
      "deals.import",
      "quotes.manage",
      "accounts.view",
      "accounts.create",
      "accounts.edit",
      "accounts.import",
      "accounts.export",
      "segments.view",
      "segments.create",
      "contacts.view",
      "contacts.create",
      "contacts.edit",
      "contacts.archive",
      "contacts.import",
      "contacts.export",
      "contacts.viewAudit",
      "consent.record",
      "activities.create",
      "activities.import",
      "messages.send",
      "tickets.manage",
      "documents.manage",
    ],
    readScope: "own",
    writeScope: "own",
  },
  crm_viewer: {
    id: "crm_viewer",
    label: "CRM Viewer",
    shortLabel: "Viewer",
    description: "Read-only access to permitted records. Cannot create, edit, import, export or merge.",
    permissions: [
      "sales.view",
      "forecast.view",
      "accounts.view",
      "segments.view","contacts.view", "reports.view"],
    readScope: "all",
    writeScope: "none",
  },
  crm_admin: {
    id: "crm_admin",
    label: "CRM Admin",
    shortLabel: "CRM Admin",
    description: "CRM-wide administration and data governance for the organisation.",
    permissions: [
      "sales.view",
      "leads.manage",
      "deals.manage",
      "deals.import",
      "quotes.manage",
      "products.manage",
      "accounts.view",
      "accounts.create",
      "accounts.edit",
      "accounts.import",
      "accounts.export",
      "segments.view",
      "segments.create",
      "segments.manage",
      "contacts.view",
      "contacts.create",
      "contacts.edit",
      "contacts.archive",
      "contacts.restore",
      "contacts.reassign",
      "contacts.import",
      "contacts.export",
      "contacts.merge",
      "contacts.viewAudit",
      "consent.record",
      "consent.viewEvidence",
      "activities.create",
      "activities.import",
      "messages.send",
      "templates.manage",
      "campaigns.manage",
      "tickets.manage",
      "answers.manage",
      "documents.manage",
      "dashboard.team",
      "dashboard.admin",
      "reports.view",
      "forecast.view",
      "settings.view",
    ],
    readScope: "all",
    writeScope: "all",
  },
  suite_admin: {
    id: "suite_admin",
    label: "Suite Administrator",
    shortLabel: "Suite Admin",
    description:
      "Cross-suite administration. Governs CRM data but does not handle day-to-day customer work or consent evidence.",
    permissions: [
      "sales.view",
      "forecast.view",
      "accounts.view",
      "accounts.export",
      "segments.view",
      "segments.manage",
      "contacts.view",
      "contacts.archive",
      "contacts.restore",
      "contacts.reassign",
      "contacts.export",
      "contacts.merge",
      "contacts.viewAudit",
      "dashboard.admin",
      "reports.view",
      "settings.view",
      "suite.admin",
    ],
    readScope: "all",
    writeScope: "all",
  },
};

export const ROLE_ORDER: RoleId[] = ["crm_sales_manager", "crm_user", "crm_viewer", "crm_admin", "suite_admin"];
