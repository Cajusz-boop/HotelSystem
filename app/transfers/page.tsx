"use client";

import { useState, useEffect } from "react";
import {
  getTransferBookings,
  createTransferBooking,
  updateTransferBookingStatus,
  TRANSFER_TYPES,
  DIRECTIONS,
  STATUSES,
} from "@/app/actions/transfers";
import { getActiveReservationsForCharge } from "@/app/actions/spa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = { AIRPORT: "Lotnisko", STATION: "Dworzec" };
const DIRECTION_LABELS: Record<string, string> = { ARRIVAL: "Przyjazd", DEPARTURE: "Wyjazd" };
const STATUS_LABELS: Record<string, string> = {
  BOOKED: "Zarezerwowany",
  CONFIRMED: "Potwierdzony",
  DONE: "Wykonany",
  CANCELLED: "Anulowany",
};

export default function TransfersPage() {
  const [bookings, setBookings] = useState<
    Array<{
      id: string;
      roomNumber: string;
      guestName: string;
      type: string;
      direction: string;
      scheduledAt: string;
      place: string;
      price: number;
      status: string;
      chargedAt: string | null;
    }>
  >([]);
  const [reservations, setReservations] = useState<Array<{ id: string; guestName: string; roomNumber: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [newType, setNewType] = useState("AIRPORT");
  const [newDirection, setNewDirection] = useState("ARRIVAL");
  const [newScheduledDate, setNewScheduledDate] = useState("");
  const [newScheduledTime, setNewScheduledTime] = useState("");
  const [newPlace, setNewPlace] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([getTransferBookings(), getActiveReservationsForCharge()]).then(([bRes, rRes]) => {
      if (bRes.success && bRes.data) setBookings(bRes.data);
      if (rRes.success && rRes.data)
        setReservations(rRes.data.map((r) => ({ id: r.id, guestName: r.guestName, roomNumber: r.roomNumber })));
      setLoading(false);
    });
  };

  useEffect(() => load(), []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReservationId) {
      toast.error("Wybierz rezerwację");
      return;
    }
    if (!newPlace.trim()) {
      toast.error("Podaj miejsce (np. Lotnisko Chopin)");
      return;
    }
    const price = parseFloat(newPrice.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Podaj prawidłową cenę");
      return;
    }
    const scheduledAt = new Date(`${newScheduledDate}T${newScheduledTime || "12:00"}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast.error("Podaj datę i godzinę");
      return;
    }
    setSubmitting(true);
    const r = await createTransferBooking(selectedReservationId, {
      type: newType,
      direction: newDirection,
      scheduledAt,
      place: newPlace.trim(),
      price,
      notes: newNotes.trim() || undefined,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Rezerwacja transferu utworzona");
      setNewOpen(false);
      setSelectedReservationId("");
      setNewPlace("");
      setNewPrice("");
      setNewNotes("");
      load();
    } else toast.error(r.error);
  };

  const handleStatusChange = async (id: string, status: string) => {
    const r = await updateTransferBookingStatus(id, status);
    if (r.success) {
      toast.success(r.data?.charged ? "Status zaktualizowany, rachunek obciążony" : "Status zaktualizowany");
      load();
    } else toast.error(r.error);
  };

  if (loading) return <p className="text-muted-foreground">Ładowanie…</p>;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transfery (lotnisko, dworzec)</h1>
        <Button onClick={() => setNewOpen(true)}>Nowa rezerwacja transferu</Button>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Rezerwacje transferów</h2>
        {bookings.length === 0 ? (
          <p className="text-muted-foreground text-sm">Brak rezerwacji.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Pokój · Gość</th>
                  <th className="text-left p-2">Typ</th>
                  <th className="text-left p-2">Kierunek</th>
                  <th className="text-left p-2">Data / godz.</th>
                  <th className="text-left p-2">Miejsce</th>
                  <th className="text-left p-2">Cena</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-2">
                      {b.roomNumber} · {b.guestName}
                    </td>
                    <td className="p-2">{TYPE_LABELS[b.type] ?? b.type}</td>
                    <td className="p-2">{DIRECTION_LABELS[b.direction] ?? b.direction}</td>
                    <td className="p-2">{new Date(b.scheduledAt).toLocaleString("pl-PL")}</td>
                    <td className="p-2">{b.place}</td>
                    <td className="p-2">{b.price.toFixed(2)} zł</td>
                    <td className="p-2">{STATUS_LABELS[b.status] ?? b.status}</td>
                    <td className="p-2">
                      {b.status !== "DONE" && b.status !== "CANCELLED" && (
                        <select
                          value={b.status}
                          onChange={(e) => handleStatusChange(b.id, e.target.value)}
                          className="h-8 rounded border px-2 text-xs"
                        >
                          {STATUSES.filter((s) => s !== "CANCELLED").map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                          <option value="CANCELLED">Anulowany</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={newOpen} onOpenChange={setNewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nowa rezerwacja transferu</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleCreate} className="mt-6 space-y-4">
            <div>
              <Label>Rezerwacja (pokój · gość)</Label>
              <select
                value={selectedReservationId}
                onChange={(e) => setSelectedReservationId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Wybierz —</option>
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} · {r.guestName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Typ</Label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3"
              >
                {TRANSFER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Kierunek</Label>
              <select
                value={newDirection}
                onChange={(e) => setNewDirection(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3"
              >
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {DIRECTION_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={newScheduledDate}
                  onChange={(e) => setNewScheduledDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Godzina</Label>
                <Input
                  type="time"
                  value={newScheduledTime}
                  onChange={(e) => setNewScheduledTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Miejsce (np. Lotnisko Chopin, Dworzec Centralny)</Label>
              <Input
                value={newPlace}
                onChange={(e) => setNewPlace(e.target.value)}
                placeholder="Lotnisko Chopin Warszawa"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Cena (PLN)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Uwagi (opcjonalnie)</Label>
              <Input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="np. nr lotu, peron"
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={submitting || !selectedReservationId || !newPlace.trim()}>
              {submitting ? "Zapisywanie…" : "Utwórz rezerwację"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
