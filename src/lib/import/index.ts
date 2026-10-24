/**
 * Module-agnostic import building blocks. Each module (Contacts, Accounts, …)
 * supplies its own field list, planner and applier; the wizard UI in
 * components/import/import-wizard.tsx is shared.
 */
export const IMPORT_LIMITS = { maxBytes: 10 * 1024 * 1024, maxRows: 10_000, extensions: [".csv", ".xlsx"] } as const;

export type RowOutcome = "create" | "update" | "skip" | "error";

export interface RowIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportRowBase {
  rowNumber: number; // 1-based; header = row 1
  raw: string[];
  outcome: RowOutcome;
  issues: RowIssue[];
  displayName: string;
}

export interface ImportPlanBase<R extends ImportRowBase = ImportRowBase> {
  headers: string[];
  mapping: string[];
  rows: R[];
  counts: Record<RowOutcome, number>;
  fatal?: string;
}

export interface ImportFieldDef {
  key: string;
  label: string;
  aliases: readonly string[];
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Map headers to fields by alias; unrecognised headers become "custom" (or "ignore" when blank). */
export function autoMapByAliases(headers: string[], fields: readonly ImportFieldDef[], unknown: "custom" | "ignore" = "custom"): string[] {
  const used = new Set<string>();
  return headers.map((h) => {
    const n = norm(h);
    const field = fields.find((f) => !used.has(f.key) && f.aliases.includes(n));
    if (field) {
      used.add(field.key);
      return field.key;
    }
    return n ? unknown : "ignore";
  });
}

export function validateFileMeta(file: { name: string; size: number }): string | null {
  const lower = file.name.toLowerCase();
  if (!IMPORT_LIMITS.extensions.some((e) => lower.endsWith(e))) return "Only .csv and .xlsx files can be imported.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > IMPORT_LIMITS.maxBytes) return "This file is larger than 10 MB. Split it into smaller files and import them one at a time.";
  return null;
}

/** Common structural checks every planner runs before row-level validation. */
export function structuralError(table: string[][], label: string): string | undefined {
  const [headers = [], ...body] = table;
  if (!headers.length) return "We couldn't find a header row. The first row must contain column names.";
  if (body.length === 0) return `The file has a header row but no ${label}.`;
  if (body.length > IMPORT_LIMITS.maxRows) return `This file has ${body.length.toLocaleString()} rows. The limit is 10,000 per import.`;
  return undefined;
}

export function emptyCounts(): Record<RowOutcome, number> {
  return { create: 0, update: 0, skip: 0, error: 0 };
}

export function errorReportCsvRows(plan: ImportPlanBase): { headers: string[]; rows: string[][] } {
  return {
    headers: ["Row", "Outcome", "Problems", ...plan.headers],
    rows: plan.rows
      .filter((r) => r.outcome === "error" || r.outcome === "skip")
      .map((r) => [String(r.rowNumber), r.outcome, r.issues.map((i) => `${i.field}: ${i.message}`).join(" | "), ...r.raw]),
  };
}

export { readImportFile } from "./read-import-file";
