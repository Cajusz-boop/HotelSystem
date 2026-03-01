"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SettlementTabRef } from "./tabs/settlement-tab";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createReservation, updateReservation, updateReservationStatus, getCheckoutBalanceWarning, findGuestsForCheckIn, getReservationCompany, getReservationEditData, deleteReservation, type GuestCheckInSuggestion } from "@/app/actions/reservations";
import { postRoomChargeOnCheckout, createVatInvoice, printFiscalReceiptForReservation, getTransactionsForReservation, getReservationDayRates, saveReservationDayRates } from "@/app/actions/finance";
import { lookupCompanyByNip } from "@/app/actions/companies";
import { getEffectivePriceForRoomOnDate, getRatePlanInfoForRoomDate } from "@/app/actions/rooms";
import { getRateCodes, type RateCodeForUi } from "@/app/actions/rate-codes";
import { getParkingSpotsForSelect } from "@/app/actions/parking";
import { toast } from "sonner";
import { FISCAL_JOB_ENQUEUED_EVENT } from "@/components/fiscal-relay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X, ChevronDown, AlertTriangle } from "lucide-react";
import type { Reservation } from "@/lib/tape-chart-types";
import type { ReservationSource, ReservationChannel, MealPlan, MarketSegment } from "@/lib/validations/schemas";
import { SettlementTab, type SettlementTabFormState } from "./tabs/settlement-tab";
import { DocumentsTab } from "./tabs/documents-tab";
import { MealsTab } from "./tabs/meals-tab";
import { CheckinTab } from "./tabs/checkin-tab";
import { UslugiTab } from "./tabs/uslugi-tab";
import { GrafikSprzatanTab } from "./tabs/grafik-sprzatan-tab";
import { PozostaleTab } from "./tabs/pozostale-tab";
import { ParkingTab } from "./tabs/parking-tab";
import { WlasneTab } from "./tabs/wlasne-tab";

export type UnifiedReservationTab = "rozliczenie" | "dokumenty" | "posilki" | "parking" | "pozostale" | "wlasne" | "uslugi" | "grafik-sprzatan" | "meldunek";

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
  /** Edit mode: when reservation is deleted */
  onDeleted?: (reservationId: string) => void;
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
  roomType: "",
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
  segment: "",
  externalReservationNumber: "",
  currency: "PLN",
  reminderDate: "",
  reminderTime: "",
  showNotesOnChart: false,
  billingMode: "room",
  pricePerChild: "",
  discountPercent: "0",
  addLocalTax: false,
  cardGuaranteed: false,
  depositDueDate: "",
  paymentAmount: "",
  paymentMethod: "CASH",
  extraStatus: "",
  voucherAmount: "",
  voucherType: "BON_TURYSTYCZNY",
  advanceAmount: "",
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
  onDeleted,
  effectivePricePerNight: effectivePriceProp,
  initialTab,
}: UnifiedReservationDialogProps) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState<SettlementTabFormState>(INITIAL_FORM);
  const [activeTab, setActiveTab] = useState<UnifiedReservationTab>("rozliczenie");
  const settlementTabRef = useRef<SettlementTabRef>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateCodes, setRateCodes] = useState<RateCodeForUi[]>([]);
  const [parkingSpots, setParkingSpots] = useState<{ id: string; number: string }[]>([]);
  const [effectivePricePerNight, setEffectivePricePerNight] = useState<number | undefined>(undefined);
  const [isNonRefundable, setIsNonRefundable] = useState(false);
  const [nipLookupLoading, setNipLookupLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [docChoiceOpen, setDocChoiceOpen] = useState(false);
  const [docChoiceResId, setDocChoiceResId] = useState<string | null>(null);
  const [_docChoiceGuestName, setDocChoiceGuestName] = useState("");
  const [docIssuing, setDocIssuing] = useState(false);
  const [issueDocMenuOpen, setIssueDocMenuOpen] = useState(false);
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false);
  const [paymentsList, setPaymentsList] = useState<Array<{ id: string; amount: number; type: string; createdAt: string }>>([]);
  const [dayRatesDialogOpen, setDayRatesDialogOpen] = useState(false);
  const [dayRates, setDayRates] = useState<Array<{ date: string; rate: number }>>([]);
  const [dayRatesSaving, setDayRatesSaving] = useState(false);
  const [isInClosedPeriod, setIsInClosedPeriod] = useState(false);
  const [canEditClosedPeriod, setCanEditClosedPeriod] = useState(false);

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
        roomType: rooms.find((r) => r.number === reservation.room)?.type ?? "",
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
      // Załaduj dane do edycji (email, telefon, źródło, kanał, wyżywienie, itp.)
      getReservationEditData(reservation.id).then((r) => {
        if (r.success && r.data) {
          const d = r.data;
          const remAt = d.reminderAt ? new Date(d.reminderAt) : null;
          setForm((prev) => ({
            ...prev,
            guestEmail: d.guestEmail ?? "",
            guestPhone: d.guestPhone ?? "",
            source: d.source ?? "PHONE",
            channel: d.channel ?? "DIRECT",
            mealPlan: d.mealPlan ?? "BB",
            adults: d.adults != null ? String(d.adults) : "1",
            children: d.children != null ? String(d.children) : "0",
            eta: d.eta ?? "14:00",
            internalNotes: d.internalNotes ?? "",
            segment: d.marketSegment ?? "",
            externalReservationNumber: d.externalReservationNumber ?? "",
            currency: d.currency ?? "PLN",
            reminderDate: remAt ? remAt.toISOString().slice(0, 10) : "",
            reminderTime: remAt ? `${String(remAt.getHours()).padStart(2, "0")}:${String(remAt.getMinutes()).padStart(2, "0")}` : "",
            showNotesOnChart: d.notesVisibleOnChart ?? false,
            extraStatus: d.extraStatus ?? "",
            depositDueDate: d.advanceDueDate ?? "",
          }));
          setIsInClosedPeriod(d.isInClosedPeriod ?? false);
          setCanEditClosedPeriod(d.canEditClosedPeriod ?? false);
        }
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
        roomType: "",
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
    if (!isEdit) {
      setIsInClosedPeriod(false);
      setCanEditClosedPeriod(false);
    }
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
        const adultsVal = form.adults !== "" ? parseInt(form.adults, 10) : 1;
        const childrenVal = form.children !== "" ? parseInt(form.children, 10) : 0;
        const paxVal = form.pax !== "" ? parseInt(form.pax, 10) : (adultsVal + childrenVal);
        const result = await updateReservation(reservation.id, {
          guestName: form.guestName.trim() || undefined,
          guestEmail: form.guestEmail.trim() || undefined,
          guestPhone: form.guestPhone.trim() || undefined,
          room: form.room.trim() || undefined,
          checkIn: form.checkIn || undefined,
          checkOut: form.checkOut || undefined,
          checkInTime: form.checkInTime.trim() || undefined,
          checkOutTime: form.checkOutTime.trim() || undefined,
          status: form.status as Reservation["status"],
          pax: paxVal > 0 ? paxVal : undefined,
          bedsBooked: roomBeds > 1 ? (form.bedsBooked !== "" ? parseInt(form.bedsBooked, 10) : null) : undefined,
          rateCodeId: form.rateCodeId || undefined,
          rateCodePrice: form.rateCodePrice ? parseFloat(form.rateCodePrice) : undefined,
          parkingSpotId: form.parkingSpotId || null,
          notes: form.notes.trim() || null,
          internalNotes: form.internalNotes.trim() || null,
          source: (form.source || undefined) as ReservationSource | undefined,
          channel: (form.channel || undefined) as ReservationChannel | undefined,
          mealPlan: (form.mealPlan || undefined) as MealPlan | undefined,
          adults: adultsVal,
          children: childrenVal,
          eta: form.eta.trim() || undefined,
          marketSegment: (form.segment?.trim() || undefined) as MarketSegment | undefined,
          externalReservationNumber: form.externalReservationNumber?.trim() || undefined,
          currency: form.currency?.trim() || undefined,
          reminderAt: form.reminderDate && form.reminderTime ? `${form.reminderDate}T${form.reminderTime}:00` : undefined,
          notesVisibleOnChart: form.showNotesOnChart,
          extraStatus: form.extraStatus?.trim() || undefined,
          advanceDueDate: form.depositDueDate?.trim() || undefined,
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

  const handleDeleteReservation = useCallback(async () => {
    if (!reservation?.id) return;
    setDeleteLoading(true);
    try {
      const result = await deleteReservation(reservation.id, deleteReason.trim() || undefined);
      if (result.success) {
        toast.success("Rezerwacja usunięta");
        onDeleted?.(reservation.id);
        setDeleteDialogOpen(false);
        setDeleteReason("");
        onOpenChange(false);
      } else {
        toast.error("error" in result ? result.error : "Błąd usuwania rezerwacji");
      }
    } finally {
      setDeleteLoading(false);
    }
  }, [reservation?.id, onDeleted, onOpenChange, deleteReason]);

  const handleFullCheckout = useCallback(async () => {
    if (!reservation?.id) return;
    setCheckoutLoading(true);
    try {
      if (reservation.status === "CONFIRMED") {
        const checkinResult = await updateReservationStatus(reservation.id, "CHECKED_IN");
        if (!checkinResult.success) {
          toast.error("error" in checkinResult ? checkinResult.error : "Błąd meldunku");
          return;
        }
        toast.success("Zameldowano gościa");
      }

      const chargeResult = await postRoomChargeOnCheckout(reservation.id);
      if (chargeResult.success && chargeResult.data && !chargeResult.data.skipped) {
        toast.success(`Naliczono nocleg: ${chargeResult.data.amount?.toFixed(2)} PLN`);
      }

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

  const handleIssueDoc = useCallback(async (choice: "vat" | "posnet" | "proforma" | "potwierdzenie") => {
    if (!reservation?.id) return;
    if (choice === "proforma" || choice === "potwierdzenie") {
      toast.info("Funkcja w przygotowaniu (Proforma / Potwierdzenie rezerwacji)");
      setIssueDocMenuOpen(false);
      return;
    }
    setDocIssuing(true);
    setIssueDocMenuOpen(false);
    try {
      if (choice === "vat") {
        const result = await createVatInvoice(reservation.id);
        if (result.success && result.data) {
          toast.success(`Faktura VAT ${result.data.number} – ${result.data.amountGross.toFixed(2)} PLN`);
          const printWindow = window.open(`/api/finance/invoice/${result.data.id}/pdf`, "_blank");
          if (printWindow) printWindow.addEventListener("load", () => { setTimeout(() => printWindow.print(), 500); });
        } else toast.error("error" in result ? result.error : "Błąd wystawiania faktury");
      } else {
        const result = await printFiscalReceiptForReservation(reservation.id);
        if (result.success) {
          window.dispatchEvent(new CustomEvent(FISCAL_JOB_ENQUEUED_EVENT));
          toast.success(result.data?.receiptNumber ? `Paragon: ${result.data.receiptNumber}` : "Paragon wysłany do kasy");
        } else toast.error("error" in result ? result.error : "Błąd druku paragonu");
      }
    } finally {
      setDocIssuing(false);
    }
  }, [reservation?.id]);

  if (isEdit && !reservation) return null;
  if (!isEdit && !createContext) return null;

  const title = isEdit
    ? `Edycja rezerwacji${reservation!.confirmationNumber ? ` nr ${reservation!.confirmationNumber}` : ""} · ${reservation!.guestName} · Pokój ${reservation!.room}`
    : "Nowa rezerwacja";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[1150px] min-w-[950px] max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="relative px-6 pt-6 pb-2 shrink-0 border-b flex flex-row items-center justify-between gap-2">
          <DialogTitle className="text-base font-semibold pr-8">{title}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" aria-label="Zamknij">
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </DialogHeader>

        {/* Banner o zamkniętym okresie */}
        {isEdit && isInClosedPeriod && (
          <div className={`mx-4 mt-3 p-3 rounded-md border-l-4 flex items-start gap-3 ${
            canEditClosedPeriod 
              ? "bg-blue-50 border-blue-500 text-blue-800" 
              : "bg-amber-50 border-amber-500 text-amber-800"
          }`}>
            <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${canEditClosedPeriod ? "text-blue-500" : "text-amber-500"}`} />
            <div className="text-sm">
              {canEditClosedPeriod ? (
                <>
                  <span className="font-medium">Rezerwacja w zamkniętym okresie (po Night Audit).</span>
                  <br />
                  <span>Edycja możliwa dzięki specjalnym uprawnieniom.</span>
                </>
              ) : (
                <>
                  <span className="font-medium">Nie można edytować rezerwacji w zamkniętym okresie (po Night Audit).</span>
                  <br />
                  <span>Skontaktuj się z administratorem, aby uzyskać uprawnienia do edycji.</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Banner błędu */}
        {error && (
          <div data-testid="create-reservation-error" className="mx-4 mt-3 p-3 rounded-md border-l-4 bg-red-50 border-red-500 text-red-800 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEWA KOLUMNA (40%) - Formularz */}
          <div className="w-[40%] min-w-0 overflow-y-auto bg-muted/30 border-r flex-shrink-0">
            <form id="reservation-form" onSubmit={handleSubmit} className="p-4 space-y-6">
              <fieldset disabled={isEdit && isInClosedPeriod && !canEditClosedPeriod} className="space-y-6">
              <SettlementTab
                ref={settlementTabRef}
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
                layout="form"
              />
              </fieldset>
            </form>
          </div>

          {/* PRAWA KOLUMNA (60%) - Zakładki */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UnifiedReservationTab)} className="flex-1 flex flex-col min-h-0">
              <TabsList className="flex w-full overflow-x-auto flex-nowrap shrink-0 rounded-none border-b px-4 gap-0 h-auto min-h-9 mb-2 [&>button]:shrink-0">
                <TabsTrigger value="rozliczenie" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Rozlicz.</TabsTrigger>
                <TabsTrigger value="dokumenty" disabled={!isEdit} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Dok.</TabsTrigger>
                <TabsTrigger value="posilki" disabled={!isEdit} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Posiłki</TabsTrigger>
                <TabsTrigger value="parking" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Parking</TabsTrigger>
                <TabsTrigger value="pozostale" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Inne</TabsTrigger>
                <TabsTrigger value="wlasne" disabled={!isEdit} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Własne</TabsTrigger>
                <TabsTrigger value="uslugi" disabled={!isEdit} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Usługi</TabsTrigger>
                <TabsTrigger value="grafik-sprzatan" disabled={!isEdit} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Sprzątanie</TabsTrigger>
                <TabsTrigger value="meldunek" disabled={!isEdit} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Meld.</TabsTrigger>
              </TabsList>

              <TabsContent value="rozliczenie" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
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
                  layout="rozliczenie"
                />
              </TabsContent>

              <TabsContent value="dokumenty" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                {isEdit && reservation && <DocumentsTab reservationId={reservation.id} />}
              </TabsContent>

              <TabsContent value="posilki" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                {isEdit && reservation && <MealsTab reservationId={reservation.id} />}
              </TabsContent>

              <TabsContent value="parking" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                <ParkingTab
                  parkingSpotId={form.parkingSpotId}
                  parkingSpots={parkingSpots}
                  onParkingChange={(id) => onFormChange({ parkingSpotId: id })}
                />
              </TabsContent>

              <TabsContent value="pozostale" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                <PozostaleTab form={form} onFormChange={onFormChange} reservationId={isEdit ? reservation?.id : undefined} />
              </TabsContent>

              <TabsContent value="wlasne" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                <WlasneTab />
              </TabsContent>

              <TabsContent value="meldunek" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                {isEdit && reservation && (
                  <CheckinTab
                    onGuestNameFromOcr={(name) => onFormChange({ guestName: name })}
                    onMrzParsed={() => {}}
                  />
                )}
              </TabsContent>

              <TabsContent value="uslugi" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                <UslugiTab />
              </TabsContent>

              <TabsContent value="grafik-sprzatan" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                <GrafikSprzatanTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* FOOTER - sticky przyciski (KWHotel: Towary, Wystaw dokument, Ceny/dni, Płatności, Historia, Zapisz) */}
        <footer className="shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {isEdit && reservation && (
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => settlementTabRef.current?.openAddCharge?.()}>
                Towary
              </Button>
            )}
            {isEdit && reservation && (
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIssueDocMenuOpen(true)}>
                Wystaw dokument <ChevronDown className="ml-0.5 h-3 w-3 inline" />
              </Button>
            )}
            {isEdit && reservation && (
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                setDayRatesDialogOpen(true);
                if (reservation?.id && form.checkIn && form.checkOut) {
                  getReservationDayRates(reservation.id, form.checkIn, form.checkOut).then((r) => {
                    if (r.success && r.data) setDayRates(r.data);
                  });
                }
              }}>
                Ceny / dni
              </Button>
            )}
            {isEdit && reservation && (
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                setPaymentsDialogOpen(true);
                if (reservation?.id) {
                  getTransactionsForReservation(reservation.id).then((r) => {
                    if (r.success && r.data) setPaymentsList(r.data);
                    else setPaymentsList([]);
                  });
                }
              }}>
                Płatności
              </Button>
            )}
            {isEdit && reservation && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={saving || deleteLoading}
              >
                🗑 Usuń rezerwację
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEdit && reservation && reservation.status !== "CANCELLED" && reservation.status !== "CHECKED_OUT" && (
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white border-orange-600" disabled={checkoutLoading} onClick={handleFullCheckout}>
                {checkoutLoading ? "Rozliczanie…" : "Rozlicz i wymelduj"}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200" disabled={saving || (isEdit && isInClosedPeriod && !canEditClosedPeriod)} onClick={() => { saveAndPrintRef.current = true; handleSubmit(); }} title="Ctrl+Shift+Enter">
              {saving && saveAndPrintRef.current ? "Zapisywanie…" : "Zapisz i drukuj"}
            </Button>
            <Button ref={saveBtnRef} type="submit" form="reservation-form" size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" disabled={saving || (isEdit && isInClosedPeriod && !canEditClosedPeriod)} title="Ctrl+Enter" data-testid="create-reservation-save">
              {saving && !saveAndPrintRef.current ? "Zapisywanie…" : "💾 Zapisz"}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
          </div>
        </footer>
      </DialogContent>

      {/* Potwierdzenie usunięcia */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteReason(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno usunąć rezerwację?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta operacja jest nieodwracalna. Rezerwacja zostanie trwale usunięta z systemu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label htmlFor="delete-reason" className="text-sm font-medium">
              Powód usunięcia <span className="text-destructive">(wymagane)</span>
            </label>
            <textarea
              id="delete-reason"
              className="mt-1.5 w-full min-h-[80px] rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="np. rezygnacja gościa, błąd rezerwacji…"
              maxLength={500}
              disabled={deleteLoading}
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReservation}
              disabled={deleteLoading || !deleteReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading ? "Usuwanie…" : "Usuń"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <Button variant="default" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleDocChoice("vat")}>
              📄 Faktura VAT (PDF) — drukuj
            </Button>
            <Button variant="secondary" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleDocChoice("posnet")}>
              🧾 Paragon (kasa fiskalna POSNET)
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleDocChoice("none")}>
              Bez dokumentu
            </Button>
          </div>
          {docIssuing && <p className="text-xs text-muted-foreground mt-2">Wystawianie dokumentu…</p>}
        </DialogContent>
      </Dialog>

      {/* Menu: Wystaw dokument (z footera) */}
      <Dialog open={issueDocMenuOpen} onOpenChange={setIssueDocMenuOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Wystaw dokument</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button variant="default" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleIssueDoc("vat")}>
              📄 Faktura VAT
            </Button>
            <Button variant="secondary" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleIssueDoc("posnet")}>
              🧾 Paragon
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs justify-start text-muted-foreground" onClick={() => handleIssueDoc("proforma")}>
              Proforma (w przygotowaniu)
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs justify-start text-muted-foreground" onClick={() => handleIssueDoc("potwierdzenie")}>
              Potwierdzenie rezerwacji (w przygotowaniu)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Płatności – historia transakcji */}
      <Dialog open={paymentsDialogOpen} onOpenChange={setPaymentsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Historia płatności / transakcji</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto text-sm">
            {paymentsList.length === 0 ? (
              <p className="text-muted-foreground">Brak transakcji.</p>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 font-medium">Data</th>
                    <th className="text-left py-1.5 font-medium">Typ</th>
                    <th className="text-right py-1.5 font-medium">Kwota</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsList.map((t) => (
                    <tr key={t.id} className="border-b border-border/50">
                      <td className="py-1">{new Date(t.createdAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="py-1">{t.type}</td>
                      <td className="py-1 text-right tabular-nums">{Number(t.amount).toFixed(2)} PLN</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Ceny za poszczególne dni */}
      <Dialog open={dayRatesDialogOpen} onOpenChange={(open) => { setDayRatesDialogOpen(open); if (!open) setDayRates([]); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ceny za poszczególne dni</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 font-medium">Data</th>
                  <th className="text-left py-1.5 font-medium">Dzień</th>
                  <th className="text-right py-1.5 font-medium">Cena/doba (PLN)</th>
                </tr>
              </thead>
              <tbody>
                {dayRates.map((row, i) => (
                  <tr key={row.date} className="border-b border-border/50">
                    <td className="py-1">{new Date(row.date + "T12:00:00").toLocaleDateString("pl-PL")}</td>
                    <td className="py-1">{["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"][new Date(row.date + "T12:00:00").getDay()]}</td>
                    <td className="py-1 text-right">
                      <Input type="number" min={0} step={0.01} className="h-8 w-24 text-right text-xs" value={row.rate || ""} onChange={(e) => {
                        const v = e.target.value ? parseFloat(e.target.value) : 0;
                        setDayRates((prev) => prev.map((r, j) => j === i ? { ...r, rate: v } : r));
                      }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dayRates.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Średnia: {(dayRates.reduce((s, r) => s + r.rate, 0) / (dayRates.length || 1)).toFixed(2)} · Suma: {dayRates.reduce((s, r) => s + r.rate, 0).toFixed(2)} PLN
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDayRatesDialogOpen(false)}>Anuluj</Button>
            <Button size="sm" disabled={dayRatesSaving || !reservation?.id} onClick={async () => {
              if (!reservation?.id) return;
              setDayRatesSaving(true);
              const result = await saveReservationDayRates(reservation.id, dayRates);
              setDayRatesSaving(false);
              if (result.success) { toast.success("Zapisano ceny za dni"); setDayRatesDialogOpen(false); }
              else toast.error("error" in result ? result.error : "Błąd zapisu");
            }}>{dayRatesSaving ? "Zapisywanie…" : "Zapisz"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
