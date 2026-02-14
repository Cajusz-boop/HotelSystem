"use client";

import { useState, useEffect } from "react";
import { createRoomBlock } from "@/app/actions/rooms";
import { getRoomsForProperty, setSelectedProperty } from "@/app/actions/properties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Property {
  id: string;
  name: string;
  code: string;
}

export function OwnerReservationForm({ properties }: { properties: Property[] }) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [roomNumber, setRoomNumber] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Array<{ id: string; number: string; type: string }>>([]);

  useEffect(() => {
    if (!propertyId) {
      setRooms([]);
      setRoomNumber("");
      return;
    }
    getRoomsForProperty(propertyId).then((r) => {
      if (r.success && r.data) {
        setRooms(r.data);
        setRoomNumber(r.data[0]?.number ?? "");
      } else {
        setRooms([]);
        setRoomNumber("");
      }
    });
  }, [propertyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim()) {
      toast.error("Wybierz pokój");
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      toast.error("Data zakończenia musi być po dacie rozpoczęcia");
      return;
    }
    setLoading(true);
    await setSelectedProperty(propertyId);
    const result = await createRoomBlock({
      roomNumber: roomNumber.trim(),
      startDate,
      endDate,
      reason: "Rezerwacja właścicielska",
      blockType: "OWNER_HOLD",
    });
    setLoading(false);
    if (result.success && result.data) {
      toast.success(`Zablokowano pokój ${result.data.roomNumber} na ${startDate}–${endDate}`);
      setStartDate(endDate);
      const nextEnd = new Date(endDate);
      nextEnd.setDate(nextEnd.getDate() + 1);
      setEndDate(nextEnd.toISOString().slice(0, 10));
    } else {
      toast.error(result.error ?? "Błąd tworzenia rezerwacji");
    }
  };

  if (properties.length === 0) return null;

  return (
    <section className="mb-8 rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Rezerwacja właścicielska</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Zablokuj pokój na własny użytek (noclegi właściciela, goście zaproszeni). Blokada pojawi się na grafiku.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="owner-prop">Obiekt</Label>
          <select
            id="owner-prop"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[160px]"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="owner-room">Pokój</Label>
          <select
            id="owner-room"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[120px]"
          >
            <option value="">—</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.number}>
                {r.number} ({r.type})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="owner-start">Od</Label>
          <Input
            id="owner-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="owner-end">Do</Label>
          <Input
            id="owner-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <Button type="submit" disabled={loading || rooms.length === 0}>
          {loading ? "Zapisuję…" : "Zablokuj pokój"}
        </Button>
      </form>
    </section>
  );
}
