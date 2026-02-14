"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Reservation } from "@/lib/tape-chart-types";
import { ArrowDown, ArrowUp, Calendar } from "lucide-react";

interface DailyMovementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservations: Reservation[];
  initialDate: string;
}

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Potwierdzona",
  CHECKED_IN: "Zameldowany",
  CHECKED_OUT: "Wymeldowany",
  CANCELLED: "Anulowana",
  NO_SHOW: "No-show",
};

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();
  const weekdays = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
  const weekday = weekdays[d.getUTCDay()];
  return `${weekday}, ${day}.${String(month).padStart(2, "0")}.${year}`;
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DailyMovementsDialog({
  open,
  onOpenChange,
  reservations,
  initialDate,
}: DailyMovementsDialogProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);

  // Przyjazdy (checkIn = selectedDate, status CONFIRMED lub CHECKED_IN)
  const arrivals = useMemo(() => {
    return reservations
      .filter(
        (r) =>
          r.checkIn === selectedDate &&
          (r.status === "CONFIRMED" || r.status === "CHECKED_IN")
      )
      .sort((a, b) => {
        // Sortuj wg godziny przyjazdu (jeśli dostępna), potem wg nazwiska
        const timeA = a.checkInTime || "00:00";
        const timeB = b.checkInTime || "00:00";
        if (timeA !== timeB) return timeA.localeCompare(timeB);
        return a.guestName.localeCompare(b.guestName);
      });
  }, [reservations, selectedDate]);

  // Wyjazdy (checkOut = selectedDate, status CHECKED_IN lub CHECKED_OUT)
  const departures = useMemo(() => {
    return reservations
      .filter(
        (r) =>
          r.checkOut === selectedDate &&
          (r.status === "CHECKED_IN" || r.status === "CHECKED_OUT")
      )
      .sort((a, b) => {
        // Sortuj wg godziny wyjazdu (jeśli dostępna), potem wg nazwiska
        const timeA = a.checkOutTime || "00:00";
        const timeB = b.checkOutTime || "00:00";
        if (timeA !== timeB) return timeA.localeCompare(timeB);
        return a.guestName.localeCompare(b.guestName);
      });
  }, [reservations, selectedDate]);

  // Pobyty (goście w hotelu tego dnia)
  const stayovers = useMemo(() => {
    return reservations
      .filter(
        (r) =>
          r.checkIn < selectedDate &&
          r.checkOut > selectedDate &&
          r.status === "CHECKED_IN"
      )
      .sort((a, b) => a.guestName.localeCompare(b.guestName));
  }, [reservations, selectedDate]);

  const handlePrevDay = () => setSelectedDate(addDaysToDateStr(selectedDate, -1));
  const handleNextDay = () => setSelectedDate(addDaysToDateStr(selectedDate, 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Przyjazdy i wyjazdy
          </DialogTitle>
        </DialogHeader>

        {/* Nawigacja daty */}
        <div className="flex items-center justify-between gap-4 border-b pb-3">
          <Button variant="outline" size="sm" onClick={handlePrevDay}>
            &larr; Poprzedni
          </Button>
          <div className="text-center">
            <div className="text-lg font-semibold">{formatDisplayDate(selectedDate)}</div>
            <div className="flex justify-center gap-4 text-sm text-muted-foreground">
              <span>{arrivals.length} przyjazd{arrivals.length !== 1 ? "ów" : ""}</span>
              <span>•</span>
              <span>{departures.length} wyjazd{departures.length !== 1 ? "ów" : ""}</span>
              <span>•</span>
              <span>{stayovers.length} w trakcie pobytu</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleNextDay}>
            Następny &rarr;
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Kolumna przyjazdów */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
              <ArrowDown className="h-4 w-4" />
              Przyjazdy ({arrivals.length})
            </h3>
            {arrivals.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Brak przyjazdów
              </div>
            ) : (
              <div className="space-y-2">
                {arrivals.map((res) => (
                  <div
                    key={res.id}
                    className={cn(
                      "rounded-md border p-3",
                      res.status === "CHECKED_IN"
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-muted bg-muted/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{res.guestName}</div>
                        <div className="text-sm text-muted-foreground">
                          Pokój {res.room}
                          {res.checkInTime && ` • ${res.checkInTime}`}
                        </div>
                      </div>
                      <Badge
                        variant={res.status === "CHECKED_IN" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {STATUS_LABELS[res.status]}
                      </Badge>
                    </div>
                    {res.notes && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Uwagi: {res.notes}
                      </div>
                    )}
                    {res.pax && res.pax > 1 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {res.pax} osób
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kolumna wyjazdów */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
              <ArrowUp className="h-4 w-4" />
              Wyjazdy ({departures.length})
            </h3>
            {departures.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Brak wyjazdów
              </div>
            ) : (
              <div className="space-y-2">
                {departures.map((res) => (
                  <div
                    key={res.id}
                    className={cn(
                      "rounded-md border p-3",
                      res.status === "CHECKED_OUT"
                        ? "border-gray-400 bg-gray-50 dark:bg-gray-800/30"
                        : "border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{res.guestName}</div>
                        <div className="text-sm text-muted-foreground">
                          Pokój {res.room}
                          {res.checkOutTime && ` • ${res.checkOutTime}`}
                        </div>
                      </div>
                      <Badge
                        variant={res.status === "CHECKED_OUT" ? "outline" : "secondary"}
                        className="text-[10px]"
                      >
                        {STATUS_LABELS[res.status]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sekcja gości w trakcie pobytu */}
        {stayovers.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              W trakcie pobytu ({stayovers.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {stayovers.map((res) => (
                <div
                  key={res.id}
                  className="rounded-md border bg-muted/20 p-2 text-sm"
                >
                  <div className="font-medium truncate">{res.guestName}</div>
                  <div className="text-xs text-muted-foreground">
                    Pokój {res.room} • do {res.checkOut}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
