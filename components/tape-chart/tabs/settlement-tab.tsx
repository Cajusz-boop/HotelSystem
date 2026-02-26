"use client";

import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGuestBlacklist, getReservationsByGuestId, searchGuests, updateReservationStatus, getActiveGuestDiscount } from "@/app/actions/reservations";
import { getTransactionsForReservation, getFolioSummary, setFolioAssignment, createNewFolio, getFolioItems, transferFolioItem, addFolioDiscount, collectSecurityDeposit, refundSecurityDeposit, getReservationGuestsForFolio, addReservationOccupant, removeReservationOccupant, postRoomChargeOnCheckout, chargeLocalTax, addFolioPayment, voidFolioItem, type ReservationGuestForFolio } from "@/app/actions/finance";
import { type FolioBillTo } from "@/lib/finance-constants";
import { searchCompanies } from "@/app/actions/companies";
import type { Reservation } from "@/lib/tape-chart-types";
import type { RateCodeForUi } from "@/app/actions/rate-codes";
import { toast } from "sonner";
import { SplitSquareVertical, User, Building2, Plus, ArrowRightLeft, Percent, Banknote, Pencil, Trash2 } from "lucide-react";
import { AddChargeDialog } from "@/components/add-charge-dialog";
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
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "CONFIRMED", label: "Potwierdzona" },
  { value: "CHECKED_IN", label: "Zameldowany" },
  { value: "CHECKED_OUT", label: "Wymeldowany" },
  { value: "CANCELLED", label: "Anulowana" },
  { value: "NO_SHOW", label: "No-show" },
];

/** Statusy dostępne w zależności od etapu rezerwacji (KWHotel). */
function getAvailableStatuses(reservation: { checkIn: string; checkOut: string; status: string }): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkIn = new Date(reservation.checkIn);
  checkIn.setHours(0, 0, 0, 0);
  const checkOut = new Date(reservation.checkOut);
  checkOut.setHours(0, 0, 0, 0);
  const currentStatus = reservation.status;

  function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  if (checkIn > today) {
    return ["CONFIRMED", "CANCELLED", "NO_SHOW"];
  }
  if (isSameDay(checkIn, today) && currentStatus !== "CHECKED_IN") {
    return ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"];
  }
  if (currentStatus === "CHECKED_IN") {
    return ["CHECKED_IN", "CHECKED_OUT"];
  }
  if (checkOut <= today && currentStatus === "CONFIRMED") {
    return ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"];
  }
  if (currentStatus === "CHECKED_OUT") {
    return ["CHECKED_OUT"];
  }
  if (currentStatus === "CANCELLED") {
    return ["CANCELLED", "CONFIRMED"];
  }
  return ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"];
}

const VOUCHER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "BON_TURYSTYCZNY", label: "Bon turystyczny" },
  { value: "VOUCHER_FIRMOWY", label: "Voucher firmowy" },
  { value: "DOFINANSOWANIE", label: "Dofinansowanie" },
  { value: "INNY", label: "Inny" },
];

const EXTRA_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "— brak —" },
  { value: "VIP", label: "VIP" },
  { value: "AWAITING_PAYMENT", label: "Oczekuje na wpłatę" },
  { value: "COMPLAINT", label: "Reklamacja" },
  { value: "LATE_CHECKOUT", label: "Późne wymeldowanie" },
  { value: "EARLY_CHECKIN", label: "Wczesne zameldowanie" },
  { value: "SPECIAL_REQUEST", label: "Specjalna prośba" },
  { value: "GROUP_LEADER", label: "Kierownik grupy" },
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "PHONE", label: "Telefon" },
  { value: "EMAIL", label: "Email" },
  { value: "WALK_IN", label: "Osobiście (walk-in)" },
  { value: "WEBSITE", label: "Strona WWW" },
  { value: "OTA", label: "OTA (portal)" },
  { value: "BOOKING_ENGINE", label: "Silnik rezerwacji" },
  { value: "CHANNEL_MANAGER", label: "Channel Manager" },
  { value: "OTHER", label: "Inne" },
];

const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: "DIRECT", label: "Bezpośrednio" },
  { value: "BOOKING_COM", label: "Booking.com" },
  { value: "EXPEDIA", label: "Expedia" },
  { value: "AIRBNB", label: "Airbnb" },
  { value: "AGODA", label: "Agoda" },
  { value: "TRIVAGO", label: "Trivago" },
  { value: "HOTELS_COM", label: "Hotels.com" },
  { value: "HOSTELWORLD", label: "Hostelworld" },
  { value: "TRIP_COM", label: "Trip.com" },
  { value: "GOOGLE_HOTELS", label: "Google Hotels" },
  { value: "KAYAK", label: "Kayak" },
  { value: "HRS", label: "HRS" },
  { value: "CORPORATE", label: "Corporate (B2B)" },
  { value: "TRAVEL_AGENT", label: "Biuro podróży" },
  { value: "GDS", label: "GDS (Amadeus/Sabre)" },
  { value: "OTHER", label: "Inne" },
];

const MEAL_PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: "RO", label: "RO — Tylko nocleg" },
  { value: "BB", label: "BB — Śniadanie" },
  { value: "HB", label: "HB — Półpensja" },
  { value: "FB", label: "FB — Pełne wyżywienie" },
  { value: "AI", label: "AI — All Inclusive" },
  { value: "BB_PLUS", label: "BB+ — Śniadanie rozszerzone" },
  { value: "HB_PLUS", label: "HB+ — Półpensja plus" },
  { value: "UAI", label: "UAI — Ultra All Inclusive" },
];

const NATIONALITY_OPTIONS: { value: string; label: string }[] = [
  { value: "PL", label: "Polska" },
  { value: "DE", label: "Niemcy" },
  { value: "GB", label: "Wielka Brytania" },
  { value: "UA", label: "Ukraina" },
  { value: "CZ", label: "Czechy" },
  { value: "SK", label: "Słowacja" },
  { value: "FR", label: "Francja" },
  { value: "IT", label: "Włochy" },
  { value: "ES", label: "Hiszpania" },
  { value: "NL", label: "Holandia" },
  { value: "US", label: "USA" },
  { value: "BY", label: "Białoruś" },
  { value: "LT", label: "Litwa" },
  { value: "RU", label: "Rosja" },
  { value: "SE", label: "Szwecja" },
  { value: "NO", label: "Norwegia" },
  { value: "DK", label: "Dania" },
  { value: "AT", label: "Austria" },
  { value: "CH", label: "Szwajcaria" },
  { value: "BE", label: "Belgia" },
];

const DOCUMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "ID_CARD", label: "Dowód osobisty" },
  { value: "PASSPORT", label: "Paszport" },
  { value: "DRIVING_LICENSE", label: "Prawo jazdy" },
  { value: "OTHER", label: "Inny" },
];

const selectClass = "flex h-7 w-full rounded border border-input bg-background px-2 py-0.5 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const textareaClass = "flex min-h-[40px] w-full rounded border border-input bg-background px-2 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y";
const inputCompact = "h-7 text-xs";

export interface SettlementTabFormState {
  guestName: string;
  guestId: string | null;
  guestEmail: string;
  guestPhone: string;
  guestDateOfBirth: string;
  guestNationality: string;
  documentType: string;
  documentNumber: string;
  room: string;
  /** Typ pokoju (grupa) — do filtrowania listy pokoi */
  roomType: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  status: string;
  adults: string;
  children: string;
  pax: string;
  notes: string;
  internalNotes: string;
  source: string;
  channel: string;
  mealPlan: string;
  eta: string;
  rateCodeId: string;
  rateCodePrice: string;  // edytowalna cena za dobę (puste = z cennika)
  parkingSpotId: string;
  bedsBooked: string;
  nipInput: string;
  companyName: string;
  companyAddress: string;
  companyPostalCode: string;
  companyCity: string;
  companyFound: boolean;
  segment: string;
  externalReservationNumber: string;
  currency: string;
  reminderDate: string;
  reminderTime: string;
  showNotesOnChart: boolean;
  /** Tryb rozliczenia: room = cena pokoju za dobę, person = za osobo-dobę, plan = plan cenowy */
  billingMode: "room" | "person" | "plan";
  /** Cena za dziecko/dziecko1 (gdy billingMode === "person") */
  pricePerChild: string;
  /** Rabat za nocleg [%] */
  discountPercent: string;
  /** Dolicz opłatę miejscową */
  addLocalTax: boolean;
  /** Płatność gwarantowana kartą (informacyjny) */
  cardGuaranteed: boolean;
  /** Termin wpłaty zaliczki (YYYY-MM-DD) */
  depositDueDate: string;
  /** Kwota wpłaty do zarejestrowania (UI) */
  paymentAmount: string;
  /** Metoda płatności (UI) */
  paymentMethod: string;
  /** Dodatkowy status rezerwacji (VIP, Oczekuje na wpłatę, Reklamacja) */
  extraStatus: string;
  /** Kwota vouchera/dofinansowania (UI) */
  voucherAmount: string;
  /** Typ: VOUCHER | OTHER (UI) */
  voucherType: string;
  /** Kwota zaliczki do dodania (UI) */
  advanceAmount: string;
}

interface SettlementTabProps {
  mode: "create" | "edit";
  form: SettlementTabFormState;
  onFormChange: (patch: Partial<SettlementTabFormState>) => void;
  reservation?: Reservation | null;
  rooms: Array<{ number: string; type?: string; price?: number; beds?: number }>;
  rateCodes: RateCodeForUi[];
  parkingSpots: Array<{ id: string; number: string }>;
  effectivePricePerNight?: number;
  isNonRefundable: boolean;
  guestSuggestions: Array<{ id: string; name: string; email: string | null; phone: string | null; dateOfBirth: string | null }>;
  suggestionsOpen: boolean;
  suggestionsField: "name" | "email" | "phone";
  highlightedIdx: number;
  onSelectGuest: (g: { id: string; name: string; email: string | null; phone: string | null; dateOfBirth: string | null }) => void;
  onGuestKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSearchGuest: (query: string, field: "name" | "email" | "phone") => void;
  onSuggestionsOpenChange: (open: boolean) => void;
  guestInputRef: React.Ref<HTMLInputElement>;
  nipLookupLoading: boolean;
  onNipLookup: () => void;
  /** full = 3-kolumnowy grid (domyślny), form = tylko lewa kolumna (formularz), rozliczenie = tylko prawa kolumna (cennik+folio) */
  layout?: "full" | "form" | "rozliczenie";
}

export interface SettlementTabRef {
  openAddCharge: () => void;
}

function computeNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (24 * 60 * 60 * 1000)
  );
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type FolioSummaryItem = {
  folioNumber: number;
  balance: number;
  totalCharges: number;
  totalDiscounts: number;
  totalPayments: number;
  billTo?: FolioBillTo;
  guestId?: string | null;
  guestName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  label?: string | null;
};

function parseFolios(folios: Array<{ folioNumber: number; balance: number; totalCharges: number; totalDiscounts?: number; totalPayments: number; billTo?: FolioBillTo; guestId?: string | null; guestName?: string | null; companyId?: string | null; companyName?: string | null; label?: string | null }>): FolioSummaryItem[] {
  return folios.map((f) => ({
    folioNumber: f.folioNumber,
    balance: f.balance,
    totalCharges: f.totalCharges,
    totalDiscounts: f.totalDiscounts ?? 0,
    totalPayments: f.totalPayments,
    billTo: f.billTo,
    guestId: f.guestId,
    guestName: f.guestName,
    companyId: f.companyId,
    companyName: f.companyName,
    label: f.label,
  }));
}

export const SettlementTab = forwardRef<SettlementTabRef, SettlementTabProps>(function SettlementTab({
  mode,
  form,
  onFormChange,
  reservation,
  rooms,
  rateCodes,
  parkingSpots,
  effectivePricePerNight,
  isNonRefundable,
  guestSuggestions,
  suggestionsOpen,
  suggestionsField,
  highlightedIdx,
  onSelectGuest,
  onGuestKeyDown,
  onSearchGuest,
  onSuggestionsOpenChange,
  guestInputRef,
  nipLookupLoading,
  onNipLookup,
  layout = "full",
}, ref) {
  const isEdit = mode === "edit";
  const [localTaxLoading, setLocalTaxLoading] = useState(false);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const [addChargeDialogOpen, setAddChargeDialogOpen] = useState(false);
  useImperativeHandle(ref, () => ({ openAddCharge: () => setAddChargeDialogOpen(true) }), []);
  const roomBeds = rooms.find((r) => r.number === form.room)?.beds ?? 1;
  const nights = computeNights(form.checkIn, form.checkOut);

  const roomTypes = useMemo(() => [...new Set(rooms.map((r) => r.type).filter(Boolean))] as string[], [rooms]);
  const filteredRoomsByType = useMemo(
    () => (form.roomType ? rooms.filter((r) => r.type === form.roomType) : rooms),
    [rooms, form.roomType]
  );

  /** Gdy brak kodów stawek – pokaż ceny wg typu pokoju z listy pokoi */
  const fallbackPricesFromRooms = useMemo(() => {
    const seen = new Set<string>();
    return rooms
      .filter((r): r is typeof r & { price: number } => r.price != null && r.price > 0)
      .reduce<Array<{ key: string; label: string; price: number }>>((acc, r) => {
        const key = (r.type ?? r.number) + "-" + r.price;
        if (seen.has(key)) return acc;
        seen.add(key);
        acc.push({
          key,
          label: r.type ? r.type : `Pokój ${r.number}`,
          price: r.price,
        });
        return acc;
      }, [])
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rooms]);
  const dateError = form.checkIn && form.checkOut && nights <= 0;
  const priceFromForm = form.rateCodePrice.trim() ? parseFloat(form.rateCodePrice) : null;
  const priceFromRate = effectivePricePerNight
    ?? rateCodes.find((r) => r.id === form.rateCodeId)?.price
    ?? rooms.find((r) => r.number === form.room)?.price;
  const pricePerNight = (priceFromForm != null && !Number.isNaN(priceFromForm) && priceFromForm > 0)
    ? priceFromForm
    : priceFromRate;
  const totalAmount = pricePerNight != null && pricePerNight > 0 && nights > 0 ? pricePerNight * nights : undefined;

  const todayStr = new Date().toISOString().slice(0, 10);
  const isPastRes = form.checkOut && form.checkOut <= todayStr;
  const isCheckedIn = form.status === "CHECKED_IN";
  const isTodayRes = form.checkIn && form.checkOut && form.checkIn <= todayStr && todayStr < form.checkOut;
  const availableStatusValues = getAvailableStatuses({ checkIn: form.checkIn || "", checkOut: form.checkOut || "", status: form.status });
  const allowedStatusOptions = STATUS_OPTIONS.filter((s) => availableStatusValues.includes(s.value));

  // Edit-mode-only state: folio, transactions, guest history, blacklist
  const [guestHistory, setGuestHistory] = useState<Reservation[]>([]);
  const [guestHistoryRequested, setGuestHistoryRequested] = useState(false);
  const [guestHistoryLoading, setGuestHistoryLoading] = useState(false);
  const [localGuestBlacklisted, setLocalGuestBlacklisted] = useState(false);
  const [togglingBlacklist, setTogglingBlacklist] = useState(false);
  const [transactions, setTransactions] = useState<Array<{ id: string; amount: number; type: string; createdAt: string; isReadOnly: boolean }>>([]);
  const [folioSummaries, setFolioSummaries] = useState<FolioSummaryItem[]>([]);
  const [editingFolioNumber, setEditingFolioNumber] = useState<number | null>(null);
  const [editBillTo, setEditBillTo] = useState<FolioBillTo>("GUEST");
  const [editGuestId, setEditGuestId] = useState("");
  const [editCompanyId, setEditCompanyId] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [reservationGuests, setReservationGuests] = useState<ReservationGuestForFolio[]>([]);
  const [companyOptions, setCompanyOptions] = useState<Array<{ id: string; nip: string; name: string; city: string | null }>>([]);
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [folioActionLoading, setFolioActionLoading] = useState(false);
  const [newFolioLoading, setNewFolioLoading] = useState(false);
  const [occupantSearchQuery, setOccupantSearchQuery] = useState("");
  const [occupantSearchResults, setOccupantSearchResults] = useState<Array<{ id: string; name: string }>>([]);
  const [addOccupantLoading, setAddOccupantLoading] = useState(false);
  const [roomChargeLoading, setRoomChargeLoading] = useState(false);
  const [paymentRegisterLoading, setPaymentRegisterLoading] = useState(false);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [folioItemsByNumber, setFolioItemsByNumber] = useState<Record<number, Array<{ id: string; type: string; description: string | null; amount: number; status: string }>>>({});
  const [loadingItemsFolio, setLoadingItemsFolio] = useState<number | null>(null);
  const [transferLoadingId, setTransferLoadingId] = useState<string | null>(null);
  const [discountFolioNumber, setDiscountFolioNumber] = useState<number | null>(null);
  const [discountScope, setDiscountScope] = useState<"RESERVATION" | "LINE_ITEM">("RESERVATION");
  const [discountAppliesToTransactionId, setDiscountAppliesToTransactionId] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [discountValue, setDiscountValue] = useState("");
  const [discountDescription, setDiscountDescription] = useState("");
  const [discountManagerPin, setDiscountManagerPin] = useState("");
  const [addDiscountLoading, setAddDiscountLoading] = useState(false);
  const [showCollectDeposit, setShowCollectDeposit] = useState(false);
  const [showRefundDeposit, setShowRefundDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<string>("CASH");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDeduction, setRefundDeduction] = useState("");
  const [refundDeductionReason, setRefundDeductionReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<string>("CASH");
  const [collectDepositLoading, setCollectDepositLoading] = useState(false);
  const collectDepositInFlightRef = useRef(false);
  const [refundDepositLoading, setRefundDepositLoading] = useState(false);
  const [activeGuestDiscount, setActiveGuestDiscount] = useState<{ percentage: number; reason: string | null; dateTo: string } | null>(null);
  const [activeGuestDiscountLoading, setActiveGuestDiscountLoading] = useState(false);
  const [openKaucjaDetails, setOpenKaucjaDetails] = useState(false);
  const [voidItemId, setVoidItemId] = useState<string | null>(null);
  const [voidItemReason, setVoidItemReason] = useState("");

  // Load edit-mode data
  useEffect(() => {
    if (!isEdit || !reservation) return;
    setLocalGuestBlacklisted(reservation.guestBlacklisted ?? false);
  }, [isEdit, reservation]);

  // Historia gościa — leniwie (dopiero po rozwinięciu <details>)
  useEffect(() => {
    if (!isEdit || !reservation?.guestId || !guestHistoryRequested) {
      if (!guestHistoryRequested) setGuestHistory([]);
      return;
    }
    setGuestHistoryLoading(true);
    getReservationsByGuestId(reservation.guestId)
      .then((r) => {
        setGuestHistory(r.success && r.data ? (r.data as Reservation[]) : []);
      })
      .finally(() => setGuestHistoryLoading(false));
  }, [isEdit, reservation?.guestId, guestHistoryRequested]);

  // Rabat gościa na okres (CRM) — sprawdź czy gość ma aktywny rabat na datę check-in
  useEffect(() => {
    const guestId = form.guestId ?? reservation?.guestId ?? null;
    const checkInDate = form.checkIn || reservation?.checkIn;
    if (!guestId || !checkInDate) {
      setActiveGuestDiscount(null);
      return;
    }
    setActiveGuestDiscountLoading(true);
    getActiveGuestDiscount(guestId, checkInDate)
      .then((r) => {
        if (r.success && r.data)
          setActiveGuestDiscount({ percentage: r.data.percentage, reason: r.data.reason, dateTo: r.data.dateTo });
        else setActiveGuestDiscount(null);
      })
      .finally(() => setActiveGuestDiscountLoading(false));
  }, [form.guestId, form.checkIn, reservation?.guestId, reservation?.checkIn]);

  useEffect(() => {
    if (!isEdit || !reservation?.id) { setTransactions([]); return; }
    getTransactionsForReservation(reservation.id).then((r) => r.success && r.data && setTransactions(r.data));
  }, [isEdit, reservation?.id]);

  useEffect(() => {
    if (!isEdit || !reservation?.id) { setFolioSummaries([]); setReservationGuests([]); return; }
    getFolioSummary(reservation.id).then((r) => {
      if (r.success && r.data?.folios) setFolioSummaries(parseFolios(r.data.folios));
      else setFolioSummaries([]);
    });
    getReservationGuestsForFolio(reservation.id).then((r) => {
      if (r.success && r.data) setReservationGuests(r.data);
      else setReservationGuests([]);
    });
  }, [isEdit, reservation?.id]);

  useEffect(() => {
    if (companySearchQuery.trim().length >= 2) {
      searchCompanies(companySearchQuery, 15).then((r) => {
        if (r.success && r.data) setCompanyOptions(r.data);
        else setCompanyOptions([]);
      });
    } else setCompanyOptions([]);
  }, [companySearchQuery]);

  const refreshFolios = useCallback(async () => {
    if (!reservation?.id) return;
    const r = await getFolioSummary(reservation.id);
    if (r.success && r.data?.folios) setFolioSummaries(parseFolios(r.data.folios));
  }, [reservation?.id]);

  const loadFolioItems = useCallback(async (folioNum: number) => {
    if (!reservation?.id) return;
    setLoadingItemsFolio(folioNum);
    const result = await getFolioItems({ reservationId: reservation.id, folioNumber: folioNum, includeVoided: false });
    setLoadingItemsFolio(null);
    if (result.success && result.data?.items) {
      setFolioItemsByNumber((prev) => ({
        ...prev,
        [folioNum]: result.data!.items.map((it: { id: string; type: string; description: string | null; amount: number; status: string }) => ({
          id: it.id, type: it.type, description: it.description, amount: it.amount, status: it.status,
        })),
      }));
    } else {
      setFolioItemsByNumber((prev) => ({ ...prev, [folioNum]: [] }));
    }
  }, [reservation?.id]);

  const renderSuggestionsDropdown = (forField: "name" | "email" | "phone") => {
    if (!suggestionsOpen || guestSuggestions.length === 0 || suggestionsField !== forField) return null;
    return (
      <div
        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-popover text-popover-foreground py-1 shadow-xl"
        role="listbox"
        onMouseDown={(e) => e.preventDefault()}
      >
        {guestSuggestions.map((g, idx) => (
          <button
            key={g.id}
            type="button"
            role="option"
            aria-selected={idx === highlightedIdx}
            className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none ${idx === highlightedIdx ? "bg-accent" : ""}`}
            onClick={() => onSelectGuest(g)}
          >
            <span className="font-medium">{g.name}</span>
            <span className="text-xs text-muted-foreground">
              {[g.email, g.phone, g.dateOfBirth].filter(Boolean).join(" · ") || "brak danych kontaktowych"}
            </span>
          </button>
        ))}
      </div>
    );
  };

  const localTaxAmount = transactions.filter((t) => t.type === "LOCAL_TAX").reduce((s, t) => s + t.amount, 0);
  const hasLocalTax = transactions.some((t) => t.type === "LOCAL_TAX");
  const mealsAmount = transactions.filter((t) => ["GASTRONOMY", "RESTAURANT", "POSTING"].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const roomChargesFromTx = transactions.filter((t) => t.type === "ROOM").reduce((s, t) => s + t.amount, 0);
  const otherChargesAmount = transactions.filter((t) => t.amount > 0 && !["ROOM", "LOCAL_TAX", "DISCOUNT"].includes(t.type) && !["GASTRONOMY", "RESTAURANT", "POSTING"].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const totalPaymentsFromFolios = folioSummaries.reduce((s, f) => s + f.totalPayments, 0);
  const totalPaid = totalPaymentsFromFolios;

  /** Lewa kolumna: tylko formularz w 4 sekcjach (KWHotel) */
  if (layout === "form") {
    const sectionHeader = "text-xs font-medium uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-1.5 mb-2";
    const selectedRoomData = rooms.find((r) => r.number === form.room);
    const filteredRooms = filteredRoomsByType;
    return (
      <div className="space-y-6">
        {/* 1. DANE POKOJU (KWHotel: Grupa, Numer, SB/DB/EB, Wyposażenie, Opis) */}
        <section>
          <h3 className={sectionHeader}>🏨 DANE POKOJU</h3>
          <div className="grid grid-cols-[90px_1fr] items-center gap-x-2 gap-y-2">
            <Label className="text-xs text-muted-foreground text-right">Grupa</Label>
            <select
              id="uni-roomType"
              value={form.roomType}
              onChange={(e) => {
                const t = e.target.value;
                onFormChange({ roomType: t });
                const byType = t ? rooms.filter((r) => r.type === t) : rooms;
                const keepRoom = byType.some((r) => r.number === form.room);
                if (!keepRoom && byType.length > 0) onFormChange({ room: byType[0].number });
                else if (!keepRoom) onFormChange({ room: "" });
              }}
              className={selectClass}
            >
              <option value="">— wszystkie —</option>
              {roomTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <Label className="text-xs text-muted-foreground text-right">Numer</Label>
            {filteredRooms.length > 0 ? (
              <select
                id="uni-room"
                data-testid="create-reservation-room"
                value={form.room}
                onChange={(e) => {
                  const num = e.target.value;
                  onFormChange({ room: num, roomType: rooms.find((r) => r.number === num)?.type ?? form.roomType });
                }}
                required
                className={selectClass}
              >
                <option value="">— wybierz —</option>
                {filteredRooms.map((r) => (
                  <option key={r.number} value={r.number}>{r.number}{r.type ? ` · ${r.type}` : ""}</option>
                ))}
              </select>
            ) : (
              <Input id="uni-room" className={inputCompact} value={form.room} onChange={(e) => onFormChange({ room: e.target.value })} placeholder="Nr pokoju" required />
            )}
            <Label className="text-xs text-muted-foreground text-right">SB / DB / EB</Label>
            <span className="text-xs text-muted-foreground">
              {roomBeds === 1 ? "SB" : roomBeds === 2 ? "DB" : roomBeds > 2 ? `EB (${roomBeds})` : "—"}
            </span>
            {roomBeds > 1 && (
              <>
                <Label className="text-xs text-muted-foreground text-right">Łóżka</Label>
                <Input id="uni-beds" type="number" className={inputCompact} min={1} max={roomBeds} value={form.bedsBooked} onChange={(e) => onFormChange({ bedsBooked: e.target.value })} />
              </>
            )}
            <Label className="text-xs text-muted-foreground text-right">Wyposażenie</Label>
            <span className="text-xs text-muted-foreground">—</span>
            <Label className="text-xs text-muted-foreground text-right">Opis</Label>
            <span className="text-xs text-muted-foreground">—</span>
          </div>
        </section>

        {/* 2. OKRES POBYTU */}
        <section>
          <h3 className={sectionHeader}>📅 OKRES POBYTU</h3>
          <div className="grid grid-cols-[90px_1fr] items-center gap-x-2 gap-y-2">
            <Label className="text-xs text-muted-foreground text-right">Zameld.</Label>
            <div className="flex flex-wrap items-center gap-1">
              <Input id="uni-checkIn" data-testid="create-reservation-checkIn" type="date" className={`${inputCompact} w-32`} value={form.checkIn}
                onChange={(e) => { onFormChange({ checkIn: e.target.value, checkOut: e.target.value ? addDays(e.target.value, 1) : form.checkOut }); }} />
              <Input id="uni-checkInTime" type="time" className={inputCompact} value={form.checkInTime} onChange={(e) => onFormChange({ checkInTime: e.target.value })} />
            </div>
            <Label className="text-xs text-muted-foreground text-right">Wymeld.</Label>
            <div className="flex flex-wrap items-center gap-1">
              <Input id="uni-checkOut" data-testid="create-reservation-checkOut" type="date" className={`${inputCompact} w-32 ${dateError ? "border-destructive" : ""}`} value={form.checkOut}
                onChange={(e) => onFormChange({ checkOut: e.target.value })} min={form.checkIn ? addDays(form.checkIn, 1) : undefined} />
              <Input id="uni-checkOutTime" type="time" className={inputCompact} value={form.checkOutTime} onChange={(e) => onFormChange({ checkOutTime: e.target.value })} />
            </div>
            <Label className="text-xs text-muted-foreground text-right">Doby</Label>
            <div className="flex items-center gap-1 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} type="button" className={cn("h-6 min-w-6 rounded border px-1 text-xs font-medium tabular-nums transition-colors", nights === n ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted/50")}
                  onClick={() => { if (form.checkIn) onFormChange({ checkOut: addDays(form.checkIn, n) }); }}>{n}</button>
              ))}
            </div>
            <Label className="text-xs text-muted-foreground text-right">Noce</Label>
            <span className="text-xs tabular-nums">{nights}</span>
            <Label className="text-xs text-muted-foreground text-right">Parking</Label>
            <select id="uni-parking" data-testid="create-reservation-parking" value={form.parkingSpotId} onChange={(e) => onFormChange({ parkingSpotId: e.target.value })} className={selectClass}>
              <option value="">— brak —</option>
              {parkingSpots.map((s) => <option key={s.id} value={s.id}>{s.number}</option>)}
            </select>
            <Label className="text-xs text-muted-foreground text-right">Stawka</Label>
            <select id="uni-rateCode" value={form.rateCodeId} onChange={(e) => onFormChange({ rateCodeId: e.target.value })} className={selectClass}>
              <option value="">— brak —</option>
              {rateCodes.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
            </select>
            <Label className="text-xs text-muted-foreground text-right">Status</Label>
            <div className="flex items-center gap-1 flex-wrap">
              <select id="uni-status" data-testid="create-reservation-status" value={form.status} onChange={(e) => onFormChange({ status: e.target.value })} className={selectClass}>
                {allowedStatusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {isEdit && reservation?.id && form.status === "CONFIRMED" && (
                <Button type="button" size="sm" variant="default" className="h-7 text-xs" onClick={async () => { if (!reservation?.id) return; const r = await updateReservationStatus(reservation.id, "CHECKED_IN"); if (r.success) { onFormChange({ status: "CHECKED_IN" }); toast.success("Zameldowano"); } else toast.error(r.error); }}>Melduj gościa</Button>
              )}
              {isEdit && reservation?.id && form.status === "CHECKED_IN" && (
                <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={async () => { if (!reservation?.id) return; const r = await updateReservationStatus(reservation.id, "CHECKED_OUT"); if (r.success) { onFormChange({ status: "CHECKED_OUT" }); toast.success("Wymeldowano"); } else toast.error(r.error); }}>Wymelduj i zapisz</Button>
              )}
            </div>
            <Label className="text-xs text-muted-foreground text-right">Dodatkowy status</Label>
            <select id="uni-extraStatus" value={form.extraStatus} onChange={(e) => onFormChange({ extraStatus: e.target.value })} className={selectClass}>
              {EXTRA_STATUS_OPTIONS.map((s) => <option key={s.value || "_"} value={s.value}>{s.label}</option>)}
            </select>
            <Label className="text-xs text-muted-foreground text-right">Pax</Label>
            <Input id="uni-pax" type="number" className={inputCompact} min={0} max={20} value={form.pax} onChange={(e) => onFormChange({ pax: e.target.value })} />
            <Label className="text-xs text-muted-foreground text-right">Dorośli</Label>
            <Input id="uni-adults" type="number" className={inputCompact} min={1} max={20} value={form.adults} onChange={(e) => onFormChange({ adults: e.target.value })} />
            <Label className="text-xs text-muted-foreground text-right">Dzieci</Label>
            <Input id="uni-children" type="number" className={inputCompact} min={0} max={20} value={form.children} onChange={(e) => onFormChange({ children: e.target.value })} />
            {!isEdit && (
              <>
                <Label className="text-xs text-muted-foreground text-right">Źródło</Label>
                <select id="uni-source" value={form.source} onChange={(e) => onFormChange({ source: e.target.value })} className={selectClass}>
                  <option value="">— brak —</option>
                  {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <Label className="text-xs text-muted-foreground text-right">Kanał</Label>
                <select id="uni-channel" value={form.channel} onChange={(e) => onFormChange({ channel: e.target.value })} className={selectClass}>
                  <option value="">— brak —</option>
                  {CHANNEL_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </>
            )}
          </div>
        </section>

        {/* 3. DANE GOŚCIA */}
        <section>
          <h3 className={sectionHeader}>👤 DANE GOŚCIA</h3>
          <div className="space-y-2">
            <div className="relative">
              <Label className="text-xs text-muted-foreground">Imię i nazwisko</Label>
              <Input ref={guestInputRef} id="uni-guestName" data-testid="create-reservation-guest" className={inputCompact} value={form.guestName}
                onChange={(e) => { onFormChange({ guestName: e.target.value }); onSearchGuest(e.target.value, "name"); }}
                onBlur={() => { setTimeout(() => onSuggestionsOpenChange(false), 250); }}
                onFocus={() => { if (guestSuggestions.length > 0) onSuggestionsOpenChange(true); }}
                onKeyDown={onGuestKeyDown}
                placeholder="Wpisz min. 2 litery…" required autoComplete="off" role="combobox" aria-expanded={suggestionsOpen} aria-autocomplete="list" />
              {renderSuggestionsDropdown("name")}
              {form.guestId && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">Stały gość</span>}
              {isEdit && reservation?.guestId && (
                <a href={`/guests/${reservation.guestId}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline mt-0.5 inline-block">Edycja klienta</a>
              )}
            </div>
            {isEdit && reservation?.guestId && localGuestBlacklisted && (
              <div className="flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-xs">
                <span className="font-medium text-red-700 dark:text-red-400">⚠️ UWAGA: Gość na czarnej liście!</span>
                <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px] px-1" disabled={togglingBlacklist} onClick={async () => {
                  setTogglingBlacklist(true);
                  const res = await updateGuestBlacklist(reservation!.guestId!, false);
                  setTogglingBlacklist(false);
                  if (res.success) setLocalGuestBlacklisted(false);
                }}>Usuń z listy</Button>
              </div>
            )}
            {isEdit && reservation?.guestId && !localGuestBlacklisted && (
              <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px] px-1 text-muted-foreground" disabled={togglingBlacklist} onClick={async () => {
                setTogglingBlacklist(true);
                const res = await updateGuestBlacklist(reservation!.guestId!, true);
                setTogglingBlacklist(false);
                if (res.success) setLocalGuestBlacklisted(true);
              }}>+ Czarna lista</Button>
            )}
            <div className="relative">
              <Label className="text-xs text-muted-foreground">Telefon</Label>
              <Input id="uni-guestPhone" type="text" inputMode="tel" className={inputCompact} value={form.guestPhone}
                onChange={(e) => { onFormChange({ guestPhone: e.target.value }); onSearchGuest(e.target.value, "phone"); }}
                onBlur={() => { setTimeout(() => { if (suggestionsField === "phone") onSuggestionsOpenChange(false); }, 250); }}
                onFocus={() => { if (guestSuggestions.length > 0 && suggestionsField === "phone") onSuggestionsOpenChange(true); }}
                onKeyDown={onGuestKeyDown} placeholder="+48 600 123 456" autoComplete="off" />
              {renderSuggestionsDropdown("phone")}
            </div>
            <div className="relative">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input id="uni-guestEmail" type="text" inputMode="email" className={inputCompact} value={form.guestEmail}
                onChange={(e) => { onFormChange({ guestEmail: e.target.value }); onSearchGuest(e.target.value, "email"); }}
                onBlur={() => { setTimeout(() => { if (suggestionsField === "email") onSuggestionsOpenChange(false); }, 250); }}
                onFocus={() => { if (guestSuggestions.length > 0 && suggestionsField === "email") onSuggestionsOpenChange(true); }}
                onKeyDown={onGuestKeyDown} placeholder="opcjonalnie" autoComplete="off" />
              {renderSuggestionsDropdown("email")}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">NIP firmy (dla faktury VAT)</Label>
              <div className="flex gap-1 mt-0.5">
                <Input id="uni-nip" type="text" inputMode="numeric" className={`${inputCompact} flex-1`} value={form.nipInput}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 10);
                    let formatted = d;
                    if (d.length > 3) formatted = `${d.slice(0, 3)}-${d.slice(3)}`;
                    if (d.length > 6) formatted = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
                    if (d.length > 8) formatted = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
                    onFormChange({ nipInput: formatted, companyFound: false });
                  }}
                  placeholder="000-000-00-00" autoComplete="off" />
                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] px-2 shrink-0"
                  disabled={nipLookupLoading || form.nipInput.replace(/\D/g, "").length !== 10}
                  onClick={onNipLookup}>{nipLookupLoading ? "…" : "Sprawdź"}</Button>
              </div>
              {form.companyFound && (
                <div className="mt-1 space-y-0.5 rounded border bg-muted/30 p-1.5 text-xs">
                  <Input className="h-6 text-xs" value={form.companyName} onChange={(e) => onFormChange({ companyName: e.target.value })} placeholder="Nazwa firmy" />
                  <Input className="h-6 text-xs" value={form.companyAddress} onChange={(e) => onFormChange({ companyAddress: e.target.value })} placeholder="Adres" />
                  <div className="grid grid-cols-[80px_1fr] gap-1">
                    <Input className="h-6 text-xs" value={form.companyPostalCode} onChange={(e) => onFormChange({ companyPostalCode: e.target.value })} placeholder="00-000" />
                    <Input className="h-6 text-xs" value={form.companyCity} onChange={(e) => onFormChange({ companyCity: e.target.value })} placeholder="Miasto" />
                  </div>
                </div>
              )}
            </div>
            {isEdit && reservation?.guestId && (
              <details
                className="rounded border bg-muted/20 text-xs"
                onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setGuestHistoryRequested(true); }}
              >
                <summary className="cursor-pointer px-2 py-1 font-medium">
                  ▶ Historia ({guestHistoryRequested ? guestHistory.length : "?"} pobytów)
                </summary>
                {guestHistoryLoading && <p className="px-2 pb-1 text-muted-foreground">Ładowanie…</p>}
                {!guestHistoryLoading && guestHistory.length === 0 && guestHistoryRequested && (
                  <p className="px-2 pb-1 text-muted-foreground">Brak wcześniejszych pobytów.</p>
                )}
                {!guestHistoryLoading && guestHistory.length > 0 && (
                <ul className="list-none px-2 pb-1">
                  {guestHistory.slice(0, 5).map((r) => (
                    <li key={r.id} className="flex items-center gap-1 text-[10px]">
                      <span className="font-medium">{r.room}</span>
                      <span className="text-muted-foreground">{r.checkIn}–{r.checkOut}</span>
                      <span className={r.id === reservation?.id ? "text-primary" : "text-muted-foreground"}>{STATUS_OPTIONS.find((s) => s.value === r.status)?.label ?? r.status}</span>
                    </li>
                  ))}
                </ul>
                )}
              </details>
            )}
            {isEdit && reservation?.id && (
              <div className="rounded border border-border/50 p-2">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Goście w pokoju</p>
                <ul className="list-none space-y-0.5 text-xs">
                  {reservationGuests.map((g) => (
                    <li key={g.guestId} className="flex items-center justify-between gap-2 rounded bg-muted/30 px-2 py-1">
                      <span>{g.name} {g.isPrimary ? "(główny)" : ""}</span>
                      <div className="flex items-center gap-0.5">
                        <a href={`/guests/${g.guestId}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edycja klienta">
                          <Pencil className="h-3 w-3" />
                        </a>
                        {!g.isPrimary && (
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={async () => {
                              const result = await removeReservationOccupant(reservation.id, g.guestId);
                              if (result.success) { toast.success("Usunięto gościa z pokoju"); getReservationGuestsForFolio(reservation.id).then((r) => r.success && r.data && setReservationGuests(r.data)); }
                              else toast.error(result.error);
                            }} title="Usuń z pokoju">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-2">
                  <Input type="text" placeholder="Wyszukaj gościa (min. 2 znaki)" value={occupantSearchQuery}
                    onChange={(e) => {
                      const q = e.target.value;
                      setOccupantSearchQuery(q);
                      if (q.trim().length >= 2) searchGuests(q, { limit: 8 }).then((r) => { if (r.success && r.data?.guests) setOccupantSearchResults(r.data.guests.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name }))); else setOccupantSearchResults([]); });
                      else setOccupantSearchResults([]);
                    }} className="h-8 text-sm" />
                </div>
                {occupantSearchResults.length > 0 && (
                  <ul className="mt-1 list-none space-y-0.5 text-xs">
                    {occupantSearchResults.filter((g) => !reservationGuests.some((r) => r.guestId === g.id)).slice(0, 5).map((g) => (
                      <li key={g.id}>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-full justify-start text-left font-normal" disabled={addOccupantLoading}
                          onClick={async () => {
                            setAddOccupantLoading(true);
                            const result = await addReservationOccupant(reservation.id, g.id);
                            setAddOccupantLoading(false);
                            if (result.success) { toast.success(`Dodano ${g.name}`); setOccupantSearchQuery(""); setOccupantSearchResults([]); getReservationGuestsForFolio(reservation.id).then((r) => r.success && r.data && setReservationGuests(r.data)); }
                            else toast.error(result.error);
                          }}>+ {g.name}</Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button type="button" variant="outline" size="sm" className="mt-1 h-7 text-xs w-full" disabled={addOccupantLoading}>+ Dodaj gościa</Button>
              </div>
            )}
          </div>
        </section>

        {/* 4. UWAGI */}
        <section>
          <h3 className={sectionHeader}>📝 UWAGI</h3>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Uwagi zewnętrzne</Label>
            <textarea id="uni-notes" className={textareaClass} value={form.notes} onChange={(e) => onFormChange({ notes: e.target.value })} placeholder="Uwagi…" rows={2} maxLength={2000} />
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input type="checkbox" checked={form.showNotesOnChart} onChange={(e) => onFormChange({ showNotesOnChart: e.target.checked })} className="rounded border-input" />
              <span>Pokaż uwagi na grafiku</span>
            </label>
            <Label className="text-xs text-muted-foreground">Uwagi wewnętrzne</Label>
            <textarea id="uni-internalNotes" className={textareaClass} value={form.internalNotes} onChange={(e) => onFormChange({ internalNotes: e.target.value })} placeholder="Tylko dla personelu…" rows={2} maxLength={10000} />
            <div className="pt-1 border-t border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={!!(form.reminderDate || form.reminderTime)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const today = new Date().toISOString().slice(0, 10);
                      onFormChange({ reminderDate: form.reminderDate || today, reminderTime: form.reminderTime || "09:00" });
                    } else {
                      onFormChange({ reminderDate: "", reminderTime: "" });
                    }
                  }}
                  className="rounded border-input"
                />
                <span>Przypomnienie do rezerwacji</span>
              </label>
              {(form.reminderDate || form.reminderTime) && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Input type="date" className={inputCompact} value={form.reminderDate} onChange={(e) => onFormChange({ reminderDate: e.target.value })} />
                  <Input type="time" className={inputCompact} value={form.reminderTime} onChange={(e) => onFormChange({ reminderTime: e.target.value })} />
                </div>
              )}
            </div>
          </div>
        </section>

        {isEdit && reservation && (
          <AddChargeDialog
            reservationId={reservation.id}
            open={addChargeDialogOpen}
            onOpenChange={setAddChargeDialogOpen}
            onSuccess={refreshFolios}
            folioNumbers={folioSummaries.length > 0 ? folioSummaries.map((f) => f.folioNumber) : [1]}
            defaultFolioNumber={folioSummaries[0]?.folioNumber ?? 1}
          />
        )}
      </div>
    );
  }

  if (layout === "rozliczenie") {
    const roomTotal = (totalAmount ?? 0) || roomChargesFromTx;
    const naliczono = roomTotal + mealsAmount + otherChargesAmount + localTaxAmount;
    const pozostalo = naliczono - totalPaid;
    const adultsNum = parseInt(form.adults, 10) || 0;
    const child1 = parseInt(form.children, 10) || 0;
    const child2 = 0;
    const child3 = 0;
    const priceA = (form.billingMode === "person" && form.rateCodePrice.trim()) ? parseFloat(form.rateCodePrice) : (pricePerNight ?? 0);
    const priceC = form.pricePerChild.trim() ? parseFloat(form.pricePerChild) : 0;
    const sumPerNight = form.billingMode === "person"
      ? adultsNum * priceA + child1 * priceC + child2 * priceC + child3 * priceC
      : (pricePerNight ?? 0);
    const billingMode = (form.billingMode ?? "room") as "room" | "person" | "plan";

    return (
      <div className="space-y-4">
        {/* F3: Podsumowanie salda w jednym miejscu */}
        <div className="rounded border bg-muted/20 p-3 text-xs space-y-1">
          <h3 className="font-semibold text-muted-foreground border-b pb-1 mb-1">Podsumowanie salda</h3>
          <div className="flex justify-between"><span>Do zapłaty (naliczono)</span><span className="tabular-nums">{naliczono.toFixed(2)} PLN</span></div>
          <div className="flex justify-between"><span>Zapłacono</span><span className="tabular-nums">{totalPaid.toFixed(2)} PLN</span></div>
          <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Saldo</span><span className="tabular-nums">{pozostalo >= 0 ? `${pozostalo.toFixed(2)} PLN` : `(${Math.abs(pozostalo).toFixed(2)}) PLN`}</span></div>
          {folioSummaries.length > 1 && (
            <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
              <span className="text-muted-foreground">Per folio:</span>
              {folioSummaries.map((f) => (
                <div key={f.folioNumber} className="flex justify-between text-muted-foreground">
                  <span>Folio {f.folioNumber}</span>
                  <span className="tabular-nums">{f.balance.toFixed(2)} PLN</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tryb rozliczenia: Cena pokoju / osobo-doba / Plan cenowy */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="price-type" checked={billingMode === "room"} onChange={() => onFormChange({ billingMode: "room" })} className="rounded" />
            <span>Cena pokoju za dobę</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="price-type" checked={billingMode === "person"} onChange={() => onFormChange({ billingMode: "person" })} className="rounded" />
            <span>Cena za osobo-dobę</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="price-type" checked={billingMode === "plan"} onChange={() => onFormChange({ billingMode: "plan" })} className="rounded" />
            <span>Plan cenowy</span>
          </label>
        </div>

        {/* Tabela cen: Osób | Dziecko1 | Dziecko2 | Dziecko3 | Suma/doba */}
        <div className="rounded border bg-muted/20 p-3 text-xs overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 pr-2 font-medium">Osób</th>
                <th className="text-left py-1 pr-2 font-medium">Dziecko1</th>
                <th className="text-left py-1 pr-2 font-medium">Dziecko2</th>
                <th className="text-left py-1 pr-2 font-medium">Dziecko3</th>
                <th className="text-right py-1 font-medium">Suma/doba</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1 pr-2">
                  {billingMode === "person" ? <Input type="number" min={0} className="h-6 w-14 text-xs" value={form.adults} onChange={(e) => onFormChange({ adults: e.target.value })} /> : <span className="tabular-nums">{adultsNum}</span>}
                </td>
                <td className="py-1 pr-2">
                  {billingMode === "person" ? <Input type="number" min={0} className="h-6 w-14 text-xs" value={form.children} onChange={(e) => onFormChange({ children: e.target.value })} /> : <span className="tabular-nums">{child1}</span>}
                </td>
                <td className="py-1 pr-2 tabular-nums">{child2}</td>
                <td className="py-1 pr-2 tabular-nums">{child3}</td>
                <td className="py-1 text-right tabular-nums font-medium">{sumPerNight.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2">
                  {billingMode === "person" ? <Input type="number" min={0} step={0.01} className="h-6 w-16 text-xs tabular-nums" value={form.rateCodePrice} onChange={(e) => onFormChange({ rateCodePrice: e.target.value })} placeholder="0" /> : (billingMode === "plan" ? <span className="text-muted-foreground">z cennika</span> : <Input ref={priceInputRef} type="number" min={0} step={0.01} className="h-6 w-16 text-xs tabular-nums" value={form.rateCodePrice} onChange={(e) => onFormChange({ rateCodePrice: e.target.value })} placeholder={priceFromRate != null ? String(priceFromRate) : "—"} />)}
                </td>
                <td className="py-1 pr-2">
                  {billingMode === "person" ? <Input type="number" min={0} step={0.01} className="h-6 w-16 text-xs tabular-nums" value={form.pricePerChild} onChange={(e) => onFormChange({ pricePerChild: e.target.value })} placeholder="0" /> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-1 pr-2 text-muted-foreground">—</td>
                <td className="py-1 pr-2 text-muted-foreground">—</td>
                <td className="py-1 text-right tabular-nums">{sumPerNight.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          {billingMode === "plan" && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <Label className="text-xs text-muted-foreground">Stawka (cennik)</Label>
              <select value={form.rateCodeId} onChange={(e) => { const c = rateCodes.find((r) => r.id === e.target.value); onFormChange({ rateCodeId: e.target.value, rateCodePrice: c?.price != null ? String(c.price) : "" }); }} className={selectClass}>
                <option value="">— wybierz —</option>
                {rateCodes.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.name}{c.price != null ? ` (${c.price.toFixed(2)} PLN)` : ""}</option>)}
              </select>
            </div>
          )}
          {nights > 0 && (billingMode === "room" || billingMode === "plan") && (
            <div className="mt-2 flex justify-between border-t pt-1"><span className="text-muted-foreground">Suma za pokój</span><span className="tabular-nums font-medium">{(pricePerNight ?? 0) * nights} PLN</span></div>
          )}
        </div>

        {/* Podgląd cennika */}
        <details className="rounded border bg-muted/10 text-xs">
          <summary className="cursor-pointer px-2 py-1.5 font-medium text-muted-foreground hover:text-foreground">▶ Rozwiń cennik (klik)</summary>
          <div className="border-t px-2 py-1.5 space-y-0.5">
            {rateCodes.length > 0 ? (
              rateCodes.map((c) => (
                <button key={c.id} type="button" className="w-full flex justify-between items-center text-left px-1.5 py-0.5 rounded hover:bg-muted/50"
                  onClick={() => { onFormChange({ rateCodeId: c.id, rateCodePrice: c.price != null ? String(c.price) : "" }); priceInputRef.current?.focus(); }}>
                  <span>{c.code} – {c.name}</span>
                  <span className="tabular-nums text-muted-foreground">{c.price != null ? `${c.price.toFixed(2)} PLN` : "—"}</span>
                </button>
              ))
            ) : fallbackPricesFromRooms.length > 0 ? (
              fallbackPricesFromRooms.map((f) => (
                <button key={f.key} type="button" className="w-full flex justify-between items-center text-left px-1.5 py-0.5 rounded hover:bg-muted/50"
                  onClick={() => { onFormChange({ rateCodePrice: String(f.price) }); priceInputRef.current?.focus(); }}>
                  <span>{f.label}</span>
                  <span className="tabular-nums text-muted-foreground">{f.price.toFixed(2)} PLN</span>
                </button>
              ))
            ) : (
              <p className="text-muted-foreground py-1">Brak stawek.</p>
            )}
          </div>
        </details>

        {/* Rabat gościa (CRM) — info + Zastosuj */}
        {activeGuestDiscountLoading && (
          <p className="text-xs text-muted-foreground">Sprawdzanie rabatu gościa…</p>
        )}
        {!activeGuestDiscountLoading && activeGuestDiscount && (
          <div className="rounded border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            <p className="font-medium text-primary">
              Gość ma aktywny rabat: {activeGuestDiscount.percentage}%
              {activeGuestDiscount.reason && ` (${activeGuestDiscount.reason})`}
              {" "}do {activeGuestDiscount.dateTo}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1.5 h-6 text-[10px]"
              onClick={() => onFormChange({ discountPercent: String(activeGuestDiscount.percentage) })}
            >
              Zastosuj rabat
            </Button>
          </div>
        )}

        {/* Rabat za nocleg [%] */}
        <div className="flex items-center gap-2 text-xs">
          <Label className="text-muted-foreground">Rabat za nocleg [%]</Label>
          <Input type="number" min={0} max={100} step={1} className="h-6 w-14 text-xs" value={form.discountPercent} onChange={(e) => onFormChange({ discountPercent: e.target.value })} />
          {isEdit && reservation?.id && parseFloat(form.discountPercent || "0") > 0 && (
            <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={async () => {
              const pct = parseFloat(form.discountPercent || "0");
              if (Number.isNaN(pct) || pct <= 0) return;
              const r = await addFolioDiscount({ reservationId: reservation.id, discountType: "PERCENT", discountValue: pct });
              if (r.success) { toast.success("Dodano rabat %"); refreshFolios(); } else toast.error(r.error);
            }}>Zastosuj</Button>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={form.addLocalTax} onChange={(e) => onFormChange({ addLocalTax: e.target.checked })} className="rounded border-input" />
          <span>Dolicz opłatę miejscową</span>
        </label>
        {form.addLocalTax && isEdit && !hasLocalTax && reservation?.id && (
          <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" disabled={localTaxLoading} onClick={async () => {
            if (!reservation?.id) return;
            setLocalTaxLoading(true);
            const r = await chargeLocalTax(reservation.id);
            setLocalTaxLoading(false);
            if (r.success && r.data) {
              if (r.data.skipped) toast.info("Opłata miejscowa już naliczona.");
              else toast.success(`Naliczono opłatę miejscową: ${r.data.amount?.toFixed(2)} PLN`);
              getTransactionsForReservation(reservation.id).then((res) => res.success && res.data && setTransactions(res.data));
            } else toast.error("error" in r ? r.error : "Błąd naliczania opłaty miejscowej");
          }}>{localTaxLoading ? "…" : "Nalicz"}</Button>
        )}

        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={form.cardGuaranteed} onChange={(e) => onFormChange({ cardGuaranteed: e.target.checked })} className="rounded border-input" />
          <span>Płatność gwarantowana kartą kredytową</span>
        </label>

        <div className="flex items-center gap-2 text-xs">
          <Label className="text-muted-foreground">Termin wpłaty zaliczki</Label>
          <Input type="date" className="h-6 w-36 text-xs" value={form.depositDueDate} onChange={(e) => onFormChange({ depositDueDate: e.target.value })} />
        </div>

        {/* Podsumowanie kosztów (KWHotel) */}
        <div className="rounded border bg-muted/10 p-3 text-xs space-y-1">
          <div className="flex justify-between"><span>Cena za noclegi</span><span className="tabular-nums">{roomTotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Cena za posiłki</span><span className="tabular-nums">{mealsAmount.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Dodatkowe towary i usługi</span><span className="tabular-nums">{otherChargesAmount.toFixed(2)}</span></div>
          <div className="flex justify-between items-center gap-2">
            <span>Opłata miejscowa</span>
            <span className="tabular-nums">{localTaxAmount.toFixed(2)}</span>
            {isEdit && !hasLocalTax && reservation?.id && (
              <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2" disabled={localTaxLoading}
                onClick={async () => {
                  if (!reservation?.id) return;
                  setLocalTaxLoading(true);
                  const r = await chargeLocalTax(reservation.id);
                  setLocalTaxLoading(false);
                  if (r.success && r.data) {
                    if (r.data.skipped) toast.info("Opłata miejscowa już naliczona.");
                    else toast.success(`Naliczono opłatę miejscową: ${r.data.amount?.toFixed(2)} PLN`);
                    getTransactionsForReservation(reservation.id).then((res) => res.success && res.data && setTransactions(res.data));
                  } else toast.error("error" in r ? r.error : "Błąd naliczania opłaty miejscowej");
                  }}>
                {localTaxLoading ? "…" : "Nalicz"}
              </Button>
            )}
          </div>
          <div className="border-t pt-1 mt-1" />
          <div className="flex justify-between font-medium"><span>Naliczono</span><span className="tabular-nums">{naliczono.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Kwota do zapłaty</span><span className="tabular-nums">{naliczono.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Wpłaty</span><span className="tabular-nums">{totalPaid.toFixed(2)}</span></div>
          <div className="border-t pt-1 mt-1" />
          <div className="flex justify-between font-bold text-sm"><span>POZOSTAŁO DO ZAPŁATY</span><span className="tabular-nums">{Math.max(0, pozostalo).toFixed(2)} PLN</span></div>
        </div>

        {/* Wpłata, Zapłacono, Zaliczka, Voucher, Kaucja */}
        {isEdit && reservation?.id && (
          <div className="rounded border bg-muted/10 p-3 text-xs space-y-3">
            <h4 className="font-medium text-muted-foreground">Wpłaty</h4>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-muted-foreground">Wpłata</Label>
              <Input type="number" min={0} step={0.01} className="h-6 w-24 text-right text-xs tabular-nums" value={form.paymentAmount} onChange={(e) => onFormChange({ paymentAmount: e.target.value })} placeholder="0,00" />
              <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => onFormChange({ paymentAmount: Math.max(0, pozostalo).toFixed(2) })}>Zapłacono</Button>
              <select className="h-6 rounded border border-input bg-background px-2 text-xs w-24" value={form.paymentMethod} onChange={(e) => onFormChange({ paymentMethod: e.target.value })}>
                <option value="CASH">Gotówka</option><option value="CARD">Karta</option><option value="TRANSFER">Przelew</option><option value="PREPAID">Przedpłata</option>
              </select>
              <Button type="button" size="sm" className="h-6 text-[10px]" disabled={paymentRegisterLoading || !form.paymentAmount || parseFloat(form.paymentAmount) <= 0}
                onClick={async () => {
                  const amt = parseFloat(form.paymentAmount || "0");
                  if (Number.isNaN(amt) || amt <= 0) return;
                  setPaymentRegisterLoading(true);
                  const r = await addFolioPayment({ reservationId: reservation.id, amount: amt, paymentMethod: (form.paymentMethod || "CASH") as "CASH" | "CARD" | "TRANSFER" | "PREPAID" });
                  setPaymentRegisterLoading(false);
                  if (r.success) { toast.success(`Zarejestrowano wpłatę: ${amt.toFixed(2)} PLN`); onFormChange({ paymentAmount: "" }); refreshFolios(); getTransactionsForReservation(reservation.id).then((res) => res.success && res.data && setTransactions(res.data)); }
                  else toast.error(r.error);
                }}>{paymentRegisterLoading ? "Zapisywanie…" : "Zapisz wpłatę"}</Button>
            </div>
            <div className="grid grid-cols-1 gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-muted-foreground w-24">Zaliczka</Label>
                <span className="tabular-nums text-right w-16">{transactions.filter((t) => t.type === "DEPOSIT").reduce((s, t) => s + Math.abs(t.amount), 0).toFixed(2)}</span>
                <Input type="number" min={0} step={0.01} className="h-6 w-24 text-right text-xs tabular-nums" value={form.advanceAmount} onChange={(e) => onFormChange({ advanceAmount: e.target.value })} placeholder="0,00" />
                <Button type="button" size="sm" className="h-6 text-[10px]" disabled={advanceLoading || !form.advanceAmount || parseFloat(form.advanceAmount) <= 0}
                  onClick={async () => {
                    const amt = parseFloat(form.advanceAmount || "0");
                    if (Number.isNaN(amt) || amt <= 0) return;
                    setAdvanceLoading(true);
                    const r = await addFolioPayment({ reservationId: reservation.id, amount: amt, paymentMethod: "TRANSFER", description: "Zaliczka" });
                    setAdvanceLoading(false);
                    if (r.success) { toast.success(`Zarejestrowano zaliczkę: ${amt.toFixed(2)} PLN`); onFormChange({ advanceAmount: "" }); refreshFolios(); getTransactionsForReservation(reservation.id).then((res) => res.success && res.data && setTransactions(res.data)); }
                    else toast.error(r.error);
                  }}>{advanceLoading ? "…" : "Zapisz zaliczkę"}</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-muted-foreground w-32">Voucher / dofinans.</Label>
                <Input type="number" min={0} step={0.01} className="h-6 w-24 text-right text-xs tabular-nums" value={form.voucherAmount} onChange={(e) => onFormChange({ voucherAmount: e.target.value })} placeholder="0,00" />
                <select className="h-6 rounded border border-input bg-background px-2 text-xs w-28" value={form.voucherType} onChange={(e) => onFormChange({ voucherType: e.target.value })}>
                  {VOUCHER_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <Button type="button" size="sm" className="h-6 text-[10px]" disabled={voucherLoading || !form.voucherAmount || parseFloat(form.voucherAmount) <= 0}
                  onClick={async () => {
                    const amt = parseFloat(form.voucherAmount || "0");
                    if (Number.isNaN(amt) || amt <= 0) return;
                    setVoucherLoading(true);
                    const desc = VOUCHER_TYPE_OPTIONS.find((o) => o.value === form.voucherType)?.label ?? "Voucher";
                    const r = await addFolioPayment({ reservationId: reservation.id, amount: amt, paymentMethod: "VOUCHER", description: desc });
                    setVoucherLoading(false);
                    if (r.success) { toast.success(`Zarejestrowano ${desc.toLowerCase()}: ${amt.toFixed(2)} PLN`); onFormChange({ voucherAmount: "" }); refreshFolios(); getTransactionsForReservation(reservation.id).then((res) => res.success && res.data && setTransactions(res.data)); }
                    else toast.error(r.error);
                  }}>{voucherLoading ? "…" : "Zapisz"}</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-muted-foreground w-24">Kaucja</Label>
                <span className="tabular-nums text-right w-16">{transactions.filter((t) => t.type === "SECURITY_DEPOSIT").reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0).toFixed(2)}</span>
                <span className="text-muted-foreground text-[10px]">PLN</span>
                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => { setShowCollectDeposit(true); setShowRefundDeposit(false); setOpenKaucjaDetails(true); }}>Pobierz kaucję</Button>
                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => { setShowRefundDeposit(true); setShowCollectDeposit(false); setOpenKaucjaDetails(true); }}>Zwróć kaucję</Button>
              </div>
            </div>
          </div>
        )}

        {/* Nalicz nocleg */}
        {isEdit && (pricePerNight != null && pricePerNight > 0) && (
          transactions.some((t) => t.type === "ROOM") ? (
            <p className="text-[10px] text-green-600 dark:text-green-400">✓ Nocleg naliczony</p>
          ) : (
            reservation?.id && nights > 0 && (
              <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs" disabled={roomChargeLoading}
                onClick={async () => {
                  if (!reservation?.id) return;
                  setRoomChargeLoading(true);
                  const result = await postRoomChargeOnCheckout(reservation.id);
                  setRoomChargeLoading(false);
                  if (result.success && result.data) {
                    if (result.data.skipped) toast.info("Nocleg już był naliczony.");
                    else toast.success(`Naliczono nocleg: ${result.data.amount?.toFixed(2)} PLN`);
                    getTransactionsForReservation(reservation.id).then((r) => r.success && r.data && setTransactions(r.data));
                  } else toast.error("error" in result ? result.error : "Błąd naliczania noclegu");
                }}>
                <Banknote className="mr-1 h-3 w-3" />
                {roomChargeLoading ? "Naliczanie..." : "Nalicz nocleg"}
              </Button>
            )
          )
        )}

        {/* Folio section – pełna wersja (Kaucja, Folio lista, pozycje, rabat) */}
        {isEdit && reservation?.id && (
          <details className="rounded border bg-muted/20 text-xs" open>
            <summary className="flex cursor-pointer items-center gap-1 px-2 py-1 text-xs font-medium">
              <SplitSquareVertical className="h-3 w-3" />
              Folio
            </summary>
            <div className="space-y-1.5 border-t px-2 pb-2 pt-1">
              {/* Goście w pokoju – też w zakładce Rozliczenie (dla kontekstu) */}
              <div className="rounded border border-border/50 p-1.5">
                <p className="mb-1 text-[10px] font-medium text-muted-foreground">Goście w pokoju</p>
                <ul className="list-none space-y-0.5 text-xs">
                  {reservationGuests.map((g) => (
                    <li key={g.guestId} className="flex items-center justify-between gap-2 rounded bg-muted/30 px-2 py-1">
                      <span>{g.name} {g.isPrimary ? "(główny)" : ""}</span>
                      <div className="flex items-center gap-0.5">
                        <a href={`/guests/${g.guestId}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edycja klienta">
                          <Pencil className="h-3 w-3" />
                        </a>
                        {!g.isPrimary && (
                          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive"
                            onClick={async () => {
                              const result = await removeReservationOccupant(reservation.id, g.guestId);
                              if (result.success) {
                                toast.success("Usunięto gościa z pokoju");
                                getReservationGuestsForFolio(reservation.id).then((r) => r.success && r.data && setReservationGuests(r.data));
                              } else toast.error(result.error);
                            }}>Usuń</Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <Input type="text" placeholder="Wyszukaj gościa (min. 2 znaki)" value={occupantSearchQuery}
                    onChange={(e) => {
                      const q = e.target.value;
                      setOccupantSearchQuery(q);
                      if (q.trim().length >= 2) {
                        searchGuests(q, { limit: 8 }).then((r) => {
                          if (r.success && r.data?.guests) setOccupantSearchResults(r.data.guests.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
                          else setOccupantSearchResults([]);
                        });
                      } else setOccupantSearchResults([]);
                    }} className="h-8 text-sm" />
                </div>
                {occupantSearchResults.length > 0 && (
                  <ul className="mt-1 list-none space-y-0.5 text-xs">
                    {occupantSearchResults.filter((g) => !reservationGuests.some((r) => r.guestId === g.id)).slice(0, 5).map((g) => (
                      <li key={g.id}>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-full justify-start text-left font-normal" disabled={addOccupantLoading}
                          onClick={async () => {
                            setAddOccupantLoading(true);
                            const result = await addReservationOccupant(reservation.id, g.id);
                            setAddOccupantLoading(false);
                            if (result.success) {
                              toast.success(`Dodano ${g.name} do pokoju`);
                              setOccupantSearchQuery(""); setOccupantSearchResults([]);
                              getReservationGuestsForFolio(reservation.id).then((r) => r.success && r.data && setReservationGuests(r.data));
                            } else toast.error(result.error);
                          }}>+ {g.name}</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Kaucja */}
              <details className="rounded border border-border/50" open={openKaucjaDetails} onToggle={(e) => setOpenKaucjaDetails((e.target as HTMLDetailsElement).open)}>
                <summary className="cursor-pointer px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <Banknote className="mr-1.5 inline-block h-4 w-4" />Kaucja za pokój
                </summary>
                <div className="border-t px-2 py-2 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => { setShowCollectDeposit(!showCollectDeposit); setShowRefundDeposit(false); }}>Pobierz kaucję</Button>
                    <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => { setShowRefundDeposit(!showRefundDeposit); setShowCollectDeposit(false); }}>Zwróć kaucję</Button>
                  </div>
                  {showCollectDeposit && (
                    <div className="rounded border bg-muted/10 p-2 space-y-2 text-xs">
                      <Label className="text-xs">Kwota (PLN)</Label>
                      <Input type="number" min={0.01} step={0.01} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="np. 500" className="h-8 w-28" />
                      <Label className="text-xs">Metoda płatności</Label>
                      <select className="h-8 rounded border border-input bg-background px-2 w-32 text-xs" value={depositPaymentMethod} onChange={(e) => setDepositPaymentMethod(e.target.value)}>
                        <option value="CASH">Gotówka</option><option value="CARD">Karta</option><option value="TRANSFER">Przelew</option><option value="PREPAID">Przedpłata</option>
                      </select>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" disabled={collectDepositLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                          onClick={async () => {
                            if (collectDepositInFlightRef.current) return;
                            const amt = parseFloat(depositAmount);
                            if (Number.isNaN(amt) || amt <= 0) { toast.error("Kwota kaucji musi być większa od zera."); return; }
                            collectDepositInFlightRef.current = true; setCollectDepositLoading(true);
                            try {
                              const r = await collectSecurityDeposit({ reservationId: reservation.id, amount: amt, paymentMethod: depositPaymentMethod as "CASH" | "CARD" | "TRANSFER" | "PREPAID" });
                              if (r.success) { toast.success(`Pobrano kaucję: ${amt.toFixed(2)} PLN`); setDepositAmount(""); setShowCollectDeposit(false); refreshFolios(); }
                              else toast.error("error" in r ? (r.error ?? "Błąd pobierania kaucji") : "Błąd pobierania kaucji");
                            } finally { collectDepositInFlightRef.current = false; setCollectDepositLoading(false); }
                          }}>{collectDepositLoading ? "Zapisywanie…" : "Zapisz"}</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowCollectDeposit(false); setDepositAmount(""); }}>Anuluj</Button>
                      </div>
                    </div>
                  )}
                  {showRefundDeposit && (
                    <div className="rounded border bg-muted/10 p-2 space-y-2 text-xs">
                      <Label className="text-xs">Kwota do zwrotu (PLN, puste = całość)</Label>
                      <Input type="number" min={0} step={0.01} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Całość" className="h-8 w-28" />
                      <Label className="text-xs">Potrącenie (PLN, opcjonalnie)</Label>
                      <Input type="number" min={0} step={0.01} value={refundDeduction} onChange={(e) => setRefundDeduction(e.target.value)} placeholder="0" className="h-8 w-28" />
                      <Label className="text-xs">Powód potrącenia</Label>
                      <Input type="text" value={refundDeductionReason} onChange={(e) => setRefundDeductionReason(e.target.value)} placeholder="np. minibar, uszkodzenia" className="h-8 w-48" />
                      <Label className="text-xs">Metoda zwrotu</Label>
                      <select className="h-8 rounded border border-input bg-background px-2 w-32 text-xs" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                        <option value="CASH">Gotówka</option><option value="CARD">Karta</option><option value="TRANSFER">Przelew</option>
                      </select>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" disabled={refundDepositLoading}
                          onClick={async () => {
                            setRefundDepositLoading(true);
                            const r = await refundSecurityDeposit({ reservationId: reservation.id, refundAmount: refundAmount.trim() ? parseFloat(refundAmount) : undefined, deductionAmount: refundDeduction.trim() ? parseFloat(refundDeduction) : undefined, deductionReason: refundDeductionReason.trim() || undefined, refundMethod: refundMethod as "CASH" | "CARD" | "TRANSFER" });
                            setRefundDepositLoading(false);
                            if (r.success) { toast.success(r.data?.refundAmount ? `Zwrócono kaucję: ${r.data.refundAmount.toFixed(2)} PLN` : "Zapisano potrącenie z kaucji"); setRefundAmount(""); setRefundDeduction(""); setRefundDeductionReason(""); setShowRefundDeposit(false); refreshFolios(); }
                            else toast.error("error" in r ? (r.error ?? "Błąd zwrotu kaucji") : "Błąd zwrotu kaucji");
                          }}>{refundDepositLoading ? "Zapisywanie…" : "Zwróć"}</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowRefundDeposit(false); setRefundAmount(""); setRefundDeduction(""); setRefundDeductionReason(""); }}>Anuluj</Button>
                      </div>
                    </div>
                  )}
                </div>
              </details>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAddChargeDialogOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Dodaj obciążenie
                </Button>
              </div>
              {folioSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak folio.</p>
              ) : (
                <ul className="list-none space-y-2">
                  {folioSummaries.map((f) => (
                    <li key={f.folioNumber} className="rounded border px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">Folio #{f.folioNumber}</span>
                        <span className="text-muted-foreground text-xs">
                          {f.totalCharges.toFixed(2)}{f.totalDiscounts > 0 && ` -${f.totalDiscounts.toFixed(2)}`} / {f.totalPayments.toFixed(2)} PLN · Saldo: {f.balance.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                        {f.billTo === "COMPANY" && f.companyName ? (
                          <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />Firma: {f.companyName}{f.label ? ` · ${f.label}` : ""}</span>
                        ) : (
                          <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />Gość: {f.guestName ?? "Główny gość"}{f.label ? ` · ${f.label}` : ""}</span>
                        )}
                        {editingFolioNumber === f.folioNumber ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingFolioNumber(null)}>Anuluj</Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" className="h-6 text-xs"
                            onClick={() => {
                              setEditingFolioNumber(f.folioNumber); setEditBillTo(f.billTo ?? "GUEST"); setEditGuestId(f.guestId ?? reservation?.guestId ?? ""); setEditCompanyId(f.companyId ?? ""); setEditLabel(f.label ?? ""); setCompanySearchQuery(f.companyName ?? "");
                              if (f.companyName && f.companyId) setCompanyOptions([{ id: f.companyId, nip: "", name: f.companyName, city: null }]);
                            }}>Ustaw płatnika</Button>
                        )}
                      </div>
                      {editingFolioNumber === f.folioNumber && (
                        <div className="mt-3 space-y-2 rounded border bg-background p-2">
                          <div className="flex gap-2">
                            <Label className="shrink-0 pt-2 text-xs">Płatnik</Label>
                            <div className="flex flex-1 gap-2">
                              <label className="flex cursor-pointer items-center gap-1.5 text-sm"><input type="radio" name={`rb-${f.folioNumber}`} checked={editBillTo === "GUEST"} onChange={() => setEditBillTo("GUEST")} className="rounded" />Gość</label>
                              <label className="flex cursor-pointer items-center gap-1.5 text-sm"><input type="radio" name={`rb-${f.folioNumber}`} checked={editBillTo === "COMPANY"} onChange={() => setEditBillTo("COMPANY")} className="rounded" />Firma</label>
                            </div>
                          </div>
                          {editBillTo === "GUEST" && reservationGuests.length > 0 && (
                            <div className="space-y-1">
                              <Label className="text-xs">Który gość</Label>
                              <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={editGuestId} onChange={(e) => setEditGuestId(e.target.value)}>
                                {reservationGuests.map((g) => <option key={g.guestId} value={g.guestId}>{g.name} {g.isPrimary ? "(główny)" : ""}</option>)}
                              </select>
                            </div>
                          )}
                          {editBillTo === "COMPANY" && (
                            <div className="space-y-1">
                              <Label className="text-xs">Firma (wyszukaj min. 2 znaki)</Label>
                              <Input type="text" value={companySearchQuery} onChange={(e) => setCompanySearchQuery(e.target.value)} placeholder="Nazwa lub NIP firmy" className="h-8 text-sm" />
                              {companyOptions.length > 0 && (
                                <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={editCompanyId}
                                  onChange={(e) => { const c = companyOptions.find((x) => x.id === e.target.value); if (c) { setEditCompanyId(c.id); setCompanySearchQuery(c.name); } }}>
                                  <option value="">— wybierz firmę —</option>
                                  {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name} {c.nip ? `(${c.nip})` : ""}</option>)}
                                </select>
                              )}
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-xs">Etykieta (opcjonalnie)</Label>
                            <Input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="np. Gość prywatnie" className="h-8 text-sm" />
                          </div>
                          <Button type="button" size="sm" disabled={folioActionLoading}
                            onClick={async () => {
                              setFolioActionLoading(true);
                              const result = await setFolioAssignment({ reservationId: reservation.id, folioNumber: f.folioNumber, billTo: editBillTo, guestId: editBillTo === "GUEST" ? (editGuestId || null) : null, companyId: editBillTo === "COMPANY" ? editCompanyId || null : null, label: editLabel.trim() || null });
                              setFolioActionLoading(false);
                              if (result.success) { toast.success("Płatnik folio zapisany"); setEditingFolioNumber(null); refreshFolios(); }
                              else toast.error("error" in result ? (result.error ?? "Błąd zapisu") : "Błąd zapisu");
                            }}>{folioActionLoading ? "Zapisywanie…" : "Zapisz"}</Button>
                        </div>
                      )}
                      <details className="mt-2 rounded border border-border/50"
                        onToggle={(e) => { const d = e.currentTarget; if (d.open && !folioItemsByNumber[f.folioNumber] && loadingItemsFolio !== f.folioNumber) loadFolioItems(f.folioNumber); }}>
                        <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                          <ArrowRightLeft className="h-3.5 w-3.5" />Pozycje {loadingItemsFolio === f.folioNumber ? "(ładowanie…)" : folioItemsByNumber[f.folioNumber] ? `(${folioItemsByNumber[f.folioNumber].length})` : ""}
                        </summary>
                        <div className="border-t px-2 py-2">
                          {loadingItemsFolio === f.folioNumber ? (
                            <p className="text-xs text-muted-foreground">Ładowanie…</p>
                          ) : (folioItemsByNumber[f.folioNumber]?.length ?? 0) === 0 ? (
                            <p className="text-xs text-muted-foreground">Brak aktywnych pozycji w tym folio.</p>
                          ) : (
                            <>
                              <ul className="list-none space-y-1.5">
                                {folioItemsByNumber[f.folioNumber]?.map((item) => (
                                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/20 px-2 py-1.5 text-xs">
                                    <span className="font-medium">{item.type === "DISCOUNT" ? "Rabat" : item.type}</span>
                                    <span>{item.description ?? ""} · {item.type === "DISCOUNT" ? "-" : ""}{item.amount.toFixed(2)} PLN</span>
                                    <div className="flex items-center gap-1">
                                      {folioSummaries.length > 1 && (
                                        <select className="h-7 rounded border border-input bg-background px-1.5 text-xs" value=""
                                          onChange={async (e) => {
                                            const target = parseInt(e.target.value, 10);
                                            if (Number.isNaN(target)) return;
                                            setTransferLoadingId(item.id);
                                            const result = await transferFolioItem({ transactionId: item.id, targetFolioNumber: target });
                                            setTransferLoadingId(null);
                                            if (result.success) { toast.success(`Przeniesiono do folio #${target}`); refreshFolios(); loadFolioItems(f.folioNumber); loadFolioItems(target); }
                                            else toast.error("error" in result ? (result.error ?? "Błąd przenoszenia") : "Błąd przenoszenia");
                                            e.target.value = "";
                                          }} disabled={!!transferLoadingId}>
                                          <option value="">Przenieś…</option>
                                          {folioSummaries.filter((o) => o.folioNumber !== f.folioNumber).map((o) => <option key={o.folioNumber} value={o.folioNumber}>Folio #{o.folioNumber}</option>)}
                                        </select>
                                      )}
                                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" title="Usuń pozycję"
                                        onClick={() => { setVoidItemId(item.id); setVoidItemReason(""); }}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-3 space-y-2 rounded border border-dashed border-muted-foreground/40 bg-muted/10 p-2">
                                {discountFolioNumber === f.folioNumber ? (
                                  <>
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Percent className="h-3.5 w-3.5" /> Rabat</div>
                                    <div className="flex flex-col gap-2">
                                      <div className="flex flex-wrap items-center gap-3 text-xs">
                                        <label className="flex items-center gap-1.5"><input type="radio" name={`ds-r-${f.folioNumber}`} checked={discountScope === "RESERVATION"} onChange={() => { setDiscountScope("RESERVATION"); setDiscountAppliesToTransactionId(null); }} className="rounded border-input" />Na całe folio</label>
                                        <label className="flex items-center gap-1.5"><input type="radio" name={`ds-r-${f.folioNumber}`} checked={discountScope === "LINE_ITEM"} onChange={() => { setDiscountScope("LINE_ITEM"); setDiscountAppliesToTransactionId(null); if (!folioItemsByNumber[f.folioNumber]) loadFolioItems(f.folioNumber); }} className="rounded border-input" />Na pozycję</label>
                                      </div>
                                      {discountScope === "LINE_ITEM" && (
                                        <select className="h-8 max-w-xs rounded border border-input bg-background px-2 text-xs" value={discountAppliesToTransactionId ?? ""} onChange={(e) => setDiscountAppliesToTransactionId(e.target.value || null)}>
                                          <option value="">— wybierz pozycję —</option>
                                          {(folioItemsByNumber[f.folioNumber] ?? []).filter((it) => it.type !== "DISCOUNT" && it.type !== "PAYMENT" && it.amount > 0).map((it) => <option key={it.id} value={it.id}>{it.description || it.type} — {Number(it.amount).toFixed(2)} PLN</option>)}
                                        </select>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-end gap-2">
                                      <label className="flex flex-col gap-0.5 text-xs"><span>Typ</span>
                                        <select className="h-8 rounded border border-input bg-background px-2 text-xs" value={discountType} onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "FIXED")}>
                                          <option value="PERCENT">Procent (%)</option><option value="FIXED">Kwota (PLN)</option>
                                        </select>
                                      </label>
                                      <label className="flex flex-col gap-0.5 text-xs"><span>{discountType === "PERCENT" ? "Procent (0–100)" : "Kwota (PLN)"}</span>
                                        <Input type="number" min={discountType === "PERCENT" ? 0 : 0.01} max={discountType === "PERCENT" ? 100 : undefined} step={discountType === "PERCENT" ? 1 : 0.01} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "PERCENT" ? "np. 10" : "np. 50.00"} className="h-8 w-24 text-xs" />
                                      </label>
                                      <Input type="text" value={discountDescription} onChange={(e) => setDiscountDescription(e.target.value)} placeholder="Opis (opcjonalnie)" className="h-8 w-32 text-xs" />
                                      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground"><span>PIN managera</span>
                                        <Input type="password" inputMode="numeric" autoComplete="off" value={discountManagerPin} onChange={(e) => setDiscountManagerPin(e.target.value)} placeholder="Opcjonalnie" className="h-8 w-20 text-xs" />
                                      </label>
                                      <Button type="button" size="sm" disabled={addDiscountLoading || !discountValue.trim() || (discountScope === "LINE_ITEM" && !discountAppliesToTransactionId)}
                                        onClick={async () => {
                                          const num = parseFloat(discountValue);
                                          if (Number.isNaN(num) || (discountType === "PERCENT" && (num < 0 || num > 100)) || (discountType === "FIXED" && num <= 0)) { toast.error(discountType === "PERCENT" ? "Wprowadź procent 0–100" : "Wprowadź kwotę rabatu > 0"); return; }
                                          if (discountScope === "LINE_ITEM" && !discountAppliesToTransactionId?.trim()) { toast.error("Wybierz pozycję do rabatowania"); return; }
                                          setAddDiscountLoading(true);
                                          const result = await addFolioDiscount({ reservationId: reservation.id, folioNumber: f.folioNumber, appliesToTransactionId: discountScope === "LINE_ITEM" ? discountAppliesToTransactionId : undefined, discountType, discountValue: num, description: discountDescription.trim() || undefined, managerPin: discountManagerPin.trim() || undefined });
                                          setAddDiscountLoading(false);
                                          if (result.success) { toast.success(`Dodano rabat: ${result.data?.discountAmount.toFixed(2) ?? ""} PLN`); setDiscountValue(""); setDiscountDescription(""); setDiscountFolioNumber(null); setDiscountScope("RESERVATION"); setDiscountAppliesToTransactionId(null); refreshFolios(); loadFolioItems(f.folioNumber); }
                                          else toast.error("error" in result ? (result.error ?? "Błąd dodawania rabatu") : "Błąd dodawania rabatu");
                                        }}>{addDiscountLoading ? "Dodawanie…" : "Dodaj rabat"}</Button>
                                      <Button type="button" variant="ghost" size="sm" onClick={() => { setDiscountFolioNumber(null); setDiscountValue(""); setDiscountDescription(""); setDiscountScope("RESERVATION"); setDiscountAppliesToTransactionId(null); setDiscountManagerPin(""); }}>Anuluj</Button>
                                    </div>
                                  </>
                                ) : (
                                  <Button type="button" variant="outline" size="sm" className="text-xs"
                                    onClick={() => { setDiscountFolioNumber(f.folioNumber); setDiscountScope("RESERVATION"); setDiscountAppliesToTransactionId(null); if (!folioItemsByNumber[f.folioNumber]) loadFolioItems(f.folioNumber); }}>
                                    <Banknote className="mr-1 h-3.5 w-3.5" />Dodaj rabat
                                  </Button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
              {folioSummaries.length > 0 && folioSummaries.length < 10 && (
                <Button type="button" variant="outline" size="sm" disabled={newFolioLoading}
                  onClick={async () => {
                    setNewFolioLoading(true);
                    const result = await createNewFolio({ reservationId: reservation.id, billTo: "GUEST" });
                    setNewFolioLoading(false);
                    if (result.success && result.data) { toast.success(`Utworzono folio #${result.data.folioNumber}`); refreshFolios(); }
                    else toast.error("error" in result ? (result.error ?? "Błąd tworzenia folio") : "Błąd tworzenia folio");
                  }}>
                  <Plus className="mr-1 h-3.5 w-3.5" />{newFolioLoading ? "Tworzenie…" : "Dodaj folio"}
                </Button>
              )}
            </div>
          </details>
        )}

        {/* Status rezerwacji (w zakładce Rozliczenie) — dynamiczne opcje + Melduj/Wymelduj */}
        <div className="rounded border bg-muted/10 p-3 text-xs">
          <p className="font-medium text-muted-foreground mb-2">STATUS REZERWACJI</p>
          <div className="space-y-1">
            {allowedStatusOptions.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="status-rozliczenie" value={opt.value} checked={form.status === opt.value} onChange={() => onFormChange({ status: opt.value })} className="rounded" />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {isEdit && reservation?.id && form.status === "CONFIRMED" && (
            <Button type="button" size="sm" variant="default" className="mt-2 h-7 text-xs w-full" onClick={async () => {
              if (!reservation?.id) return;
              const r = await updateReservationStatus(reservation.id, "CHECKED_IN");
              if (r.success) { onFormChange({ status: "CHECKED_IN" }); toast.success("Zameldowano gościa"); }
              else toast.error("error" in r ? r.error : "Błąd meldunku");
            }}>▶ Melduj gościa</Button>
          )}
          {isEdit && reservation?.id && form.status === "CHECKED_IN" && (
            <Button type="button" size="sm" variant="secondary" className="mt-2 h-7 text-xs w-full" onClick={async () => {
              if (!reservation?.id) return;
              const r = await updateReservationStatus(reservation.id, "CHECKED_OUT");
              if (r.success) { onFormChange({ status: "CHECKED_OUT" }); toast.success("Wymeldowano i zapisano"); }
              else toast.error("error" in r ? r.error : "Błąd wymeldowania");
            }}>▶ Wymelduj i zapisz</Button>
          )}
        </div>

        {isEdit && reservation && (
          <AddChargeDialog
            reservationId={reservation.id}
            open={addChargeDialogOpen}
            onOpenChange={setAddChargeDialogOpen}
            onSuccess={refreshFolios}
            folioNumbers={folioSummaries.length > 0 ? folioSummaries.map((f) => f.folioNumber) : [1]}
            defaultFolioNumber={folioSummaries[0]?.folioNumber ?? 1}
          />
        )}
      </div>
    );
  }

  // Tu layout jest już tylko "full" (form i rozliczenie zwracają wcześniej)
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_300px]" accessKey={undefined}>
      {/* COL 1: Room & dates (like KW Hotel left side) */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Dane pokoju</h3>

        <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-1">
          <Label className="text-xs text-right text-muted-foreground">🚪 Pokój</Label>
          {rooms.length > 0 ? (
            <select id="uni-room" data-testid="create-reservation-room" value={form.room} onChange={(e) => onFormChange({ room: e.target.value })} required className={selectClass}>
              <option value="">— wybierz —</option>
              {rooms.map((r) => <option key={r.number} value={r.number}>{r.number}{r.type ? ` · ${r.type}` : ""}</option>)}
            </select>
          ) : (
            <Input id="uni-room" className={inputCompact} value={form.room} onChange={(e) => onFormChange({ room: e.target.value })} placeholder="Nr pokoju" required />
          )}

          {roomBeds > 1 && (<>
            <Label className="text-xs text-right text-muted-foreground">🛏️ Łóżek</Label>
            <Input id="uni-beds" type="number" className={inputCompact} min={1} max={roomBeds} value={form.bedsBooked} onChange={(e) => onFormChange({ bedsBooked: e.target.value })} />
          </>)}

          <Label className="text-xs text-right text-muted-foreground">📅 Zameld.</Label>
          <div className="flex flex-col gap-1">
            <Input id="uni-checkIn" data-testid="create-reservation-checkIn" type="date" className={`${inputCompact} w-36`} value={form.checkIn}
              onChange={(e) => { onFormChange({ checkIn: e.target.value, checkOut: e.target.value ? addDays(e.target.value, 1) : form.checkOut }); }} />
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground mr-0.5">doby:</span>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cn(
                    "h-6 min-w-6 rounded border px-1 text-xs font-medium tabular-nums transition-colors",
                    nights === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted/50"
                  )}
                  onClick={() => {
                    if (form.checkIn) onFormChange({ checkOut: addDays(form.checkIn, n) });
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Label className="text-xs text-right text-muted-foreground">📅 Wymeld.</Label>
          <Input id="uni-checkOut" data-testid="create-reservation-checkOut" type="date" className={`${inputCompact} min-w-[140px] ${dateError ? "border-destructive" : ""}`} value={form.checkOut}
            onChange={(e) => onFormChange({ checkOut: e.target.value })} min={form.checkIn ? addDays(form.checkIn, 1) : undefined} />

          <Label className="text-xs text-right text-muted-foreground">🕐 Godz. od</Label>
          <Input id="uni-checkInTime" type="time" className={inputCompact} value={form.checkInTime} onChange={(e) => onFormChange({ checkInTime: e.target.value })} />

          <Label className="text-xs text-right text-muted-foreground">🕐 Godz. do</Label>
          <Input id="uni-checkOutTime" type="time" className={inputCompact} value={form.checkOutTime} onChange={(e) => onFormChange({ checkOutTime: e.target.value })} />

          <Label className="text-xs text-right text-muted-foreground">🅿️ Parking</Label>
          <select id="uni-parking" data-testid="create-reservation-parking" value={form.parkingSpotId} onChange={(e) => onFormChange({ parkingSpotId: e.target.value })} className={selectClass}>
            <option value="">— brak —</option>
            {parkingSpots.map((s) => <option key={s.id} value={s.id}>{s.number}</option>)}
          </select>

          <Label className="text-xs text-right text-muted-foreground">💰 Stawka</Label>
          <select id="uni-rateCode" value={form.rateCodeId} onChange={(e) => onFormChange({ rateCodeId: e.target.value })} className={selectClass}>
            <option value="">— brak —</option>
            {rateCodes.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
          </select>

          <Label className="text-xs text-right text-muted-foreground">📋 Status</Label>
          <select id="uni-status" data-testid="create-reservation-status" value={form.status} onChange={(e) => onFormChange({ status: e.target.value })} className={selectClass}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {!isEdit && (
          <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-1 mt-1">
            <Label className="text-xs text-right text-muted-foreground">👤 Dorośli</Label>
            <Input id="uni-adults" type="number" className={inputCompact} min={1} max={20} value={form.adults} onChange={(e) => onFormChange({ adults: e.target.value })} />
            <Label className="text-xs text-right text-muted-foreground">👶 Dzieci</Label>
            <Input id="uni-children" type="number" className={inputCompact} min={0} max={20} value={form.children} onChange={(e) => onFormChange({ children: e.target.value })} />
            <Label className="text-xs text-right text-muted-foreground">🍽️ Wyżyw.</Label>
            <select id="uni-mealPlan" value={form.mealPlan} onChange={(e) => onFormChange({ mealPlan: e.target.value })} className={selectClass}>
              <option value="">— brak —</option>
              {MEAL_PLAN_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <Label className="text-xs text-right text-muted-foreground">📡 Źródło</Label>
            <select id="uni-source" value={form.source} onChange={(e) => onFormChange({ source: e.target.value })} className={selectClass}>
              <option value="">— brak —</option>
              {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <Label className="text-xs text-right text-muted-foreground">📺 Kanał</Label>
            <select id="uni-channel" value={form.channel} onChange={(e) => onFormChange({ channel: e.target.value })} className={selectClass}>
              <option value="">— brak —</option>
              {CHANNEL_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <Label className="text-xs text-right text-muted-foreground">⏰ Godzina przyjazdu</Label>
            <Input id="uni-eta" type="time" className={inputCompact} value={form.eta} onChange={(e) => onFormChange({ eta: e.target.value })} />
          </div>
        )}

        {isEdit && layout === "full" && (
          <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-1 mt-1">
            <Label className="text-xs text-right text-muted-foreground">👥 Pax</Label>
            <Input id="uni-pax" type="number" className={inputCompact} min={0} max={20} value={form.pax} onChange={(e) => onFormChange({ pax: e.target.value })} />
          </div>
        )}

      </div>

      {/* COL 2: Guest data (like KW Hotel "Dane gościa") */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Dane gościa</h3>

        <div className="space-y-1">
          <div className="relative">
            <Label className="text-xs text-muted-foreground">👤 Imię i nazwisko</Label>
            <Input
              ref={guestInputRef}
              id="uni-guestName"
              data-testid="create-reservation-guest"
              className={inputCompact}
              value={form.guestName}
              onChange={(e) => { onFormChange({ guestName: e.target.value }); onSearchGuest(e.target.value, "name"); }}
              onBlur={() => { setTimeout(() => onSuggestionsOpenChange(false), 250); }}
              onFocus={() => { if (guestSuggestions.length > 0) onSuggestionsOpenChange(true); }}
              onKeyDown={onGuestKeyDown}
              placeholder="Wpisz min. 2 litery…"
              required
              autoComplete="off"
              role="combobox"
              aria-expanded={suggestionsOpen}
              aria-autocomplete="list"
            />
            {renderSuggestionsDropdown("name")}
            {form.guestId && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ Stały gość</span>}
            {isEdit && reservation?.guestId && (
              <a href={`/guests/${reservation.guestId}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-[10px] text-primary hover:underline">Edycja klienta</a>
            )}
          </div>

          {isEdit && reservation?.guestId && localGuestBlacklisted && (
            <div className="flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-xs">
              <span className="font-medium text-red-700 dark:text-red-400">⚠️ UWAGA: Gość na czarnej liście!</span>
              <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px] px-1" disabled={togglingBlacklist} onClick={async () => {
                setTogglingBlacklist(true);
                const res = await updateGuestBlacklist(reservation!.guestId!, false);
                setTogglingBlacklist(false);
                if (res.success) setLocalGuestBlacklisted(false);
              }}>Usuń z listy</Button>
            </div>
          )}
          {isEdit && reservation?.guestId && !localGuestBlacklisted && (
            <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px] px-1 text-muted-foreground" disabled={togglingBlacklist} onClick={async () => {
              setTogglingBlacklist(true);
              const res = await updateGuestBlacklist(reservation!.guestId!, true);
              setTogglingBlacklist(false);
              if (res.success) setLocalGuestBlacklisted(true);
            }}>+ Czarna lista</Button>
          )}

          {isEdit && reservation?.guestId && (
            <details
              className="rounded border bg-muted/20 text-xs"
              onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setGuestHistoryRequested(true); }}
            >
              <summary className="cursor-pointer px-2 py-1 font-medium">
                Historia ({guestHistoryRequested ? guestHistory.length : "?"} pobytów)
              </summary>
              {guestHistoryLoading && <p className="px-2 pb-1 text-muted-foreground">Ładowanie…</p>}
              {!guestHistoryLoading && guestHistory.length === 0 && guestHistoryRequested && (
                <p className="px-2 pb-1 text-muted-foreground">Brak wcześniejszych pobytów.</p>
              )}
              {!guestHistoryLoading && guestHistory.length > 0 && (
              <ul className="list-none px-2 pb-1">
                {guestHistory.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center gap-1 text-[10px]">
                    <span className="font-medium">{r.room}</span>
                    <span className="text-muted-foreground">{r.checkIn}–{r.checkOut}</span>
                    <span className={r.id === reservation?.id ? "text-primary" : "text-muted-foreground"}>
                      {STATUS_OPTIONS.find((s) => s.value === r.status)?.label ?? r.status}
                    </span>
                  </li>
                ))}
              </ul>
              )}
            </details>
          )}

          <div className="relative">
            <Label className="text-xs text-muted-foreground">✉️ Email</Label>
            <Input id="uni-guestEmail" type="text" inputMode="email" className={inputCompact} value={form.guestEmail}
              onChange={(e) => { onFormChange({ guestEmail: e.target.value }); onSearchGuest(e.target.value, "email"); }}
              onBlur={() => { setTimeout(() => { if (suggestionsField === "email") onSuggestionsOpenChange(false); }, 250); }}
              onFocus={() => { if (guestSuggestions.length > 0 && suggestionsField === "email") onSuggestionsOpenChange(true); }}
              onKeyDown={onGuestKeyDown} placeholder="opcjonalnie" autoComplete="off" />
            {renderSuggestionsDropdown("email")}
          </div>

          <div className="relative">
            <Label className="text-xs text-muted-foreground">📞 Telefon</Label>
            <Input id="uni-guestPhone" type="text" inputMode="tel" className={inputCompact} value={form.guestPhone}
              onChange={(e) => { onFormChange({ guestPhone: e.target.value }); onSearchGuest(e.target.value, "phone"); }}
              onBlur={() => { setTimeout(() => { if (suggestionsField === "phone") onSuggestionsOpenChange(false); }, 250); }}
              onFocus={() => { if (guestSuggestions.length > 0 && suggestionsField === "phone") onSuggestionsOpenChange(true); }}
              onKeyDown={onGuestKeyDown} placeholder="+48 600 123 456" autoComplete="off" />
            {renderSuggestionsDropdown("phone")}
          </div>

          {!isEdit && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">🎂 Urodziny</Label>
                  <Input id="uni-guestDob" type="date" className={inputCompact} value={form.guestDateOfBirth} onChange={(e) => onFormChange({ guestDateOfBirth: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">🌍 Narod.</Label>
                  <select id="uni-nationality" value={form.guestNationality} onChange={(e) => onFormChange({ guestNationality: e.target.value })} className={selectClass}>
                    <option value="">—</option>
                    {NATIONALITY_OPTIONS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">🪪 Dokument</Label>
                  <select id="uni-docType" value={form.documentType} onChange={(e) => onFormChange({ documentType: e.target.value })} className={selectClass}>
                    <option value="">— typ —</option>
                    {DOCUMENT_TYPE_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">🔢 Nr dok.</Label>
                  <Input id="uni-docNumber" type="text" className={inputCompact} value={form.documentNumber} onChange={(e) => onFormChange({ documentNumber: e.target.value })} placeholder="ABC 123456" autoComplete="off" />
                </div>
              </div>

              {/* NIP inline — create mode */}
              <div className="mt-1 border-t pt-1">
                <Label className="text-xs text-muted-foreground">🏢 NIP (firma/faktura)</Label>
                <div className="flex gap-1">
                  <Input id="uni-nip" type="text" inputMode="numeric" className={`${inputCompact} flex-1`} value={form.nipInput}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 10);
                      let formatted = d;
                      if (d.length > 3) formatted = `${d.slice(0, 3)}-${d.slice(3)}`;
                      if (d.length > 6) formatted = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
                      if (d.length > 8) formatted = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
                      onFormChange({ nipInput: formatted, companyFound: false });
                    }}
                    placeholder="000-000-00-00" autoComplete="off" />
                  <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] px-2 shrink-0"
                    disabled={nipLookupLoading || form.nipInput.replace(/\D/g, "").length !== 10}
                    onClick={onNipLookup}>
                    {nipLookupLoading ? "…" : "Sprawdź"}
                  </Button>
                </div>
                {form.companyFound && (
                  <div className="mt-1 space-y-0.5 rounded border bg-muted/30 p-1.5 text-xs">
                    <Input className="h-6 text-xs" value={form.companyName} onChange={(e) => onFormChange({ companyName: e.target.value })} placeholder="Nazwa firmy" />
                    <Input className="h-6 text-xs" value={form.companyAddress} onChange={(e) => onFormChange({ companyAddress: e.target.value })} placeholder="Adres" />
                    <div className="grid grid-cols-[80px_1fr] gap-1">
                      <Input className="h-6 text-xs" value={form.companyPostalCode} onChange={(e) => onFormChange({ companyPostalCode: e.target.value })} placeholder="00-000" />
                      <Input className="h-6 text-xs" value={form.companyCity} onChange={(e) => onFormChange({ companyCity: e.target.value })} placeholder="Miasto" />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* NIP w trybie edycji — dla faktury VAT */}
          {isEdit && (
            <div className="mt-2 border-t pt-2">
              <Label className="text-xs text-muted-foreground">🏢 NIP firmy (dla faktury VAT)</Label>
              <p className="text-[10px] text-muted-foreground mb-1">Wpisz NIP i wybierz firmę, by móc wystawić fakturę.</p>
              <div className="flex gap-1">
                <Input id="uni-nip-edit" type="text" inputMode="numeric" className={`${inputCompact} flex-1`} value={form.nipInput}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 10);
                    let formatted = d;
                    if (d.length > 3) formatted = `${d.slice(0, 3)}-${d.slice(3)}`;
                    if (d.length > 6) formatted = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
                    if (d.length > 8) formatted = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
                    onFormChange({ nipInput: formatted, companyFound: false });
                  }}
                  placeholder="000-000-00-00" autoComplete="off" />
                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] px-2 shrink-0"
                  disabled={nipLookupLoading || form.nipInput.replace(/\D/g, "").length !== 10}
                  onClick={onNipLookup}>
                  {nipLookupLoading ? "…" : "Sprawdź"}
                </Button>
              </div>
              {form.companyFound && (
                <div className="mt-1 space-y-0.5 rounded border bg-muted/30 p-1.5 text-xs">
                  <Input className="h-6 text-xs" value={form.companyName} onChange={(e) => onFormChange({ companyName: e.target.value })} placeholder="Nazwa firmy" />
                  <Input className="h-6 text-xs" value={form.companyAddress} onChange={(e) => onFormChange({ companyAddress: e.target.value })} placeholder="Adres" />
                  <div className="grid grid-cols-[80px_1fr] gap-1">
                    <Input className="h-6 text-xs" value={form.companyPostalCode} onChange={(e) => onFormChange({ companyPostalCode: e.target.value })} placeholder="00-000" />
                    <Input className="h-6 text-xs" value={form.companyCity} onChange={(e) => onFormChange({ companyCity: e.target.value })} placeholder="Miasto" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* COL 3: Pricing + folio (like KW Hotel right side) */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Rozliczenie</h3>

        {/* Price table – edytowalna cena */}
        <div className="rounded border bg-muted/20 p-2 text-xs space-y-0.5">
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground">Cena za dobę</span>
            <Input
              ref={priceInputRef}
              type="number"
              min={0}
              step={0.01}
              className="h-6 w-20 text-right text-xs tabular-nums"
              value={form.rateCodePrice}
              onChange={(e) => onFormChange({ rateCodePrice: e.target.value })}
              placeholder={priceFromRate != null ? String(priceFromRate) : "—"}
            />
          </div>
          {(pricePerNight != null && pricePerNight > 0) ? (
            <>
              {nights > 0 && (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Liczba dób</span><span className="tabular-nums">{nights}</span></div>
                  <div className="flex justify-between border-t pt-0.5 font-bold"><span>Suma za pokój</span><span className="tabular-nums">{totalAmount?.toFixed(2)}</span></div>
                </>
              )}
              {isEdit && transactions.length > 0 && (
                <>
                  <div className="flex justify-between border-t pt-0.5"><span className="text-muted-foreground">Wpłaty</span><span className="tabular-nums">{transactions.filter((t) => t.type === "DEPOSIT" || t.type === "ROOM").reduce((s, t) => s + t.amount, 0).toFixed(2)}</span></div>
                  {totalAmount != null && totalAmount > 0 && (
                    <div className="flex justify-between font-medium"><span>Pozostało</span><span className="tabular-nums">{(totalAmount - transactions.filter((t) => t.type === "DEPOSIT" || t.type === "ROOM").reduce((s, t) => s + t.amount, 0)).toFixed(2)}</span></div>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>

        {/* Podgląd cennika – kliknij stawkę, aby ustawić cenę */}
        <details className="rounded border bg-muted/10 text-xs" open>
          <summary className="cursor-pointer px-2 py-1 font-medium text-muted-foreground hover:text-foreground">
            Podgląd cennika
          </summary>
          <div className="border-t px-2 py-1.5 space-y-0.5">
            {rateCodes.length > 0 ? (
              rateCodes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full flex justify-between items-center text-left px-1.5 py-0.5 rounded hover:bg-muted/50"
                  onClick={() => {
                    onFormChange({
                      rateCodeId: c.id,
                      rateCodePrice: c.price != null ? String(c.price) : "",
                    });
                    priceInputRef.current?.focus();
                  }}
                >
                  <span>{c.code} – {c.name}</span>
                  <span className="tabular-nums text-muted-foreground">{c.price != null ? `${c.price.toFixed(2)} PLN` : "—"}</span>
                </button>
              ))
            ) : fallbackPricesFromRooms.length > 0 ? (
              fallbackPricesFromRooms.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="w-full flex justify-between items-center text-left px-1.5 py-0.5 rounded hover:bg-muted/50"
                  onClick={() => {
                    onFormChange({ rateCodePrice: String(f.price) });
                    priceInputRef.current?.focus();
                  }}
                >
                  <span>{f.label}</span>
                  <span className="tabular-nums text-muted-foreground">{f.price.toFixed(2)} PLN</span>
                </button>
              ))
            ) : (
              <p className="text-muted-foreground py-1">Brak stawek. Dodaj Kody stawek w Ustawieniach → Cennik albo uzupełnij ceny typów pokoi.</p>
            )}
          </div>
        </details>

        <div className="mt-1">
          <Label className="text-xs text-muted-foreground">📝 Uwagi</Label>
          <textarea id="uni-notes" className={textareaClass} value={form.notes} onChange={(e) => onFormChange({ notes: e.target.value })} placeholder="Uwagi…" rows={2} maxLength={2000} />
        </div>
        {!isEdit && (
          <div>
            <Label className="text-xs text-muted-foreground">🔒 Uwagi wewnętrzne</Label>
            <textarea id="uni-internalNotes" className={textareaClass} value={form.internalNotes} onChange={(e) => onFormChange({ internalNotes: e.target.value })} placeholder="Tylko dla personelu…" rows={2} maxLength={10000} />
          </div>
        )}

        {isEdit && (pricePerNight != null && pricePerNight > 0) && (
          transactions.some((t) => t.type === "ROOM") ? (
            <p className="text-[10px] text-green-600 dark:text-green-400">✓ Nocleg naliczony</p>
          ) : (
            reservation?.id && nights > 0 && (
              <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs" disabled={roomChargeLoading}
                onClick={async () => {
                  if (!reservation?.id) return;
                  setRoomChargeLoading(true);
                  const result = await postRoomChargeOnCheckout(reservation.id);
                  setRoomChargeLoading(false);
                  if (result.success && result.data) {
                    if (result.data.skipped) toast.info("Nocleg już był naliczony.");
                    else toast.success(`Naliczono nocleg: ${result.data.amount?.toFixed(2)} PLN`);
                    getTransactionsForReservation(reservation.id).then((r) => r.success && r.data && setTransactions(r.data));
                  } else toast.error("error" in result ? result.error : "Błąd naliczania noclegu");
                }}>
                <Banknote className="mr-1 h-3 w-3" />
                {roomChargeLoading ? "Naliczanie..." : "Nalicz nocleg"}
              </Button>
            )
          )
        )}

        {dateError && <p className="text-xs font-medium text-destructive">Data wymeld. musi być po zameld.</p>}
        {isNonRefundable && <p className="text-[10px] font-medium text-amber-600 dark:text-amber-500">Non-refundable</p>}

        {/* Folio section (edit mode only) */}
        {isEdit && reservation?.id && (
          <details className="rounded border bg-muted/20 text-xs" open>
            <summary className="flex cursor-pointer items-center gap-1 px-2 py-1 text-xs font-medium">
              <SplitSquareVertical className="h-3 w-3" />
              Folio
            </summary>
            <div className="space-y-1.5 border-t px-2 pb-2 pt-1">
              {/* Occupants */}
              <div className="rounded border border-border/50 p-1.5">
                <p className="mb-1 text-[10px] font-medium text-muted-foreground">Goście w pokoju</p>
                <ul className="list-none space-y-0.5 text-xs">
                  {reservationGuests.map((g) => (
                    <li key={g.guestId} className="flex items-center justify-between gap-2 rounded bg-muted/30 px-2 py-1">
                      <span>{g.name} {g.isPrimary ? "(główny)" : ""}</span>
                      <div className="flex items-center gap-0.5">
                        <a href={`/guests/${g.guestId}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edycja klienta">
                          <Pencil className="h-3 w-3" />
                        </a>
                        {!g.isPrimary && (
                          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive"
                            onClick={async () => {
                              const result = await removeReservationOccupant(reservation.id, g.guestId);
                              if (result.success) {
                                toast.success("Usunięto gościa z pokoju");
                                getReservationGuestsForFolio(reservation.id).then((r) => r.success && r.data && setReservationGuests(r.data));
                              } else toast.error(result.error);
                            }}>Usuń</Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <Input type="text" placeholder="Wyszukaj gościa (min. 2 znaki)" value={occupantSearchQuery}
                    onChange={(e) => {
                      const q = e.target.value;
                      setOccupantSearchQuery(q);
                      if (q.trim().length >= 2) {
                        searchGuests(q, { limit: 8 }).then((r) => {
                          if (r.success && r.data?.guests) setOccupantSearchResults(r.data.guests.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
                          else setOccupantSearchResults([]);
                        });
                      } else setOccupantSearchResults([]);
                    }} className="h-8 text-sm" />
                </div>
                {occupantSearchResults.length > 0 && (
                  <ul className="mt-1 list-none space-y-0.5 text-xs">
                    {occupantSearchResults.filter((g) => !reservationGuests.some((r) => r.guestId === g.id)).slice(0, 5).map((g) => (
                      <li key={g.id}>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-full justify-start text-left font-normal" disabled={addOccupantLoading}
                          onClick={async () => {
                            setAddOccupantLoading(true);
                            const result = await addReservationOccupant(reservation.id, g.id);
                            setAddOccupantLoading(false);
                            if (result.success) {
                              toast.success(`Dodano ${g.name} do pokoju`);
                              setOccupantSearchQuery(""); setOccupantSearchResults([]);
                              getReservationGuestsForFolio(reservation.id).then((r) => r.success && r.data && setReservationGuests(r.data));
                            } else toast.error(result.error);
                          }}>+ {g.name}</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Security deposit */}
              <details className="rounded border border-border/50">
                <summary className="cursor-pointer px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <Banknote className="mr-1.5 inline-block h-4 w-4" />Kaucja za pokój
                </summary>
                <div className="border-t px-2 py-2 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => { setShowCollectDeposit(!showCollectDeposit); setShowRefundDeposit(false); }}>Pobierz kaucję</Button>
                    <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => { setShowRefundDeposit(!showRefundDeposit); setShowCollectDeposit(false); }}>Zwróć kaucję</Button>
                  </div>
                  {showCollectDeposit && (
                    <div className="rounded border bg-muted/10 p-2 space-y-2 text-xs">
                      <Label className="text-xs">Kwota (PLN)</Label>
                      <Input type="number" min={0.01} step={0.01} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="np. 500" className="h-8 w-28" />
                      <Label className="text-xs">Metoda płatności</Label>
                      <select className="h-8 rounded border border-input bg-background px-2 w-32 text-xs" value={depositPaymentMethod} onChange={(e) => setDepositPaymentMethod(e.target.value)}>
                        <option value="CASH">Gotówka</option><option value="CARD">Karta</option><option value="TRANSFER">Przelew</option><option value="PREPAID">Przedpłata</option>
                      </select>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" disabled={collectDepositLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                          onClick={async () => {
                            if (collectDepositInFlightRef.current) return;
                            const amt = parseFloat(depositAmount);
                            if (Number.isNaN(amt) || amt <= 0) { toast.error("Kwota kaucji musi być większa od zera."); return; }
                            collectDepositInFlightRef.current = true; setCollectDepositLoading(true);
                            try {
                              const r = await collectSecurityDeposit({ reservationId: reservation.id, amount: amt, paymentMethod: depositPaymentMethod as "CASH" | "CARD" | "TRANSFER" | "PREPAID" });
                              if (r.success) { toast.success(`Pobrano kaucję: ${amt.toFixed(2)} PLN`); setDepositAmount(""); setShowCollectDeposit(false); refreshFolios(); }
                              else toast.error("error" in r ? (r.error ?? "Błąd pobierania kaucji") : "Błąd pobierania kaucji");
                            } finally { collectDepositInFlightRef.current = false; setCollectDepositLoading(false); }
                          }}>{collectDepositLoading ? "Zapisywanie…" : "Zapisz"}</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowCollectDeposit(false); setDepositAmount(""); }}>Anuluj</Button>
                      </div>
                    </div>
                  )}
                  {showRefundDeposit && (
                    <div className="rounded border bg-muted/10 p-2 space-y-2 text-xs">
                      <Label className="text-xs">Kwota do zwrotu (PLN, puste = całość)</Label>
                      <Input type="number" min={0} step={0.01} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Całość" className="h-8 w-28" />
                      <Label className="text-xs">Potrącenie (PLN, opcjonalnie)</Label>
                      <Input type="number" min={0} step={0.01} value={refundDeduction} onChange={(e) => setRefundDeduction(e.target.value)} placeholder="0" className="h-8 w-28" />
                      <Label className="text-xs">Powód potrącenia</Label>
                      <Input type="text" value={refundDeductionReason} onChange={(e) => setRefundDeductionReason(e.target.value)} placeholder="np. minibar, uszkodzenia" className="h-8 w-48" />
                      <Label className="text-xs">Metoda zwrotu</Label>
                      <select className="h-8 rounded border border-input bg-background px-2 w-32 text-xs" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                        <option value="CASH">Gotówka</option><option value="CARD">Karta</option><option value="TRANSFER">Przelew</option>
                      </select>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" disabled={refundDepositLoading}
                          onClick={async () => {
                            setRefundDepositLoading(true);
                            const r = await refundSecurityDeposit({ reservationId: reservation.id, refundAmount: refundAmount.trim() ? parseFloat(refundAmount) : undefined, deductionAmount: refundDeduction.trim() ? parseFloat(refundDeduction) : undefined, deductionReason: refundDeductionReason.trim() || undefined, refundMethod: refundMethod as "CASH" | "CARD" | "TRANSFER" });
                            setRefundDepositLoading(false);
                            if (r.success) { toast.success(r.data?.refundAmount ? `Zwrócono kaucję: ${r.data.refundAmount.toFixed(2)} PLN` : "Zapisano potrącenie z kaucji"); setRefundAmount(""); setRefundDeduction(""); setRefundDeductionReason(""); setShowRefundDeposit(false); refreshFolios(); }
                            else toast.error("error" in r ? (r.error ?? "Błąd zwrotu kaucji") : "Błąd zwrotu kaucji");
                          }}>{refundDepositLoading ? "Zapisywanie…" : "Zwróć"}</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowRefundDeposit(false); setRefundAmount(""); setRefundDeduction(""); setRefundDeductionReason(""); }}>Anuluj</Button>
                      </div>
                    </div>
                  )}
                </div>
              </details>

              {/* Add charge */}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAddChargeDialogOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Dodaj obciążenie
                </Button>
              </div>

              {/* Folio list */}
              {folioSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak folio.</p>
              ) : (
                <ul className="list-none space-y-2">
                  {folioSummaries.map((f) => (
                    <li key={f.folioNumber} className="rounded border px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">Folio #{f.folioNumber}</span>
                        <span className="text-muted-foreground text-xs">
                          {f.totalCharges.toFixed(2)}{f.totalDiscounts > 0 && ` -${f.totalDiscounts.toFixed(2)}`} / {f.totalPayments.toFixed(2)} PLN · Saldo: {f.balance.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                        {f.billTo === "COMPANY" && f.companyName ? (
                          <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />Firma: {f.companyName}{f.label ? ` · ${f.label}` : ""}</span>
                        ) : (
                          <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />Gość: {f.guestName ?? "Główny gość"}{f.label ? ` · ${f.label}` : ""}</span>
                        )}
                        {editingFolioNumber === f.folioNumber ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingFolioNumber(null)}>Anuluj</Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" className="h-6 text-xs"
                            onClick={() => {
                              setEditingFolioNumber(f.folioNumber); setEditBillTo(f.billTo ?? "GUEST"); setEditGuestId(f.guestId ?? reservation?.guestId ?? ""); setEditCompanyId(f.companyId ?? ""); setEditLabel(f.label ?? ""); setCompanySearchQuery(f.companyName ?? "");
                              if (f.companyName && f.companyId) setCompanyOptions([{ id: f.companyId, nip: "", name: f.companyName, city: null }]);
                            }}>Ustaw płatnika</Button>
                        )}
                      </div>
                      {editingFolioNumber === f.folioNumber && (
                        <div className="mt-3 space-y-2 rounded border bg-background p-2">
                          <div className="flex gap-2">
                            <Label className="shrink-0 pt-2 text-xs">Płatnik</Label>
                            <div className="flex flex-1 gap-2">
                              <label className="flex cursor-pointer items-center gap-1.5 text-sm"><input type="radio" name={`billTo-${f.folioNumber}`} checked={editBillTo === "GUEST"} onChange={() => setEditBillTo("GUEST")} className="rounded" />Gość</label>
                              <label className="flex cursor-pointer items-center gap-1.5 text-sm"><input type="radio" name={`billTo-${f.folioNumber}`} checked={editBillTo === "COMPANY"} onChange={() => setEditBillTo("COMPANY")} className="rounded" />Firma</label>
                            </div>
                          </div>
                          {editBillTo === "GUEST" && reservationGuests.length > 0 && (
                            <div className="space-y-1">
                              <Label className="text-xs">Który gość</Label>
                              <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={editGuestId} onChange={(e) => setEditGuestId(e.target.value)}>
                                {reservationGuests.map((g) => <option key={g.guestId} value={g.guestId}>{g.name} {g.isPrimary ? "(główny)" : ""}</option>)}
                              </select>
                            </div>
                          )}
                          {editBillTo === "COMPANY" && (
                            <div className="space-y-1">
                              <Label className="text-xs">Firma (wyszukaj min. 2 znaki)</Label>
                              <Input type="text" value={companySearchQuery} onChange={(e) => setCompanySearchQuery(e.target.value)} placeholder="Nazwa lub NIP firmy" className="h-8 text-sm" />
                              {companyOptions.length > 0 && (
                                <select className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={editCompanyId}
                                  onChange={(e) => { const c = companyOptions.find((x) => x.id === e.target.value); if (c) { setEditCompanyId(c.id); setCompanySearchQuery(c.name); } }}>
                                  <option value="">— wybierz firmę —</option>
                                  {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name} {c.nip ? `(${c.nip})` : ""}</option>)}
                                </select>
                              )}
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-xs">Etykieta (opcjonalnie)</Label>
                            <Input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="np. Gość prywatnie" className="h-8 text-sm" />
                          </div>
                          <Button type="button" size="sm" disabled={folioActionLoading}
                            onClick={async () => {
                              setFolioActionLoading(true);
                              const result = await setFolioAssignment({ reservationId: reservation.id, folioNumber: f.folioNumber, billTo: editBillTo, guestId: editBillTo === "GUEST" ? (editGuestId || null) : null, companyId: editBillTo === "COMPANY" ? editCompanyId || null : null, label: editLabel.trim() || null });
                              setFolioActionLoading(false);
                              if (result.success) { toast.success("Płatnik folio zapisany"); setEditingFolioNumber(null); refreshFolios(); }
                              else toast.error("error" in result ? (result.error ?? "Błąd zapisu") : "Błąd zapisu");
                            }}>{folioActionLoading ? "Zapisywanie…" : "Zapisz"}</Button>
                        </div>
                      )}
                      {/* Folio items */}
                      <details className="mt-2 rounded border border-border/50"
                        onToggle={(e) => { const d = e.currentTarget; if (d.open && !folioItemsByNumber[f.folioNumber] && loadingItemsFolio !== f.folioNumber) loadFolioItems(f.folioNumber); }}>
                        <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                          <ArrowRightLeft className="h-3.5 w-3.5" />Pozycje {loadingItemsFolio === f.folioNumber ? "(ładowanie…)" : folioItemsByNumber[f.folioNumber] ? `(${folioItemsByNumber[f.folioNumber].length})` : ""}
                        </summary>
                        <div className="border-t px-2 py-2">
                          {loadingItemsFolio === f.folioNumber ? (
                            <p className="text-xs text-muted-foreground">Ładowanie…</p>
                          ) : (folioItemsByNumber[f.folioNumber]?.length ?? 0) === 0 ? (
                            <p className="text-xs text-muted-foreground">Brak aktywnych pozycji w tym folio.</p>
                          ) : (
                            <>
                              <ul className="list-none space-y-1.5">
                                {folioItemsByNumber[f.folioNumber]?.map((item) => (
                                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/20 px-2 py-1.5 text-xs">
                                    <span className="font-medium">{item.type === "DISCOUNT" ? "Rabat" : item.type}</span>
                                    <span>{item.description ?? ""} · {item.type === "DISCOUNT" ? "-" : ""}{item.amount.toFixed(2)} PLN</span>
                                    <div className="flex items-center gap-1">
                                      {folioSummaries.length > 1 && (
                                        <select className="h-7 rounded border border-input bg-background px-1.5 text-xs" value=""
                                          onChange={async (e) => {
                                            const target = parseInt(e.target.value, 10);
                                            if (Number.isNaN(target)) return;
                                            setTransferLoadingId(item.id);
                                            const result = await transferFolioItem({ transactionId: item.id, targetFolioNumber: target });
                                            setTransferLoadingId(null);
                                            if (result.success) { toast.success(`Przeniesiono do folio #${target}`); refreshFolios(); loadFolioItems(f.folioNumber); loadFolioItems(target); }
                                            else toast.error("error" in result ? (result.error ?? "Błąd przenoszenia") : "Błąd przenoszenia");
                                            e.target.value = "";
                                          }} disabled={!!transferLoadingId}>
                                          <option value="">Przenieś…</option>
                                          {folioSummaries.filter((o) => o.folioNumber !== f.folioNumber).map((o) => <option key={o.folioNumber} value={o.folioNumber}>Folio #{o.folioNumber}</option>)}
                                        </select>
                                      )}
                                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" title="Usuń pozycję"
                                        onClick={() => { setVoidItemId(item.id); setVoidItemReason(""); }}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                              {/* Discount form */}
                              <div className="mt-3 space-y-2 rounded border border-dashed border-muted-foreground/40 bg-muted/10 p-2">
                                {discountFolioNumber === f.folioNumber ? (
                                  <>
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Percent className="h-3.5 w-3.5" /> Rabat</div>
                                    <div className="flex flex-col gap-2">
                                      <div className="flex flex-wrap items-center gap-3 text-xs">
                                        <label className="flex items-center gap-1.5"><input type="radio" name={`ds-${f.folioNumber}`} checked={discountScope === "RESERVATION"} onChange={() => { setDiscountScope("RESERVATION"); setDiscountAppliesToTransactionId(null); }} className="rounded border-input" />Na całe folio</label>
                                        <label className="flex items-center gap-1.5"><input type="radio" name={`ds-${f.folioNumber}`} checked={discountScope === "LINE_ITEM"} onChange={() => { setDiscountScope("LINE_ITEM"); setDiscountAppliesToTransactionId(null); if (!folioItemsByNumber[f.folioNumber]) loadFolioItems(f.folioNumber); }} className="rounded border-input" />Na pozycję</label>
                                      </div>
                                      {discountScope === "LINE_ITEM" && (
                                        <select className="h-8 max-w-xs rounded border border-input bg-background px-2 text-xs" value={discountAppliesToTransactionId ?? ""} onChange={(e) => setDiscountAppliesToTransactionId(e.target.value || null)}>
                                          <option value="">— wybierz pozycję —</option>
                                          {(folioItemsByNumber[f.folioNumber] ?? []).filter((it) => it.type !== "DISCOUNT" && it.type !== "PAYMENT" && it.amount > 0).map((it) => <option key={it.id} value={it.id}>{it.description || it.type} — {Number(it.amount).toFixed(2)} PLN</option>)}
                                        </select>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-end gap-2">
                                      <label className="flex flex-col gap-0.5 text-xs"><span>Typ</span>
                                        <select className="h-8 rounded border border-input bg-background px-2 text-xs" value={discountType} onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "FIXED")}>
                                          <option value="PERCENT">Procent (%)</option><option value="FIXED">Kwota (PLN)</option>
                                        </select>
                                      </label>
                                      <label className="flex flex-col gap-0.5 text-xs"><span>{discountType === "PERCENT" ? "Procent (0–100)" : "Kwota (PLN)"}</span>
                                        <Input type="number" min={discountType === "PERCENT" ? 0 : 0.01} max={discountType === "PERCENT" ? 100 : undefined} step={discountType === "PERCENT" ? 1 : 0.01} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "PERCENT" ? "np. 10" : "np. 50.00"} className="h-8 w-24 text-xs" />
                                      </label>
                                      <Input type="text" value={discountDescription} onChange={(e) => setDiscountDescription(e.target.value)} placeholder="Opis (opcjonalnie)" className="h-8 w-32 text-xs" />
                                      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground"><span>PIN managera</span>
                                        <Input type="password" inputMode="numeric" autoComplete="off" value={discountManagerPin} onChange={(e) => setDiscountManagerPin(e.target.value)} placeholder="Opcjonalnie" className="h-8 w-20 text-xs" />
                                      </label>
                                      <Button type="button" size="sm" disabled={addDiscountLoading || !discountValue.trim() || (discountScope === "LINE_ITEM" && !discountAppliesToTransactionId)}
                                        onClick={async () => {
                                          const num = parseFloat(discountValue);
                                          if (Number.isNaN(num) || (discountType === "PERCENT" && (num < 0 || num > 100)) || (discountType === "FIXED" && num <= 0)) { toast.error(discountType === "PERCENT" ? "Wprowadź procent 0–100" : "Wprowadź kwotę rabatu > 0"); return; }
                                          if (discountScope === "LINE_ITEM" && !discountAppliesToTransactionId?.trim()) { toast.error("Wybierz pozycję do rabatowania"); return; }
                                          setAddDiscountLoading(true);
                                          const result = await addFolioDiscount({ reservationId: reservation.id, folioNumber: f.folioNumber, appliesToTransactionId: discountScope === "LINE_ITEM" ? discountAppliesToTransactionId : undefined, discountType, discountValue: num, description: discountDescription.trim() || undefined, managerPin: discountManagerPin.trim() || undefined });
                                          setAddDiscountLoading(false);
                                          if (result.success) { toast.success(`Dodano rabat: ${result.data?.discountAmount.toFixed(2) ?? ""} PLN`); setDiscountValue(""); setDiscountDescription(""); setDiscountFolioNumber(null); setDiscountScope("RESERVATION"); setDiscountAppliesToTransactionId(null); refreshFolios(); loadFolioItems(f.folioNumber); }
                                          else toast.error("error" in result ? (result.error ?? "Błąd dodawania rabatu") : "Błąd dodawania rabatu");
                                        }}>{addDiscountLoading ? "Dodawanie…" : "Dodaj rabat"}</Button>
                                      <Button type="button" variant="ghost" size="sm" onClick={() => { setDiscountFolioNumber(null); setDiscountValue(""); setDiscountDescription(""); setDiscountScope("RESERVATION"); setDiscountAppliesToTransactionId(null); setDiscountManagerPin(""); }}>Anuluj</Button>
                                    </div>
                                  </>
                                ) : (
                                  <Button type="button" variant="outline" size="sm" className="text-xs"
                                    onClick={() => { setDiscountFolioNumber(f.folioNumber); setDiscountScope("RESERVATION"); setDiscountAppliesToTransactionId(null); if (!folioItemsByNumber[f.folioNumber]) loadFolioItems(f.folioNumber); }}>
                                    <Banknote className="mr-1 h-3.5 w-3.5" />Dodaj rabat
                                  </Button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
              {folioSummaries.length > 0 && folioSummaries.length < 10 && (
                <Button type="button" variant="outline" size="sm" disabled={newFolioLoading}
                  onClick={async () => {
                    setNewFolioLoading(true);
                    const result = await createNewFolio({ reservationId: reservation.id, billTo: "GUEST" });
                    setNewFolioLoading(false);
                    if (result.success && result.data) { toast.success(`Utworzono folio #${result.data.folioNumber}`); refreshFolios(); }
                    else toast.error("error" in result ? (result.error ?? "Błąd tworzenia folio") : "Błąd tworzenia folio");
                  }}>
                  <Plus className="mr-1 h-3.5 w-3.5" />{newFolioLoading ? "Tworzenie…" : "Dodaj folio"}
                </Button>
              )}
            </div>
          </details>
        )}

        {isEdit && reservation && (
          <AddChargeDialog
            reservationId={reservation.id}
            open={addChargeDialogOpen}
            onOpenChange={setAddChargeDialogOpen}
            onSuccess={refreshFolios}
            folioNumbers={folioSummaries.length > 0 ? folioSummaries.map((f) => f.folioNumber) : [1]}
            defaultFolioNumber={folioSummaries[0]?.folioNumber ?? 1}
          />
        )}

        {/* Dialog potwierdzenia usunięcia pozycji folio (void) */}
        <AlertDialog open={!!voidItemId} onOpenChange={(open) => { if (!open) { setVoidItemId(null); setVoidItemReason(""); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Czy na pewno usunąć pozycję z folio?</AlertDialogTitle>
              <AlertDialogDescription>
                Pozycja zostanie anulowana (void). Operacja jest nieodwracalna.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Label htmlFor="void-reason" className="text-sm font-medium">Powód <span className="text-destructive">(wymagany)</span></Label>
              <Input id="void-reason" className="mt-1.5 h-9 text-sm" value={voidItemReason} onChange={(e) => setVoidItemReason(e.target.value)} placeholder="np. pomyłka, rezygnacja" maxLength={200} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setVoidItemId(null); setVoidItemReason(""); }}>Anuluj</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!voidItemReason.trim()}
                onClick={async () => {
                  if (!voidItemId || !voidItemReason.trim()) return;
                  const result = await voidFolioItem({ transactionId: voidItemId, reason: voidItemReason.trim() });
                  if (result.success) {
                    toast.success("Pozycja usunięta z folio");
                    setVoidItemId(null);
                    setVoidItemReason("");
                    refreshFolios();
                    if (reservation?.id) {
                      Object.keys(folioItemsByNumber).forEach((fn) => loadFolioItems(parseInt(fn, 10)));
                    }
                  } else {
                    toast.error("error" in result ? result.error : "Błąd usuwania pozycji");
                  }
                }}
              >
                Usuń
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
});
