"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Download, FileSpreadsheet, FileUp, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { downloadFile, toCsv } from "@/lib/utils/csv";
import { formatBytes, formatDateTime } from "@/lib/utils/format";
import { readImportFile, validateFileMeta, type ImportFieldDef, type ImportPlanBase, type ImportRowBase, type RowOutcome } from "@/lib/import";
import type { Result, User } from "@/lib/types";
import type { DuplicateMode, ImportJob } from "@/features/contacts/types";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page-header";
import { InlineNotice, PermissionNotice } from "@/components/feedback/states";
import { StatusPill, type PillTone } from "@/components/shared/status-pill";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ImportAdapter<R extends ImportRowBase, P extends ImportPlanBase<R>> {
  /** "contact" / "contacts" */
  entity: { singular: string; plural: string };
  listHref: string;
  description: string;
  fields: readonly ImportFieldDef[];
  /** Whether unrecognised columns can be kept as custom fields. */
  allowCustom: boolean;
  autoMap: (headers: string[]) => string[];
  plan: (table: string[][], mapping: string[], mode: DuplicateMode) => P;
  run: (plan: P, file: { name: string; size: number }, mode: DuplicateMode) => Promise<Result<ImportJob>>;
  previewColumns: { label: string; render: (row: R) => ReactNode }[];
  matchCopy: { legend: string; skip: string; update: string; reviewNote: string };
  template: { fileName: string; headers: string[]; example: string[][] };
  sampleUrl?: string;
  /** Extra review content, e.g. parent accounts that will be created. */
  reviewExtras?: (plan: P) => ReactNode;
  confirmExtras?: (plan: P) => ReactNode;
  history: ImportJob[];
  users: Map<string, User>;
  resultsAction: { label: string; onClick: () => void };
  allowed: boolean;
}

type Step = "upload" | "review" | "confirm" | "results";
const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "review", label: "Review" },
  { key: "confirm", label: "Confirm" },
  { key: "results", label: "Results" },
];
const OUTCOME_LABEL: Record<RowOutcome, string> = { create: "New", update: "Update", skip: "Skip", error: "Error" };
const OUTCOME_TONE: Record<RowOutcome, PillTone> = { create: "success", update: "info", skip: "neutral", error: "danger" };

function Stepper({ step }: { step: Step }) {
  const idx = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Import progress">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2" aria-current={i === idx ? "step" : undefined}>
          {i > 0 && <span className="h-px w-6 bg-border-strong sm:w-10" aria-hidden />}
          <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", i < idx ? "bg-brand-700 text-white" : i === idx ? "bg-brand-50 text-brand-800 ring-2 ring-brand-700" : "bg-secondary text-muted-foreground")}>
            {i < idx ? <CheckCircle2 className="size-3.5" /> : i + 1}
          </span>
          <span className={cn("hidden sm:inline", i === idx ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Shared, guided import: Upload → Review (mapping, row outcomes) → Confirm →
 * Results. Nothing is written until the user confirms, and results report
 * exactly what the module's `run` persisted.
 */
export function ImportWizard<R extends ImportRowBase, P extends ImportPlanBase<R>>({ adapter }: { adapter: ImportAdapter<R, P> }) {
  const a = adapter;
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mode, setMode] = useState<DuplicateMode>("skip");
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rowFilter, setRowFilter] = useState<"all" | RowOutcome>("all");
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [frozenPlan, setFrozenPlan] = useState<P | null>(null);

  const livePlan = useMemo(() => (table ? a.plan(table, mapping, mode) : null), [a, table, mapping, mode]);
  // After import the store changes; keep the reviewed plan for the results screen.
  const plan = frozenPlan ?? livePlan;

  if (!a.allowed)
    return (
      <PageContainer>
        <PermissionNotice title={`Your role can't import ${a.entity.plural}`} action={<Button asChild variant="outline"><Link href={a.listHref}>Back</Link></Button>} />
      </PageContainer>
    );

  const pickFile = (f: File | undefined | null) => {
    setFileError(null);
    setTable(null);
    if (!f) return setFile(null);
    const err = validateFileMeta(f);
    if (err) {
      setFile(null);
      setFileError(err);
      return;
    }
    setFile(f);
  };

  const useSample = async () => {
    if (!a.sampleUrl) return;
    try {
      const res = await fetch(a.sampleUrl);
      const blob = await res.blob();
      pickFile(new File([blob], a.sampleUrl.split("/").pop() ?? "sample.csv", { type: "text/csv" }));
    } catch {
      setFileError("Couldn't load the sample file.");
    }
  };

  const parse = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const rows = await readImportFile(file);
      if (!rows.length) throw new Error("This file doesn't contain any rows.");
      const headers = rows[0].map((h) => h.trim());
      if (headers.every((h) => !h)) throw new Error("The first row must contain column names.");
      setTable([headers, ...rows.slice(1)]);
      setMapping(a.autoMap(headers));
      setRowFilter("all");
      setStep("review");
    } catch (e) {
      setFileError(e instanceof Error ? `We couldn't read this file. ${e.message}` : "We couldn't read this file.");
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    if (!livePlan || !file) return;
    setImporting(true);
    setFrozenPlan(livePlan);
    const res = await a.run(livePlan, { name: file.name, size: file.size }, mode);
    setImporting(false);
    if (!res.ok) {
      setFrozenPlan(null);
      return toast.error(res.error);
    }
    setJob(res.data);
    setStep("results");
    toast.success("Import finished", { description: `${res.data.created} created, ${res.data.updated} updated.` });
  };

  const restart = () => {
    setStep("upload");
    setFile(null);
    setTable(null);
    setJob(null);
    setFrozenPlan(null);
    setConfirmed(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const actionable = plan ? plan.counts.create + plan.counts.update : 0;
  const usedTargets = mapping.filter((m) => m !== "custom" && m !== "ignore");

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: a.entity.plural.charAt(0).toUpperCase() + a.entity.plural.slice(1), href: a.listHref }, { label: "Import" }]} />}
        title={`Import ${a.entity.plural}`}
        description={a.description}
        actions={<Stepper step={step} />}
      />

      {step === "upload" && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={cn("flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors", dragging ? "border-brand-600 bg-brand-50" : "border-border-strong")}
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <FileUp className="size-5" />
              </span>
              <div>
                <p className="font-medium">Drag a file here, or choose one</p>
                <p className="text-sm text-muted-foreground">.csv or .xlsx · up to 10 MB · up to 10,000 rows</p>
              </div>
              <input ref={inputRef} id="import-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline">
                  <label htmlFor="import-file" className="cursor-pointer">
                    <Upload /> Choose file
                  </label>
                </Button>
                {a.sampleUrl && (
                  <Button variant="ghost" onClick={useSample}>
                    Use sample file
                  </Button>
                )}
              </div>
            </div>

            {fileError && <InlineNotice tone="danger" icon={AlertCircle}>{fileError}</InlineNotice>}

            {file && (
              <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3" aria-live="polite">
                <FileSpreadsheet className="size-5 text-brand-700" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)} · ready to check</p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Remove file" onClick={() => pickFile(null)}>
                  <X />
                </Button>
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{a.matchCopy.legend}</legend>
              {(
                [
                  ["skip", "Skip it", a.matchCopy.skip],
                  ["update", "Update it", a.matchCopy.update],
                ] as const
              ).map(([value, label, hint]) => (
                <label key={value} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 has-focus-visible:ring-2 has-focus-visible:ring-ring", mode === value ? "border-brand-700 bg-brand-50/60" : "border-border hover:bg-secondary/60")}>
                  <input type="radio" name="dup-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-[var(--brand-700)]" />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-sm text-muted-foreground">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="flex justify-end">
              <Button onClick={parse} disabled={!file || parsing}>
                {parsing && <Loader2 className="animate-spin" />} Check file <ArrowRight />
              </Button>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[0.9375rem] font-semibold">Need a starting point?</h2>
              <p className="mt-1 text-sm text-muted-foreground">The template lists every standard column{a.allowCustom ? ". Extra columns can be kept as custom fields." : "."}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => downloadFile(a.template.fileName, toCsv(a.template.headers, a.template.example))}>
                <Download /> Download template
              </Button>
            </section>
            <ImportHistory history={a.history} users={a.users} />
          </aside>
        </div>
      )}

      {step === "review" && plan && table && (
        <div className="flex flex-col gap-6">
          {plan.fatal && <InlineNotice tone="danger" icon={AlertCircle}>{plan.fatal}</InlineNotice>}

          <section className="rounded-2xl border border-border bg-card">
            <div className="px-6 pt-5 pb-3">
              <h2 className="text-[0.9375rem] font-semibold">Match your columns</h2>
              <p className="text-sm text-muted-foreground">We matched what we recognised. {a.allowCustom ? "Unrecognised columns are kept as custom fields unless you choose otherwise." : "Unrecognised columns are ignored."}</p>
            </div>
            <div className="overflow-x-auto border-t border-border/70">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/70">
                    <th scope="col" className="px-6 py-2.5 text-left font-medium">Column in your file</th>
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">Example value</th>
                    <th scope="col" className="px-6 py-2.5 text-left font-medium">Import as</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {table[0].map((h, i) => (
                    <tr key={i}>
                      <td className="px-6 py-2 font-medium">{h || <span className="text-muted-foreground italic">(no name)</span>}</td>
                      <td className="max-w-56 truncate px-3 py-2 text-muted-foreground">{table.slice(1).find((r) => r[i]?.trim())?.[i] ?? "—"}</td>
                      <td className="px-6 py-2">
                        <Select value={mapping[i]} onValueChange={(v) => setMapping((m) => m.map((x, j) => (j === i ? v : x)))}>
                          <SelectTrigger className="w-64" aria-label={`Import ${h} as`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore">Don&apos;t import</SelectItem>
                            {a.allowCustom && <SelectItem value="custom">Custom field “{h}”</SelectItem>}
                            {a.fields.map((f) => (
                              <SelectItem key={f.key} value={f.key} disabled={usedTargets.includes(f.key) && mapping[i] !== f.key}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {!plan.fatal && a.reviewExtras?.(plan)}

          {!plan.fatal && (
            <section className="rounded-2xl border border-border bg-card">
              <div className="flex flex-col gap-3 px-6 pt-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[0.9375rem] font-semibold">Check the rows</h2>
                  <p className="text-sm text-muted-foreground">
                    {plan.rows.length.toLocaleString()} rows found. {a.matchCopy.reviewNote}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  Matches:
                  <Select value={mode} onValueChange={(v) => setMode(v as DuplicateMode)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="px-6 pb-4">
                <Segmented
                  label="Filter rows"
                  value={rowFilter}
                  onChange={setRowFilter}
                  options={(["all", "create", "update", "skip", "error"] as const).map((k) => ({
                    value: k,
                    label: k === "all" ? "All" : k === "create" ? "To create" : k === "update" ? "To update" : k === "skip" ? "Skipped" : "Errors",
                    count: k === "all" ? plan.rows.length : plan.counts[k],
                  }))}
                />
              </div>
              <div className="max-h-[28rem] overflow-auto border-t border-border/70">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                    <tr className="border-b border-border/70">
                      <th scope="col" className="px-6 py-2.5 text-left font-medium">Row</th>
                      <th scope="col" className="px-3 py-2.5 text-left font-medium">Name</th>
                      {a.previewColumns.map((c) => (
                        <th key={c.label} scope="col" className="px-3 py-2.5 text-left font-medium">
                          {c.label}
                        </th>
                      ))}
                      <th scope="col" className="px-3 py-2.5 text-left font-medium">Result</th>
                      <th scope="col" className="px-6 py-2.5 text-left font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {plan.rows
                      .filter((r) => rowFilter === "all" || r.outcome === rowFilter)
                      .slice(0, 500)
                      .map((r) => (
                        <tr key={r.rowNumber} className={cn("align-top", r.outcome === "error" && "bg-danger-soft/50")}>
                          <td className="px-6 py-2 text-muted-foreground tabular-nums">{r.rowNumber}</td>
                          <td className="px-3 py-2 font-medium">{r.displayName || <span className="text-muted-foreground italic">Missing</span>}</td>
                          {a.previewColumns.map((c) => (
                            <td key={c.label} className="max-w-48 truncate px-3 py-2">
                              {c.render(r) || "—"}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <StatusPill tone={OUTCOME_TONE[r.outcome]}>{OUTCOME_LABEL[r.outcome]}</StatusPill>
                          </td>
                          <td className="px-6 py-2">
                            {r.issues.length ? (
                              <ul className="space-y-0.5">
                                {r.issues.map((i, n) => (
                                  <li key={n} className={i.severity === "error" ? "text-destructive" : "text-muted-foreground"}>
                                    {i.message}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-muted-foreground">Ready</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep("upload")}>
              <ArrowLeft /> Back
            </Button>
            <Button onClick={() => (setConfirmed(false), setStep("confirm"))} disabled={!!plan.fatal || actionable === 0}>
              Continue <ArrowRight />
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && plan && (
        <section className="mx-auto flex w-full max-w-xl flex-col gap-5 rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="text-lg font-semibold">Ready to import</h2>
            <p className="text-sm text-muted-foreground">From {file?.name}. Nothing has changed yet.</p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {(
              [
                [`New ${a.entity.plural}`, plan.counts.create, "text-success"],
                [`${a.entity.plural.charAt(0).toUpperCase() + a.entity.plural.slice(1)} updated`, plan.counts.update, "text-info"],
                ["Rows skipped", plan.counts.skip, "text-foreground"],
                ["Rows with errors", plan.counts.error, "text-destructive"],
              ] as const
            ).map(([label, n, cls]) => (
              <div key={label} className="bg-card p-4">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className={cn("text-2xl font-semibold tabular-nums", cls)}>{n.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          {a.confirmExtras?.(plan)}
          {plan.counts.error > 0 && <InlineNotice tone="warning">Rows with errors won&apos;t be imported. You can download them afterwards, fix them and import again.</InlineNotice>}
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} className="mt-0.5" />
            <span>
              I&apos;ve reviewed the rows. Create {plan.counts.create} and update {plan.counts.update} {a.entity.plural}.
            </span>
          </label>
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep("review")} disabled={importing}>
              <ArrowLeft /> Back
            </Button>
            <Button onClick={doImport} disabled={!confirmed || importing}>
              {importing && <Loader2 className="animate-spin" />} Import {actionable.toLocaleString()} {actionable === 1 ? a.entity.singular : a.entity.plural}
            </Button>
          </div>
        </section>
      )}

      {step === "results" && job && (
        <section className="mx-auto flex w-full max-w-xl flex-col gap-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-6 text-success" />
            <div>
              <h2 className="text-lg font-semibold">Import complete</h2>
              <p className="text-sm text-muted-foreground">
                {job.fileName} · {formatDateTime(job.startedAt)}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
            {(
              [
                ["Created", job.created],
                ["Updated", job.updated],
                ["Skipped", job.skipped],
                ["Failed", job.failed],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="bg-card p-4">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
          {job.relatedCreated && job.relatedCreated.contacts + job.relatedCreated.accounts > 0 && (
            <p className="text-sm text-muted-foreground">
              Also created {[job.relatedCreated.contacts && `${job.relatedCreated.contacts} contact${job.relatedCreated.contacts === 1 ? "" : "s"}`, job.relatedCreated.accounts && `${job.relatedCreated.accounts} compan${job.relatedCreated.accounts === 1 ? "y" : "ies"}`].filter(Boolean).join(" and ")}, as listed in the review.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={a.resultsAction.onClick}>{a.resultsAction.label}</Button>
            {job.errorReportCsv && (
              <Button variant="outline" onClick={() => downloadFile(`import-problems-${job.id}.csv`, job.errorReportCsv!)}>
                <Download /> Download problem rows
              </Button>
            )}
            <Button variant="ghost" onClick={restart}>
              <RefreshCw /> Import another file
            </Button>
          </div>
          <ImportHistory history={a.history} users={a.users} />
        </section>
      )}
    </PageContainer>
  );
}

function ImportHistory({ history, users }: { history: ImportJob[]; users: Map<string, { name: string }> }) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <h2 className="px-5 pt-4 pb-2 text-[0.9375rem] font-semibold">Recent imports</h2>
      {history.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-muted-foreground">No imports yet.</p>
      ) : (
        <ul className="divide-y divide-border/70">
          {history.map((j) => (
            <li key={j.id} className="px-5 py-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-medium">{j.fileName}</p>
                {j.errorReportCsv && (
                  <Button variant="ghost" size="icon-xs" aria-label={`Download problem rows for ${j.fileName}`} onClick={() => downloadFile(`import-problems-${j.id}.csv`, j.errorReportCsv!)}>
                    <Download />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(j.startedAt)} · {users.get(j.actorId)?.name ?? "Unknown"}
              </p>
              <p className="text-xs text-muted-foreground">
                {j.created} created · {j.updated} updated · {j.skipped} skipped · {j.failed} failed
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
