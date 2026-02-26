"use client";

import { Download, FileSpreadsheet, Printer, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LogbookToolbarProps {
  total: number;
  summary: {
    arrivals: number;
    departures: number;
    inhouse: number;
    noshow: number;
    cancelled: number;
  };
  onColumnsClick: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  isExporting: boolean;
}

export function LogbookToolbar({
  total,
  summary,
  onColumnsClick,
  onExportCSV,
  onExportExcel,
  onPrint,
  isExporting,
}: LogbookToolbarProps) {
  return (
    <div
      data-logbook-toolbar
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">
          Znaleziono: <strong>{total}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Przyjazdy: {summary.arrivals} │ Wyjazdy: {summary.departures} │ In-house:{" "}
          {summary.inhouse} │ No-show: {summary.noshow} │ Anul.: {summary.cancelled}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onColumnsClick}>
          <Settings className="mr-1.5 h-4 w-4" />
          Kolumny
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExportExcel}
          disabled={isExporting}
        >
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          Excel
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onPrint}>
          <Printer className="mr-1.5 h-4 w-4" />
          Drukuj
        </Button>
      </div>
    </div>
  );
}
