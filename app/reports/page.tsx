"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getManagementReportData,
  type ManagementReportData,
} from "@/app/actions/finance";
import { FileText, Printer } from "lucide-react";

function formatDateForInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ReportsPage() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const [dateStr, setDateStr] = useState(formatDateForInput(yesterday));
  const [report, setReport] = useState<ManagementReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    const result = await getManagementReportData(dateStr);
    setLoading(false);
    if (result.success && result.data) {
      setReport(result.data);
    } else {
      setError(result.success ? null : result.error ?? "Błąd");
      setReport(null);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const currency = report?.currency ?? "PLN";

  const handleExportCsv = () => {
    if (!report) return;
    const headers = ["Data/czas", "Typ", `Kwota (${currency})`, "Status"];
    const rows = report.transactions.map((t) => [
      new Date(t.createdAt).toLocaleString("pl-PL"),
      t.type,
      t.amount.toFixed(2),
      t.isReadOnly ? "Zamknięta" : "Otwarta",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raport-${report.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="text-2xl font-semibold">Raporty</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="report-date">Data raportu dobowego</Label>
            <Input
              id="report-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
          <Button type="button" onClick={() => loadReport()} disabled={loading}>
            <FileText className="mr-2 h-4 w-4" />
            {loading ? "Ładowanie…" : "Pobierz raport"}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Raport dobowy transakcji. Wybierz datę i pobierz raport. Eksport CSV/Excel lub Drukuj (Zapisz jako PDF).
      </p>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {report && (
        <div className="report-print-area rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2 print:mb-2">
            <h2 className="text-lg font-semibold">
              Raport dobowy – {report.date}
            </h2>
            <div className="flex items-center gap-2 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                aria-label="Eksport CSV"
              >
                Eksport CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
              >
                <Printer className="mr-2 h-4 w-4" />
                Drukuj / Zapisz jako PDF
              </Button>
            </div>
          </div>
          <div className="mb-4 grid gap-2 text-sm print:mb-2">
            <p>
              <strong>Liczba transakcji:</strong> {report.transactionCount}
            </p>
            <p>
              <strong>Suma:</strong> {report.totalAmount.toFixed(2)} {currency}
            </p>
            {Object.keys(report.byType).length > 0 && (
              <p>
                <strong>Według typu:</strong>{" "}
                {Object.entries(report.byType)
                  .map(([type, sum]) => `${type}: ${sum.toFixed(2)} ${currency}`)
                  .join(", ")}
              </p>
            )}
          </div>
          {report.transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">Data/czas</th>
                    <th className="py-2 text-left font-medium">Typ</th>
                    <th className="py-2 text-right font-medium">Kwota ({currency})</th>
                    <th className="py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((t) => (
                    <tr key={t.id} className="border-b border-border/50">
                      <td className="py-1.5">
                        {new Date(t.createdAt).toLocaleString("pl-PL")}
                      </td>
                      <td className="py-1.5">{t.type}</td>
                      <td className="py-1.5 text-right">
                        {t.amount.toFixed(2)}
                      </td>
                      <td className="py-1.5">
                        {t.isReadOnly ? "Zamknięta (Night Audit)" : "Otwarta"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Brak transakcji w wybranym dniu.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
