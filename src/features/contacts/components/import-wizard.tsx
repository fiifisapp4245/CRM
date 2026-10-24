"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser, usePermission } from "@/features/permissions";
import { ImportWizard, type ImportAdapter } from "@/components/import/import-wizard";
import { useDb, useUserLookup } from "../hooks/use-contacts";
import { useContactsUi } from "../hooks/use-contacts-ui";
import { builtInViews } from "../lib/filters";
import { autoMapColumns, IMPORT_FIELDS, planImport, TEMPLATE_HEADERS, type ColumnTarget, type ImportPlan, type PlannedRow } from "../lib/import";
import { runImport } from "../services/contacts-service";

/** Contacts plug their field map, matching rules and applier into the shared import wizard. */
export function ContactsImport() {
  const router = useRouter();
  const allowed = usePermission("contacts.import");
  const user = useCurrentUser();
  const db = useDb();
  const users = useUserLookup();
  const setView = useContactsUi((s) => s.setView);

  const adapter = useMemo<ImportAdapter<PlannedRow, ImportPlan>>(
    () => ({
      entity: { singular: "contact", plural: "contacts" },
      listHref: "/contacts",
      description: "Bring in contacts from a spreadsheet. Nothing changes until you confirm on the last step.",
      fields: IMPORT_FIELDS,
      allowCustom: true,
      autoMap: autoMapColumns,
      plan: (table, mapping, mode) => planImport(table, mapping as ColumnTarget[], db, user, mode),
      run: runImport,
      previewColumns: [
        { label: "Email", render: (r) => r.values.email },
        { label: "Phone", render: (r) => r.values.phone },
      ],
      matchCopy: {
        legend: "When a row matches an existing contact by email or phone",
        skip: "Keep the existing contact unchanged.",
        update: "Fill in new details and add new numbers or emails. Existing values are not deleted.",
        reviewNote: "Matching uses normalised email and phone numbers within your organisation only.",
      },
      template: {
        fileName: "contacts-import-template.csv",
        headers: TEMPLATE_HEADERS,
        example: [["Mrs", "Akua", "", "Mensah", "akua.mensah@company.example", "024 123 4567", "024 123 4567", "Osu Bakery Co.", "Operations Manager", "", "Female", "1988-04-21", "12 Oxford Street", "Accra", "Greater Accra", "Ghana", "Wholesale; VIP", "Met at trade fair"]],
      },
      sampleUrl: "/samples/contacts-sample.csv",
      history: db.importJobs.filter((j) => j.orgId === user.orgId && (j.entityType ?? "contact") === "contact").slice(0, 6),
      users,
      resultsAction: {
        label: "View recently added",
        onClick: () => {
          const recent = builtInViews(user).find((v) => v.builtIn === "recent")!;
          setView(recent.id, recent.filters);
          router.push("/contacts");
        },
      },
      allowed,
    }),
    [db, user, users, allowed, router, setView],
  );

  return <ImportWizard adapter={adapter} />;
}
