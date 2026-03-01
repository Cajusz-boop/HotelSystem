"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getRoomTypesForBooking,
  getRoomTypesForBookingWithPrices,
  submitBookingFromEngine,
  submitBookingRequest,
  type BookingRoomType,
} from "@/app/actions/booking-engine";
import { getBookingTransferInfo } from "@/app/actions/hotel-config";
import type { BookingTransferInfo } from "@/lib/hotel-config-types";
import { BookingStepper, type BookingStepKey } from "./booking-stepper";
import { RoomSelection } from "./room-selection";
import { GuestForm } from "./guest-form";
import { PaymentStep } from "./payment-step";
import { BookingConfirmation } from "./confirmation";

export function BookingForm() {
  const [step, setStep] = useState<BookingStepKey>("search");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children0_6, setChildren0_6] = useState(0);
  const [children7_12, setChildren7_12] = useState(0);
  const [children13_17, setChildren13_17] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [_roomTypesLegacy, setRoomTypesLegacy] = useState<{ type: string }[]>([]);
  const [roomsWithPrices, setRoomsWithPrices] = useState<BookingRoomType[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<BookingRoomType | null>(null);
  const [selectedMealPlan, setSelectedMealPlan] = useState("RO");
  const [totalAmount, setTotalAmount] = useState(0);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestRoom, setRequestRoom] = useState<BookingRoomType | null>(null);
  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestPhone, setRequestPhone] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [transferInfo, setTransferInfo] = useState<BookingTransferInfo | null>(null);
  const [doneData, setDoneData] = useState<{
    confirmationNumber: string;
    reservationId: string;
    totalAmount: number;
    paymentStatus: string;
    guestEmail: string;
    paymentLinkUrl?: string | null;
    checkInLink?: string | null;
    message: string;
  } | null>(null);

  const loadRoomTypes = async () => {
    setLoadingRoomTypes(true);
    setError(null);
    const r = await getRoomTypesForBooking();
    setLoadingRoomTypes(false);
    if (r.success && r.data) setRoomTypesLegacy(r.data);
    else if (!r.success) {
      setError(r.error ?? "Błąd ładowania typów pokoi");
      toast.error(r.error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoadingSearch(true);
    const childAges: number[] = [];
    for (let i = 0; i < children0_6; i++) childAges.push(3);
    for (let i = 0; i < children7_12; i++) childAges.push(9);
    for (let i = 0; i < children13_17; i++) childAges.push(15);
    const childrenCount = children0_6 + children7_12 + children13_17;
    const r = await getRoomTypesForBookingWithPrices({
      checkIn,
      checkOut,
      adults,
      children: childrenCount,
      childAges: childAges.length ? childAges : undefined,
      promoCode: promoCode.trim() || undefined,
    });
    setLoadingSearch(false);
    if (r.success) {
      setRoomsWithPrices(r.data);
      setStep(r.data.length > 0 ? "rooms" : "search");
      if (r.data.length === 0) {
        setError("Brak dostępnych pokoi w podanym okresie.");
        toast.error("Brak dostępnych pokoi w podanym okresie.");
      } else {
        toast.success("Znaleziono " + r.data.length + " typ(y) pokoi.");
      }
    } else {
      setError(r.error ?? "Błąd wyszukiwania");
      toast.error(r.error);
    }
  };

  const handleSelectRoom = (room: BookingRoomType, mealPlan: string, amount: number) => {
    setSelectedRoom(room);
    setSelectedMealPlan(mealPlan);
    setTotalAmount(amount);
    setStep("guest");
    setError(null);
  };

  const handleOpenRequest = (room: BookingRoomType) => {
    setRequestRoom(room);
    setError(null);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestRoom) return;
    if (!requestName?.trim() || !requestEmail?.trim() || !requestPhone?.trim()) {
      toast.error("Wypełnij imię, e-mail i telefon.");
      return;
    }
    setLoadingRequest(true);
    const childrenCount = children0_6 + children7_12 + children13_17;
    const r = await submitBookingRequest({
      roomTypeId: requestRoom.id,
      checkIn,
      checkOut,
      adults,
      children: childrenCount || undefined,
      guestName: requestName.trim(),
      guestEmail: requestEmail.trim(),
      guestPhone: requestPhone.trim(),
      message: requestMessage.trim() || "Zapytanie o dostępność.",
    });
    setLoadingRequest(false);
    if (r.success) {
      setRequestRoom(null);
      setDoneData({
        confirmationNumber: "",
        reservationId: r.data.requestId,
        totalAmount: 0,
        paymentStatus: "—",
        guestEmail: requestEmail.trim(),
        message: r.data.message,
      });
      setStep("done");
      toast.success(r.data.message);
    } else {
      setError(r.error ?? "Błąd wysyłania zapytania");
      toast.error(r.error);
    }
  };

  const handleSubmitGuest = (data: {
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    guestCountry: string;
    notes: string;
    acceptRegulamin: boolean;
    acceptRodo: boolean;
    marketingConsent: boolean;
    paymentIntent: "FULL" | "NONE";
  }) => {
    if (!selectedRoom) return;
    setError(null);
    setLoadingSubmit(true);
    const childrenCount = children0_6 + children7_12 + children13_17;
    const childAges: number[] = [];
    for (let i = 0; i < children0_6; i++) childAges.push(3);
    for (let i = 0; i < children7_12; i++) childAges.push(9);
    for (let i = 0; i < children13_17; i++) childAges.push(15);
    submitBookingFromEngine({
      roomTypeId: selectedRoom.id,
      checkIn,
      checkOut,
      adults,
      children: childrenCount || undefined,
      childAges: childAges.length ? childAges : undefined,
      mealPlan: selectedMealPlan,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone,
      guestCountry: data.guestCountry || undefined,
      notes: data.notes || undefined,
      marketingConsent: data.marketingConsent,
      bookingType: "INSTANT",
      paymentIntent: data.paymentIntent === "FULL" ? "FULL" : "NONE",
      totalAmount,
    })
      .then((res) => {
        setLoadingSubmit(false);
        if (res.success) {
          setDoneData({
            confirmationNumber: res.data.confirmationNumber,
            reservationId: res.data.reservationId,
            totalAmount: res.data.totalAmount,
            paymentStatus: res.data.paymentLink ? "Oczekuje na wpłatę" : "Zapłacę w obiekcie",
            guestEmail: data.guestEmail,
            paymentLinkUrl: res.data.paymentLink,
            checkInLink: res.data.checkInLink,
            message: res.data.message,
          });
          if (res.data.paymentLink && data.paymentIntent === "FULL") {
            setStep("payment");
          } else {
            setStep("done");
          }
          toast.success("Rezerwacja złożona!");
        } else {
          setError(res.error ?? "Błąd rezerwacji");
          toast.error(res.error);
        }
      })
      .catch(() => {
        setLoadingSubmit(false);
        setError("Błąd rezerwacji.");
        toast.error("Błąd rezerwacji.");
      });
  };

  const handleSkipPayment = () => {
    setStep("done");
  };

  const handleNewBooking = () => {
    setStep("search");
    setSelectedRoom(null);
    setDoneData(null);
    setError(null);
  };

  useEffect(() => {
    loadRoomTypes();
  }, []);

  useEffect(() => {
    if (step === "payment" || step === "done") {
      getBookingTransferInfo().then(setTransferInfo);
    }
  }, [step]);

  const childrenCount = children0_6 + children7_12 + children13_17;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <BookingStepper currentStep={step} className="mb-6" />

      {step === "search" && (
        <form onSubmit={handleSearch} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
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
                className="mt-1"
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
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Dorośli</Label>
            <select
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Dzieci 0-6</Label>
              <select
                value={children0_6}
                onChange={(e) => setChildren0_6(Number(e.target.value))}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Dzieci 7-12</Label>
              <select
                value={children7_12}
                onChange={(e) => setChildren7_12(Number(e.target.value))}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Dzieci 13-17</Label>
              <select
                value={children13_17}
                onChange={(e) => setChildren13_17(Number(e.target.value))}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="promoCode">Kod promocyjny (opcjonalnie)</Label>
            <Input
              id="promoCode"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Kod"
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loadingSearch || loadingRoomTypes} className="w-full py-3 bg-blue-600 hover:bg-blue-700">
            {loadingSearch ? "Szukam…" : "Szukaj dostępnych pokoi"}
          </Button>
        </form>
      )}

      {step === "rooms" && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Wybór pokoju</h2>
          <RoomSelection
            rooms={roomsWithPrices}
            checkIn={checkIn}
            checkOut={checkOut}
            adults={adults}
            childrenCount={childrenCount}
            onSelectRoom={handleSelectRoom}
            onRequestRoom={handleOpenRequest}
            onBack={() => setStep("search")}
          />
        </div>
      )}

      {step === "guest" && selectedRoom && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Dane rezerwującego</h2>
          <GuestForm
            roomName={selectedRoom.name}
            totalAmount={totalAmount}
            onSubmit={handleSubmitGuest}
            onBack={() => setStep("rooms")}
            loading={loadingSubmit}
            error={error}
          />
        </div>
      )}

      {step === "payment" && doneData && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Płatność</h2>
          <PaymentStep
            summary={selectedRoom ? `${selectedRoom.name} · ${doneData.totalAmount.toFixed(0)} PLN` : ""}
            totalAmount={doneData.totalAmount}
            reservationId={doneData.reservationId}
            confirmationNumber={doneData.confirmationNumber}
            transferInfo={transferInfo}
            onSkipPayment={handleSkipPayment}
          />
        </div>
      )}

      <Dialog open={!!requestRoom} onOpenChange={(open) => !open && setRequestRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zapytaj o dostępność</DialogTitle>
          </DialogHeader>
          {requestRoom && (
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {requestRoom.name} · {checkIn} – {checkOut}
              </p>
              <div>
                <Label htmlFor="reqName">Imię i nazwisko *</Label>
                <Input id="reqName" value={requestName} onChange={(e) => setRequestName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="reqEmail">E-mail *</Label>
                <Input id="reqEmail" type="email" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="reqPhone">Telefon *</Label>
                <Input id="reqPhone" value={requestPhone} onChange={(e) => setRequestPhone(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="reqMessage">Wiadomość</Label>
                <Input id="reqMessage" value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} placeholder="Np. preferowany piętro" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={loadingRequest}>
                  {loadingRequest ? "Wysyłanie…" : "Wyślij zapytanie"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setRequestRoom(null)}>
                  Anuluj
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {step === "done" && doneData && (
        <BookingConfirmation
          confirmationNumber={doneData.confirmationNumber}
          summary={selectedRoom ? `${selectedRoom.name} · ${doneData.totalAmount.toFixed(0)} PLN` : ""}
          totalAmount={doneData.totalAmount}
          paymentStatus={doneData.paymentStatus}
          guestEmail={doneData.guestEmail}
          reservationId={doneData.reservationId}
          paymentLinkUrl={doneData.paymentLinkUrl}
          checkInLink={doneData.checkInLink}
          transferInfo={transferInfo}
          onNewBooking={handleNewBooking}
        />
      )}
    </div>
  );
}
