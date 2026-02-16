"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getCampsites,
  getCampsiteBookingsInRange,
  createCampsiteBooking,
  getGuestsForSelect,
} from "@/app/actions/camping";
import { getActiveReservationsForCharge } from "@/app/actions/spa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

function formatDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

export default function CampingPage() {
  const [campsites, setCampsites] = useState<Array<{ id: string; number: string; type: string; pricePerDay: number; active: boolean }>>([]);
  const [bookings, setBookings] = useState<
    Array<{
      id: string;
      campsiteId: string;
      campsiteNumber: string;
      startDate: string;
      endDate: string;
      guestName: string | null;
      roomNumber: string | null;
    }>
  >([]);
  const [reservations, setReservations] = useState<Array<{ id: string; guestName: string; roomNumber: string }>>([]);
  const [guests, setGuests] = useState<Array<{ id: string; name: string }>>([]);
  const [dateFrom, setDateFrom] = useState(() => formatDateKey(new Date()));
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 13);
    return formatDateKey(d);
  });
  const [loading, setLoading] = useState(true);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [newBookingCampsiteId, setNewBookingCampsiteId] = useState("");
  const [newBookingStart, setNewBookingStart] = useState("");
  const [newBookingEnd, setNewBookingEnd] = useState("");
  const [newBookingGuestId, setNewBookingGuestId] = useState("");
  const [newBookingReservationId, setNewBookingReservationId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fromDate = useMemo(() => new Date(dateFrom + "T12:00:00"), [dateFrom]);
  const toDate = useMemo(() => new Date(dateTo + "T12:00:00"), [dateTo]);
  const dayCount = useMemo(() => daysBetween(fromDate, toDate), [fromDate, toDate]);
  const dayLabels = useMemo(() => {
    const labels: string[] = [];
    const d = new Date(fromDate);
    for (let i = 0; i < dayCount; i++) {
      labels.push(d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" }));
      d.setDate(d.getDate() + 1);
    }
    return labels;
  }, [fromDate, dayCount]);

  const load = () => {
    setLoading(true);
    Promise.all([
      getCampsites(),
      getCampsiteBookingsInRange(dateFrom, dateTo),
      getActiveReservationsForCharge(),
      getGuestsForSelect(),
    ]).then(([cRes, bRes, rRes, gRes]) => {
      if (cRes.success && cRes.data) setCampsites(cRes.data.filter((c) => c.active));
      if (bRes.success && bRes.data) setBookings(bRes.data);
      if (rRes.success && rRes.data)
        setReservations(rRes.data.map((r) => ({ id: r.id, guestName: r.guestName, roomNumber: r.roomNumber })));
      if (gRes.success && gRes.data) setGuests(gRes.data);
      setLoading(false);
    });
  };

  useEffect(() => load(), [dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps -- load uses dateFrom/dateTo

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookingCampsiteId || !newBookingStart || !newBookingEnd) {
      toast.error("Wybierz miejsce i podaj daty");
      return;
    }
    if (new Date(newBookingStart) > new Date(newBookingEnd)) {
      toast.error("Data początku musi być przed datą końca");
      return;
    }
    setSubmitting(true);
    const r = await createCampsiteBooking(
      newBookingCampsiteId,
      newBookingStart,
      newBookingEnd,
      newBookingReservationId.trim() || null,
      newBookingGuestId.trim() || null
    );
    setSubmitting(false);
    if (r.success) {
      toast.success("Rezerwacja utworzona");
      setNewBookingOpen(false);
      setNewBookingCampsiteId("");
      setNewBookingStart("");
      setNewBookingEnd("");
      setNewBookingGuestId("");
      setNewBookingReservationId("");
      load();
    } else toast.error(r.error);
  };

  const openNewBooking = (campsiteId: string) => {
    setNewBookingCampsiteId(campsiteId);
    setNewBookingStart(dateFrom);
    setNewBookingEnd(dateTo);
    setNewBookingOpen(true);
  };

  const getBookingsForCampsite = (campsiteId: string) =>
    bookings.filter((b) => b.campsiteId === campsiteId).sort((a, b) => a.startDate.localeCompare(b.startDate));

  const getRowCells = (campsiteId: string) => {
    const list = getBookingsForCampsite(campsiteId);
    const cells: { type: "empty" | "booking"; colspan?: number; booking?: (typeof bookings)[0] }[] = [];
    let offset = 0;
    const totalDays = dayCount;
    for (const b of list) {
      const bStart = new Date(b.startDate + "T12:00:00");
      const bEnd = new Date(b.endDate + "T12:00:00");
      const startDay = Math.max(0, Math.round((bStart.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)));
      const endDay = Math.min(
        totalDays,
        Math.round((bEnd.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
      );
      if (startDay > offset) cells.push({ type: "empty", colspan: startDay - offset });
      if (endDay > startDay) cells.push({ type: "booking", colspan: endDay - startDay, booking: b });
      offset = Math.max(offset, endDay);
    }
    if (offset < totalDays) cells.push({ type: "empty", colspan: totalDays - offset });
    return cells;
  };

  if (loading) return <p className="text-muted-foreground p-8">Ładowanie…</p>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">Grafik miejsc campingowych</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-sm">Od</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36"
          />
          <Label className="text-sm">Do</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36"
          />
          <Button variant="outline" size="sm" onClick={() => setNewBookingOpen(true)}>
            Nowa rezerwacja
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 800 }}>
          <thead>
            <tr className="bg-muted/50">
              <th className="p-2 text-left border-b border-r w-32 sticky left-0 bg-muted/50 z-10">
                Miejsce
              </th>
              {dayLabels.map((label, i) => (
                <th
                  key={i}
                  className="p-1 text-center border-b border-r w-14 min-w-[3rem]"
                  title={(() => {
                    const d = new Date(fromDate);
                    d.setDate(d.getDate() + i);
                    return d.toLocaleDateString("pl-PL");
                  })()}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campsites.map((c) => (
              <tr key={c.id} className="border-b hover:bg-muted/20">
                <td className="p-2 border-r sticky left-0 bg-background z-10">
                  <div className="font-medium">{c.number}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.type} · {c.pricePerDay.toFixed(0)} zł/dzień
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-6 text-xs"
                    onClick={() => openNewBooking(c.id)}
                  >
                    + Rezerwuj
                  </Button>
                </td>
                {getRowCells(c.id).map((cell, idx) =>
                  cell.type === "empty" ? (
                    <td key={idx} colSpan={cell.colspan} className="p-0 border-r align-top">
                      <div className="h-10 min-h-[2.5rem]" />
                    </td>
                  ) : (
                    <td
                      key={idx}
                      colSpan={cell.colspan}
                      className="p-0 border-r align-top"
                      title={cell.booking ? `${cell.booking.guestName ?? "—"} ${cell.booking.startDate} – ${cell.booking.endDate}` : ""}
                    >
                      <div className="h-10 min-h-[2.5rem] mx-0.5 rounded bg-primary/20 border border-primary/40 flex items-center justify-center overflow-hidden">
                        <span className="truncate text-xs px-1">
                          {cell.booking?.guestName ?? cell.booking?.roomNumber ?? "Rezerwacja"}
                        </span>
                      </div>
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {campsites.length === 0 && (
        <p className="text-muted-foreground text-sm">Brak aktywnych miejsc. Dodaj miejsca w ustawieniach.</p>
      )}

      <Dialog open={newBookingOpen} onOpenChange={setNewBookingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nowa rezerwacja miejsca</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBooking} className="space-y-4">
            <div>
              <Label>Miejsce (działka / przyczepa)</Label>
              <select
                value={newBookingCampsiteId}
                onChange={(e) => setNewBookingCampsiteId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">— Wybierz miejsce —</option>
                {campsites.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.number} ({c.type}) — {c.pricePerDay.toFixed(0)} zł/dzień
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Gość</Label>
              <select
                value={newBookingGuestId}
                onChange={(e) => setNewBookingGuestId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Wybierz gościa (opcjonalnie) —</option>
                {guests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Od</Label>
                <Input
                  type="date"
                  value={newBookingStart}
                  onChange={(e) => setNewBookingStart(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label>Do</Label>
                <Input
                  type="date"
                  value={newBookingEnd}
                  onChange={(e) => setNewBookingEnd(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
            </div>
            <div>
              <Label>Rezerwacja pobytu (pokój · gość) – opcjonalnie</Label>
              <select
                value={newBookingReservationId}
                onChange={(e) => setNewBookingReservationId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Brak powiązania z pobytem —</option>
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} · {r.guestName}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewBookingOpen(false)}>
                Anuluj
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Zapisywanie…" : "Utwórz rezerwację"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
