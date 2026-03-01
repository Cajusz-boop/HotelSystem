"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLogbookData, type LogbookEntry, type LogbookResponse } from "@/app/actions/dashboard";
import { FilterPanel, type LogbookFilters } from "./filter-panel";
import {
  ALL_COLUMNS,
  useVisibleColumns,
  ColumnsDialog,
} from "./columns-config";
import { DataTable } from "./data-table";
import { LogbookToolbar } from "./toolbar";
import { exportToCSV, exportToExcel } from "./export-utils";
import "./print-styles.css";

interface KsiegaMeldunkowaClientProps {
  initialData: LogbookResponse;
  rooms: { id: string; number: string; type: string }[];
  roomTypes: { id: string; name: string }[];
  propertyId: string | null;
  defaultDateFrom: string;
  defaultDateTo: string;
}

export function KsiegaMeldunkowaClient({
  initialData,
  rooms,
  roomTypes,
  propertyId,
  defaultDateFrom,
  defaultDateTo,
}: KsiegaMeldunkowaClientProps) {
  const [data, setData] = useState<LogbookEntry[]>(initialData.data);
  const [total, setTotal] = useState(initialData.total);
  const [summary, setSummary] = useState(initialData.summary);
  const [isLoading, setIsLoading] = useState(false);

  const [filters, setFilters] = useState<LogbookFilters>({
    mode: "all",
    dateFrom: defaultDateFrom,
    dateTo: defaultDateTo,
    roomId: undefined,
    roomType: undefined,
    status: undefined,
    source: undefined,
    segment: undefined,
    channel: undefined,
    mealPlan: undefined,
    guestSearch: "",
  });

  const [sortBy, setSortBy] = useState("checkIn");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("logbook-pageSize");
      if (stored) {
        const n = Number(stored);
        if (n === 10 || n === 25 || n === 50 || n === 100) setPageSize(n);
      }
    } catch {}
  }, []);
  const { visibleColumnIds, setVisibleColumns, resetToDefaults } = useVisibleColumns();
  const router = useRouter();

  const visibleColumns = ALL_COLUMNS.filter((c) => visibleColumnIds.includes(c.id));
  const columns = visibleColumns.length > 0 ? visibleColumns : ALL_COLUMNS.filter((c) => ["lp", "id", "guest", "room", "roomType", "checkIn", "checkOut", "nights", "status", "price"].includes(c.id));

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getLogbookData({
        propertyId,
        mode: filters.mode,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        roomId: filters.roomId,
        roomType: filters.roomType,
        status: filters.status,
        source: filters.source,
        segment: filters.segment,
        channel: filters.channel,
        mealPlan: filters.mealPlan,
        guestSearch: filters.guestSearch.trim() || undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      });

      if (result && "data" in result && "total" in result) {
        const res = result as LogbookResponse;
        setData(res.data);
        setTotal(res.total);
        setSummary(res.summary);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    propertyId,
    filters.mode,
    filters.dateFrom,
    filters.dateTo,
    filters.roomId,
    filters.roomType,
    filters.status,
    filters.source,
    filters.segment,
    filters.channel,
    filters.mealPlan,
    filters.guestSearch,
    sortBy,
    sortDir,
    page,
    pageSize,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const _totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSort = useCallback((columnId: string) => {
    setSortBy((prev) => {
      if (prev === columnId) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortDir("asc");
      }
      return columnId;
    });
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
    if (typeof window !== "undefined") localStorage.setItem("logbook-pageSize", String(size));
  }, []);

  const handleRowClick = useCallback((reservationId: string) => {
    router.push(`/front-office?reservation=${reservationId}`);
  }, [router]);

  const handleClearFilters = useCallback(() => {
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastDayStr = lastDay.toISOString().slice(0, 10);
    setFilters({
      mode: "all",
      dateFrom: firstDay,
      dateTo: lastDayStr,
      roomId: undefined,
      roomType: undefined,
      status: undefined,
      source: undefined,
      segment: undefined,
      channel: undefined,
      mealPlan: undefined,
      guestSearch: "",
    });
    setPage(1);
  }, []);

  const exportColumns = visibleColumns.length > 0 ? visibleColumns : ALL_COLUMNS.filter((c) => ["lp", "id", "guest", "room", "roomType", "checkIn", "checkOut", "nights", "status", "price"].includes(c.id));

  const handleExportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = await getLogbookData({
        propertyId,
        mode: filters.mode,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        roomId: filters.roomId,
        roomType: filters.roomType,
        status: filters.status,
        source: filters.source,
        segment: filters.segment,
        channel: filters.channel,
        mealPlan: filters.mealPlan,
        guestSearch: filters.guestSearch.trim() || undefined,
        sortBy,
        sortDir,
        page: 1,
        pageSize: 99999,
      });
      if (result && "data" in result) {
        const res = result as LogbookResponse;
        const dateStr = new Date().toISOString().slice(0, 10);
        exportToCSV(res.data, exportColumns, `ksiega-meldunkowa-${dateStr}.csv`);
      }
    } finally {
      setIsExporting(false);
    }
  }, [propertyId, filters, sortBy, sortDir, exportColumns]);

  const handleExportExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = await getLogbookData({
        propertyId,
        mode: filters.mode,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        roomId: filters.roomId,
        roomType: filters.roomType,
        status: filters.status,
        source: filters.source,
        segment: filters.segment,
        channel: filters.channel,
        mealPlan: filters.mealPlan,
        guestSearch: filters.guestSearch.trim() || undefined,
        sortBy,
        sortDir,
        page: 1,
        pageSize: 99999,
      });
      if (result && "data" in result) {
        const res = result as LogbookResponse;
        const dateStr = new Date().toISOString().slice(0, 10);
        await exportToExcel(res.data, exportColumns, `ksiega-meldunkowa-${dateStr}.xlsx`);
      }
    } finally {
      setIsExporting(false);
    }
  }, [propertyId, filters, sortBy, sortDir, exportColumns]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const formatPrintDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("pl-PL") : "—");
  const roomName = filters.roomId ? rooms.find((r) => r.id === filters.roomId)?.number : null;

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Księga Meldunkowa</h1>

      {/* Nagłówek druku — ukryty na ekranie, widoczny przy druku */}
      <div data-print-header className="hidden print:block mb-4">
        <h2 className="text-lg font-bold">KARCZMA ŁABĘDŹ — KSIĘGA MELDUNKOWA</h2>
        <p className="text-sm">
          Okres: {formatPrintDate(filters.dateFrom)} — {formatPrintDate(filters.dateTo)}
          {" | "}Tryb: {filters.mode}
          {roomName != null ? ` | Pokój: ${roomName}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Wygenerowano: {new Date().toLocaleString("pl-PL")}
        </p>
      </div>

      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onSearch={() => setPage(1)}
        onClear={handleClearFilters}
        rooms={rooms}
        roomTypes={roomTypes}
      />

      <LogbookToolbar
        total={total}
        summary={summary}
        onColumnsClick={() => setColumnsDialogOpen(true)}
        onExportCSV={handleExportCSV}
        onExportExcel={handleExportExcel}
        onPrint={handlePrint}
        isExporting={isExporting}
      />

      <DataTable
        data={data}
        columns={columns}
        total={total}
        page={page}
        pageSize={pageSize}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
        onRowClick={handleRowClick}
        isLoading={isLoading}
      />

      <ColumnsDialog
        open={columnsDialogOpen}
        onClose={() => setColumnsDialogOpen(false)}
        visibleColumnIds={visibleColumnIds}
        onApply={setVisibleColumns}
        onReset={resetToDefaults}
      />
    </div>
  );
}
