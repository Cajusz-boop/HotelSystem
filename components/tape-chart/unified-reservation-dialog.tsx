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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const DOC_PAYMENT_LABELS: Record<string, string> = {
  CASH: "Gotówka",
  CARD: "Karta",
  TRANSFER: "Przelew",
  PREPAID: "Przedpłata",
};
import { createReservation, updateReservation, updateReservationStatus, getCheckoutBalanceWarning, findGuestsForCheckIn, getReservationCompany, getReservationEditData, deleteReservation, type GuestCheckInSuggestion } from "@/app/actions/reservations";
import { postRoomChargeOnCheckout, getInvoicesForReservation, createVatInvoice, createSplitVatInvoices, createProforma, printFiscalReceiptForReservation, printFiscalReceiptForReservations, getTransactionsForReservation, getReservationDayRates, saveReservationDayRates, overrideRoomPrice, getConsolidatedFolioSummary } from "@/app/actions/finance";
import { lookupCompanyByNip, createConsolidatedVatInvoice } from "@/app/actions/companies";
import { validateNipOrVat } from "@/lib/nip-vat-validate";
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
const EVENT_TYPE_LABELS_BANNER: Record<string, string> = {
  WESELE: "Wesele", KOMUNIA: "Komunia", CHRZCINY: "Chrzciny",
  URODZINY: "Urodziny", STYPA: "Stypa", FIRMOWA: "Firmowa",
  SYLWESTER: "Sylwester", INNE: "Impreza",
};
const STATUS_LABELS_EVENT_BANNER: Record<string, string> = {
  DRAFT: "Szkic", CONFIRMED: "Potwierdzone", DONE: "Wykonane", CANCELLED: "Anulowane",
};
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

function ConsolidatedSettlementContent({ reservationIds }: { reservationIds: string[] }) {
  const [data, setData] = useState<{ reservationSummaries: Array<{ reservationId: string; room?: string; balance: number }>; totalAmount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!reservationIds.length) { setData(null); setLoading(false); return; }
    setLoading(true);
    getConsolidatedFolioSummary(reservationIds).then((r) => {
      if (r.success && r.data) setData(r.data);
      else setData(null);
      setLoading(false);
    });
  }, [reservationIds.join(",")]);
  if (loading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Brak danych.</p>;
  return (
    <div className="space-y-4">
      <div className="rounded border bg-muted/20 p-3 text-xs">
        <h3 className="font-semibold text-muted-foreground border-b pb-1 mb-2">Podsumowanie (faktura zbiorcza)</h3>
        <ul className="space-y-1">
          {data.reservationSummaries.map((rs) => (
            <li key={rs.reservationId} className="flex justify-between">
              <span>Pokój {rs.room ?? "—"}</span>
              <span className="tabular-nums">{rs.balance.toFixed(2)} PLN</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-bold border-t pt-2 mt-2">
          <span>Razem</span>
          <span className="tabular-nums">{data.totalAmount.toFixed(2)} PLN</span>
        </div>
      </div>
    </div>
  );
}

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
  /** Wywoływane po zarejestrowaniu wpłaty – aby odświeżyć kolor paska (paymentStatus) na grafiku */
  onPaymentRecorded?: (reservationId: string, paymentStatus?: string) => void;
  effectivePricePerNight?: number;
  initialTab?: UnifiedReservationTab;
  /** Tryb faktury zbiorczej: lista ID rezerwacji + primary (dane firmy, gościa) */
  consolidatedReservationIds?: string[];
  primaryReservation?: Reservation | null;
}

function addDays(dateStr: string, days: number): string {
  if (!dateStr || typeof dateStr !== "string") return "";
  const d = new Date(dateStr.trim() + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return dateStr;
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
  invoiceSingleLine: true,
  invoiceScope: "ALL",
  paidAmountOverride: "",
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
  onPaymentRecorded,
  effectivePricePerNight: effectivePriceProp,
  initialTab,
  consolidatedReservationIds,
  primaryReservation,
}: UnifiedReservationDialogProps) {
  const isEdit = mode === "edit";
  const isConsolidated = !!(consolidatedReservationIds?.length && primaryReservation);
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
  const [settleLoading, setSettleLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [docChoiceOpen, setDocChoiceOpen] = useState(false);
  const [docChoiceResId, setDocChoiceResId] = useState<string | null>(null);
  const [docChoiceResIds, setDocChoiceResIds] = useState<string[]>([]);
  const [_docChoiceGuestName, setDocChoiceGuestName] = useState("");
  const [docIssuing, setDocIssuing] = useState(false);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [docAmountOverride, setDocAmountOverride] = useState("");
  const [docRoomTotal, setDocRoomTotal] = useState<number | null>(null);
  const [docTotalAmount, setDocTotalAmount] = useState<number | null>(null);
  const [docAmountInvoice, setDocAmountInvoice] = useState("");
  const [docAmountReceipt, setDocAmountReceipt] = useState("");
  const [docPaymentMethod, setDocPaymentMethod] = useState<string>("CASH");
  const [issueDocMenuOpen, setIssueDocMenuOpen] = useState(false);
  const [splitInvoiceDialogOpen, setSplitInvoiceDialogOpen] = useState(false);
  const [additionalInvoiceDialogOpen, setAdditionalInvoiceDialogOpen] = useState(false);
  const [additionalInvoiceData, setAdditionalInvoiceData] = useState<{
    resId: string;
    scope: "HOTEL_ONLY" | "GASTRONOMY_ONLY";
    existingNumber: string;
    notes: string;
    suggestedAmount: number | null;
  } | null>(null);
  const [additionalInvoiceAmount, setAdditionalInvoiceAmount] = useState("");
  const [additionalInvoiceIssuing, setAdditionalInvoiceIssuing] = useState(false);
  const [splitHotelAmount, setSplitHotelAmount] = useState("");
  const [splitGastronomyAmount, setSplitGastronomyAmount] = useState("");
  const [splitReceiptAmount, setSplitReceiptAmount] = useState("");
  const [splitReceiptPaymentMethod, setSplitReceiptPaymentMethod] = useState<string>("CASH");
  const [splitInvoiceNotes, setSplitInvoiceNotes] = useState("");
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false);
  const [paymentsList, setPaymentsList] = useState<Array<{ id: string; amount: number; type: string; createdAt: string }>>([]);
  const [dayRatesDialogOpen, setDayRatesDialogOpen] = useState(false);
  const [dayRates, setDayRates] = useState<Array<{ date: string; rate: number }>>([]);
  const [dayRatesSaving, setDayRatesSaving] = useState(false);
  /** W trybie edycji: true gdy są niezapisane zmiany; po Zapisz ustawiane na false, okno pozostaje otwarte */
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [eventOrderId, setEventOrderId] = useState<string | null>(null);

  // Guest autocomplete
  const [guestSuggestions, setGuestSuggestions] = useState<GuestCheckInSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsField, setSuggestionsField] = useState<"name" | "email" | "phone">("name");
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const justSelectedRef = useRef(false);
  const guestInputRef = useRef<HTMLInputElement>(null);
  const saveAndPrintRef = useRef(false);
  const proformaAfterCreateRef = useRef(false);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const searchGuestRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const handleSubmitRef = useRef<() => Promise<void>>(() => Promise.resolve());

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
      setEventOrderId(reservation?.eventOrderId ?? null);
      getReservationEditData(reservation.id).then((r) => {
        if (r.success && r.data) {
          const d = r.data;
          setEventOrderId(d.eventOrderId ?? null);
          const remAt = d.reminderAt ? new Date(d.reminderAt) : null;
          setForm((prev) => ({
            ...prev,
            guestEmail: d.guestEmail ?? "",
            guestPhone: d.guestPhone ?? "",
            source: d.source ?? "PHONE",
            channel: d.channel ?? "DIRECT",
            mealPlan: d.mealPlan ?? "BB",
            adults: (d.adults != null && d.adults > 0) ? String(d.adults) : "1",
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
            invoiceSingleLine: d.invoiceSingleLine ?? true,
            invoiceScope: d.invoiceScope ?? "ALL",
            paidAmountOverride: d.paidAmountOverride != null ? String(d.paidAmountOverride) : "",
          }));
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
      setEventOrderId(null);
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
    setHasUnsavedChanges(!isEdit);
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

  // Gdy rezerwacja nie ma zapisanej ceny (rateCodePrice), uzupełnij z cennika – żeby "Do zapłaty" i Suma za pokój pokazywały kwotę tak jak w innych pokojach
  useEffect(() => {
    if (!open || !isEdit || !reservation) return;
    const hasSavedPrice = reservation.rateCodePrice != null && reservation.rateCodePrice > 0;
    if (hasSavedPrice) return;
    if (effectivePricePerNight == null || effectivePricePerNight <= 0) return;
    setForm((prev) => {
      if (prev.rateCodePrice.trim() !== "") return prev;
      return { ...prev, rateCodePrice: String(effectivePricePerNight) };
    });
  }, [open, isEdit, reservation?.id, reservation?.rateCodePrice, effectivePricePerNight]);

  // Fetch non-refundable flag
  useEffect(() => {
    if (!form.room.trim() || !form.checkIn) { setIsNonRefundable(false); return; }
    getRatePlanInfoForRoomDate(form.room.trim(), form.checkIn).then((info) => setIsNonRefundable(info.isNonRefundable));
  }, [form.room, form.checkIn]);

  const scheduleAutoSave = useCallback(() => {
    if (!isEdit || !reservation?.id) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      if (savingRef.current) return;
      handleSubmitRef.current();
    }, 800);
  }, [isEdit, reservation?.id]);

  const onFormChange = useCallback((patch: Partial<SettlementTabFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setHasUnsavedChanges(true);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

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
    setHasUnsavedChanges(true);
    scheduleAutoSave();
    setGuestSuggestions([]);
    setSuggestionsOpen(false);
    setHighlightedIdx(-1);
    requestAnimationFrame(() => saveBtnRef.current?.focus());
  }, [scheduleAutoSave]);

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

  // NIP / numer VAT UE lookup
  const handleNipLookup = useCallback(async () => {
    const validation = validateNipOrVat(form.nipInput.trim());
    if (!validation.ok) return;
    setNipLookupLoading(true);
    try {
      const result = await lookupCompanyByNip(form.nipInput.trim());
      if (result.success && result.data) {
        setForm((prev) => ({
          ...prev,
          companyName: result.data!.name ?? "",
          companyAddress: result.data!.address ?? "",
          companyPostalCode: result.data!.postalCode ?? "",
          companyCity: result.data!.city ?? "",
          companyFound: true,
        }));
        setHasUnsavedChanges(true);
        scheduleAutoSave();
      }
    } catch { /* ignore */ }
    finally { setNipLookupLoading(false); }
  }, [form.nipInput, scheduleAutoSave]);

  // Auto-lookup NIP (tylko polski – WL)
  useEffect(() => {
    const validation = validateNipOrVat(form.nipInput.trim());
    if (!validation.ok || form.companyFound) return;
    if (validation.normalized.length === 10) handleNipLookup();
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
    if (isEdit && !hasUnsavedChanges && !saveAndPrintRef.current) return;
    const nights = computeNights(form.checkIn, form.checkOut);
    if (nights <= 0) { setError("Data wymeldowania musi być po dacie zameldowania."); return; }

    setSaving(true);
    setError(null);

    try {
      if (isEdit && reservation) {
        const roomData = rooms.find((r) => r.number === form.room.trim());
        const roomBeds = roomData?.beds ?? 1;
        const nipValidation = validateNipOrVat(form.nipInput.trim());
        const hasCompany = nipValidation.ok && form.companyName.trim();
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
          invoiceSingleLine: form.invoiceSingleLine,
          invoiceScope: (form.invoiceScope || "ALL") as "ALL" | "HOTEL_ONLY" | "GASTRONOMY_ONLY",
          paidAmountOverride: (() => {
            const v = form.paidAmountOverride.trim();
            if (!v) return null;
            const n = parseFloat(v);
            return Number.isNaN(n) || n < 0 ? null : n;
          })(),
          ...(hasCompany ? {
            companyData: {
              nip: nipValidation!.normalized,
              name: form.companyName.trim(),
              address: form.companyAddress.trim() || undefined,
              postalCode: form.companyPostalCode.trim() || undefined,
              city: form.companyCity.trim() || undefined,
            },
          } : {}),
          eventOrderId: eventOrderId ?? null,
        });
        if (result.success && result.data) {
          onSaved?.(result.data as Reservation);
          if (saveAndPrintRef.current) {
            saveAndPrintRef.current = false;
            openRegistrationCard(reservation.id, true);
            onOpenChange(false);
          } else {
            setHasUnsavedChanges(false);
            toast.success("Zapisano zmiany.");
          }
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
        const nipValidation = validateNipOrVat(form.nipInput.trim());
        const hasCompany = nipValidation.ok && form.companyName.trim();

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
              nip: nipValidation!.normalized,
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
          if (proformaAfterCreateRef.current) {
            proformaAfterCreateRef.current = false;
            const nights = computeNights(form.checkIn, form.checkOut);
            const proformaAmount = (effectivePricePerNight ?? 0) * Math.max(1, nights);
            createProforma(createdRes.id, proformaAmount > 0 ? proformaAmount : undefined).then((proRes) => {
              if (proRes.success && proRes.data) {
                toast.success(`Proforma ${proRes.data.number} – ${proRes.data.amount.toFixed(2)} PLN`);
                window.open(`/finance/proforma/${proRes.data.id}`, "_blank");
              } else {
                toast.error(proRes.success === false ? proRes.error : "Błąd wystawiania proformy");
              }
            });
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
  }, [form, isEdit, reservation, rooms, onSaved, onCreated, onOpenChange, openRegistrationCard, hasUnsavedChanges, effectivePricePerNight, eventOrderId]);

  handleSubmitRef.current = handleSubmit;
  savingRef.current = saving;

  // Czyszczenie timera auto-zapisu przy zamknięciu dialogu
  useEffect(() => {
    if (!open) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [open]);

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

  const handleSettle = useCallback(async () => {
    if (!reservation?.id) return;
    setSettleLoading(true);
    try {
      await postRoomChargeOnCheckout(reservation.id);
      const existing = await getInvoicesForReservation(reservation.id);
      if (existing.success && existing.data && existing.data.length > 0) {
        toast.info("Dokument już wystawiony");
        return;
      }
      setDocChoiceResId(reservation.id);
      setDocChoiceGuestName(reservation.guestName);
      setDocChoiceOpen(true);
    } finally {
      setSettleLoading(false);
    }
  }, [reservation?.id, reservation?.guestName]);

  const handleCheckoutOnly = useCallback(async () => {
    if (!reservation?.id) return;
    const balanceResult = await getCheckoutBalanceWarning(reservation.id);
    if (balanceResult.success && balanceResult.data) {
      const d = balanceResult.data;
      if (d.balance > 0) {
        const proceed = window.confirm(
          `Nieopłacone saldo: ${d.balance.toFixed(2)} PLN\n` +
          `(Obciążenia: ${d.totalOwed.toFixed(2)} PLN, Wpłaty: ${d.totalPaid.toFixed(2)} PLN)\n\n` +
          (d.restaurantCount > 0 ? `Rachunki z restauracji: ${d.restaurantCount} szt. (${d.restaurantCharges.toFixed(2)} PLN)\n\n` : "") +
          `Czy wymeldować mimo salda?`
        );
        if (!proceed) return;
      }
    }
    setCheckoutLoading(true);
    try {
      if (reservation.status === "CONFIRMED") {
        const checkinResult = await updateReservationStatus(reservation.id, "CHECKED_IN");
        if (!checkinResult.success) {
          toast.error("error" in checkinResult ? checkinResult.error : "Błąd meldunku");
          return;
        }
      }
      const result = await updateReservationStatus(reservation.id, "CHECKED_OUT");
      if (result.success && result.data) {
        toast.success("Gość wymeldowany");
        onSaved?.(result.data as Reservation);
        onOpenChange(false);
      } else {
        toast.error("error" in result ? result.error : "Błąd wymeldowania");
      }
    } finally {
      setCheckoutLoading(false);
    }
  }, [reservation?.id, reservation?.status, onSaved, onOpenChange]);

  const CHARGE_TYPES = ["ROOM", "LOCAL_TAX", "MINIBAR", "GASTRONOMY", "SPA", "PARKING", "RENTAL", "PHONE", "LAUNDRY", "TRANSPORT", "ATTRACTION", "OTHER"];
  // Fetch charge total when doc choice dialog opens
  useEffect(() => {
    if (!docChoiceOpen) {
      setDocRoomTotal(null);
      setDocTotalAmount(null);
      setDocAmountOverride("");
      setDocAmountInvoice("");
      setDocAmountReceipt("");
      return;
    }
    if (docChoiceResIds.length > 0) {
      getConsolidatedFolioSummary(docChoiceResIds).then((r) => {
        if (r.success && r.data) {
          const total = r.data.totalAmount;
          const roomTotal = r.data.reservationSummaries.reduce((s, rs) => s + rs.balance, 0);
          setDocRoomTotal(roomTotal);
          setDocTotalAmount(Math.round(total * 100) / 100);
          setDocAmountOverride("");
          setDocAmountInvoice(total > 0 ? total.toFixed(2) : "");
          setDocAmountReceipt("");
        } else {
          setDocRoomTotal(null);
          setDocTotalAmount(null);
          setDocAmountInvoice("");
          setDocAmountReceipt("");
        }
      });
      return;
    }
    if (!docChoiceResId) {
      setDocRoomTotal(null);
      setDocTotalAmount(null);
      setDocAmountOverride("");
      setDocAmountInvoice("");
      setDocAmountReceipt("");
      return;
    }
    getTransactionsForReservation(docChoiceResId).then((r) => {
      if (r.success && r.data) {
        const totalCharges = r.data
          .filter((t) => CHARGE_TYPES.includes(t.type))
          .reduce((s, t) => s + t.amount, 0);
        const rounded = Math.round(totalCharges * 100) / 100;
        setDocRoomTotal(rounded);
        setDocTotalAmount(rounded);
        setDocAmountOverride("");
        setDocAmountInvoice(totalCharges > 0 ? totalCharges.toFixed(2) : "");
        setDocAmountReceipt("");
      } else {
        setDocRoomTotal(null);
        setDocTotalAmount(null);
        setDocAmountInvoice("");
        setDocAmountReceipt("");
      }
    });
  }, [docChoiceOpen, docChoiceResId, docChoiceResIds]);

  const handleDocChoice = useCallback(async (choice: "vat" | "posnet" | "both" | "none") => {
    const isConsolidatedChoice = docChoiceResIds.length > 0;
    if (choice === "none" || (!docChoiceResId && !isConsolidatedChoice)) {
      setDocChoiceOpen(false);
      setDocChoiceResIds([]);
      setInvoiceNotes("");
      setDocAmountOverride("");
      setDocAmountInvoice("");
      setDocAmountReceipt("");
      setDocPaymentMethod("CASH");
      setDocRoomTotal(null);
      setDocTotalAmount(null);
      onOpenChange(false);
      return;
    }
    setDocIssuing(true);
    try {
      const amtInv = docAmountInvoice.trim() ? parseFloat(docAmountInvoice) : 0;
      const amtRec = docAmountReceipt.trim() ? parseFloat(docAmountReceipt) : 0;
      const overrideVal = docAmountOverride.trim() ? parseFloat(docAmountOverride) : null;
      const effectiveTotal =
        overrideVal != null && Number.isFinite(overrideVal) && overrideVal > 0
          ? Math.round(overrideVal * 100) / 100
          : (docTotalAmount ?? 0);
      const total = effectiveTotal;
      const isSplit = choice === "both" && amtInv > 0 && amtRec > 0;
      const sumSplit = Math.round((amtInv + amtRec) * 100) / 100;
      if (isSplit) {
        if (Math.abs(sumSplit - total) > 0.01) {
          toast.error(`Suma (${sumSplit.toFixed(2)} PLN) musi być równa kwocie do zapłaty (${total.toFixed(2)} PLN).`);
          setDocIssuing(false);
          return;
        }
      } else {
        if (!isConsolidatedChoice && overrideVal != null && Number.isFinite(overrideVal) && overrideVal > 0 && docChoiceResId) {
          const or = await overrideRoomPrice(docChoiceResId, overrideVal);
          if (!or.success) {
            toast.error(or.error ?? "Błąd nadpisania ceny");
            setDocIssuing(false);
            return;
          }
          toast.success(`Cena nadpisana: ${or.data?.amount.toFixed(2)} PLN`);
        }
      }
      if (choice === "vat" || (choice === "both" && amtInv > 0)) {
        if (isConsolidatedChoice && primaryReservation?.companyId) {
          const result = await createConsolidatedVatInvoice({
            reservationIds: docChoiceResIds,
            companyId: primaryReservation.companyId,
            notes: invoiceNotes.trim() || undefined,
            paymentMethod: docPaymentMethod || "CASH",
          });
          if (result.success && result.data) {
            toast.success("Faktura zbiorcza VAT wystawiona");
            window.open(`/finance/invoice/${result.data.invoiceId}?autoPrint=1`, "_blank");
          } else {
            toast.error("error" in result ? result.error : "Błąd wystawiania faktury zbiorczej");
            setDocIssuing(false);
            return;
          }
        } else if (docChoiceResId) {
          const result = await createVatInvoice(docChoiceResId, undefined, {
            notes: invoiceNotes.trim() || undefined,
            amountGrossOverride: amtInv > 0 ? amtInv : undefined,
            paymentMethod: docPaymentMethod || "CASH",
          });
          if (result.success && result.data) {
            toast.success(`Faktura VAT ${result.data.number} – ${result.data.amountGross.toFixed(2)} PLN`);
            window.open(`/finance/invoice/${result.data.id}?autoPrint=1`, "_blank");
          } else {
            const err = "error" in result ? result.error : "Błąd wystawiania faktury";
            const hotelMatch = /Już istnieje faktura hotelowa: (.+?)(?:\.|$)/.exec(err);
            const gastronomyMatch = /Już istnieje faktura gastronomiczna: (.+?)(?:\.|$)/.exec(err);
            const match = hotelMatch ?? gastronomyMatch;
            if (match) {
              const scope: "HOTEL_ONLY" | "GASTRONOMY_ONLY" = hotelMatch ? "HOTEL_ONLY" : "GASTRONOMY_ONLY";
              const scopeLabel = scope === "HOTEL_ONLY" ? "hotelowa" : "gastronomiczna";
              setAdditionalInvoiceData({
                resId: docChoiceResId,
                scope,
                existingNumber: match[1].trim(),
                notes: invoiceNotes.trim() || "",
                suggestedAmount: docTotalAmount ?? null,
              });
              setAdditionalInvoiceAmount(docTotalAmount != null && docTotalAmount > 0 ? docTotalAmount.toFixed(2) : "");
              setAdditionalInvoiceDialogOpen(true);
            } else {
              toast.error(err);
            }
            setDocIssuing(false);
            return;
          }
        }
      }
      if (choice === "posnet" || (choice === "both" && amtRec > 0)) {
        if (docChoiceResId) {
          const result = await printFiscalReceiptForReservation(docChoiceResId, docPaymentMethod || "CASH", amtRec > 0 ? amtRec : undefined);
          if (result.success) {
            window.dispatchEvent(new CustomEvent(FISCAL_JOB_ENQUEUED_EVENT));
            toast.success(result.data?.receiptNumber
              ? `Paragon wydrukowany: ${result.data.receiptNumber}`
              : "Paragon wysłany do kasy fiskalnej (POSNET)");
            const copyUrl = `/api/finance/fiscal-receipt-copy?reservationId=${encodeURIComponent(docChoiceResId)}${amtRec > 0 ? `&amount=${amtRec}` : ""}`;
            const copyWindow = window.open(copyUrl, "_blank");
            if (copyWindow) {
              copyWindow.addEventListener("load", () => {
                setTimeout(() => copyWindow.print(), 500);
              });
            }
          } else {
            toast.error("error" in result ? result.error : "Błąd druku paragonu");
          }
        } else if (docChoiceResIds.length > 0) {
          const result = await printFiscalReceiptForReservations(docChoiceResIds, docPaymentMethod || "CASH", amtRec > 0 ? amtRec : undefined);
          if (result.success) {
            window.dispatchEvent(new CustomEvent(FISCAL_JOB_ENQUEUED_EVENT));
            toast.success(result.data?.receiptNumber
              ? `Paragon wydrukowany: ${result.data.receiptNumber}`
              : "Paragon wysłany do kasy fiskalnej (POSNET)");
            const copyUrl = `/api/finance/fiscal-receipt-copy?reservationId=${encodeURIComponent(docChoiceResIds[0])}${amtRec > 0 ? `&amount=${amtRec}` : ""}`;
            const copyWindow = window.open(copyUrl, "_blank");
            if (copyWindow) {
              copyWindow.addEventListener("load", () => {
                setTimeout(() => copyWindow.print(), 500);
              });
            }
          } else {
            toast.error("error" in result ? result.error : "Błąd druku paragonu");
          }
        }
      }
    } finally {
      setDocIssuing(false);
      setDocChoiceOpen(false);
      setDocChoiceResIds([]);
      setInvoiceNotes("");
      setDocAmountOverride("");
      setDocAmountInvoice("");
      setDocAmountReceipt("");
      setDocPaymentMethod("CASH");
      setDocRoomTotal(null);
      setDocTotalAmount(null);
      onOpenChange(false);
    }
  }, [docChoiceResId, docChoiceResIds, primaryReservation, docAmountOverride, docAmountInvoice, docAmountReceipt, docTotalAmount, invoiceNotes, docPaymentMethod, onOpenChange]);

  const handleIssueDoc = useCallback(async (choice: "vat" | "posnet" | "proforma" | "potwierdzenie") => {
    if (choice === "potwierdzenie") {
      toast.info("Funkcja w przygotowaniu (Potwierdzenie rezerwacji)");
      setIssueDocMenuOpen(false);
      return;
    }
    if (choice === "proforma") {
      setIssueDocMenuOpen(false);
      if (isEdit && reservation?.id) {
        setDocIssuing(true);
        try {
          const result = await createProforma(reservation.id);
          if (result.success && result.data) {
            toast.success(`Proforma ${result.data.number} – ${result.data.amount.toFixed(2)} PLN`);
            window.open(`/finance/proforma/${result.data.id}`, "_blank");
          } else {
            toast.error(result.success === false ? result.error : "Błąd wystawiania proformy");
          }
        } finally {
          setDocIssuing(false);
        }
      } else if (!isEdit) {
        proformaAfterCreateRef.current = true;
        handleSubmit();
      }
      return;
    }
    if (isConsolidated && consolidatedReservationIds?.length && primaryReservation) {
      if (choice === "vat" || choice === "posnet") {
        setDocChoiceResId(null);
        setDocChoiceResIds([...consolidatedReservationIds]);
        setDocChoiceGuestName(primaryReservation.guestName);
        setIssueDocMenuOpen(false);
        setDocChoiceOpen(true);
      }
      return;
    }
    if (!reservation?.id) return;
    if (choice === "vat" || choice === "posnet") {
      setDocChoiceResId(reservation.id);
      setDocChoiceResIds([]);
      setDocChoiceGuestName(reservation.guestName);
      setIssueDocMenuOpen(false);
      setDocChoiceOpen(true);
      return;
    }
  }, [reservation?.id, reservation?.guestName, isEdit, handleSubmit, isConsolidated, consolidatedReservationIds, primaryReservation]);

  if (isEdit && !reservation) return null;
  if (!isEdit && !createContext) return null;

  const title = isConsolidated && primaryReservation
    ? `Faktura zbiorcza · ${primaryReservation.guestName} · ${consolidatedReservationIds?.length ?? 0} rezerwacji`
    : isEdit && reservation
      ? `Edycja rezerwacji${reservation.confirmationNumber ? ` nr ${reservation.confirmationNumber}` : ""} · ${reservation.guestName} · Pokój ${reservation.room}`
      : "Nowa rezerwacja";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[1150px] min-w-[950px] max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="relative px-6 pt-6 pb-2 shrink-0 border-b flex flex-row items-center justify-between gap-2">
          <DialogTitle className="text-base font-semibold pr-8 min-w-0 truncate" title={title}>{title}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" aria-label="Zamknij">
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </DialogHeader>

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
              <fieldset disabled={isConsolidated} className="space-y-6">
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
                onPaymentRecorded={onPaymentRecorded}
              />
              </fieldset>
            </form>
          </div>

          {/* PRAWA KOLUMNA (60%) - Zakładki */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UnifiedReservationTab)} className="flex-1 flex flex-col min-h-0">
              {isEdit && reservation?.eventOrderId && (
                <div className="mx-4 mb-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">🎉</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Pobyt powiązany z imprezą</div>
                      <div className="text-sm font-semibold text-blue-900 truncate">
                        {reservation.eventOrderType && EVENT_TYPE_LABELS_BANNER[reservation.eventOrderType]}
                        {reservation.eventOrderClient ? ` — ${reservation.eventOrderClient}` : ""}
                        {reservation.eventOrderDate ? ` · ${new Date(reservation.eventOrderDate).toLocaleDateString("pl-PL")}` : ""}
                      </div>
                      <div className="text-[11px] text-blue-700 flex gap-3 mt-0.5">
                        <span>Status: {STATUS_LABELS_EVENT_BANNER[reservation.eventOrderStatus ?? ""] ?? "—"}</span>
                        {reservation.eventOrderDeposit != null && (
                          <span>Zadatek: {Number(reservation.eventOrderDeposit).toFixed(2)} zł {reservation.eventOrderDepositPaid ? "✓" : "✗"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" className="h-7 text-xs text-blue-800 border-blue-300 hover:bg-blue-100"
                      onClick={() => window.open(`/api/event-orders/${reservation.eventOrderId}/rozliczenie`, "_blank")}>
                      📋 Rozliczenie
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:bg-blue-100"
                      onClick={() => {
                        const w = window.open(`/api/event-orders/${reservation.eventOrderId}/rozliczenie`, "_blank");
                        if (w) { setTimeout(() => w.print(), 800); }
                      }}>
                      🖨️ Drukuj
                    </Button>
                  </div>
                </div>
              )}
              <TabsList className="flex w-full overflow-x-auto flex-nowrap shrink-0 rounded-none border-b px-4 gap-0 h-auto min-h-9 mb-2 [&>button]:shrink-0">
                <TabsTrigger value="rozliczenie" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Rozlicz.</TabsTrigger>
                <TabsTrigger value="dokumenty" disabled={!isEdit && !isConsolidated} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Dok.</TabsTrigger>
                <TabsTrigger value="posilki" disabled={!isEdit} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Posiłki</TabsTrigger>
                <TabsTrigger value="parking" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Parking</TabsTrigger>
                <TabsTrigger value="pozostale" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Inne</TabsTrigger>
                <TabsTrigger value="wlasne" disabled={!isEdit} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Własne</TabsTrigger>
                <TabsTrigger value="uslugi" disabled={!isEdit} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Usługi</TabsTrigger>
                <TabsTrigger value="grafik-sprzatan" disabled={!isEdit} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Sprzątanie</TabsTrigger>
                <TabsTrigger value="meldunek" disabled={!isEdit} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Meld.</TabsTrigger>
              </TabsList>

              <TabsContent value="rozliczenie" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                {isConsolidated && consolidatedReservationIds?.length ? (
                  <ConsolidatedSettlementContent reservationIds={consolidatedReservationIds} />
                ) : (
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
                  onPaymentRecorded={onPaymentRecorded}
                />
                )}
              </TabsContent>

              <TabsContent value="dokumenty" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                {isConsolidated && consolidatedReservationIds?.length ? (
                  <DocumentsTab reservationIds={consolidatedReservationIds} isConsolidated />
                ) : isEdit && reservation ? (
                  <DocumentsTab reservationId={reservation.id} />
                ) : null}
              </TabsContent>

              <TabsContent value="posilki" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                {isEdit && reservation && (
                  <MealsTab
                    reservationId={reservation.id}
                    invoiceSingleLine={form.invoiceSingleLine}
                    onInvoiceSingleLineChange={async (value) => {
                      const r = await updateReservation(reservation.id, { invoiceSingleLine: value } as Parameters<typeof updateReservation>[1]);
                      if (r.success) {
                        setForm((prev) => ({ ...prev, invoiceSingleLine: value }));
                        toast.success("Zapisano ustawienie faktury");
                      } else {
                        toast.error(r.error ?? "Błąd zapisu");
                      }
                    }}
                    invoiceScope={form.invoiceScope || "ALL"}
                    onInvoiceScopeChange={async (value) => {
                      const r = await updateReservation(reservation.id, { invoiceScope: value } as Parameters<typeof updateReservation>[1]);
                      if (r.success) {
                        setForm((prev) => ({ ...prev, invoiceScope: value }));
                        toast.success("Zapisano zakres faktury");
                      } else {
                        toast.error(r.error ?? "Błąd zapisu");
                      }
                    }}
                  />
                )}
              </TabsContent>

              <TabsContent value="parking" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                <ParkingTab
                  parkingSpotId={form.parkingSpotId}
                  parkingSpots={parkingSpots}
                  onParkingChange={(id) => onFormChange({ parkingSpotId: id })}
                />
              </TabsContent>

              <TabsContent value="pozostale" className="flex-1 min-h-0 overflow-y-auto mt-0 p-4">
                <PozostaleTab
                  form={form}
                  onFormChange={onFormChange}
                  reservationId={isEdit ? reservation?.id : undefined}
                  eventOrderId={eventOrderId}
                  onEventOrderChange={(id) => {
                    setEventOrderId(id);
                    setHasUnsavedChanges(true);
                    scheduleAutoSave();
                  }}
                />
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
            {isEdit && reservation && !isConsolidated && (
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => settlementTabRef.current?.openAddCharge?.()}>
                Towary
              </Button>
            )}
            {((isEdit && reservation) || isConsolidated || !isEdit) ? (
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIssueDocMenuOpen(true)}>
                Wystaw dokument <ChevronDown className="ml-0.5 h-3 w-3 inline" />
              </Button>
            ) : null}
            {isEdit && reservation && !isConsolidated && (
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
            {isEdit && reservation && !isConsolidated && (
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
            {isEdit && reservation && !isConsolidated && (
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
            {isEdit && reservation && !isConsolidated && reservation.status !== "CANCELLED" && reservation.status !== "CHECKED_OUT" && (
              <>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white border-blue-600" disabled={settleLoading || checkoutLoading} onClick={handleSettle}>
                  Rozlicz
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white border-orange-600" disabled={settleLoading || checkoutLoading} onClick={handleCheckoutOnly}>
                  {checkoutLoading ? "Wymeldowywanie…" : "Wymelduj"}
                </Button>
              </>
            )}
            {!isConsolidated && (
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200" disabled={saving} onClick={() => { saveAndPrintRef.current = true; handleSubmit(); }} title="Ctrl+Shift+Enter">
              {saving && saveAndPrintRef.current ? "Zapisywanie…" : "Zapisz i drukuj"}
            </Button>
            )}
            {!isConsolidated && (
            <Button
              ref={saveBtnRef}
              type="submit"
              form="reservation-form"
              size="sm"
              className={isEdit && !hasUnsavedChanges ? "h-8 text-xs bg-gray-200 text-gray-500 cursor-default" : "h-8 text-xs bg-green-600 hover:bg-green-700 text-white"}
              disabled={saving || (isEdit && !hasUnsavedChanges)}
              title="Ctrl+Enter"
              data-testid="create-reservation-save"
            >
              {saving && !saveAndPrintRef.current ? "Zapisywanie…" : "💾 Zapisz"}
            </Button>
            )}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wystawić dokument?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Wybierz jaki dokument wystawić:
          </p>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kwota na paragonie/fakturze [PLN]</label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder={docRoomTotal != null ? String(docRoomTotal.toFixed(2)) : "suma z transakcji"}
                className="h-8 text-sm"
                value={docAmountOverride}
                onChange={(e) => setDocAmountOverride(e.target.value)}
              />
              {docRoomTotal != null && (
                <p className="text-[10px] text-muted-foreground mt-0.5">Aktualna kwota do zapłaty: {docRoomTotal.toFixed(2)} PLN</p>
              )}
            </div>
            <div className="rounded border bg-muted/30 p-2 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Podział na fakturę i paragon</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Kwota na fakturę [PLN]</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="h-8 text-sm"
                    value={docAmountInvoice}
                    onChange={(e) => setDocAmountInvoice(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Kwota na paragon [PLN]</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="h-8 text-sm"
                    value={docAmountReceipt}
                    onChange={(e) => setDocAmountReceipt(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              {(docTotalAmount != null || (docAmountOverride.trim() && parseFloat(docAmountOverride) > 0)) && (() => {
                const override = docAmountOverride.trim() ? parseFloat(docAmountOverride) : null;
                const effective = override != null && Number.isFinite(override) && override > 0
                  ? Math.round(override * 100) / 100
                  : (docTotalAmount ?? 0);
                return (
                  <p className="text-[10px] text-muted-foreground">
                    Kwota do zapłaty: {effective.toFixed(2)} PLN
                    {docAmountInvoice && docAmountReceipt && (() => {
                      const inv = parseFloat(docAmountInvoice) || 0;
                      const rec = parseFloat(docAmountReceipt) || 0;
                      const sum = Math.round((inv + rec) * 100) / 100;
                      const ok = Math.abs(sum - effective) < 0.01;
                      return ok ? " ✓" : ` (suma ${sum.toFixed(2)} – musi być równa)`;
                    })()}
                  </p>
                );
              })()}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Uwagi na fakturze (opcjonalnie)</label>
              <Textarea
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="Wpisz uwagi, które pojawią się na fakturze..."
                rows={2}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Forma zapłaty (paragon)</Label>
              <Select value={docPaymentMethod} onValueChange={setDocPaymentMethod}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_PAYMENT_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              {docAmountInvoice && docAmountReceipt && (() => {
                const inv = parseFloat(docAmountInvoice) || 0;
                const rec = parseFloat(docAmountReceipt) || 0;
                const sum = Math.round((inv + rec) * 100) / 100;
                const override = docAmountOverride.trim() ? parseFloat(docAmountOverride) : null;
                const effective = override != null && Number.isFinite(override) && override > 0
                  ? Math.round(override * 100) / 100
                  : (docTotalAmount ?? 0);
                const canBoth = inv > 0 && rec > 0 && effective > 0 && Math.abs(sum - effective) < 0.01;
                return canBoth ? (
                  <Button variant="default" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleDocChoice("both")}>
                    📄 Faktura ({inv.toFixed(2)} PLN) + 🧾 Paragon ({rec.toFixed(2)} PLN) — Wystaw oba
                  </Button>
                ) : null;
              })()}
              {docChoiceResId && !docChoiceResIds.length && reservation?.companyId && (
                <Button variant="outline" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => { setDocChoiceOpen(false); setSplitInvoiceDialogOpen(true); }}>
                  📄 Dwie faktury (hotel + gastronomia)
                </Button>
              )}
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
            {!isConsolidated && reservation?.companyId && (
              <Button variant="outline" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => { setIssueDocMenuOpen(false); setSplitInvoiceDialogOpen(true); }}>
                📄 Dwie faktury (hotel + gastronomia)
              </Button>
            )}
            <Button variant="secondary" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleIssueDoc("posnet")}>
              🧾 Paragon
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleIssueDoc("proforma")}>
              Faktura proforma
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs justify-start text-muted-foreground" onClick={() => handleIssueDoc("potwierdzenie")}>
              Potwierdzenie rezerwacji (w przygotowaniu)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dwie faktury: hotel + gastronomia (+ opcjonalnie paragon) */}
      <Dialog open={splitInvoiceDialogOpen} onOpenChange={(open) => {
        setSplitInvoiceDialogOpen(open);
        if (!open) { setSplitHotelAmount(""); setSplitGastronomyAmount(""); setSplitReceiptAmount(""); setSplitReceiptPaymentMethod("CASH"); setSplitInvoiceNotes(""); }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dwie faktury (hotel + gastronomia)</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Wystaw dwie faktury VAT i opcjonalnie paragon.
          </p>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kwota hotelowa [PLN]</label>
              <Input type="number" min={0} step={0.01} placeholder="np. 500" value={splitHotelAmount} onChange={(e) => setSplitHotelAmount(e.target.value)} className="h-8" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kwota gastronomiczna [PLN]</label>
              <Input type="number" min={0} step={0.01} placeholder="np. 100" value={splitGastronomyAmount} onChange={(e) => setSplitGastronomyAmount(e.target.value)} className="h-8" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kwota na paragon [PLN] (opcjonalnie)</label>
              <Input type="number" min={0} step={0.01} placeholder="np. 9" value={splitReceiptAmount} onChange={(e) => setSplitReceiptAmount(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Forma zapłaty (paragon)</Label>
              <Select value={splitReceiptPaymentMethod} onValueChange={setSplitReceiptPaymentMethod}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_PAYMENT_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(splitHotelAmount || splitGastronomyAmount || splitReceiptAmount) && (() => {
              const h = parseFloat(splitHotelAmount) || 0;
              const g = parseFloat(splitGastronomyAmount) || 0;
              const r = parseFloat(splitReceiptAmount) || 0;
              const sum = h + g + r;
              return <p className="text-xs text-muted-foreground">Suma: {sum.toFixed(2)} PLN</p>;
            })()}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Uwagi (opcjonalnie)</label>
              <Textarea value={splitInvoiceNotes} onChange={(e) => setSplitInvoiceNotes(e.target.value)} placeholder="Uwagi na fakturach…" rows={2} className="text-sm" />
            </div>
            <Button
              variant="default"
              size="sm"
              className="w-full"
              disabled={docIssuing || !splitHotelAmount || !splitGastronomyAmount || (parseFloat(splitHotelAmount) || 0) <= 0 || (parseFloat(splitGastronomyAmount) || 0) <= 0 || ((parseFloat(splitReceiptAmount) || 0) < 0)}
              onClick={async () => {
                if (!reservation?.id) return;
                const hotel = parseFloat(splitHotelAmount) || 0;
                const gastronomy = parseFloat(splitGastronomyAmount) || 0;
                const receiptAmt = parseFloat(splitReceiptAmount) || 0;
                if (hotel <= 0 || gastronomy <= 0) return;
                setDocIssuing(true);
                try {
                  const result = await createSplitVatInvoices(reservation.id, {
                    hotelAmountGross: hotel,
                    gastronomyAmountGross: gastronomy,
                    notes: splitInvoiceNotes.trim() || undefined,
                  });
                  if (result.success && result.data) {
                    let msg = `Faktury: ${result.data.hotelInvoice.number} (${result.data.hotelInvoice.amountGross.toFixed(2)} PLN) + ${result.data.gastronomyInvoice.number} (${result.data.gastronomyInvoice.amountGross.toFixed(2)} PLN)`;
                    window.open(`/finance/invoice/${result.data.hotelInvoice.id}?autoPrint=1`, "_blank");
                    window.open(`/finance/invoice/${result.data.gastronomyInvoice.id}?autoPrint=1`, "_blank");
                    if (receiptAmt > 0) {
                      const recResult = await printFiscalReceiptForReservation(reservation.id, splitReceiptPaymentMethod || "CASH", receiptAmt);
                      if (recResult.success) {
                        window.dispatchEvent(new CustomEvent(FISCAL_JOB_ENQUEUED_EVENT));
                        msg += `, paragon ${receiptAmt.toFixed(2)} PLN`;
                        const copyUrl = `/api/finance/fiscal-receipt-copy?reservationId=${encodeURIComponent(reservation.id)}&amount=${receiptAmt}${recResult.data?.receiptNumber ? `&receiptNumber=${encodeURIComponent(recResult.data.receiptNumber)}` : ""}`;
                        const copyWin = window.open(copyUrl, "_blank");
                        if (copyWin) copyWin.addEventListener("load", () => setTimeout(() => copyWin.print(), 500));
                      } else {
                        toast.error(recResult.error ?? "Błąd paragonu");
                      }
                    }
                    toast.success(msg);
                    setSplitInvoiceDialogOpen(false);
                    setSplitHotelAmount("");
                    setSplitGastronomyAmount("");
                    setSplitReceiptAmount("");
                    setSplitReceiptPaymentMethod("CASH");
                    setSplitInvoiceNotes("");
                  } else {
                    toast.error("error" in result ? result.error : "Błąd wystawiania faktur");
                  }
                } finally {
                  setDocIssuing(false);
                }
              }}
            >
              {docIssuing ? "Wystawianie…" : splitReceiptAmount && parseFloat(splitReceiptAmount) > 0 ? "Wystaw 2 faktury + paragon" : "Wystaw obie faktury"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dodatkowa faktura tego samego zakresu (np. dla kolejnego gościa) */}
      <Dialog open={additionalInvoiceDialogOpen} onOpenChange={(open) => {
        setAdditionalInvoiceDialogOpen(open);
        if (!open) {
          setAdditionalInvoiceData(null);
          setAdditionalInvoiceAmount("");
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dodatkowa faktura</DialogTitle>
          </DialogHeader>
          {additionalInvoiceData && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Faktura {additionalInvoiceData.scope === "HOTEL_ONLY" ? "hotelowa" : "gastronomiczna"} już istnieje (nr {additionalInvoiceData.existingNumber}). Czy chcesz wystawić dodatkową fakturę dla kolejnego gościa?
              </p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Kwota dodatkowej faktury [PLN]</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder={additionalInvoiceData.suggestedAmount != null && additionalInvoiceData.suggestedAmount > 0 ? additionalInvoiceData.suggestedAmount.toFixed(2) : "np. 190"}
                  className="h-8"
                  value={additionalInvoiceAmount}
                  onChange={(e) => setAdditionalInvoiceAmount(e.target.value)}
                />
                {additionalInvoiceData.suggestedAmount != null && additionalInvoiceData.suggestedAmount > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Sugerowana kwota (suma z transakcji): {additionalInvoiceData.suggestedAmount.toFixed(2)} PLN</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setAdditionalInvoiceDialogOpen(false)}>Anuluj</Button>
                <Button
                  size="sm"
                  disabled={additionalInvoiceIssuing || !additionalInvoiceAmount || (parseFloat(additionalInvoiceAmount) || 0) <= 0}
                  onClick={async () => {
                    if (!additionalInvoiceData) return;
                    const amt = Math.round(parseFloat(additionalInvoiceAmount) * 100) / 100;
                    if (amt <= 0) return;
                    setAdditionalInvoiceIssuing(true);
                    try {
                      const result = await createVatInvoice(additionalInvoiceData.resId, undefined, {
                        invoiceScope: additionalInvoiceData.scope,
                        allowMultipleSameScope: true,
                        amountGrossOverride: amt,
                        notes: additionalInvoiceData.notes || undefined,
                      });
                      if (result.success && result.data) {
                        toast.success(`Faktura VAT ${result.data.number} – ${result.data.amountGross.toFixed(2)} PLN`);
                        window.open(`/finance/invoice/${result.data.id}?autoPrint=1`, "_blank");
                        setAdditionalInvoiceDialogOpen(false);
                        setAdditionalInvoiceData(null);
                        setAdditionalInvoiceAmount("");
                        setDocChoiceOpen(false);
                        setDocChoiceResIds([]);
                        setDocChoiceResId(null);
                        onOpenChange(false);
                      } else {
                        toast.error("error" in result ? result.error : "Błąd wystawiania faktury");
                      }
                    } finally {
                      setAdditionalInvoiceIssuing(false);
                    }
                  }}
                >
                  {additionalInvoiceIssuing ? "Wystawianie…" : "Wystaw dodatkową fakturę"}
                </Button>
              </DialogFooter>
            </div>
          )}
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
