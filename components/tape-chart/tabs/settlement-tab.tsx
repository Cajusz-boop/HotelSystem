"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGuestBlacklist, getReservationsByGuestId, searchGuests } from "@/app/actions/reservations";
import { getTransactionsForReservation, getFolioSummary, setFolioAssignment, createNewFolio, getFolioItems, transferFolioItem, addFolioDiscount, collectSecurityDeposit, refundSecurityDeposit, getReservationGuestsForFolio, addReservationOccupant, removeReservationOccupant, postRoomChargeOnCheckout, type ReservationGuestForFolio } from "@/app/actions/finance";
import { type FolioBillTo } from "@/lib/finance-constants";
import { searchCompanies } from "@/app/actions/companies";
import type { Reservation } from "@/lib/tape-chart-types";
import type { RateCodeForUi } from "@/app/actions/rate-codes";
import { toast } from "sonner";
import { SplitSquareVertical, User, Building2, Plus, ArrowRightLeft, Percent, Banknote } from "lucide-react";
import { AddChargeDialog } from "@/components/add-charge-dialog";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "CONFIRMED", label: "Potwierdzona" },
  { value: "CHECKED_IN", label: "Zameldowany" },
  { value: "CHECKED_OUT", label: "Wymeldowany" },
  { value: "CANCELLED", label: "Anulowana" },
  { value: "NO_SHOW", label: "No-show" },
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
  parkingSpotId: string;
  bedsBooked: string;
  nipInput: string;
  companyName: string;
  companyAddress: string;
  companyPostalCode: string;
  companyCity: string;
  companyFound: boolean;
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

export function SettlementTab({
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
}: SettlementTabProps) {
  const isEdit = mode === "edit";
  const roomBeds = rooms.find((r) => r.number === form.room)?.beds ?? 1;
  const nights = computeNights(form.checkIn, form.checkOut);
  const dateError = form.checkIn && form.checkOut && nights <= 0;
  const pricePerNight = effectivePricePerNight ?? rooms.find((r) => r.number === form.room)?.price;
  const totalAmount = pricePerNight != null && pricePerNight > 0 && nights > 0 ? pricePerNight * nights : undefined;

  // Edit-mode-only state: folio, transactions, guest history, blacklist
  const [guestHistory, setGuestHistory] = useState<Reservation[]>([]);
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
  const [addChargeDialogOpen, setAddChargeDialogOpen] = useState(false);

  // Load edit-mode data
  useEffect(() => {
    if (!isEdit || !reservation) return;
    setLocalGuestBlacklisted(reservation.guestBlacklisted ?? false);
  }, [isEdit, reservation]);

  useEffect(() => {
    if (!isEdit || !reservation?.guestId) { setGuestHistory([]); return; }
    getReservationsByGuestId(reservation.guestId).then((r) =>
      r.success && r.data ? setGuestHistory(r.data as Reservation[]) : setGuestHistory([])
    );
  }, [isEdit, reservation?.guestId]);

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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_300px]">
      {/* COL 1: Room & dates (like KW Hotel left side) */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Dane pokoju</h3>

        <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-1">
          <Label className="text-xs text-right text-muted-foreground">🚪 Pokój</Label>
          {rooms.length > 0 ? (
            <select id="uni-room" value={form.room} onChange={(e) => onFormChange({ room: e.target.value })} required className={selectClass}>
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
          <Input id="uni-checkIn" type="date" className={inputCompact} value={form.checkIn}
            onChange={(e) => { onFormChange({ checkIn: e.target.value, checkOut: e.target.value ? addDays(e.target.value, 1) : form.checkOut }); }} />

          <Label className="text-xs text-right text-muted-foreground">📅 Wymeld.</Label>
          <Input id="uni-checkOut" type="date" className={`${inputCompact} ${dateError ? "border-destructive" : ""}`} value={form.checkOut}
            onChange={(e) => onFormChange({ checkOut: e.target.value })} min={form.checkIn ? addDays(form.checkIn, 1) : undefined} />

          <Label className="text-xs text-right text-muted-foreground">🕐 Godz. od</Label>
          <Input id="uni-checkInTime" type="time" className={inputCompact} value={form.checkInTime} onChange={(e) => onFormChange({ checkInTime: e.target.value })} />

          <Label className="text-xs text-right text-muted-foreground">🕐 Godz. do</Label>
          <Input id="uni-checkOutTime" type="time" className={inputCompact} value={form.checkOutTime} onChange={(e) => onFormChange({ checkOutTime: e.target.value })} />

          <Label className="text-xs text-right text-muted-foreground">🅿️ Parking</Label>
          <select id="uni-parking" value={form.parkingSpotId} onChange={(e) => onFormChange({ parkingSpotId: e.target.value })} className={selectClass}>
            <option value="">— brak —</option>
            {parkingSpots.map((s) => <option key={s.id} value={s.id}>{s.number}</option>)}
          </select>

          <Label className="text-xs text-right text-muted-foreground">💰 Stawka</Label>
          <select id="uni-rateCode" value={form.rateCodeId} onChange={(e) => onFormChange({ rateCodeId: e.target.value })} className={selectClass}>
            <option value="">— brak —</option>
            {rateCodes.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
          </select>

          <Label className="text-xs text-right text-muted-foreground">📋 Status</Label>
          <select id="uni-status" value={form.status} onChange={(e) => onFormChange({ status: e.target.value })} className={selectClass}>
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
            <Label className="text-xs text-right text-muted-foreground">⏰ ETA</Label>
            <Input id="uni-eta" type="time" className={inputCompact} value={form.eta} onChange={(e) => onFormChange({ eta: e.target.value })} />
          </div>
        )}

        {isEdit && (
          <div className="grid grid-cols-[80px_1fr] items-center gap-x-2 gap-y-1 mt-1">
            <Label className="text-xs text-right text-muted-foreground">👥 Pax</Label>
            <Input id="uni-pax" type="number" className={inputCompact} min={0} max={20} value={form.pax} onChange={(e) => onFormChange({ pax: e.target.value })} />
          </div>
        )}

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
            <div className="flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-xs">
              <span className="font-medium text-amber-700 dark:text-amber-400">Czarna lista</span>
              <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px] px-1" disabled={togglingBlacklist} onClick={async () => {
                setTogglingBlacklist(true);
                const res = await updateGuestBlacklist(reservation!.guestId!, false);
                setTogglingBlacklist(false);
                if (res.success) setLocalGuestBlacklisted(false);
              }}>Usuń</Button>
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

          {isEdit && guestHistory.length > 0 && (
            <details className="rounded border bg-muted/20 text-xs">
              <summary className="cursor-pointer px-2 py-1 font-medium">Historia ({guestHistory.length})</summary>
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

              {/* NIP inline */}
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
        </div>
      </div>

      {/* COL 3: Pricing + folio (like KW Hotel right side) */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Rozliczenie</h3>

        {/* Price table */}
        <div className="rounded border bg-muted/20 p-2 text-xs space-y-0.5">
          {(pricePerNight != null && pricePerNight > 0) ? (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">Cena za dobę</span><span className="font-medium tabular-nums">{pricePerNight.toFixed(2)}</span></div>
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
          ) : (
            <span className="text-muted-foreground">Brak ceny</span>
          )}
        </div>

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
                                        <option value="">Przenieś do folio…</option>
                                        {folioSummaries.filter((o) => o.folioNumber !== f.folioNumber).map((o) => <option key={o.folioNumber} value={o.folioNumber}>Folio #{o.folioNumber}</option>)}
                                      </select>
                                    )}
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
      </div>
    </div>
  );
}
