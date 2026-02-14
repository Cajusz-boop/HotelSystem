"use client";

import { useState, useEffect } from "react";
import {
  getAttractions,
  createAttraction,
  getAttractionBookings,
  createAttractionBooking,
  updateAttractionBookingStatus,
  STATUSES,
} from "@/app/actions/attractions";
import { getActiveReservationsForCharge } from "@/app/actions/spa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  BOOKED: "Zarezerwowana",
  CONFIRMED: "Potwierdzona",
  DONE: "Wykonana",
  CANCELLED: "Anulowana",
};

export default function AttractionsPage() {
  const [attractions, setAttractions] = useState<Array<{ id: string; name: string; price: number; description: string | null }>>([]);
  const [bookings, setBookings] = useState<
    Array<{
      id: string;
      roomNumber: string;
      guestName: string;
      attractionName: string;
      scheduledAt: string;
      quantity: number;
      amount: number;
      status: string;
      chargedAt: string | null;
    }>
  >([]);
  const [reservations, setReservations] = useState<Array<{ id: string; guestName: string; roomNumber: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [addAttractionOpen, setAddAttractionOpen] = useState(false);
  const [newAttractionName, setNewAttractionName] = useState("");
  const [newAttractionPrice, setNewAttractionPrice] = useState("");
  const [newAttractionDesc, setNewAttractionDesc] = useState("");
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [selectedAttractionId, setSelectedAttractionId] = useState("");
  const [newScheduledDate, setNewScheduledDate] = useState("");
  const [newScheduledTime, setNewScheduledTime] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newNotes, setNewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      getAttractions(),
      getAttractionBookings(),
      getActiveReservationsForCharge(),
    ]).then(([aRes, bRes, rRes]) => {
      if (aRes.success && aRes.data) setAttractions(aRes.data);
      if (bRes.success && bRes.data) setBookings(bRes.data);
      if (rRes.success && rRes.data)
        setReservations(rRes.data.map((r) => ({ id: r.id, guestName: r.guestName, roomNumber: r.roomNumber })));
      setLoading(false);
    });
  };

  useEffect(() => load(), []);

  const handleAddAttraction = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newAttractionPrice.replace(",", "."));
    if (!newAttractionName.trim()) {
      toast.error("Nazwa wymagana");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Podaj prawidłową cenę");
      return;
    }
    setSubmitting(true);
    const r = await createAttraction(newAttractionName.trim(), price, newAttractionDesc.trim() || undefined);
    setSubmitting(false);
    if (r.success) {
      toast.success("Atrakcja dodana");
      setAddAttractionOpen(false);
      setNewAttractionName("");
      setNewAttractionPrice("");
      setNewAttractionDesc("");
      load();
    } else toast.error(r.error);
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReservationId || !selectedAttractionId) {
      toast.error("Wybierz rezerwację i atrakcję");
      return;
    }
    const qty = parseInt(newQuantity, 10);
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error("Liczba osób musi być co najmniej 1");
      return;
    }
    const scheduledAt = new Date(`${newScheduledDate}T${newScheduledTime || "10:00"}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast.error("Podaj datę i godzinę");
      return;
    }
    setSubmitting(true);
    const r = await createAttractionBooking(
      selectedReservationId,
      selectedAttractionId,
      scheduledAt,
      qty,
      newNotes.trim() || undefined
    );
    setSubmitting(false);
    if (r.success) {
      toast.success("Rezerwacja utworzona");
      setNewBookingOpen(false);
      setSelectedReservationId("");
      setSelectedAttractionId("");
      setNewQuantity("1");
      setNewNotes("");
      load();
    } else toast.error(r.error);
  };

  const handleStatusChange = async (id: string, status: string) => {
    const r = await updateAttractionBookingStatus(id, status);
    if (r.success) {
      toast.success(r.data?.charged ? "Status zaktualizowany, rachunek obciążony" : "Status zaktualizowany");
      load();
    } else toast.error(r.error);
  };

  if (loading) return <p className="text-muted-foreground">Ładowanie…</p>;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wycieczki i atrakcje</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddAttractionOpen(true)}>
            Dodaj atrakcję
          </Button>
          <Button size="sm" onClick={() => setNewBookingOpen(true)}>
            Nowa rezerwacja
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold mb-3">Cennik atrakcji</h2>
          {attractions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Brak atrakcji. Dodaj pozycje do cennika.</p>
          ) : (
            <ul className="rounded-lg border divide-y">
              {attractions.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{a.name}</span>
                  <span className="text-sm font-medium">{a.price.toFixed(2)} zł</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-3">Rezerwacje</h2>
          {bookings.length === 0 ? (
            <p className="text-muted-foreground text-sm">Brak rezerwacji.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Pokój · Gość</th>
                    <th className="text-left p-2">Atrakcja</th>
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Osób</th>
                    <th className="text-left p-2">Kwota</th>
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
                      <td className="p-2">{b.attractionName}</td>
                      <td className="p-2">{new Date(b.scheduledAt).toLocaleString("pl-PL")}</td>
                      <td className="p-2">{b.quantity}</td>
                      <td className="p-2">{b.amount.toFixed(2)} zł</td>
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
                            <option value="CANCELLED">Anulowana</option>
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
      </div>

      <Sheet open={addAttractionOpen} onOpenChange={setAddAttractionOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Dodaj atrakcję</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleAddAttraction} className="mt-6 space-y-4">
            <div>
              <Label>Nazwa</Label>
              <Input
                value={newAttractionName}
                onChange={(e) => setNewAttractionName(e.target.value)}
                placeholder="np. Zwiedzanie zamku"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Cena (PLN)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={newAttractionPrice}
                onChange={(e) => setNewAttractionPrice(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Opis (opcjonalnie)</Label>
              <Input
                value={newAttractionDesc}
                onChange={(e) => setNewAttractionDesc(e.target.value)}
                placeholder="Krótki opis"
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Zapisywanie…" : "Dodaj"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={newBookingOpen} onOpenChange={setNewBookingOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nowa rezerwacja wycieczki/atrakcji</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleCreateBooking} className="mt-6 space-y-4">
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
              <Label>Atrakcja</Label>
              <select
                value={selectedAttractionId}
                onChange={(e) => setSelectedAttractionId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Wybierz —</option>
                {attractions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.price.toFixed(2)} zł
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
              <Label>Liczba osób</Label>
              <Input
                type="number"
                min={1}
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Uwagi (opcjonalnie)</Label>
              <Input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting || !selectedReservationId || !selectedAttractionId || !newScheduledDate}
            >
              {submitting ? "Zapisywanie…" : "Utwórz rezerwację"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
