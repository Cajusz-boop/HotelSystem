"use client";

import { useState, useEffect } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type LogbookMode = "all" | "arrivals" | "departures" | "inhouse" | "noshow" | "cancelled";

export interface LogbookFilters {
  mode: LogbookMode;
  dateFrom: string;
  dateTo: string;
  roomId?: string;
  roomType?: string;
  status?: string;
  source?: string;
  segment?: string;
  channel?: string;
  mealPlan?: string;
  guestSearch: string;
}

const COLLAPSED_KEY = "logbook-filters-collapsed";

const MODE_OPTIONS: { value: LogbookMode; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "arrivals", label: "Przyjazdy" },
  { value: "departures", label: "Wyjazdy" },
  { value: "inhouse", label: "In-house" },
  { value: "noshow", label: "No-show" },
  { value: "cancelled", label: "Anulowane" },
];

const STATUS_OPTIONS = [
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
].map((v) => ({ value: v, label: v }));

const SOURCE_OPTIONS = [
  { value: "PHONE", label: "Telefon" },
  { value: "EMAIL", label: "Email" },
  { value: "WALK_IN", label: "Osobiście" },
  { value: "WEBSITE", label: "Strona WWW" },
  { value: "BOOKING_COM", label: "Booking.com" },
  { value: "OTA", label: "OTA" },
  { value: "AGENCY", label: "Biuro" },
  { value: "OTHER", label: "Inne" },
];

const SEGMENT_OPTIONS = [
  { value: "BUSINESS", label: "Biznes" },
  { value: "LEISURE", label: "Wakacje" },
  { value: "VIP", label: "VIP" },
  { value: "GROUP", label: "Grupa" },
  { value: "EVENT", label: "Event" },
];

const CHANNEL_OPTIONS = [
  { value: "DIRECT", label: "Bezpośrednio" },
  { value: "OTA", label: "OTA" },
  { value: "AGENCY", label: "Biuro" },
  { value: "CORPORATE", label: "Korporacja" },
];

const MEAL_OPTIONS = [
  { value: "RO", label: "RO" },
  { value: "BB", label: "BB" },
  { value: "HB", label: "HB" },
  { value: "FB", label: "FB" },
  { value: "AI", label: "AI" },
];

interface FilterPanelProps {
  filters: LogbookFilters;
  onChange: (filters: LogbookFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  rooms: { id: string; number: string; type: string }[];
  roomTypes: { id: string; name: string }[];
}

function getDateShortcutRange(
  key: "today" | "tomorrow" | "week" | "month" | "prevMonth" | "year"
): { from: string; to: string } {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const toStr = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  switch (key) {
    case "today": {
      const today = toStr(d);
      return { from: today, to: today };
    }
    case "tomorrow": {
      const t = new Date(d);
      t.setDate(t.getDate() + 1);
      const tomorrow = toStr(t);
      return { from: tomorrow, to: tomorrow };
    }
    case "week": {
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: toStr(monday), to: toStr(sunday) };
    }
    case "month": {
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { from: toStr(first), to: toStr(last) };
    }
    case "prevMonth": {
      const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const last = new Date(d.getFullYear(), d.getMonth(), 0);
      return { from: toStr(first), to: toStr(last) };
    }
    case "year": {
      return {
        from: `${d.getFullYear()}-01-01`,
        to: `${d.getFullYear()}-12-31`,
      };
    }
  }
}

export function FilterPanel({
  filters,
  onChange,
  onSearch,
  onClear,
  rooms,
  roomTypes,
}: FilterPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(COLLAPSED_KEY);
    setIsCollapsed(stored === "true");
  }, []);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    if (typeof window !== "undefined") localStorage.setItem(COLLAPSED_KEY, String(next));
  };

  return (
    <div
      data-logbook-filters
      className="rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs font-medium text-gray-500">Tryb:</span>
        <div className="flex flex-wrap gap-4">
          {MODE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="logbook-mode"
                checked={filters.mode === opt.value}
                onChange={() => onChange({ ...filters, mode: opt.value })}
                className="h-3.5 w-3.5"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={toggleCollapsed}
        >
          {isCollapsed ? (
            <>
              <ChevronDown className="mr-1 h-4 w-4" />
              Rozwiń filtry
            </>
          ) : (
            <>
              <ChevronUp className="mr-1 h-4 w-4" />
              Zwiń filtry
            </>
          )}
        </Button>
      </div>

      {!isCollapsed && (
        <div className="mt-4 space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-500">
                Data od
              </Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                className="h-9 w-40"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-500">
                Data do
              </Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                className="h-9 w-40"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { key: "today" as const, label: "Dziś" },
                  { key: "tomorrow" as const, label: "Jutro" },
                  { key: "week" as const, label: "Ten tydzień" },
                  { key: "month" as const, label: "Ten miesiąc" },
                  { key: "prevMonth" as const, label: "Poprzedni mies." },
                  { key: "year" as const, label: "Rok" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const { from, to } = getDateShortcutRange(key);
                    onChange({ ...filters, dateFrom: from, dateTo: to });
                  }}
                  className="rounded-full border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-500">Pokój</Label>
              <Select
                value={filters.roomId ?? ""}
                onValueChange={(v) => onChange({ ...filters, roomId: v || undefined })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Wszystkie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Wszystkie</SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-500">Typ pokoju</Label>
              <Select
                value={filters.roomType ?? ""}
                onValueChange={(v) => onChange({ ...filters, roomType: v || undefined })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Wszystkie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Wszystkie</SelectItem>
                  {roomTypes.map((rt) => (
                    <SelectItem key={rt.id} value={rt.id}>
                      {rt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-500">Status</Label>
              <Select
                value={filters.status ?? ""}
                onValueChange={(v) => onChange({ ...filters, status: v || undefined })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Wszystkie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Wszystkie</SelectItem>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-500">Źródło</Label>
              <Select
                value={filters.source ?? ""}
                onValueChange={(v) => onChange({ ...filters, source: v || undefined })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Wszystkie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Wszystkie</SelectItem>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-500">Segment</Label>
              <Select
                value={filters.segment ?? ""}
                onValueChange={(v) => onChange({ ...filters, segment: v || undefined })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Wszystkie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Wszystkie</SelectItem>
                  {SEGMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-500">Kanał</Label>
              <Select
                value={filters.channel ?? ""}
                onValueChange={(v) => onChange({ ...filters, channel: v || undefined })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Wszystkie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Wszystkie</SelectItem>
                  {CHANNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-gray-500">Wyżywienie</Label>
              <Select
                value={filters.mealPlan ?? ""}
                onValueChange={(v) => onChange({ ...filters, mealPlan: v || undefined })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Wszystkie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Wszystkie</SelectItem>
                  {MEAL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-gray-500">
              Szukaj gościa
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Nazwisko, email lub telefon..."
                value={filters.guestSearch}
                onChange={(e) => onChange({ ...filters, guestSearch: e.target.value })}
                className="h-9 pl-8"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={onSearch}>
              Szukaj
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              Wyczyść filtry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
