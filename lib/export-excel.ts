/**
 * Eksport tablicy obiektów do pliku .xlsx (Excel).
 * Działa w przeglądarce – wywołaj z komponentu klienckiego.
 */
import * as XLSX from "xlsx";

export function exportToExcel(
  rows: Record<string, string | number>[],
  sheetName: string,
  fileName: string
): void {
  const data =
    rows.length === 0
      ? [{ "Brak danych": "Raport nie zawiera wierszy w wybranym okresie." }]
      : rows;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // Excel limit 31 chars
  XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}
