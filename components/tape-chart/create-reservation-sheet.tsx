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
import { createReservation } from "@/app/actions/reservations";
import { getEffectivePriceForRoomOnDate, getRatePlanInfoForRoomDate } from "@/app/actions/rooms";
import { getRateCodes, type RateCodeForUi } from "@/app/actions/rate-codes";
import { toast } from "sonner";
import type { Reservation } from "@/lib/tape-chart-types";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "CONFIRMED", label: "Potwierdzona" },
  { value: "CHECKED_IN", label: "Zameldowany" },
  { value: "CHECKED_OUT", label: "Wymeldowany" },
  { value: "CANCELLED", label: "Anulowana" },
  { value: "NO_SHOW", label: "No-show" },
];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface CreateReservationContext {
  roomNumber: string;
  checkIn: string;
}

interface CreateReservationSheetProps {
  context: CreateReservationContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (reservation: Reservation) => void;
  /** Pokoje z cenami – do wyświetlenia ceny za dobę i sumy */
  rooms?: Array<{ number: string; price?: number }>;
}

export function CreateReservationSheet({
  context,
  open,
  onOpenChange,
  onCreated,
  rooms = [],
}: CreateReservationSheetProps) {
  const [guestName, setGuestName] = useState("");
  const [room, setRoom] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [status, setStatus] = useState<string>("CONFIRMED");
  const [pax, setPax] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [effectivePricePerNight, setEffectivePricePerNight] = useState<number | undefined>(undefined);
  const [rateCodes, setRateCodes] = useState<RateCodeForUi[]>([]);
  const [rateCodeId, setRateCodeId] = useState("");
  const [isNonRefundable, setIsNonRefundable] = useState(false);

  useEffect(() => {
    if (context) {
      setRoom(context.roomNumber);
      setCheckIn(context.checkIn);
      setCheckOut(addDays(context.checkIn, 1));
      setStatus("CONFIRMED");
      setGuestName("");
      setPax("");
      setRateCodeId("");
      setError(null);
    }
  }, [context]);

  useEffect(() => {
    if (open) getRateCodes().then((r) => r.success && r.data && setRateCodes(r.data));
  }, [open]);

  useEffect(() => {
    if (!room.trim() || !checkIn) {
      setEffectivePricePerNight(undefined);
      return;
    }
    getEffectivePriceForRoomOnDate(room.trim(), checkIn).then(setEffectivePricePerNight);
  }, [room, checkIn]);

  useEffect(() => {
    if (!room.trim() || !checkIn) {
      setIsNonRefundable(false);
      return;
    }
    getRatePlanInfoForRoomDate(room.trim(), checkIn).then((info) =>
      setIsNonRefundable(info.isNonRefundable)
    );
  }, [room, checkIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!context) return;
    setSaving(true);
    setError(null);
    const result = await createReservation({
      guestName: guestName.trim(),
      room: room.trim(),
      checkIn,
      checkOut,
      status: status as Reservation["status"],
      pax: pax !== "" ? parseInt(pax, 10) : undefined,
      rateCodeId: rateCodeId || undefined,
    });
    setSaving(false);
    if (result.success && result.data) {
      toast.success("Rezerwacja utworzona.");
      onCreated?.(result.data as Reservation);
      onOpenChange(false);
    } else {
      setError(result.success ? null : result.error ?? null);
    }
  };

  if (!context) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nowa rezerwacja</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-guestName">Gość</Label>
            <Input
              id="create-guestName"
              data-testid="create-reservation-guest"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Imię i nazwisko"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-room">Pokój</Label>
            <Input
              id="create-room"
              data-testid="create-reservation-room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Numer pokoju"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-checkIn">Zameldowanie</Label>
              <Input
                id="create-checkIn"
                data-testid="create-reservation-checkIn"
                type="date"
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  setCheckOut(addDays(e.target.value, 1));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-checkOut">Wymeldowanie</Label>
              <Input
                id="create-checkOut"
                data-testid="create-reservation-checkOut"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-rateCode">Kod stawki (opcjonalnie)</Label>
            <select
              id="create-rateCode"
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
            <Label htmlFor="create-status">Status</Label>
            <select
              id="create-status"
              data-testid="create-reservation-status"
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
          {(() => {
            const pricePerNight = effectivePricePerNight ?? rooms.find((r) => r.number === room)?.price;
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
            return (pricePerNight != null && pricePerNight > 0) ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p><strong>Cena za dobę:</strong> {pricePerNight} PLN</p>
                {nights > 0 && (
                  <p><strong>Liczba nocy:</strong> {nights} · <strong>Suma:</strong> {totalAmount?.toFixed(0)} PLN</p>
                )}
              </div>
            ) : null;
          })()}
          {isNonRefundable && (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
              Stawka non-refundable – brak zwrotu przy anulowaniu
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="create-pax">Liczba gości (pax)</Label>
            <Input
              id="create-pax"
              type="number"
              min={0}
              max={20}
              value={pax}
              onChange={(e) => setPax(e.target.value)}
              placeholder="Opcjonalnie"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={saving} data-testid="create-reservation-save">
              {saving ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
