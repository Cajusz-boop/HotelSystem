"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Reservation, Room } from "@/lib/tape-chart-types";

interface MonthlyOverviewDialogProps {
  trigger?: React.ReactNode;
  reservations: Reservation[];
  rooms: Room[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDate?: (dateStr: string) => void;
  /** YYYY-MM-DD z rodzica – unika new Date() w pierwszym renderze (hydratacja). */
  initialTodayStr?: string;
}

interface DaySummary {
  date: string;
  freeRooms: number;
  freeBeds: number;
  occupiedRooms: number;
}

const WEEK_DAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

function toDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00Z");
}

function isBetween(dateStr: string, checkIn: string, checkOut: string): boolean {
  return dateStr >= checkIn && dateStr < checkOut;
}

function parseYearMonth(dateStr: string): { y: number; m: number } {
  const [y, m] = dateStr.split("-").map(Number);
  return { y: y || 2026, m: (m || 1) - 1 };
}

export function MonthlyOverviewDialog({
  trigger,
  reservations,
  rooms,
  open,
  onOpenChange,
  onSelectDate,
  initialTodayStr = "2026-01-01",
}: MonthlyOverviewDialogProps) {
  const { y: initialYear, m: initialMonth } = parseYearMonth(initialTodayStr);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedType, setSelectedType] = useState<string>("__all__");

  useEffect(() => {
    if (open) {
      const { y, m } = parseYearMonth(initialTodayStr);
      setYear(y);
      setMonth(m);
      setSelectedType("__all__");
    }
  }, [open, initialTodayStr]);

  const types = useMemo(() => {
    const arr = Array.from(new Set(rooms.map((room) => room.type)));
    return ["__all__", ...arr];
  }, [rooms]);

  const filteredRooms = useMemo(
    () => (selectedType === "__all__" ? rooms : rooms.filter((room) => room.type === selectedType)),
    [rooms, selectedType]
  );

  const filteredReservations = useMemo(() => {
    if (selectedType === "__all__") return reservations;
    const roomNumbers = new Set(filteredRooms.map((r) => r.number));
    return reservations.filter((res) => roomNumbers.has(res.room));
  }, [reservations, filteredRooms, selectedType]);

  const totalBeds = filteredRooms.reduce(
    (acc, room) => acc + ((room as { capacity?: number }).capacity ?? 2),
    0
  );
  const totalRooms = filteredRooms.length;

  const summaries = useMemo<DaySummary[]>(() => {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const result: DaySummary[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const current = new Date(Date.UTC(year, month, day));
      const dateStr = current.toISOString().slice(0, 10);

      const occupiedRooms = filteredReservations.filter((reservation) =>
        isBetween(dateStr, reservation.checkIn, reservation.checkOut)
      ).length;

      const occupiedBeds = filteredReservations.reduce((sum, reservation) => {
        if (!isBetween(dateStr, reservation.checkIn, reservation.checkOut)) return sum;
        return sum + (reservation.pax ?? 1);
      }, 0);

      result.push({
        date: dateStr,
        freeRooms: Math.max(totalRooms - occupiedRooms, 0),
        freeBeds: Math.max(totalBeds - occupiedBeds, 0),
        occupiedRooms,
      });
    }

    return result;
  }, [year, month, filteredReservations, totalRooms, totalBeds]);

  const monthLabel = new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month, 1)));

  const handlePrev = () => {
    setMonth((prev) => {
      if (prev === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNext = () => {
    setMonth((prev) => {
      if (prev === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const firstDayOfWeek = new Date(Date.UTC(year, month, 1)).getUTCDay() || 7;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Widok miesięczny</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev}>
              ←
            </Button>
            <p className="text-base font-semibold capitalize">{monthLabel}</p>
            <Button variant="outline" size="sm" onClick={handleNext}>
              →
            </Button>
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="flex h-10 w-[220px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="__all__">Wszystkie pokoje</option>
            {types
              .filter((type) => type !== "__all__")
              .map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
          </select>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2 text-sm">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="text-center font-semibold uppercase text-muted-foreground">
              {day}
            </div>
          ))}
          {Array.from({ length: firstDayOfWeek - 1 }).map((_, idx) => (
            <div key={`empty-${idx}`} />
          ))}
          {summaries.map((summary) => {
            const date = toDate(summary.date);
            const isWeekend = [0, 6].includes(date.getUTCDay());
            const isToday = summary.date === initialTodayStr;
            return (
              <button
                key={summary.date}
                type="button"
                className={cn(
                  "flex flex-col rounded-md border bg-card p-2 text-left transition hover:border-primary hover:shadow-sm",
                  isWeekend && "bg-muted/40",
                  isToday && "border-primary"
                )}
                onClick={() => {
                  onSelectDate?.(summary.date);
                  onOpenChange(false);
                }}
              >
                <span className="text-sm font-semibold">
                  {date.getUTCDate()}
                </span>
                <span className="text-xs text-muted-foreground">
                  Wolne pokoje: {summary.freeRooms}
                </span>
                <span className="text-xs text-muted-foreground">
                  Wolne łóżka: {summary.freeBeds}
                </span>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zamknij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
