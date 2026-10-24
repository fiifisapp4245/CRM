"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { GitBranch } from "lucide-react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useCurrentUser, usePermission } from "@/features/permissions";
import { ImportWizard, type ImportAdapter } from "@/components/import/import-wizard";
import { InlineNotice } from "@/components/feedback/states";
import { useAccountsUi } from "../hooks/use-accounts";
import { ACCOUNT_IMPORT_FIELDS, ACCOUNT_TEMPLATE_HEADERS, autoMapAccountColumns, planAccountImport, type AccountImportPlan, type AccountPlannedRow } from "../lib/import";
import { runAccountImport } from "../services/accounts-service";

function ParentsNotice({ plan }: { plan: AccountImportPlan }) {
  if (!plan.parentsToCreate.length) return null;
  return (
    <InlineNotice tone="info" icon={GitBranch}>
      <p className="font-medium">
        {plan.parentsToCreate.length} parent {plan.parentsToCreate.length === 1 ? "account" : "accounts"} will be created
      </p>
      <p>Branches in this file refer to head offices that don&apos;t exist yet. These will be added with only a name, so you can complete them later:</p>
      <ul className="mt-1 list-disc pl-5">
        {plan.parentsToCreate.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </InlineNotice>
  );
}

export function AccountsImport() {
  const router = useRouter();
  const allowed = usePermission("accounts.import");
  const user = useCurrentUser();
  const db = useDbStore((s) => s.db);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]);
  const setFilters = useAccountsUi((s) => s.setFilters);

  const adapter = useMemo<ImportAdapter<AccountPlannedRow, AccountImportPlan>>(
    () => ({
      entity: { singular: "account", plural: "accounts" },
      listHref: "/accounts",
      description: "Bring in organisations, head offices and branches from a spreadsheet. Nothing changes until you confirm.",
      fields: ACCOUNT_IMPORT_FIELDS,
      allowCustom: false,
      autoMap: autoMapAccountColumns,
      plan: (table, mapping, mode) => planAccountImport(table, mapping, db, user, mode),
      run: runAccountImport,
      previewColumns: [
        { label: "Number", render: (r) => r.values.accountNumber },
        { label: "Parent", render: (r) => (r.parent ? `${r.parent.name}${r.parent.kind === "create" ? " (new)" : ""}` : r.values.parent) },
      ],
      matchCopy: {
        legend: "When a row matches an existing account (by account number, otherwise by name)",
        skip: "Keep the existing account unchanged.",
        update: "Update it with the file's values. Empty cells never erase details already in the CRM.",
        reviewNote: "Account number is matched first, then name. Names shared by several accounts are flagged, never guessed.",
      },
      template: {
        fileName: "accounts-import-template.csv",
        headers: ACCOUNT_TEMPLATE_HEADERS,
        example: [
          ["Kasoa Building Supplies", "ACC-2001", "Customer", "", "Warm", "", "030 255 0900", "info@kasoabuild.example", "kasoabuild.example", "Retail", "45", "Small", "4200000", "Kasoa", "Central", "Ghana", "Wholesale", ""],
          ["Kasoa Building Supplies – Winneba", "ACC-2002", "Customer", "ACC-2001", "", "", "", "", "", "Retail", "8", "Micro", "", "Winneba", "Central", "Ghana", "", "Branch"],
        ],
      },
      sampleUrl: "/samples/accounts-sample.csv",
      reviewExtras: (plan) => <ParentsNotice plan={plan} />,
      confirmExtras: (plan) => <ParentsNotice plan={plan} />,
      history: db.importJobs.filter((j) => j.orgId === user.orgId && j.entityType === "account").slice(0, 6),
      users,
      resultsAction: {
        label: "View newest accounts",
        onClick: () => {
          setFilters({ sort: "newest" });
          router.push("/accounts");
        },
      },
      allowed,
    }),
    [db, user, users, allowed, router, setFilters],
  );
  return <ImportWizard adapter={adapter} />;
}
