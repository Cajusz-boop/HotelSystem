"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateReservation } from "@/app/actions/reservations";
import { getRateCodes, type RateCodeForUi } from "@/app/actions/rate-codes";
import { getRatePlanInfoForRoomDate } from "@/app/actions/rooms";
import type { Reservation } from "@/lib/tape-chart-types";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "CONFIRMED", label: "Potwierdzona" },
  { value: "CHECKED_IN", label: "Zameldowany" },
  { value: "CHECKED_OUT", label: "Wymeldowany" },
  { value: "CANCELLED", label: "Anulowana" },
  { value: "NO_SHOW", label: "No-show" },
];

interface ReservationEditSheetProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (updated: Reservation) => void;
  /** Pokoje z cenami – do wyświetlenia ceny za dobę i sumy */
  rooms?: Array<{ number: string; price?: number }>;
  /** Cena efektywna na datę zameldowania (ze stawek sezonowych) – nadpisuje rooms[].price */
  effectivePricePerNight?: number;
}

export function ReservationEditSheet({
  reservation,
  open,
  onOpenChange,
  onSaved,
  rooms = [],
  effectivePricePerNight,
}: ReservationEditSheetProps) {
  const [guestName, setGuestName] = useState("");
  const [room, setRoom] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [status, setStatus] = useState<string>("CONFIRMED");
  const [pax, setPax] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateCodes, setRateCodes] = useState<RateCodeForUi[]>([]);
  const [rateCodeId, setRateCodeId] = useState("");
  const [isNonRefundable, setIsNonRefundable] = useState(false);

  useEffect(() => {
    if (reservation) {
      setGuestName(reservation.guestName);
      setRoom(reservation.room);
      setCheckIn(reservation.checkIn);
      setCheckOut(reservation.checkOut);
      setStatus(reservation.status);
      setPax(reservation.pax != null ? String(reservation.pax) : "");
      setRateCodeId(reservation.rateCodeId ?? "");
      setError(null);
    }
  }, [reservation]);

  useEffect(() => {
    if (open) getRateCodes().then((r) => r.success && r.data && setRateCodes(r.data));
  }, [open]);

  useEffect(() => {
    if (open && room.trim() && checkIn) {
      getRatePlanInfoForRoomDate(room.trim(), checkIn).then((info) =>
        setIsNonRefundable(info.isNonRefundable)
      );
    } else {
      setIsNonRefundable(false);
    }
  }, [open, room, checkIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;
    setSaving(true);
    setError(null);
    const result = await updateReservation(reservation.id, {
      guestName: guestName.trim() || undefined,
      room: room.trim() || undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      status: status as Reservation["status"],
      pax: pax !== "" ? parseInt(pax, 10) : undefined,
      rateCodeId: rateCodeId || undefined,
    });
    setSaving(false);
    if (result.success && result.data) {
      onSaved?.(result.data as Reservation);
      onOpenChange(false);
    } else {
      setError(result.success ? null : result.error ?? null);
    }
  };

  if (!reservation) return null;

  const roomData = rooms.find((r) => r.number === room);
  const pricePerNight = effectivePricePerNight ?? roomData?.price;
  const nights =
    checkIn && checkOut
      ? Math.round(
          (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
            (24 * 60 * 60 * 1000)
        )
      : 0;
  const totalAmount =
    pricePerNight != null && pricePerNight > 0 && nights > 0
      ? pricePerNight * nights
      : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edycja rezerwacji</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="guestName">Gość</Label>
            <Input
              id="guestName"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Imię i nazwisko"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="room">Pokój</Label>
            <Input
              id="room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Numer pokoju"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkIn">Zameldowanie</Label>
              <Input
                id="checkIn"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkOut">Wymeldowanie</Label>
              <Input
                id="checkOut"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateCode">Kod stawki (opcjonalnie)</Label>
            <select
              id="rateCode"
              value={rateCodeId}
              onChange={(e) => setRateCodeId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— brak —</option>
              {rateCodes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} – {c.name}
                  {c.price != null ? ` (${c.price} PLN)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {(pricePerNight != null && pricePerNight > 0) && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <p><strong>Cena za dobę:</strong> {pricePerNight} PLN</p>
              {nights > 0 && (
                <p><strong>Liczba nocy:</strong> {nights} · <strong>Suma:</strong> {totalAmount?.toFixed(0)} PLN</p>
              )}
            </div>
          )}
          {isNonRefundable && (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
              Stawka non-refundable – brak zwrotu przy anulowaniu
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="pax">Liczba gości (pax)</Label>
            <Input
              id="pax"
              type="number"
              min={0}
              max={20}
              value={pax}
              onChange={(e) => setPax(e.target.value)}
              placeholder="Opcjonalnie"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
