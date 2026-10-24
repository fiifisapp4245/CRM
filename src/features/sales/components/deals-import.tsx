"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useCurrentUser, usePermission } from "@/features/permissions";
import { ImportWizard, type ImportAdapter } from "@/components/import/import-wizard";
import { InlineNotice } from "@/components/feedback/states";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { autoMapDealColumns, DEAL_IMPORT_FIELDS, DEAL_TEMPLATE_HEADERS, planDealImport, type DealImportPlan, type DealPlannedRow } from "../lib/deal-import";
import { runDealImport } from "../services/deals-service";

function RelatedList({ plan }: { plan: DealImportPlan }) {
  const n = plan.newContacts.length + plan.newAccounts.length;
  if (!n) return null;
  return (
    <InlineNotice tone="info" icon={UserPlus}>
      <p className="font-medium">This import will also create {[plan.newContacts.length && `${plan.newContacts.length} contact${plan.newContacts.length === 1 ? "" : "s"}`, plan.newAccounts.length && `${plan.newAccounts.length} compan${plan.newAccounts.length === 1 ? "y" : "ies"}`].filter(Boolean).join(" and ")}</p>
      <p>They weren&apos;t found in the CRM. Check the names — you can complete their details afterwards.</p>
      <ul className="mt-1 list-disc pl-5">
        {plan.newContacts.map((c) => (
          <li key={`c${c.key}`}>
            Contact: {c.name}
            {c.detail && <span className="text-xs"> ({c.detail})</span>}
          </li>
        ))}
        {plan.newAccounts.map((a) => (
          <li key={`a${a.key}`}>Company: {a.name}</li>
        ))}
      </ul>
    </InlineNotice>
  );
}

export function DealsImport() {
  const router = useRouter();
  const allowed = usePermission("deals.import");
  const user = useCurrentUser();
  const db = useDbStore((s) => s.db);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]);
  const [createMissing, setCreateMissing] = useState(false);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  const adapter = useMemo<ImportAdapter<DealPlannedRow, DealImportPlan>>(
    () => ({
      entity: { singular: "deal", plural: "deals" },
      listHref: "/deals",
      description: "Bring in open, won and lost deals from a spreadsheet. Customers are matched to existing contacts and companies; nothing changes until you confirm.",
      fields: DEAL_IMPORT_FIELDS,
      allowCustom: false,
      autoMap: autoMapDealColumns,
      plan: (table, mapping, mode) => planDealImport(table, mapping, db, user, mode, { createMissing, today }),
      run: runDealImport,
      previewColumns: [
        { label: "Value", render: (r) => (r.values.amount ? `${r.values.currency?.toUpperCase() ?? "GHS"} ${r.values.amount}` : "—") },
        { label: "Stage", render: (r) => r.values.stage ?? "—" },
        { label: "Customer", render: (r) => [r.contact && `${r.contact.name}${r.contact.kind === "new" ? " (new)" : ""}`, r.account && `${r.account.name}${r.account.kind === "new" ? " (new)" : ""}`].filter(Boolean).join(" · ") || "—" },
      ],
      matchCopy: {
        legend: "When a row matches an existing deal (same name and customer)",
        skip: "Keep the existing deal unchanged.",
        update: "Update its value, stage, close date, chance and notes. Won and lost deals are never changed by import.",
        reviewNote: "Contacts are matched by email, then phone; companies by exact name. Several matches are flagged, never guessed.",
      },
      template: {
        fileName: "deals-import-template.csv",
        headers: DEAL_TEMPLATE_HEADERS,
        example: [
          ["Clinic waiting-room seating", "38000", "GHS", "Proposal sent", "2026-12-15", "", "", "", "", "Mercy Boateng", "mercy@ridgeclinic.example", "024 555 0199", "Ridge Family Clinic", "Wants delivery before Christmas"],
          ["Bank branch counters", "12500", "GHS", "Lost", "", "2026-09-30", "Chose a competitor", "", "", "", "", "", "", ""],
        ],
      },
      sampleUrl: "/samples/deals-sample.csv",
      reviewExtras: (plan) => (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-xl border border-border p-4">
            <Checkbox id="create-missing" checked={createMissing} onCheckedChange={(c) => setCreateMissing(c === true)} />
            <Label htmlFor="create-missing" className="grid gap-0.5 leading-snug font-normal">
              <span className="font-medium">Create missing contacts and companies</span>
              <span className="text-muted-foreground">Off: rows whose customer isn&apos;t in the CRM are not imported. On: they&apos;re created and listed below before you confirm.</span>
            </Label>
          </div>
          <RelatedList plan={plan} />
        </div>
      ),
      confirmExtras: (plan) => <RelatedList plan={plan} />,
      history: db.importJobs.filter((j) => j.orgId === user.orgId && j.entityType === "deal").slice(0, 6),
      users,
      resultsAction: { label: "View deals", onClick: () => router.push("/deals?status=all") },
      allowed,
    }),
    [db, user, users, allowed, router, createMissing, today],
  );
  return <ImportWizard adapter={adapter} />;
}
