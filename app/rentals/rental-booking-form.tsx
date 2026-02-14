"use client";

import { useState } from "react";
import { createRentalBooking, getRentalAvailability } from "@/app/actions/rentals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface RentalItemForForm {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export function RentalBookingForm({
  items,
}: {
  items: RentalItemForForm[];
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [availabilityHint, setAvailabilityHint] = useState<string | null>(null);

  const selectedItem = items.find((i) => i.id === itemId);
  const maxQty = selectedItem?.quantity ?? 1;

  const checkAvailability = async () => {
    if (!itemId || !startDate || !endDate) return;
    const res = await getRentalAvailability(itemId, startDate, endDate);
    if (res.success && res.data.length) {
      const min = Math.min(...res.data.map((d) => d.available));
      setAvailabilityHint(
        min >= quantity
          ? `Dostępne: min. ${min} szt. w wybranym terminie`
          : `Niewystarczająca dostępność (min. ${min} szt.)`
      );
    } else {
      setAvailabilityHint(res.success ? null : res.error ?? null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !startDate || !endDate) {
      toast.error("Wypełnij sprzęt oraz daty");
      return;
    }
    const start = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");
    if (end < start) {
      toast.error("Data końca musi być późniejsza lub równa dacie początku");
      return;
    }
    const qty = Math.max(1, Math.min(quantity, maxQty));
    setLoading(true);
    const res = await createRentalBooking({
      rentalItemId: itemId,
      startDate: start,
      endDate: end,
      quantity: qty,
    });
    setLoading(false);
    if (res.success) {
      toast.success("Rezerwacja wypożyczenia utworzona.");
      setStartDate("");
      setEndDate("");
      setQuantity(1);
      setAvailabilityHint(null);
    } else {
      toast.error(res.error);
    }
  };

  if (items.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Nowa rezerwacja wypożyczenia</h2>
      <div className="grid gap-2">
        <Label htmlFor="rental-item">Sprzęt</Label>
        <select
          id="rental-item"
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value);
            setAvailabilityHint(null);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · max {item.quantity} {item.unit}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="start-date">Od</Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setAvailabilityHint(null);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="end-date">Do</Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setAvailabilityHint(null);
            }}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="quantity">Liczba sztuk</Label>
        <Input
          id="quantity"
          type="number"
          min={1}
          max={maxQty}
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
        />
      </div>
      {availabilityHint && (
        <p className="text-sm text-muted-foreground">{availabilityHint}</p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={checkAvailability}>
          Sprawdź dostępność
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Zapisywanie…" : "Zarezerwuj"}
        </Button>
      </div>
    </form>
  );
}
