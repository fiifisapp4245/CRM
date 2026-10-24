import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  FileText,
  Filter,
  FolderOpen,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MessageSquare,
  Package,
  Settings,
  BookOpen,
  TrendingUp,
  UserPlus,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";
import type { Feature } from "@/lib/entitlements";

export type ModuleStatus = "ready" | "foundation" | "pending";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hide from navigation for roles without this permission (services still enforce access). */
  permission?: Permission;
  status: ModuleStatus;
  description: string;
  /** Plan-gated module: shows its plan badge when the organisation lacks it. */
  feature?: Feature;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Navigation inventory taken from the existing CRM. Grouping is provisional
 * and will be revisited as each module is audited.
 * NOTE: "Activities" (/activity) and "Tasks & Calls" (/activities) are both
 * kept as in the existing CRM until their workflows are audited.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, status: "foundation", description: "Role-based starting point." },
      { label: "Activity feed", href: "/activity", icon: Activity, status: "ready", description: "What changed across the CRM." },
    ],
  },
  {
    label: "Customers",
    items: [
      { label: "Contacts", href: "/contacts", icon: Users, permission: "contacts.view", status: "ready", description: "People you have a relationship with." },
      { label: "Accounts", href: "/accounts", icon: Building2, permission: "accounts.view", status: "ready", description: "Organisations you sell to, buy from or work with." },
      { label: "Segments", href: "/segments", icon: Filter, permission: "segments.view", status: "ready", description: "Dynamic groups of contacts." },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Leads", href: "/leads", icon: UserPlus, permission: "sales.view", status: "ready", description: "Prospects to qualify and convert." },
      { label: "Pipeline", href: "/pipeline", icon: Workflow, permission: "sales.view", status: "ready", description: "Open deals by stage." },
      { label: "Deals", href: "/deals", icon: Handshake, permission: "sales.view", status: "ready", description: "Every opportunity, open and closed." },
      { label: "Quotes", href: "/quotes", icon: FileText, permission: "sales.view", status: "ready", description: "Priced offers sent from deals." },
      { label: "Products", href: "/products", icon: Package, permission: "sales.view", status: "ready", description: "Products and services you sell." },
      { label: "Forecast", href: "/forecast", icon: TrendingUp, permission: "forecast.view", status: "ready", description: "What you've won and what might close." },
    ],
  },
  {
    label: "Engagement",
    items: [
      { label: "Tasks & Calls", href: "/activities", icon: ListChecks, status: "ready", description: "Follow-ups and call lists." },
      { label: "Calendar", href: "/calendar", icon: CalendarDays, status: "ready", description: "Meetings and scheduled work." },
      { label: "Messaging", href: "/messaging", icon: MessageSquare, status: "ready", feature: "messaging", description: "SMS, WhatsApp and email sent from the CRM." },
      { label: "Campaigns", href: "/campaigns", icon: Megaphone, status: "ready", feature: "campaigns", description: "One message to a whole segment." },
    ],
  },
  {
    label: "Service",
    items: [{ label: "Tickets", href: "/tickets", icon: LifeBuoy, status: "ready", feature: "tickets", description: "Customer issues and requests." }],
  },
  {
    label: "Files",
    items: [{ label: "Documents", href: "/documents", icon: FolderOpen, status: "ready", description: "Files and folders, linked to customers." }],
  },
  {
    label: "Insights",
    items: [{ label: "Reports", href: "/reports", icon: BarChart3, permission: "reports.view", status: "pending", description: "Reporting and analysis." }],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings, permission: "settings.view", status: "pending", description: "CRM configuration." },
      { label: "Guide", href: "/guide", icon: BookOpen, status: "ready", description: "Help and how-to guides." },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
}
