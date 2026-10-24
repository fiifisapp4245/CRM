import { toCsv } from "@/lib/utils/csv";
import type { Db } from "@/lib/mock-data/db-types";
import { SOURCE_LABELS, STATUS_LABELS, type Contact } from "../types";

export const EXPORT_HEADERS = [
  "Display name", "Title", "First name", "Middle name", "Last name",
  "Primary email", "Other emails", "Primary phone", "Other phones", "WhatsApp",
  "Account", "Job title", "Owner", "Owner email", "Source", "Status", "Tags",
  "Address", "City / town", "Region", "Country", "Created", "Last updated", "Last activity",
];

/** CSV of the given (already permission-filtered) contacts. Notes and date of birth are deliberately excluded. */
export function contactsToCsv(contacts: Contact[], db: Pick<Db, "users" | "accounts">): string {
  const users = new Map(db.users.map((u) => [u.id, u]));
  const accounts = new Map(db.accounts.map((a) => [a.id, a.name]));
  const rows = contacts.map((c) => {
    const of = (kind: string) => c.methods.filter((m) => m.kind === kind);
    const primary = (kind: string) => of(kind).find((m) => m.isPrimary) ?? of(kind)[0];
    const others = (kind: string) => of(kind).filter((m) => m !== primary(kind)).map((m) => m.value).join("; ");
    const owner = c.ownerId ? users.get(c.ownerId) : undefined;
    return [
      c.displayName, c.title, c.firstName, c.middleName, c.lastName,
      primary("email")?.value, others("email"), primary("phone")?.value, others("phone"), of("whatsapp").map((m) => m.value).join("; "),
      c.accountId ? accounts.get(c.accountId) : "", c.jobTitle, owner?.name ?? "Unassigned", owner?.email ?? "", SOURCE_LABELS[c.source], STATUS_LABELS[c.status], c.tags.join("; "),
      c.address, c.city, c.region, c.country, c.createdAt.slice(0, 10), c.updatedAt.slice(0, 10), c.lastActivityAt?.slice(0, 10) ?? "",
    ];
  });
  return toCsv(EXPORT_HEADERS, rows);
}
