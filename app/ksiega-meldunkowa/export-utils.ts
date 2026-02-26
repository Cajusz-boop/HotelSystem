import type { LogbookEntry } from "@/app/actions/dashboard";
import type { ColumnDef } from "./columns-config";
import { exportToExcel as exportToExcelLib } from "@/lib/export-excel";

const CSV_SEP = ";";

function escapeCsvCell(val: string): string {
  if (!/[;"\n]/.test(val)) return val;
  return `"${val.replace(/"/g, '""')}"`;
}

/** Eksport do CSV: BOM UTF-8, separator `;`, tylko widoczne kolumny. */
export function exportToCSV(
  data: LogbookEntry[],
  columns: ColumnDef[],
  filename: string
): void {
  const bom = "\uFEFF";
  const header = columns.map((c) => c.label).join(CSV_SEP);
  const rows = data.map((entry, idx) =>
    columns
      .map((c) => {
        let raw: string;
        if (c.id === "lp") raw = String(idx + 1);
        else raw = c.exportAccessor ? c.exportAccessor(entry) : String(c.accessor(entry) ?? "");
        return escapeCsvCell(raw);
      })
      .join(CSV_SEP)
  );
  const content = [header, ...rows].join("\r\n");
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Eksport do Excel: używa lib/export-excel, tylko widoczne kolumny. */
export async function exportToExcel(
  data: LogbookEntry[],
  columns: ColumnDef[],
  filename: string
): Promise<void> {
  const rows: Record<string, string | number>[] = data.map((entry, idx) => {
    const row: Record<string, string | number> = {};
    for (const c of columns) {
      const label = c.label;
      if (c.id === "lp") row[label] = idx + 1;
      else {
        const val = c.exportAccessor ? c.exportAccessor(entry) : String(c.accessor(entry) ?? "");
        row[label] = val;
      }
    }
    return row;
  });
  await exportToExcelLib(
    rows.length === 0 ? [{ "Brak danych": "Brak wyników dla wybranych filtrów." }] : rows,
    "Księga meldunkowa",
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
  );
}
