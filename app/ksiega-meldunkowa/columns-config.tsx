"use client";

import { useState, useEffect, useCallback } from "react";
import type { LogbookEntry } from "@/app/actions/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const COLUMNS_STORAGE_KEY = "logbook-columns";
const DEFAULT_VISIBLE_IDS = [
  "lp",
  "id",
  "guest",
  "room",
  "roomType",
  "checkIn",
  "checkOut",
  "nights",
  "status",
  "price",
];

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pl-PL");
}

function formatPrice(val: number) {
  return `${val.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN`;
}

function truncate(s: string | null, max: number) {
  if (!s) return "—";
  return s.length <= max ? s : s.slice(0, max) + "...";
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  switch (s) {
    case "CONFIRMED":
      return "secondary";
    case "CHECKED_IN":
      return "default";
    case "CHECKED_OUT":
      return "outline";
    case "CANCELLED":
      return "destructive";
    case "NO_SHOW":
      return "secondary";
    default:
      return "outline";
  }
}

export interface ColumnDef {
  id: string;
  label: string;
  defaultVisible: boolean;
  sortable: boolean;
  accessor: (entry: LogbookEntry, rowIndex?: number) => React.ReactNode;
  exportAccessor?: (entry: LogbookEntry) => string;
}

export const ALL_COLUMNS: ColumnDef[] = [
  {
    id: "lp",
    label: "#",
    defaultVisible: true,
    sortable: false,
    accessor: (_, rowIndex) => (rowIndex != null ? rowIndex : "—"),
    exportAccessor: () => "", // LP jest numerowany przy eksporcie
  },
  {
    id: "id",
    label: "ID rez.",
    defaultVisible: true,
    sortable: true,
    accessor: (e) => e.reservationId.slice(0, 8),
    exportAccessor: (e) => e.reservationId,
  },
  {
    id: "confirmation",
    label: "Nr potw.",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => e.confirmationNumber ?? "—",
    exportAccessor: (e) => e.confirmationNumber ?? "",
  },
  {
    id: "guest",
    label: "Gość",
    defaultVisible: true,
    sortable: true,
    accessor: (e) =>
      `${e.guestIsVip ? "⭐ " : ""}${e.guestIsBlacklisted ? "🚫 " : ""}${e.guestName}`,
    exportAccessor: (e) => e.guestName,
  },
  {
    id: "email",
    label: "Email",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => e.guestEmail ?? "—",
    exportAccessor: (e) => e.guestEmail ?? "",
  },
  {
    id: "phone",
    label: "Telefon",
    defaultVisible: false,
    sortable: false,
    accessor: (e) => e.guestPhone ?? "—",
    exportAccessor: (e) => e.guestPhone ?? "",
  },
  {
    id: "company",
    label: "Firma",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => e.companyName ?? "—",
    exportAccessor: (e) => e.companyName ?? "",
  },
  {
    id: "companyNip",
    label: "NIP",
    defaultVisible: false,
    sortable: false,
    accessor: (e) => e.companyNip ?? "—",
    exportAccessor: (e) => e.companyNip ?? "",
  },
  {
    id: "room",
    label: "Pokój",
    defaultVisible: true,
    sortable: true,
    accessor: (e) => e.roomNumber,
    exportAccessor: (e) => e.roomNumber,
  },
  {
    id: "roomType",
    label: "Typ",
    defaultVisible: true,
    sortable: true,
    accessor: (e) => e.roomTypeName,
    exportAccessor: (e) => e.roomTypeName,
  },
  {
    id: "checkIn",
    label: "Check-in",
    defaultVisible: true,
    sortable: true,
    accessor: (e) => formatDate(e.checkIn),
    exportAccessor: (e) => e.checkIn,
  },
  {
    id: "checkOut",
    label: "Check-out",
    defaultVisible: true,
    sortable: true,
    accessor: (e) => formatDate(e.checkOut),
    exportAccessor: (e) => e.checkOut,
  },
  {
    id: "nights",
    label: "Noce",
    defaultVisible: true,
    sortable: true,
    accessor: (e) => String(e.nights),
    exportAccessor: (e) => String(e.nights),
  },
  {
    id: "adults",
    label: "Dorośli",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => String(e.adults),
    exportAccessor: (e) => String(e.adults),
  },
  {
    id: "children",
    label: "Dzieci",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => String(e.children),
    exportAccessor: (e) => String(e.children),
  },
  {
    id: "pax",
    label: "Pax",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => String(e.adults + e.children),
    exportAccessor: (e) => String(e.adults + e.children),
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: true,
    sortable: true,
    accessor: (e) => (
      <Badge variant={statusVariant(e.status)} className="text-xs">
        {e.status}
      </Badge>
    ),
    exportAccessor: (e) => e.status,
  },
  {
    id: "source",
    label: "Źródło",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => e.source ?? "—",
    exportAccessor: (e) => e.source ?? "",
  },
  {
    id: "channel",
    label: "Kanał",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => e.channel ?? "—",
    exportAccessor: (e) => e.channel ?? "",
  },
  {
    id: "segment",
    label: "Segment",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => e.marketSegment ?? "—",
    exportAccessor: (e) => e.marketSegment ?? "",
  },
  {
    id: "mealPlan",
    label: "Wyżywienie",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => e.mealPlan ?? "—",
    exportAccessor: (e) => e.mealPlan ?? "",
  },
  {
    id: "price",
    label: "Cena",
    defaultVisible: true,
    sortable: true,
    accessor: (e) => formatPrice(e.totalPrice),
    exportAccessor: (e) => String(e.totalPrice),
  },
  {
    id: "paid",
    label: "Zapłacono",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => formatPrice(e.totalPaid),
    exportAccessor: (e) => String(e.totalPaid),
  },
  {
    id: "remaining",
    label: "Pozostało",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => formatPrice(e.remaining),
    exportAccessor: (e) => String(e.remaining),
  },
  {
    id: "notes",
    label: "Uwagi",
    defaultVisible: false,
    sortable: false,
    accessor: (e) => truncate(e.notes, 50),
    exportAccessor: (e) => e.notes ?? "",
  },
  {
    id: "internalNotes",
    label: "Uwagi wewn.",
    defaultVisible: false,
    sortable: false,
    accessor: (e) => truncate(e.internalNotes, 50),
    exportAccessor: (e) => e.internalNotes ?? "",
  },
  {
    id: "country",
    label: "Kraj",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => e.guestCountry ?? "—",
    exportAccessor: (e) => e.guestCountry ?? "",
  },
  {
    id: "nationality",
    label: "Narodowość",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => e.guestNationality ?? "—",
    exportAccessor: (e) => e.guestNationality ?? "",
  },
  {
    id: "dob",
    label: "Data ur.",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => (e.guestDateOfBirth ? formatDate(e.guestDateOfBirth) : "—"),
    exportAccessor: (e) => e.guestDateOfBirth ?? "",
  },
  {
    id: "gender",
    label: "Płeć",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => e.guestGender ?? "—",
    exportAccessor: (e) => e.guestGender ?? "",
  },
  {
    id: "docNumber",
    label: "Nr dok.",
    defaultVisible: false,
    sortable: false,
    accessor: (e) => e.guestDocumentNumber ?? "—",
    exportAccessor: (e) => e.guestDocumentNumber ?? "",
  },
  {
    id: "docType",
    label: "Typ dok.",
    defaultVisible: false,
    sortable: false,
    accessor: (e) => e.guestDocumentType ?? "—",
    exportAccessor: (e) => e.guestDocumentType ?? "",
  },
  {
    id: "vip",
    label: "VIP",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => (e.guestIsVip ? "⭐" : "—"),
    exportAccessor: (e) => (e.guestIsVip ? "1" : "0"),
  },
  {
    id: "blacklist",
    label: "Czarna lista",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => (e.guestIsBlacklisted ? "🚫" : "—"),
    exportAccessor: (e) => (e.guestIsBlacklisted ? "1" : "0"),
  },
  {
    id: "rateCode",
    label: "Rate code",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => e.rateCode ?? "—",
    exportAccessor: (e) => e.rateCode ?? "",
  },
  {
    id: "createdAt",
    label: "Utworzono",
    defaultVisible: false,
    sortable: true,
    accessor: (e) => (e.createdAt ? new Date(e.createdAt).toLocaleString("pl-PL") : "—"),
    exportAccessor: (e) => e.createdAt ?? "",
  },
];

export function useVisibleColumns() {
  const [visibleColumnIds, setVisibleColumnIdsState] = useState<string[]>(DEFAULT_VISIBLE_IDS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) setVisibleColumnIdsState(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumnIds));
  }, [visibleColumnIds]);

  const setVisibleColumns = useCallback((ids: string[]) => {
    setVisibleColumnIdsState(ids);
  }, []);

  const resetToDefaults = useCallback(() => {
    setVisibleColumnIdsState(DEFAULT_VISIBLE_IDS);
  }, []);

  return { visibleColumnIds, setVisibleColumns, resetToDefaults };
}

interface ColumnsDialogProps {
  open: boolean;
  onClose: () => void;
  visibleColumnIds: string[];
  onApply: (ids: string[]) => void;
  onReset: () => void;
}

export function ColumnsDialog({
  open,
  onClose,
  visibleColumnIds,
  onApply,
  onReset,
}: ColumnsDialogProps) {
  const [localIds, setLocalIds] = useState<Set<string>>(() => new Set(visibleColumnIds));

  useEffect(() => {
    if (open) setLocalIds(new Set(visibleColumnIds));
  }, [open, visibleColumnIds]);

  const toggle = (id: string) => {
    setLocalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setLocalIds(new Set(ALL_COLUMNS.map((c) => c.id)));
  const selectNone = () => setLocalIds(new Set());
  const setDefaults = () => {
    setLocalIds(new Set(DEFAULT_VISIBLE_IDS));
  };

  const handleApply = () => {
    onApply(Array.from(localIds));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Konfiguracja kolumn</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
          {ALL_COLUMNS.map((col) => (
            <label
              key={col.id}
              className="flex cursor-pointer items-center gap-2 rounded border p-2 hover:bg-muted/50"
            >
              <Checkbox
                checked={localIds.has(col.id)}
                onCheckedChange={() => toggle(col.id)}
              />
              <span className="text-sm">{col.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAll}>
            Zaznacz wszystkie
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={selectNone}>
            Odznacz
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={setDefaults}>
            Domyślne
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="button" onClick={handleApply}>
            Zastosuj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
