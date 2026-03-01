"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { splitReservation } from "@/app/actions/reservations";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import type { Reservation } from "@/lib/tape-chart-types";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface SplitReservationDialogProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSplit: (first: Reservation, second: Reservation) => void;
  rooms?: Array<{ number: string }>;
}

export function SplitReservationDialog({
  reservation,
  open,
  onOpenChange,
  onSplit,
  rooms = [],
}: SplitReservationDialogProps) {
  const [splitDate, setSplitDate] = useState("");
  const [secondRoom, setSecondRoom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reservation && open) {
      const nights = Math.round(
        (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      const mid = nights > 1 ? addDays(reservation.checkIn, Math.floor(nights / 2)) : reservation.checkIn;
      setSplitDate(mid);
      setSecondRoom(reservation.room);
      setError(null);
    }
  }, [reservation, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;
    setSaving(true);
    setError(null);
    const result = await splitReservation({
      reservationId: reservation.id,
      splitDate,
      secondRoomNumber: secondRoom.trim() || undefined,
    });
    setSaving(false);
    if (result.success && result.data) {
      toast.success("Rezerwacja podzielona na dwie.");
      onSplit(result.data.first as Reservation, result.data.second as Reservation);
      onOpenChange(false);
    } else {
      setError("error" in result ? (result.error ?? "Błąd") : null);
    }
  };

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Podziel rezerwację</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {reservation.guestName} · pokój {reservation.room} · {reservation.checkIn} – {reservation.checkOut}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="split-date">Data podziału (od tej nocy druga rezerwacja)</Label>
            <Input
              id="split-date"
              type="date"
              value={splitDate}
              onChange={(e) => setSplitDate(e.target.value)}
              min={addDays(reservation.checkIn, 1)}
              max={addDays(reservation.checkOut, -1)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="second-room">Pokój drugiej części (domyślnie ten sam)</Label>
            <select
              id="second-room"
              value={secondRoom}
              onChange={(e) => setSecondRoom(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value={reservation.room}>{reservation.room} (ten sam)</option>
              {rooms
                .filter((r) => r.number !== reservation.room)
                .map((r) => (
                  <option key={r.number} value={r.number}>
                    {r.number}
                  </option>
                ))}
            </select>
          </div>
          {error && (
            <div className="p-3 rounded-md border-l-4 bg-red-50 border-red-500 text-red-800 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" />
              <div className="text-sm font-medium">{error}</div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Zapisywanie…" : "Podziel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
