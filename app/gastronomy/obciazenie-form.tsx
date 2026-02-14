"use client";

import { useState, useEffect } from "react";
import { getActiveReservationsForCharge } from "@/app/actions/spa";
import { chargeGastronomyToReservation } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function ObciazenieForm() {
  const [reservationId, setReservationId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reservations, setReservations] = useState<Array<{ id: string; guestName: string; roomNumber: string; confirmationNumber: string | null }>>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getActiveReservationsForCharge().then((res) => {
      if (res.success && res.data) setReservations(res.data);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount.replace(",", "."));
    if (!reservationId) {
      toast.error("Wybierz rezerwację");
      return;
    }
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Podaj prawidłową kwotę");
      return;
    }
    if (!description.trim()) {
      toast.error("Podaj opis (np. Obiad, Room service)");
      return;
    }
    setSubmitting(true);
    const r = await chargeGastronomyToReservation(reservationId, amt, description.trim());
    setSubmitting(false);
    if (r.success) {
      toast.success("Doliczono do rachunku pokoju");
      setAmount("");
      setDescription("");
    } else {
      toast.error(r.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-4 space-y-4 max-w-md">
      <h3 className="font-medium">Obciążenie rachunku pokoju (restauracja / room service)</h3>
      <div>
        <Label htmlFor="gast-res">Rezerwacja</Label>
        <select
          id="gast-res"
          value={reservationId}
          onChange={(e) => setReservationId(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="">— Wybierz —</option>
          {reservations.map((r) => (
            <option key={r.id} value={r.id}>
              {r.roomNumber} · {r.guestName} {r.confirmationNumber ? `(${r.confirmationNumber})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="gast-amount">Kwota (PLN)</Label>
        <Input
          id="gast-amount"
          type="number"
          min={0}
          step={0.01}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="gast-desc">Opis</Label>
        <Input
          id="gast-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="np. Obiad, Room service – kolacja"
          className="mt-1"
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Zapisywanie…" : "Dolicz do rachunku"}
      </Button>
    </form>
  );
}
