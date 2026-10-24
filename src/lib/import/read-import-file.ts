import { parseCsv } from "@/lib/utils/csv";

/** Reads a .csv or .xlsx file into a 2-D array of strings (first row = headers). Browser only. */
export async function readImportFile(file: File): Promise<string[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = await file.text();
    return parseCsv(text);
  }
  if (lower.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = (await readSheet(file)) as unknown[][];
    return rows
      .map((r) =>
        r.map((cell) => {
          if (cell === null || cell === undefined) return "";
          if (cell instanceof Date) return cell.toISOString().slice(0, 10);
          return String(cell);
        }),
      )
      .filter((r) => r.some((c) => c.trim() !== ""));
  }
  throw new Error("Only .csv and .xlsx files can be imported.");
}
