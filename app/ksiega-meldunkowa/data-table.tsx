"use client";

import { ChevronUp, ChevronDown } from "lucide-react";
import type { LogbookEntry } from "@/app/actions/dashboard";
import type { ColumnDef } from "./columns-config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const _PAGE_SIZE_KEY = "logbook-pageSize";

export interface DataTableProps {
  data: LogbookEntry[];
  columns: ColumnDef[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (columnId: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRowClick: (reservationId: string) => void;
  isLoading: boolean;
}

export function DataTable({
  data,
  columns,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
  onSort,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  isLoading,
}: DataTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-logbook-table>
      <div className={cn("overflow-x-auto", isLoading && "opacity-50")}>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    "text-xs uppercase tracking-wider",
                    col.sortable && "cursor-pointer select-none"
                  )}
                  onClick={() => col.sortable && onSort(col.id)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortBy === col.id && (
                      sortDir === "asc" ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Ładowanie…
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Brak wyników dla wybranych filtrów
                </TableCell>
              </TableRow>
            ) : (
              data.map((entry, idx) => (
                <TableRow
                  key={entry.reservationId}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => onRowClick(entry.reservationId)}
                >
                  {columns.map((col) => (
                    <TableCell key={col.id} className="py-2 text-sm">
                      {col.id === "lp"
                        ? col.accessor(entry, idx + 1)
                        : col.accessor(entry)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm"
        data-logbook-pagination
      >
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            ◀
          </Button>
          <span className="text-muted-foreground max-sm:hidden">
            Strona {page} z {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            ▶
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Pokaż:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">na stronę</span>
        </div>
      </div>
    </div>
  );
}
