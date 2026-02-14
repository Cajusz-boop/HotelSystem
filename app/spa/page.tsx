"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  getSpaGrafikData,
  getSpaBookingsCountByDay,
  getActiveReservationsForCharge,
  createSpaResource,
  createSpaBooking,
  type SpaResourceForGrafik,
  type SpaBookingForGrafik,
} from "@/app/actions/spa";
import { chargeSpaBookingToReservation } from "@/app/actions/finance";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

const HOUR_START = 8;
const HOUR_END = 20;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

function hourLabel(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

function SpaCalendar({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  counts,
  onDayClick,
  today,
}: {
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  counts: Record<string, number>;
  onDayClick: (dateStr: string) => void;
  today: string;
}) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));
  const startWeekday = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = lastDay.getUTCDate();
  const prevMonthDays = month === 1 ? 31 : new Date(Date.UTC(year, month - 2, 0)).getUTCDate();
  const cells: Array<{ dateStr: string; day: number; isCurrentMonth: boolean; count: number }> = [];
  for (let i = 0; i < startWeekday; i++) {
    const d = prevMonthDays - startWeekday + i + 1;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const dateStr = `${prevYear}-${prevMonth.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    cells.push({ dateStr, day: d, isCurrentMonth: false, count: counts[dateStr] ?? 0 });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${month.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    cells.push({ dateStr, day: d, isCurrentMonth: true, count: counts[dateStr] ?? 0 });
  }
  const remaining = 42 - cells.length;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  for (let i = 0; i < remaining; i++) {
    const d = i + 1;
    const dateStr = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    cells.push({ dateStr, day: d, isCurrentMonth: false, count: counts[dateStr] ?? 0 });
  }

  return (
    <div className="rounded-lg border bg-card p-4 max-w-md">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={onPrevMonth}>←</Button>
        <span className="font-medium">{MONTH_NAMES[month - 1]} {year}</span>
        <Button variant="ghost" size="sm" onClick={onNextMonth}>→</Button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-xs text-muted-foreground py-1">{w}</div>
        ))}
        {cells.map(({ dateStr, day, isCurrentMonth, count }) => (
          <button
            key={dateStr}
            type="button"
            onClick={() => onDayClick(dateStr)}
            className={`
              aspect-square rounded p-1 text-sm transition-colors
              ${!isCurrentMonth ? "text-muted-foreground/60" : ""}
              ${dateStr === today ? "ring-2 ring-primary" : ""}
              ${count > 0 ? "bg-emerald-100 dark:bg-emerald-900/30 font-medium" : "hover:bg-muted"}
            `}
          >
            {day}
            {count > 0 && <span className="block text-xs text-emerald-600">{count}</span>}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">Kliknij dzień, aby zobaczyć grafik zabiegów.</p>
    </div>
  );
}

/** Sprawdza czy rezerwacja obejmuje daną godzinę w danym dniu. */
function bookingCoversHour(
  b: SpaBookingForGrafik,
  dateStr: string,
  hour: number,
  resourceId: string
): boolean {
  if (b.resourceId !== resourceId) return false;
  const dayStart = new Date(dateStr + "T00:00:00Z").getTime();
  const hourStart = dayStart + hour * 60 * 60 * 1000;
  const hourEnd = hourStart + 60 * 60 * 1000;
  const bStart = new Date(b.start).getTime();
  const bEnd = new Date(b.end).getTime();
  return bStart < hourEnd && bEnd > hourStart;
}

export default function SpaPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateStr, setDateStr] = useState(today);
  const [data, setData] = useState<{
    resources: SpaResourceForGrafik[];
    bookings: SpaBookingForGrafik[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addResourceOpen, setAddResourceOpen] = useState(false);
  const [addBookingOpen, setAddBookingOpen] = useState(false);
  const [newResourceName, setNewResourceName] = useState("");
  const [newResourcePrice, setNewResourcePrice] = useState("");
  const [bookingResourceId, setBookingResourceId] = useState("");
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");
  const [bookingReservationId, setBookingReservationId] = useState("");
  const [bookingChargeToRoom, setBookingChargeToRoom] = useState(true);
  const [reservations, setReservations] = useState<Array<{ id: string; guestName: string; roomNumber: string; confirmationNumber: string | null }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"grafik" | "kalendarz">("grafik");
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1);
  const [calendarCounts, setCalendarCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    getSpaGrafikData(dateStr).then((res) => {
      setLoading(false);
      if (res.success && res.data) setData(res.data);
      else setError(res.success ? null : res.error ?? "Błąd");
    });
  }, [dateStr]);

  useEffect(() => {
    if (viewMode !== "kalendarz") return;
    getSpaBookingsCountByDay(calendarYear, calendarMonth).then((res) => {
      if (res.success && res.data) setCalendarCounts(res.data);
    });
  }, [viewMode, calendarYear, calendarMonth]);

  useEffect(() => {
    if (!addBookingOpen) return;
    getActiveReservationsForCharge().then((res) => {
      if (res.success && res.data) setReservations(res.data);
    });
  }, [addBookingOpen]);

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newResourceName.trim();
    const price = parseFloat(newResourcePrice.replace(",", "."));
    if (!name) {
      toast.error("Nazwa zasobu jest wymagana");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      toast.error("Podaj prawidłową cenę");
      return;
    }
    setSubmitting(true);
    const r = await createSpaResource(name, price);
    setSubmitting(false);
    if (r.success) {
      toast.success("Zasób dodany");
      setAddResourceOpen(false);
      setNewResourceName("");
      setNewResourcePrice("");
      getSpaGrafikData(dateStr).then((res) => {
        if (res.success && res.data) setData(res.data);
      });
    } else {
      toast.error(r.error);
    }
  };

  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingResourceId) {
      toast.error("Wybierz zasób");
      return;
    }
    const start = `${dateStr}T${bookingStart}:00`;
    const end = `${dateStr}T${bookingEnd}:00`;
    const reservationId = bookingReservationId?.trim() || null;
    setSubmitting(true);
    const r = await createSpaBooking(bookingResourceId, start, end, reservationId, "BOOKED");
    setSubmitting(false);
    if (r.success && r.data) {
      if (reservationId && bookingChargeToRoom) {
        const chargeRes = await chargeSpaBookingToReservation(r.data.id, reservationId);
        if (chargeRes.success && !chargeRes.data.skipped) {
          toast.success("Rezerwacja utworzona i doliczona do rachunku pokoju");
        } else if (chargeRes.success && chargeRes.data.skipped) {
          toast.success("Rezerwacja utworzona");
        } else {
          toast.warning(`Rezerwacja utworzona, ale błąd doliczenia: ${chargeRes.error}`);
        }
      } else {
        toast.success("Rezerwacja utworzona");
      }
      setAddBookingOpen(false);
      setBookingResourceId("");
      setBookingStart("");
      setBookingEnd("");
      setBookingReservationId("");
      getSpaGrafikData(dateStr).then((res) => {
        if (res.success && res.data) setData(res.data);
      });
    } else {
      toast.error(r.error);
    }
  };

  if (viewMode === "grafik" && loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">Ładowanie grafiku SPA…</p>
      </div>
    );
  }

  if (viewMode === "grafik" && error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const resources = data?.resources ?? [];
  const bookings = data?.bookings ?? [];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6" />
          <h1 className="text-xl font-semibold">Moduł SPA – Grafik zasobów</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grafik" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grafik")}
          >
            Grafik
          </Button>
          <Button
            variant={viewMode === "kalendarz" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("kalendarz")}
          >
            Kalendarz
          </Button>
          {viewMode === "grafik" && (
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm"
            />
          )}
          <Button variant="outline" size="sm" onClick={() => setAddResourceOpen(true)}>
            Dodaj zasób
          </Button>
          <Button size="sm" onClick={() => setAddBookingOpen(true)}>
            Nowa rezerwacja
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Oś czasu vs zasoby. <Link href="/front-office" className="text-primary hover:underline">Powrót do recepcji</Link>
      </p>

      {viewMode === "kalendarz" && (
        <SpaCalendar
          year={calendarYear}
          month={calendarMonth}
          onPrevMonth={() => {
            if (calendarMonth === 1) {
              setCalendarMonth(12);
              setCalendarYear((y) => y - 1);
            } else setCalendarMonth((m) => m - 1);
          }}
          onNextMonth={() => {
            if (calendarMonth === 12) {
              setCalendarMonth(1);
              setCalendarYear((y) => y + 1);
            } else setCalendarMonth((m) => m + 1);
          }}
          counts={calendarCounts}
          onDayClick={(d) => {
            setDateStr(d);
            setViewMode("grafik");
          }}
          today={today}
        />
      )}

      {viewMode === "grafik" && resources.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 max-w-xl">
          <p className="text-muted-foreground mb-4">
            Brak zdefiniowanych zasobów SPA. Dodaj zasób (np. masaż, sauna) aby rozpocząć.
          </p>
          <Button onClick={() => setAddResourceOpen(true)}>Dodaj pierwszy zasób</Button>
        </div>
      ) : viewMode === "grafik" ? (
        <div className="overflow-x-auto rounded-lg border">
          <div
            className="grid min-w-max"
            style={{
              gridTemplateColumns: `140px repeat(${HOURS.length}, minmax(56px, 1fr))`,
              gridTemplateRows: `36px repeat(${resources.length}, 44px)`,
            }}
          >
            <div className="border-b border-r bg-muted/50 p-1.5 text-center text-xs font-medium" />
            {HOURS.map((h) => (
              <div
                key={h}
                className="border-b border-r p-1 text-center text-xs text-muted-foreground"
              >
                {hourLabel(h)}
              </div>
            ))}
            {resources.map((res, rowIdx) => {
              const row = rowIdx + 2;
              return (
                <React.Fragment key={res.id}>
                  <div
                    className="border-b border-r bg-muted/30 p-2 text-sm font-medium flex items-center gap-1"
                    style={{ gridRow: row, gridColumn: 1 }}
                  >
                    <span>{res.name}</span>
                    <span className="text-xs text-muted-foreground">({res.price} zł)</span>
                  </div>
                  {HOURS.map((hour, colIdx) => {
                    const booking = bookings.find((b) =>
                      bookingCoversHour(b, dateStr, hour, res.id)
                    );
                    return (
                      <div
                        key={`${res.id}-${hour}`}
                        className="border-b border-r p-0.5"
                        style={{ gridRow: row, gridColumn: colIdx + 2 }}
                      >
                        {booking && (
                          <div
                            className="h-full w-full rounded bg-emerald-200 dark:bg-emerald-900/50 px-1.5 py-1 text-xs truncate"
                            title={`${booking.guestName ?? "Rezerwacja"} ${booking.start.slice(11, 16)}–${booking.end.slice(11, 16)}`}
                          >
                            {booking.guestName ?? "—"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : null}

      <Sheet open={addResourceOpen} onOpenChange={setAddResourceOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Dodaj zasób SPA</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleAddResource} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="res-name">Nazwa</Label>
              <Input
                id="res-name"
                value={newResourceName}
                onChange={(e) => setNewResourceName(e.target.value)}
                placeholder="np. Masaż relaksacyjny"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="res-price">Cena (PLN)</Label>
              <Input
                id="res-price"
                type="number"
                min={0}
                step={0.01}
                value={newResourcePrice}
                onChange={(e) => setNewResourcePrice(e.target.value)}
                placeholder="150"
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Zapisywanie…" : "Dodaj zasób"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={addBookingOpen} onOpenChange={setAddBookingOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Nowa rezerwacja SPA</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleAddBooking} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="book-resource">Zasób</Label>
              <select
                id="book-resource"
                value={bookingResourceId}
                onChange={(e) => setBookingResourceId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">— Wybierz —</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.price} zł)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="book-start">Godzina początku</Label>
              <Input
                id="book-start"
                type="time"
                value={bookingStart}
                onChange={(e) => setBookingStart(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="book-end">Godzina końca</Label>
              <Input
                id="book-end"
                type="time"
                value={bookingEnd}
                onChange={(e) => setBookingEnd(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="book-reservation">Dolicz do rachunku pokoju (rezerwacja)</Label>
              <select
                id="book-reservation"
                value={bookingReservationId}
                onChange={(e) => setBookingReservationId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">— Bez powiązania —</option>
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} · {r.guestName} {r.confirmationNumber ? `(${r.confirmationNumber})` : ""}
                  </option>
                ))}
              </select>
              {bookingReservationId && (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bookingChargeToRoom}
                    onChange={(e) => setBookingChargeToRoom(e.target.checked)}
                    className="rounded"
                  />
                  Od razu dolicz do rachunku
                </label>
              )}
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Zapisywanie…" : "Utwórz rezerwację"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
