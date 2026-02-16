"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getBookingAvailability,
  getRoomTypesForBooking,
  submitBookingFromEngine,
} from "@/app/actions/booking-engine";
import { createPaymentLink } from "@/app/actions/finance";

type Step = "search" | "results" | "guest" | "payment" | "done";

export function BookingForm() {
  const [step, setStep] = useState<Step>("search");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [roomType, setRoomType] = useState("");
  const [roomTypes, setRoomTypes] = useState<{ type: string }[]>([]);
  const [options, setOptions] = useState<Array<{
    roomNumber: string;
    type: string;
    pricePerNight: number;
    totalNights: number;
    totalAmount: number;
  }>>([]);
  const [selectedRoom, setSelectedRoom] = useState<typeof options[0] | null>(null);
  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingPaymentLink, setLoadingPaymentLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState("");
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [_reservationId, setReservationId] = useState<string | null>(null);

  const loadRoomTypes = async () => {
    setLoadingRoomTypes(true);
    setError(null);
    const r = await getRoomTypesForBooking();
    setLoadingRoomTypes(false);
    if (r.success && r.data) setRoomTypes(r.data);
    else if (!r.success) {
      const msg = r.error ?? "Błąd ładowania typów pokoi";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoadingSearch(true);
    const r = await getBookingAvailability(
      checkIn,
      checkOut,
      roomType || undefined
    );
    setLoadingSearch(false);
    if (r.success) {
      setOptions(r.data);
      setStep(r.data.length > 0 ? "results" : "search");
      if (r.data.length === 0) {
        const msg = "Brak dostępnych pokoi w podanym okresie.";
        setError(msg);
        toast.error(msg);
      } else {
        toast.success(`Znaleziono ${r.data.length} dostępnych pokoi.`);
      }
    } else {
      const msg = r.error ?? "Błąd wyszukiwania";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleSelectRoom = (opt: typeof options[0]) => {
    setSelectedRoom(opt);
    setStep("guest");
    setError(null);
  };

  const handleSubmitGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    setError(null);
    setLoadingSubmit(true);
    const r = await submitBookingFromEngine(
      guestName,
      email,
      phone,
      selectedRoom.roomNumber,
      checkIn,
      checkOut
    );
    setLoadingSubmit(false);
    if (r.success) {
      setReservationId(r.data.reservationId);
      setDoneMessage(r.data.message);
      toast.success("Rezerwacja złożona pomyślnie!");

      if (selectedRoom.totalAmount > 0) {
        setLoadingPaymentLink(true);
        const linkRes = await createPaymentLink(
          r.data.reservationId,
          selectedRoom.totalAmount,
          14
        );
        setLoadingPaymentLink(false);
        if (linkRes.success && linkRes.data?.url) {
          setPaymentUrl(linkRes.data.url);
          setStep("payment");
        } else {
          setStep("done");
        }
      } else {
        setStep("done");
      }
    } else {
      const msg = r.error ?? "Błąd rezerwacji";
      setError(msg);
      toast.error(msg);
    }
  };

  useEffect(() => {
    loadRoomTypes();
  }, []);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {step === "search" && (
        <form onSubmit={handleSearch} className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Sprawdź dostępność</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="checkIn">Zameldowanie</Label>
              <Input
                id="checkIn"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="checkOut">Wymeldowanie</Label>
              <Input
                id="checkOut"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                required
              />
            </div>
          </div>
          {roomTypes.length > 0 && (
            <div>
              <Label htmlFor="roomType">Typ pokoju (opcjonalnie)</Label>
              <select
                id="roomType"
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Dowolny</option>
                {roomTypes.map((t) => (
                  <option key={t.type} value={t.type}>{t.type}</option>
                ))}
              </select>
            </div>
          )}
          {loadingRoomTypes && (
            <p className="text-sm text-muted-foreground">Ładowanie typów pokoi…</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loadingSearch || loadingRoomTypes}>
            {loadingSearch ? "Szukam…" : "Szukaj"}
          </Button>
        </form>
      )}

      {step === "results" && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Dostępne pokoje</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {checkIn} – {checkOut}
          </p>
          <ul className="space-y-2">
            {options.map((opt) => (
              <li
                key={opt.roomNumber}
                className="flex justify-between items-center rounded border px-4 py-3"
              >
                <div>
                  <span className="font-medium">Pokój {opt.roomNumber}</span>
                  <span className="text-muted-foreground ml-2">({opt.type})</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">{opt.totalAmount.toFixed(0)} PLN</p>
                  <p className="text-xs text-muted-foreground">
                    {opt.pricePerNight} PLN / noc · {opt.totalNights} nocy
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="ml-2"
                  onClick={() => handleSelectRoom(opt)}
                >
                  Wybierz
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => { setStep("search"); setError(null); }}
          >
            Inne daty
          </Button>
        </div>
      )}

      {step === "guest" && selectedRoom && (
        <form onSubmit={handleSubmitGuest} className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Dane rezerwującego</h2>
          <p className="text-sm text-muted-foreground">
            Pokój {selectedRoom.roomNumber} · {selectedRoom.totalAmount.toFixed(0)} PLN
          </p>
          <div>
            <Label htmlFor="guestName">Imię i nazwisko *</Label>
            <Input
              id="guestName"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
              placeholder="Jan Kowalski"
            />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jan@example.com"
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+48 123 456 789"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loadingSubmit}>
              {loadingSubmit ? "Zapisuję…" : "Złóż rezerwację"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("results")}
            >
              Wstecz
            </Button>
          </div>
        </form>
      )}

      {step === "payment" && paymentUrl && (
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Płatność</h2>
          <p className="text-sm text-muted-foreground">
            Możesz zapłacić teraz lub później. Link do płatności jest ważny 14 dni.
          </p>
          {loadingPaymentLink ? (
            <p className="text-sm text-muted-foreground">Generowanie linku…</p>
          ) : (
            <>
              <Button asChild className="w-full">
                <Link href={paymentUrl} target="_blank" rel="noopener noreferrer">
                  Zapłać teraz ({selectedRoom?.totalAmount.toFixed(0)} PLN)
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep("done");
                }}
              >
                Zapłacę później
              </Button>
            </>
          )}
        </div>
      )}

      {step === "done" && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-6">
          <h2 className="text-lg font-semibold text-green-800 dark:text-green-400">Rezerwacja złożona</h2>
          <p className="mt-2 text-sm">{doneMessage}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => {
              setStep("search");
              setGuestName("");
              setEmail("");
              setPhone("");
              setSelectedRoom(null);
              setDoneMessage("");
              setPaymentUrl(null);
              setReservationId(null);
            }}
          >
            Nowa rezerwacja
          </Button>
        </div>
      )}
    </div>
  );
}
