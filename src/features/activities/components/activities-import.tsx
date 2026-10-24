"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { useDbStore } from "@/lib/mock-data/db-store";
import { useCurrentUser, usePermission } from "@/features/permissions";
import { ImportWizard, type ImportAdapter } from "@/components/import/import-wizard";
import { InlineNotice } from "@/components/feedback/states";
import { StatusPill } from "@/components/shared/status-pill";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTIVITY_IMPORT_FIELDS, ACTIVITY_TEMPLATE_HEADERS, autoMapActivityColumns, IMPORT_AS_LABELS, planActivityImport, type ActivityImportPlan, type ActivityPlannedRow, type ImportAs } from "../lib/import";
import { runActivityImport } from "../services/activities-service";

function Split({ plan }: { plan: ActivityImportPlan }) {
  if (!plan.logged && !plan.scheduled) return null;
  return (
    <InlineNotice tone="info" icon={CalendarClock}>
      <span className="font-medium">{plan.logged}</span> will be saved as done history and <span className="font-medium">{plan.scheduled}</span> as open to-dos. Rows marked Done, notes, and dates before today count as history; today, later or no date become to-dos.
    </InlineNotice>
  );
}

export function ActivitiesImport() {
  const router = useRouter();
  const allowed = usePermission("activities.import");
  const user = useCurrentUser();
  const db = useDbStore((s) => s.db);
  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]);
  const [importAs, setImportAs] = useState<ImportAs>("each");
  const [now] = useState(() => Date.now());

  const adapter = useMemo<ImportAdapter<ActivityPlannedRow, ActivityImportPlan>>(
    () => ({
      entity: { singular: "activity", plural: "activities" },
      listHref: "/activities",
      description: "Import calls, meetings and tasks. Check the file first; nothing is saved until you confirm.",
      fields: ACTIVITY_IMPORT_FIELDS,
      allowCustom: false,
      autoMap: autoMapActivityColumns,
      plan: (table, mapping, mode) => planActivityImport(table, mapping, db, user, mode, { importAs, now }),
      run: runActivityImport,
      previewColumns: [
        { label: "Type", render: (r) => r.activity?.type ?? r.values.type ?? "—" },
        { label: "When", render: (r) => [r.values.date, r.values.time].filter(Boolean).join(" ") || "No date" },
        { label: "Saved as", render: (r) => (r.state ? <StatusPill tone={r.state === "logged" ? "success" : "info"}>{r.state === "logged" ? "Done (history)" : "To do"}</StatusPill> : "—") },
        { label: "Contact", render: (r) => r.contactName ?? "—" },
      ],
      matchCopy: {
        legend: "When a row matches an existing activity (same type, subject, contact and date)",
        skip: "Keep the existing activity unchanged.",
        update: "Update its notes, owner, time and priority.",
        reviewNote: "Contacts are matched by email, then phone. Rows for people who aren't in the CRM are not imported — add the contact first.",
      },
      template: {
        fileName: "activities-import-template.csv",
        headers: ACTIVITY_TEMPLATE_HEADERS,
        example: [
          ["call", "Follow-up on quotation", "2026-10-20", "10:30", "yes", "12", "Answered", "We contacted them", "", "abigail.owusuansah@coastalpharmacy.example", "", "", "Asked for revised delivery dates"],
          ["task", "Send updated price list", "2026-11-03", "09:00", "no", "", "", "", "High", "", "", "", ""],
        ],
      },
      sampleUrl: "/samples/activities-sample.csv",
      reviewExtras: (plan) => (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="import-as">Import as</Label>
            <Select value={importAs} onValueChange={(v) => setImportAs(v as ImportAs)}>
              <SelectTrigger id="import-as">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(IMPORT_AS_LABELS) as ImportAs[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {IMPORT_AS_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Split plan={plan} />
        </div>
      ),
      confirmExtras: (plan) => <Split plan={plan} />,
      history: db.importJobs.filter((j) => j.orgId === user.orgId && j.entityType === "activity").slice(0, 6),
      users,
      resultsAction: { label: "Go to Tasks & calls", onClick: () => router.push("/activities") },
      allowed,
    }),
    [db, user, users, allowed, router, importAs, now],
  );
  return <ImportWizard adapter={adapter} />;
}
