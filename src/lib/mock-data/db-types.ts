import type { Organization, User } from "@/lib/types";
import type { BusinessSettings } from "@/lib/business/settings";
import type { Campaign, Communication, MessageTemplate } from "@/features/messaging/types";
import type { SavedAnswer, Ticket } from "@/features/tickets/types";
import type { DocumentFile, Folder } from "@/features/documents/types";
import type { Deal, Lead, Pipeline, Product, Quote, SalesTarget, Tax } from "@/features/sales/types";
import type { Account } from "@/features/accounts/types";
import type { Segment } from "@/features/segments/types";
import type { Activity } from "@/features/activities/types";
import type { AuditEvent, ConsentRecord, Contact, ImportJob, SavedView } from "@/features/contacts/types";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  href?: string;
  at: string;
  read: boolean;
}

/** Shape of the local prototype "database" persisted in localStorage. */
export interface Db {
  version: number;
  seededAt: string;
  orgs: Organization[];
  users: User[];
  accounts: Account[];
  segments: Segment[];
  contacts: Contact[];
  activities: Activity[];
  consents: ConsentRecord[];
  audit: AuditEvent[];
  deals: Deal[];
  leads: Lead[];
  pipelines: Pipeline[];
  taxes: Tax[];
  products: Product[];
  quotes: Quote[];
  targets: SalesTarget[];
  communications: Communication[];
  templates: MessageTemplate[];
  campaigns: Campaign[];
  tickets: Ticket[];
  savedAnswers: SavedAnswer[];
  folders: Folder[];
  documents: DocumentFile[];
  settings: BusinessSettings;
  importJobs: ImportJob[];
  savedViews: SavedView[];
  /** Pair keys ("idA|idB", sorted) marked as "not duplicates". */
  dismissedDuplicatePairs: string[];
  notifications: AppNotification[];
}

export const DB_VERSION = 7;
