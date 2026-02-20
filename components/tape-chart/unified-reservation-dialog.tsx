"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { createReservation, updateReservation, updateReservationStatus, getCheckoutBalanceWarning, findGuestsForCheckIn, getReservationCompany, type GuestCheckInSuggestion } from "@/app/actions/reservations";
import { postRoomChargeOnCheckout, createVatInvoice, printFiscalReceiptForReservation } from "@/app/actions/finance";
import { lookupCompanyByNip } from "@/app/actions/companies";
import { getEffectivePriceForRoomOnDate, getRatePlanInfoForRoomDate } from "@/app/actions/rooms";
import { getRateCodes, type RateCodeForUi } from "@/app/actions/rate-codes";
import { getParkingSpotsForSelect } from "@/app/actions/parking";
import { toast } from "sonner";
import { FISCAL_JOB_ENQUEUED_EVENT } from "@/components/fiscal-relay";
import type { Reservation } from "@/lib/tape-chart-types";
import type { ReservationSource, ReservationChannel, MealPlan } from "@/lib/validations/schemas";
import { SettlementTab, type SettlementTabFormState } from "./tabs/settlement-tab";
import { DocumentsTab } from "./tabs/documents-tab";
import { MealsTab } from "./tabs/meals-tab";
import { CheckinTab } from "./tabs/checkin-tab";

export type UnifiedReservationTab = "rozliczenie" | "dokumenty" | "posilki" | "meldunek";

export interface CreateReservationContext {
  roomNumber: string;
  checkIn: string;
  checkOut?: string;
  guestName?: string;
  pax?: number;
  notes?: string;
  rateCodeId?: string;
}

interface UnifiedReservationDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms?: Array<{ number: string; type?: string; price?: number; beds?: number }>;
  /** Create mode: context for new reservation */
  createContext?: CreateReservationContext | null;
  onCreated?: (reservation: Reservation) => void;
  /** Edit mode: existing reservation */
  reservation?: Reservation | null;
  onSaved?: (updated: Reservation) => void;
  effectivePricePerNight?: number;
  initialTab?: UnifiedReservationTab;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (24 * 60 * 60 * 1000)
  );
}

const INITIAL_FORM: SettlementTabFormState = {
  guestName: "",
  guestId: null,
  guestEmail: "",
  guestPhone: "",
  guestDateOfBirth: "",
  guestNationality: "PL",
  documentType: "ID_CARD",
  documentNumber: "",
  room: "",
  checkIn: "",
  checkOut: "",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  status: "CONFIRMED",
  adults: "1",
  children: "0",
  pax: "",
  notes: "",
  internalNotes: "",
  source: "PHONE",
  channel: "DIRECT",
  mealPlan: "BB",
  eta: "14:00",
  rateCodeId: "",
  rateCodePrice: "",
  parkingSpotId: "",
  bedsBooked: "1",
  nipInput: "",
  companyName: "",
  companyAddress: "",
  companyPostalCode: "",
  companyCity: "",
  companyFound: false,
};

export function UnifiedReservationDialog({
  mode,
  open,
  onOpenChange,
  rooms = [],
  createContext,
  onCreated,
  reservation,
  onSaved,
  effectivePricePerNight: effectivePriceProp,
  initialTab,
}: UnifiedReservationDialogProps) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState<SettlementTabFormState>(INITIAL_FORM);
  const [activeTab, setActiveTab] = useState<UnifiedReservationTab>("rozliczenie");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateCodes, setRateCodes] = useState<RateCodeForUi[]>([]);
  const [parkingSpots, setParkingSpots] = useState<{ id: string; number: string }[]>([]);
  const [effectivePricePerNight, setEffectivePricePerNight] = useState<number | undefined>(undefined);
  const [isNonRefundable, setIsNonRefundable] = useState(false);
  const [nipLookupLoading, setNipLookupLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [docChoiceOpen, setDocChoiceOpen] = useState(false);
  const [docChoiceResId, setDocChoiceResId] = useState<string | null>(null);
  const [_docChoiceGuestName, setDocChoiceGuestName] = useState("");
  const [docIssuing, setDocIssuing] = useState(false);

  // Guest autocomplete
  const [guestSuggestions, setGuestSuggestions] = useState<GuestCheckInSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsField, setSuggestionsField] = useState<"name" | "email" | "phone">("name");
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const justSelectedRef = useRef(false);
  const guestInputRef = useRef<HTMLInputElement>(null);
  const saveAndPrintRef = useRef(false);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const searchGuestRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form on open / context change
  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab ?? "rozliczenie");
    setError(null);

    if (isEdit && reservation) {
      setForm({
        ...INITIAL_FORM,
        guestName: reservation.guestName,
        guestId: reservation.guestId ?? null,
        room: reservation.room,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        checkInTime: reservation.checkInTime ?? "",
        checkOutTime: reservation.checkOutTime ?? "",
        status: reservation.status,
        pax: reservation.pax != null ? String(reservation.pax) : "",
        rateCodeId: reservation.rateCodeId ?? "",
        rateCodePrice: reservation.rateCodePrice != null ? String(reservation.rateCodePrice) : "",
        parkingSpotId: reservation.parkingSpotId ?? "",
        notes: reservation.notes ?? "",
        bedsBooked: reservation.bedsBooked != null ? String(reservation.bedsBooked) : "",
      });
      // Załaduj firmę (NIP) powiązaną z rezerwacją
      getReservationCompany(reservation.id).then((r) => {
        if (r.success && r.data) {
          const c = r.data;
          let nipFormatted = (c.nip ?? "").replace(/\D/g, "");
          if (nipFormatted.length > 3) nipFormatted = `${nipFormatted.slice(0, 3)}-${nipFormatted.slice(3)}`;
          if (nipFormatted.length > 6) nipFormatted = `${nipFormatted.slice(0, 6)}-${nipFormatted.slice(6)}`;
          if (nipFormatted.length > 8) nipFormatted = `${nipFormatted.slice(0, 8)}-${nipFormatted.slice(8)}`;
          setForm((prev) => ({
            ...prev,
            nipInput: nipFormatted,
            companyName: c.name ?? "",
            companyAddress: c.address ?? "",
            companyPostalCode: c.postalCode ?? "",
            companyCity: c.city ?? "",
            companyFound: true,
          }));
        }
      });
    } else if (!isEdit && createContext) {
      setForm({
        ...INITIAL_FORM,
        room: createContext.roomNumber,
        checkIn: createContext.checkIn,
        checkOut: createContext.checkOut ?? addDays(createContext.checkIn, 1),
        guestName: createContext.guestName ?? "",
        pax: createContext.pax?.toString() ?? "",
        notes: createContext.notes ?? "",
        rateCodeId: createContext.rateCodeId ?? "",
      });
    }

    setGuestSuggestions([]);
    setSuggestionsOpen(false);
    setHighlightedIdx(-1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservation, createContext, isEdit]);

  // Load rate codes and parking spots
  useEffect(() => {
    if (open) {
      getRateCodes().then((r) => r.success && r.data && setRateCodes(r.data));
      getParkingSpotsForSelect().then((r) => r.success && r.data && setParkingSpots(r.data));
    }
  }, [open]);

  // Focus guest name on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => guestInputRef.current?.focus());
    }
  }, [open, createContext, reservation]);

  // Fetch effective price for room + date
  useEffect(() => {
    if (effectivePriceProp != null) {
      setEffectivePricePerNight(effectivePriceProp);
      return;
    }
    if (!form.room.trim() || !form.checkIn) {
      setEffectivePricePerNight(undefined);
      return;
    }
    getEffectivePriceForRoomOnDate(form.room.trim(), form.checkIn).then(setEffectivePricePerNight);
  }, [form.room, form.checkIn, effectivePriceProp]);

  // Fetch non-refundable flag
  useEffect(() => {
    if (!form.room.trim() || !form.checkIn) { setIsNonRefundable(false); return; }
    getRatePlanInfoForRoomDate(form.room.trim(), form.checkIn).then((info) => setIsNonRefundable(info.isNonRefundable));
  }, [form.room, form.checkIn]);

  const onFormChange = useCallback((patch: Partial<SettlementTabFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  // Guest autocomplete search
  const searchGuest = useCallback((query: string, field: "name" | "email" | "phone") => {
    if (searchGuestRef.current) clearTimeout(searchGuestRef.current);
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    const q = query.trim();
    if (q.length < 2) { setGuestSuggestions([]); setSuggestionsOpen(false); setHighlightedIdx(-1); return; }
    if (field === "name") setForm((prev) => ({ ...prev, guestId: null }));
    searchGuestRef.current = setTimeout(() => {
      findGuestsForCheckIn(q).then((res) => {
        if (res.success && res.data?.length) { setGuestSuggestions(res.data); setSuggestionsField(field); setSuggestionsOpen(true); setHighlightedIdx(-1); }
        else { setGuestSuggestions([]); setSuggestionsOpen(false); setHighlightedIdx(-1); }
      });
    }, 300);
  }, []);

  const selectGuest = useCallback((g: GuestCheckInSuggestion) => {
    justSelectedRef.current = true;
    setForm((prev) => ({
      ...prev,
      guestName: g.name,
      guestId: g.id,
      guestEmail: g.email ?? "",
      guestPhone: g.phone ?? "",
      guestDateOfBirth: g.dateOfBirth ?? "",
    }));
    setGuestSuggestions([]);
    setSuggestionsOpen(false);
    setHighlightedIdx(-1);
    requestAnimationFrame(() => saveBtnRef.current?.focus());
  }, []);

  const handleGuestKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!suggestionsOpen || guestSuggestions.length === 0) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlightedIdx((prev) => (prev < guestSuggestions.length - 1 ? prev + 1 : 0)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightedIdx((prev) => (prev > 0 ? prev - 1 : guestSuggestions.length - 1)); }
      else if (e.key === "Enter" && highlightedIdx >= 0) { e.preventDefault(); selectGuest(guestSuggestions[highlightedIdx]); }
      else if (e.key === "Escape") { e.preventDefault(); setSuggestionsOpen(false); setHighlightedIdx(-1); }
    },
    [suggestionsOpen, guestSuggestions, highlightedIdx, selectGuest]
  );

  // NIP lookup
  const handleNipLookup = useCallback(async () => {
    const raw = form.nipInput.replace(/\D/g, "");
    if (raw.length !== 10) return;
    setNipLookupLoading(true);
    try {
      const result = await lookupCompanyByNip(raw);
      if (result.success && result.data) {
        setForm((prev) => ({
          ...prev,
          companyName: result.data!.name ?? "",
          companyAddress: result.data!.address ?? "",
          companyPostalCode: result.data!.postalCode ?? "",
          companyCity: result.data!.city ?? "",
          companyFound: true,
        }));
      }
    } catch { /* ignore */ }
    finally { setNipLookupLoading(false); }
  }, [form.nipInput]);

  // Auto-lookup NIP
  useEffect(() => {
    const raw = form.nipInput.replace(/\D/g, "");
    if (raw.length === 10 && !form.companyFound) handleNipLookup();
  }, [form.nipInput, form.companyFound, handleNipLookup]);

  const openRegistrationCard = useCallback((reservationId: string, triggerPrint = false) => {
    const printWindow = window.open(`/api/reservations/${reservationId}/registration-card/pdf`, "_blank", "noopener,noreferrer");
    if (triggerPrint && printWindow) {
      printWindow.addEventListener("load", () => {
        setTimeout(() => printWindow.print(), 500);
      });
    }
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const nights = computeNights(form.checkIn, form.checkOut);
    if (nights <= 0) { setError("Data wymeldowania musi być po dacie zameldowania."); return; }

    setSaving(true);
    setError(null);

    try {
      if (isEdit && reservation) {
        const roomData = rooms.find((r) => r.number === form.room.trim());
        const roomBeds = roomData?.beds ?? 1;
        const nipRaw = form.nipInput.replace(/\D/g, "");
        const hasCompany = nipRaw.length === 10 && form.companyName.trim();
        const result = await updateReservation(reservation.id, {
          guestName: form.guestName.trim() || undefined,
          room: form.room.trim() || undefined,
          checkIn: form.checkIn || undefined,
          checkOut: form.checkOut || undefined,
          checkInTime: form.checkInTime.trim() || undefined,
          checkOutTime: form.checkOutTime.trim() || undefined,
          status: form.status as Reservation["status"],
          pax: form.pax !== "" ? parseInt(form.pax, 10) : undefined,
          bedsBooked: roomBeds > 1 ? (form.bedsBooked !== "" ? parseInt(form.bedsBooked, 10) : null) : undefined,
          rateCodeId: form.rateCodeId || undefined,
          rateCodePrice: form.rateCodePrice ? parseFloat(form.rateCodePrice) : undefined,
          parkingSpotId: form.parkingSpotId || null,
          notes: form.notes.trim() || null,
          ...(hasCompany ? {
            companyData: {
              nip: nipRaw,
              name: form.companyName.trim(),
              address: form.companyAddress.trim() || undefined,
              postalCode: form.companyPostalCode.trim() || undefined,
              city: form.companyCity.trim() || undefined,
            },
          } : {}),
        });
        if (result.success && result.data) {
          onSaved?.(result.data as Reservation);
          if (saveAndPrintRef.current) {
            saveAndPrintRef.current = false;
            openRegistrationCard(reservation.id, true);
          }
          onOpenChange(false);
        } else {
          setError("error" in result ? (result.error ?? null) : null);
        }
      } else {
        const selectedRoom = rooms.find((r) => r.number === form.room.trim());
        const maxBeds = selectedRoom?.beds ?? 1;
        const bedsVal = form.bedsBooked !== "" ? parseInt(form.bedsBooked, 10) : undefined;
        const adultsVal = form.adults !== "" ? parseInt(form.adults, 10) : 1;
        const childrenVal = form.children !== "" ? parseInt(form.children, 10) : 0;
        const paxVal = adultsVal + childrenVal;
        const nipRaw = form.nipInput.replace(/\D/g, "");
        const hasCompany = nipRaw.length === 10 && form.companyName.trim();

        const result = await createReservation({
          guestName: form.guestName.trim(),
          guestId: form.guestId || undefined,
          guestEmail: form.guestEmail.trim() || undefined,
          guestPhone: form.guestPhone.trim() || undefined,
          guestDateOfBirth: form.guestDateOfBirth || undefined,
          room: form.room.trim(),
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          checkInTime: form.checkInTime.trim() || undefined,
          checkOutTime: form.checkOutTime.trim() || undefined,
          eta: form.eta.trim() || undefined,
          status: form.status as Reservation["status"],
          pax: paxVal,
          adults: adultsVal,
          children: childrenVal,
          bedsBooked: maxBeds > 1 && bedsVal != null && bedsVal >= 1 ? bedsVal : undefined,
          rateCodeId: form.rateCodeId || undefined,
          rateCodePrice: form.rateCodePrice ? parseFloat(form.rateCodePrice) : undefined,
          parkingSpotId: form.parkingSpotId || undefined,
          notes: form.notes.trim() || undefined,
          internalNotes: form.internalNotes.trim() || undefined,
          source: (form.source || undefined) as ReservationSource | undefined,
          channel: (form.channel || undefined) as ReservationChannel | undefined,
          mealPlan: (form.mealPlan || undefined) as MealPlan | undefined,
          ...(hasCompany ? {
            companyData: {
              nip: nipRaw,
              name: form.companyName.trim(),
              address: form.companyAddress.trim() || undefined,
              postalCode: form.companyPostalCode.trim() || undefined,
              city: form.companyCity.trim() || undefined,
            },
          } : {}),
        });
        if (result.success && result.data) {
          if ("guestBlacklisted" in result && result.guestBlacklisted) toast.warning("Rezerwacja utworzona. Uwaga: gość jest na czarnej liście.");
          else if ("overbooking" in result && result.overbooking) toast.warning("Rezerwacja utworzona w trybie overbooking.");
          else if ("guestMatched" in result && result.guestMatched) toast.success("Rezerwacja utworzona. Przypisano do istniejącego gościa.");
          else toast.success("Rezerwacja utworzona.");

          import("@/lib/notifications").then(({ showDesktopNotification }) => {
            showDesktopNotification("Nowa rezerwacja", { body: "Rezerwacja utworzona.", tag: "new-reservation" });
          });

          const createdRes = result.data as Reservation;
          onCreated?.(createdRes);
          if (saveAndPrintRef.current) {
            saveAndPrintRef.current = false;
            openRegistrationCard(createdRes.id, true);
          }
          onOpenChange(false);
        } else {
          setError("error" in result ? (result.error ?? null) : null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieoczekiwany błąd");
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, reservation, rooms, onSaved, onCreated, onOpenChange, openRegistrationCard]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (saving) return;
        if (e.shiftKey) saveAndPrintRef.current = true;
        handleSubmit();
      }
    },
    [handleSubmit, saving]
  );

  const handleFullCheckout = useCallback(async () => {
    if (!reservation?.id) return;
    setCheckoutLoading(true);
    try {
      // 1. If not checked in yet, check in first
      if (reservation.status === "CONFIRMED") {
        const checkinResult = await updateReservationStatus(reservation.id, "CHECKED_IN");
        if (!checkinResult.success) {
          toast.error("error" in checkinResult ? checkinResult.error : "Błąd meldunku");
          return;
        }
        toast.success("Zameldowano gościa");
      }

      // 2. Charge room if not yet charged
      const chargeResult = await postRoomChargeOnCheckout(reservation.id);
      if (chargeResult.success && chargeResult.data && !chargeResult.data.skipped) {
        toast.success(`Naliczono nocleg: ${chargeResult.data.amount?.toFixed(2)} PLN`);
      }

      // 3. Check balance
      const balanceResult = await getCheckoutBalanceWarning(reservation.id);
      if (balanceResult.success && balanceResult.data) {
        const d = balanceResult.data;
        if (d.hasUnpaidBalance) {
          const proceed = window.confirm(
            `Nieopłacone saldo: ${d.balance.toFixed(2)} PLN\n` +
            `(Obciążenia: ${d.totalOwed.toFixed(2)} PLN, Wpłaty: ${d.totalPaid.toFixed(2)} PLN)\n\n` +
            (d.restaurantCount > 0 ? `Rachunki z restauracji: ${d.restaurantCount} szt. (${d.restaurantCharges.toFixed(2)} PLN)\n\n` : "") +
            `Czy wymeldować mimo salda?`
          );
          if (!proceed) return;
        }
      }

      // 4. Check out
      const result = await updateReservationStatus(reservation.id, "CHECKED_OUT");
      if (result.success && result.data) {
        toast.success("Gość wymeldowany i rozliczony");
        onSaved?.(result.data as Reservation);
        setDocChoiceResId(reservation.id);
        setDocChoiceGuestName(reservation.guestName);
        setDocChoiceOpen(true);
      } else {
        toast.error("error" in result ? result.error : "Błąd wymeldowania");
      }
    } finally {
      setCheckoutLoading(false);
    }
  }, [reservation?.id, reservation?.status, reservation?.guestName, onSaved]);

  const handleDocChoice = useCallback(async (choice: "vat" | "posnet" | "none") => {
    if (choice === "none" || !docChoiceResId) {
      setDocChoiceOpen(false);
      onOpenChange(false);
      return;
    }
    setDocIssuing(true);
    try {
      if (choice === "vat") {
        const result = await createVatInvoice(docChoiceResId);
        if (result.success && result.data) {
          toast.success(`Faktura VAT ${result.data.number} – ${result.data.amountGross.toFixed(2)} PLN`);
          const printWindow = window.open(`/api/finance/invoice/${result.data.id}/pdf`, "_blank");
          if (printWindow) {
            printWindow.addEventListener("load", () => {
              setTimeout(() => printWindow.print(), 500);
            });
          }
        } else {
          toast.error("error" in result ? result.error : "Błąd wystawiania faktury");
        }
      } else {
        const result = await printFiscalReceiptForReservation(docChoiceResId);
        if (result.success) {
          window.dispatchEvent(new CustomEvent(FISCAL_JOB_ENQUEUED_EVENT));
          toast.success(result.data?.receiptNumber
            ? `Paragon wydrukowany: ${result.data.receiptNumber}`
            : "Paragon wysłany do kasy fiskalnej (POSNET)");
        } else {
          toast.error("error" in result ? result.error : "Błąd druku paragonu");
        }
      }
    } finally {
      setDocIssuing(false);
      setDocChoiceOpen(false);
      onOpenChange(false);
    }
  }, [docChoiceResId, onOpenChange]);

  if (isEdit && !reservation) return null;
  if (!isEdit && !createContext) return null;

  const title = isEdit
    ? `Edycja rezerwacji · ${reservation!.guestName} · Pokój ${reservation!.room}`
    : "Nowa rezerwacja";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UnifiedReservationTab)} className="mt-1 flex flex-col min-h-0 flex-1">
          <TabsList className="w-full justify-start shrink-0">
            <TabsTrigger value="rozliczenie">Rozliczenie</TabsTrigger>
            <TabsTrigger value="dokumenty" disabled={!isEdit}>Dokumenty</TabsTrigger>
            <TabsTrigger value="posilki" disabled={!isEdit}>Posiłki</TabsTrigger>
            <TabsTrigger value="meldunek" disabled={!isEdit}>Meldunek</TabsTrigger>
          </TabsList>

          <TabsContent value="rozliczenie" className="mt-2 flex-1 min-h-0 overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <SettlementTab
                mode={mode}
                form={form}
                onFormChange={onFormChange}
                reservation={reservation}
                rooms={rooms}
                rateCodes={rateCodes}
                parkingSpots={parkingSpots}
                effectivePricePerNight={effectivePricePerNight}
                isNonRefundable={isNonRefundable}
                guestSuggestions={guestSuggestions}
                suggestionsOpen={suggestionsOpen}
                suggestionsField={suggestionsField}
                highlightedIdx={highlightedIdx}
                onSelectGuest={selectGuest}
                onGuestKeyDown={handleGuestKeyDown}
                onSearchGuest={searchGuest}
                onSuggestionsOpenChange={setSuggestionsOpen}
                guestInputRef={guestInputRef}
                nipLookupLoading={nipLookupLoading}
                onNipLookup={handleNipLookup}
              />

              {error && <p data-testid="create-reservation-error" className="mt-2 text-xs text-destructive">{error}</p>}

              <DialogFooter className="mt-3 gap-1 sm:gap-0 border-t pt-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>Anuluj</Button>
                {isEdit && reservation && reservation.status !== "CANCELLED" && reservation.status !== "CHECKED_OUT" && (
                  <Button type="button" variant="destructive" size="sm" className="h-7 text-xs" disabled={checkoutLoading}
                    onClick={handleFullCheckout}>
                    {checkoutLoading ? "Rozliczanie…" : "💳 Rozlicz i wymelduj"}
                  </Button>
                )}
                <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" disabled={saving}
                  onClick={() => { saveAndPrintRef.current = true; handleSubmit(); }}
                  title="Ctrl+Shift+Enter">
                  {saving && saveAndPrintRef.current ? "Zapisywanie…" : "🖨️ Zapisz i drukuj"}
                </Button>
                <Button ref={saveBtnRef} type="submit" size="sm" className="h-7 text-xs" disabled={saving} title="Ctrl+Enter" data-testid="create-reservation-save">
                  {saving && !saveAndPrintRef.current ? "Zapisywanie…" : "💾 Zapisz"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="dokumenty" className="mt-2 flex-1 min-h-0 overflow-y-auto">
            {isEdit && reservation && <DocumentsTab reservationId={reservation.id} />}
          </TabsContent>

          <TabsContent value="posilki" className="mt-2 flex-1 min-h-0 overflow-y-auto">
            {isEdit && reservation && <MealsTab reservationId={reservation.id} />}
          </TabsContent>

          <TabsContent value="meldunek" className="mt-2 flex-1 min-h-0 overflow-y-auto">
            {isEdit && reservation && (
              <CheckinTab
                onGuestNameFromOcr={(name) => onFormChange({ guestName: name })}
                onMrzParsed={() => {}}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Post-checkout: document choice */}
      <Dialog open={docChoiceOpen} onOpenChange={(open) => { if (!open) handleDocChoice("none"); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Gość wymeldowany — wystawić dokument?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Gość został wymeldowany. Wybierz jaki dokument wystawić:
          </p>
          <div className="flex flex-col gap-2 mt-2">
            <Button variant="default" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing}
              onClick={() => handleDocChoice("vat")}>
              📄 Faktura VAT (PDF) — drukuj
            </Button>
            <Button variant="secondary" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing}
              onClick={() => handleDocChoice("posnet")}>
              🧾 Paragon (kasa fiskalna POSNET)
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing}
              onClick={() => handleDocChoice("none")}>
              Bez dokumentu
            </Button>
          </div>
          {docIssuing && <p className="text-xs text-muted-foreground mt-2">Wystawianie dokumentu…</p>}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
