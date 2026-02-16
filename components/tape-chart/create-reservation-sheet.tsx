"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { createReservation, findGuestsForCheckIn, type GuestCheckInSuggestion } from "@/app/actions/reservations";
import { lookupCompanyByNip } from "@/app/actions/companies";
import { getEffectivePriceForRoomOnDate, getRatePlanInfoForRoomDate } from "@/app/actions/rooms";
import { getRateCodes, type RateCodeForUi } from "@/app/actions/rate-codes";
import { getParkingSpotsForSelect } from "@/app/actions/parking";
import { toast } from "sonner";
import type { Reservation } from "@/lib/tape-chart-types";
import type { ReservationSource, ReservationChannel, MealPlan } from "@/lib/validations/schemas";

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

const DOCUMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "ID_CARD", label: "Dowód osobisty" },
  { value: "PASSPORT", label: "Paszport" },
  { value: "DRIVING_LICENSE", label: "Prawo jazdy" },
  { value: "OTHER", label: "Inny" },
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

function formatNip(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 8) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
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

interface CreateReservationSheetProps {
  context: CreateReservationContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (reservation: Reservation) => void;
  rooms?: Array<{ number: string; type?: string; price?: number; beds?: number }>;
}

const selectClass = "mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass = "mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y";

export function CreateReservationSheet({
  context,
  open,
  onOpenChange,
  onCreated,
  rooms = [],
}: CreateReservationSheetProps) {
  // ── Reservation fields ──
  const [room, setRoom] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [status, setStatus] = useState<string>("CONFIRMED");
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [effectivePricePerNight, setEffectivePricePerNight] = useState<number | undefined>(undefined);
  const [rateCodes, setRateCodes] = useState<RateCodeForUi[]>([]);
  const [rateCodeId, setRateCodeId] = useState("");
  const [isNonRefundable, setIsNonRefundable] = useState(false);
  const [parkingSpots, setParkingSpots] = useState<{ id: string; number: string }[]>([]);
  const [parkingSpotId, setParkingSpotId] = useState("");
  const [bedsBooked, setBedsBooked] = useState<string>("1");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [source, setSource] = useState("");
  const [channel, setChannel] = useState("");
  const [mealPlan, setMealPlan] = useState("");
  const [eta, setEta] = useState("");

  // ── Guest fields ──
  const [guestName, setGuestName] = useState("");
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestDateOfBirth, setGuestDateOfBirth] = useState("");
  const [guestNationality, setGuestNationality] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");

  // ── Company / NIP (faktura) ──
  const [nipInput, setNipInput] = useState("");
  const [nipLookupLoading, setNipLookupLoading] = useState(false);
  const [nipError, setNipError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPostalCode, setCompanyPostalCode] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyFound, setCompanyFound] = useState(false);

  // ── Guest autocomplete (works from name, email, phone) ──
  const [guestSuggestions, setGuestSuggestions] = useState<GuestCheckInSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsField, setSuggestionsField] = useState<"name" | "email" | "phone">("name");
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const justSelectedRef = useRef(false);
  const guestInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // ── Collapsible sections ──
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  // ── "Save and new" mode ──
  const saveAndNewRef = useRef(false);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  // Reset form when context changes
  useEffect(() => {
    if (context) {
      setRoom(context.roomNumber);
      setCheckIn(context.checkIn);
      setCheckOut(context.checkOut ?? addDays(context.checkIn, 1));
      setStatus("CONFIRMED");
      setGuestName(context.guestName ?? "");
      setGuestId(null);
      setGuestEmail("");
      setGuestPhone("");
      setGuestDateOfBirth("");
      setGuestNationality("");
      setDocumentType("");
      setDocumentNumber("");
      setAdults(context.pax?.toString() ?? "1");
      setChildren("0");
      setNotes(context.notes ?? "");
      setInternalNotes("");
      setSource("");
      setChannel("");
      setMealPlan("");
      setEta("");
      setRateCodeId(context.rateCodeId ?? "");
      setParkingSpotId("");
      setBedsBooked("1");
      setCheckInTime("");
      setCheckOutTime("");
      setNipInput("");
      setNipError(null);
      setCompanyName("");
      setCompanyAddress("");
      setCompanyPostalCode("");
      setCompanyCity("");
      setCompanyFound(false);
      setError(null);
      setGuestSuggestions([]);
      setSuggestionsOpen(false);
      setHighlightedIdx(-1);
      setMoreOptionsOpen(false);
    }
  }, [context]);

  // Load rate codes and parking spots when opened
  useEffect(() => {
    if (open) {
      getRateCodes().then((r) => r.success && r.data && setRateCodes(r.data));
      getParkingSpotsForSelect().then((r) => r.success && r.data && setParkingSpots(r.data));
    }
  }, [open]);

  // Focus guest name on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        guestInputRef.current?.focus();
      });
    }
  }, [open, context]);

  // Fetch effective price for room + date
  useEffect(() => {
    if (!room.trim() || !checkIn) {
      setEffectivePricePerNight(undefined);
      return;
    }
    getEffectivePriceForRoomOnDate(room.trim(), checkIn).then(setEffectivePricePerNight);
  }, [room, checkIn]);

  // Fetch non-refundable flag
  useEffect(() => {
    if (!room.trim() || !checkIn) {
      setIsNonRefundable(false);
      return;
    }
    getRatePlanInfoForRoomDate(room.trim(), checkIn).then((info) =>
      setIsNonRefundable(info.isNonRefundable)
    );
  }, [room, checkIn]);

  // Shared search function for guest autocomplete
  const searchGuestRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGuest = useCallback((query: string, field: "name" | "email" | "phone") => {
    if (searchGuestRef.current) clearTimeout(searchGuestRef.current);
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setGuestSuggestions([]);
      setSuggestionsOpen(false);
      setHighlightedIdx(-1);
      return;
    }
    if (field === "name") setGuestId(null);
    searchGuestRef.current = setTimeout(() => {
      findGuestsForCheckIn(q).then((res) => {
        if (res.success && res.data?.length) {
          setGuestSuggestions(res.data);
          setSuggestionsField(field);
          setSuggestionsOpen(true);
          setHighlightedIdx(-1);
        } else {
          setGuestSuggestions([]);
          setSuggestionsOpen(false);
          setHighlightedIdx(-1);
        }
      });
    }, 300);
  }, []);

  // Trigger search on name change
  useEffect(() => { searchGuest(guestName, "name"); }, [guestName, searchGuest]);
  // Trigger search on email change (only when typing, not from selectGuest)
  const emailUserTyping = useRef(false);
  useEffect(() => {
    if (emailUserTyping.current) { searchGuest(guestEmail, "email"); emailUserTyping.current = false; }
  }, [guestEmail, searchGuest]);
  // Trigger search on phone change
  const phoneUserTyping = useRef(false);
  useEffect(() => {
    if (phoneUserTyping.current) { searchGuest(guestPhone, "phone"); phoneUserTyping.current = false; }
  }, [guestPhone, searchGuest]);

  const selectGuest = useCallback((g: GuestCheckInSuggestion) => {
    justSelectedRef.current = true;
    emailUserTyping.current = false;
    phoneUserTyping.current = false;
    setGuestName(g.name);
    setGuestId(g.id);
    setGuestEmail(g.email ?? "");
    setGuestPhone(g.phone ?? "");
    setGuestDateOfBirth(g.dateOfBirth ?? "");
    setGuestSuggestions([]);
    setSuggestionsOpen(false);
    setHighlightedIdx(-1);
    requestAnimationFrame(() => {
      saveBtnRef.current?.focus();
    });
  }, []);

  // Keyboard navigation for guest autocomplete
  const handleGuestKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!suggestionsOpen || guestSuggestions.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx((prev) => (prev < guestSuggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx((prev) => (prev > 0 ? prev - 1 : guestSuggestions.length - 1));
      } else if (e.key === "Enter" && highlightedIdx >= 0) {
        e.preventDefault();
        selectGuest(guestSuggestions[highlightedIdx]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSuggestionsOpen(false);
        setHighlightedIdx(-1);
      }
    },
    [suggestionsOpen, guestSuggestions, highlightedIdx, selectGuest]
  );

  // NIP lookup handler
  const handleNipLookup = useCallback(async () => {
    const raw = nipInput.replace(/\D/g, "");
    if (raw.length !== 10) {
      setNipError("NIP musi mieć 10 cyfr");
      return;
    }
    setNipLookupLoading(true);
    setNipError(null);
    try {
      const result = await lookupCompanyByNip(raw);
      if (result.success && result.data) {
        setCompanyName(result.data.name ?? "");
        setCompanyAddress(result.data.address ?? "");
        setCompanyPostalCode(result.data.postalCode ?? "");
        setCompanyCity(result.data.city ?? "");
        setCompanyFound(true);
        setNipError(null);
      } else {
        setNipError("error" in result ? (result.error ?? "Nie znaleziono firmy") : "Nie znaleziono firmy");
        setCompanyFound(false);
      }
    } catch {
      setNipError("Błąd połączenia z API");
      setCompanyFound(false);
    } finally {
      setNipLookupLoading(false);
    }
  }, [nipInput]);

  // Auto-lookup NIP when 10 digits entered
  useEffect(() => {
    const raw = nipInput.replace(/\D/g, "");
    if (raw.length === 10 && !companyFound) {
      handleNipLookup();
    }
  }, [nipInput, companyFound, handleNipLookup]);

  // "Save and new" keeps room + dates, resets guest + other fields
  const resetFormForNew = useCallback(() => {
    setGuestName("");
    setGuestId(null);
    setGuestEmail("");
    setGuestPhone("");
    setGuestDateOfBirth("");
    setGuestNationality("");
    setDocumentType("");
    setDocumentNumber("");
    setAdults("1");
    setChildren("0");
    setNotes("");
    setInternalNotes("");
    setEta("");
    setNipInput("");
    setNipError(null);
    setCompanyName("");
    setCompanyAddress("");
    setCompanyPostalCode("");
    setCompanyCity("");
    setCompanyFound(false);
    setError(null);
    setGuestSuggestions([]);
    setSuggestionsOpen(false);
    setHighlightedIdx(-1);
    requestAnimationFrame(() => {
      guestInputRef.current?.focus();
    });
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!context) return;

    const nights = computeNights(checkIn, checkOut);
    if (nights <= 0) {
      setError("Data wymeldowania musi być po dacie zameldowania.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const selectedRoom = rooms.find((r) => r.number === room.trim());
      const maxBeds = selectedRoom?.beds ?? 1;
      const bedsVal = bedsBooked !== "" ? parseInt(bedsBooked, 10) : undefined;
      const adultsVal = adults !== "" ? parseInt(adults, 10) : 1;
      const childrenVal = children !== "" ? parseInt(children, 10) : 0;
      const paxVal = adultsVal + childrenVal;

      // Build company data if NIP provided
      const nipRaw = nipInput.replace(/\D/g, "");
      const hasCompany = nipRaw.length === 10 && companyName.trim();

      const result = await createReservation({
        guestName: guestName.trim(),
        guestId: guestId || undefined,
        guestEmail: guestEmail.trim() || undefined,
        guestPhone: guestPhone.trim() || undefined,
        guestDateOfBirth: guestDateOfBirth || undefined,
        room: room.trim(),
        checkIn,
        checkOut,
        checkInTime: checkInTime.trim() || undefined,
        checkOutTime: checkOutTime.trim() || undefined,
        eta: eta.trim() || undefined,
        status: status as Reservation["status"],
        pax: paxVal,
        adults: adultsVal,
        children: childrenVal,
        bedsBooked: maxBeds > 1 && bedsVal != null && bedsVal >= 1 ? bedsVal : undefined,
        rateCodeId: rateCodeId || undefined,
        parkingSpotId: parkingSpotId || undefined,
        notes: notes.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
        source: (source || undefined) as ReservationSource | undefined,
        channel: (channel || undefined) as ReservationChannel | undefined,
        mealPlan: (mealPlan || undefined) as MealPlan | undefined,
        ...(hasCompany
          ? {
              companyData: {
                nip: nipRaw,
                name: companyName.trim(),
                address: companyAddress.trim() || undefined,
                postalCode: companyPostalCode.trim() || undefined,
                city: companyCity.trim() || undefined,
              },
            }
          : {}),
      });
      if (result.success && result.data) {
        if ("guestBlacklisted" in result && result.guestBlacklisted) {
          toast.warning("Rezerwacja utworzona. Uwaga: gość jest na czarnej liście.");
        } else if ("overbooking" in result && result.overbooking) {
          toast.warning("Rezerwacja utworzona w trybie overbooking (przekroczono dostępność łóżek).");
        } else if ("guestMatched" in result && result.guestMatched) {
          toast.success("Rezerwacja utworzona. Przypisano do istniejącego gościa.");
        } else {
          toast.success("Rezerwacja utworzona.");
        }
        import("@/lib/notifications").then(({ showDesktopNotification }) => {
          showDesktopNotification("Nowa rezerwacja", { body: "Rezerwacja utworzona.", tag: "new-reservation" });
        });
        onCreated?.(result.data as Reservation);
        if (saveAndNewRef.current) {
          saveAndNewRef.current = false;
          resetFormForNew();
        } else {
          onOpenChange(false);
        }
      } else {
        setError("error" in result ? (result.error ?? null) : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieoczekiwany błąd");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (saving) return;
        if (e.shiftKey) {
          saveAndNewRef.current = true;
        }
        handleSubmit();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, guestName, guestId, guestEmail, guestPhone, guestDateOfBirth, guestNationality, documentType, documentNumber, room, checkIn, checkOut, checkInTime, checkOutTime, status, adults, children, bedsBooked, rateCodeId, parkingSpotId, notes, internalNotes, source, channel, mealPlan, eta, nipInput, companyName, companyAddress, companyPostalCode, companyCity, companyFound, saving, rooms]
  );

  if (!context) return null;

  const roomBeds = rooms.find((r) => r.number === room)?.beds ?? 1;
  const nights = computeNights(checkIn, checkOut);
  const dateError = checkIn && checkOut && nights <= 0;

  // Inline suggestions dropdown — renders under the field that triggered the search
  const renderSuggestionsDropdown = (forField: "name" | "email" | "phone") => {
    if (!suggestionsOpen || guestSuggestions.length === 0 || suggestionsField !== forField) return null;
    return (
      <div
        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-popover text-popover-foreground py-1 shadow-xl"
        data-testid="guest-suggestions-dropdown"
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
            onClick={() => selectGuest(g)}
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

  const hasMoreOptionsSet =
    checkInTime || checkOutTime || parkingSpotId || rateCodeId ||
    status !== "CONFIRMED" || (roomBeds > 1 && bedsBooked !== "1") ||
    source || channel || eta || internalNotes.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        data-scroll-area
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>Nowa rezerwacja</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* ── Section: Guest data ── */}
          <fieldset className="space-y-3 rounded-lg border border-border/60 p-3">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dane gościa
            </legend>

            {/* Guest name with autocomplete — dropdown rendered inline (not portaled) */}
            <div className="relative">
              <Label htmlFor="create-guestName">Imię i nazwisko</Label>
              <Input
                ref={guestInputRef}
                id="create-guestName"
                data-testid="create-reservation-guest"
                className="mt-1"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onBlur={() => {
                  setTimeout(() => setSuggestionsOpen(false), 250);
                }}
                onFocus={() => {
                  if (guestSuggestions.length > 0) setSuggestionsOpen(true);
                }}
                onKeyDown={handleGuestKeyDown}
                placeholder="Wpisz min. 2 litery…"
                required
                autoComplete="off"
                role="combobox"
                aria-expanded={suggestionsOpen}
                aria-autocomplete="list"
              />
              {renderSuggestionsDropdown("name")}
              {guestId && (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Stały gość — dane uzupełnione z profilu
                </p>
              )}
            </div>

            {/* Email — full width with autocomplete */}
            <div className="relative">
              <Label htmlFor="create-guestEmail">Email</Label>
              <Input
                ref={emailInputRef}
                id="create-guestEmail"
                type="text"
                inputMode="email"
                className="mt-1"
                value={guestEmail}
                onChange={(e) => { emailUserTyping.current = true; setGuestEmail(e.target.value); }}
                onBlur={() => { setTimeout(() => { if (suggestionsField === "email") setSuggestionsOpen(false); }, 250); }}
                onFocus={() => { if (guestSuggestions.length > 0 && suggestionsField === "email") setSuggestionsOpen(true); }}
                onKeyDown={handleGuestKeyDown}
                placeholder="opcjonalnie"
                autoComplete="off"
              />
              {renderSuggestionsDropdown("email")}
            </div>

            {/* Phone — full width with autocomplete */}
            <div className="relative">
              <Label htmlFor="create-guestPhone">Telefon</Label>
              <Input
                ref={phoneInputRef}
                id="create-guestPhone"
                type="text"
                inputMode="tel"
                className="mt-1"
                value={guestPhone}
                onChange={(e) => { phoneUserTyping.current = true; setGuestPhone(e.target.value); }}
                onBlur={() => { setTimeout(() => { if (suggestionsField === "phone") setSuggestionsOpen(false); }, 250); }}
                onFocus={() => { if (guestSuggestions.length > 0 && suggestionsField === "phone") setSuggestionsOpen(true); }}
                onKeyDown={handleGuestKeyDown}
                placeholder="opcjonalnie, np. +48 600 123 456"
                autoComplete="off"
              />
              {renderSuggestionsDropdown("phone")}
            </div>

            {/* Date of birth + Nationality */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="create-guestDob">Data urodzenia</Label>
                <Input
                  id="create-guestDob"
                  type="date"
                  className="mt-1"
                  value={guestDateOfBirth}
                  onChange={(e) => setGuestDateOfBirth(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="create-nationality">Narodowość</Label>
                <select
                  id="create-nationality"
                  value={guestNationality}
                  onChange={(e) => setGuestNationality(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— wybierz —</option>
                  {NATIONALITY_OPTIONS.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Document type + number */}
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <div>
                <Label htmlFor="create-docType">Dokument</Label>
                <select
                  id="create-docType"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— typ —</option>
                  {DOCUMENT_TYPE_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="create-docNumber">Numer dokumentu</Label>
                <Input
                  id="create-docNumber"
                  type="text"
                  className="mt-1"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="np. ABC 123456"
                  autoComplete="off"
                />
              </div>
            </div>
          </fieldset>

          {/* ── Section: NIP / Faktura ── */}
          <fieldset className="space-y-3 rounded-lg border border-border/60 p-3">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Firma / Faktura
            </legend>

            <div>
              <Label htmlFor="create-nip">NIP</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="create-nip"
                  type="text"
                  inputMode="numeric"
                  className="flex-1"
                  value={nipInput}
                  onChange={(e) => {
                    const formatted = formatNip(e.target.value);
                    setNipInput(formatted);
                    setCompanyFound(false);
                    setNipError(null);
                  }}
                  placeholder="000-000-00-00"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={nipLookupLoading || nipInput.replace(/\D/g, "").length !== 10}
                  onClick={handleNipLookup}
                >
                  {nipLookupLoading ? "Szukam…" : "Sprawdź"}
                </Button>
              </div>
              {nipError && (
                <p className="mt-1 text-xs text-destructive">{nipError}</p>
              )}
            </div>

            {companyFound && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
                <div>
                  <Label htmlFor="create-companyName" className="text-xs">Nazwa firmy</Label>
                  <Input
                    id="create-companyName"
                    className="mt-0.5 h-8 text-sm"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="create-companyAddress" className="text-xs">Adres</Label>
                  <Input
                    id="create-companyAddress"
                    className="mt-0.5 h-8 text-sm"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <div>
                    <Label htmlFor="create-companyPostal" className="text-xs">Kod</Label>
                    <Input
                      id="create-companyPostal"
                      className="mt-0.5 h-8 text-sm"
                      value={companyPostalCode}
                      onChange={(e) => setCompanyPostalCode(e.target.value)}
                      placeholder="00-000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-companyCity" className="text-xs">Miasto</Label>
                    <Input
                      id="create-companyCity"
                      className="mt-0.5 h-8 text-sm"
                      value={companyCity}
                      onChange={(e) => setCompanyCity(e.target.value)}
                    />
                  </div>
                </div>
                <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Dane pobrane z GUS — możesz edytować
                </p>
              </div>
            )}

            {!companyFound && !nipInput.replace(/\D/g, "").length && (
              <p className="text-xs text-muted-foreground">
                Wpisz NIP, aby pobrać dane firmy do faktury. Zostaw puste, jeśli faktura nie jest potrzebna.
              </p>
            )}
          </fieldset>

          {/* ── Section: Reservation details ── */}
          <fieldset className="space-y-3 rounded-lg border border-border/60 p-3">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rezerwacja
            </legend>

            {/* Room select — shows type */}
            <div>
              <Label htmlFor="create-room">Pokój</Label>
              {rooms.length > 0 ? (
                <select
                  id="create-room"
                  data-testid="create-reservation-room"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  required
                  className={selectClass}
                >
                  <option value="">— wybierz pokój —</option>
                  {rooms.map((r) => (
                    <option key={r.number} value={r.number}>
                      {r.number}
                      {r.type ? ` · ${r.type}` : ""}
                      {r.price != null ? ` (${r.price} PLN)` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="create-room"
                  data-testid="create-reservation-room"
                  className="mt-1"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="Numer pokoju"
                  required
                />
              )}
            </div>

            {/* Check-in / Check-out */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="create-checkIn">Zameldowanie</Label>
                <Input
                  id="create-checkIn"
                  data-testid="create-reservation-checkIn"
                  type="date"
                  className="mt-1"
                  value={checkIn}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (e.target.value) {
                      setCheckOut(addDays(e.target.value, 1));
                    }
                  }}
                />
              </div>
              <div>
                <Label htmlFor="create-checkOut">Wymeldowanie</Label>
                <Input
                  id="create-checkOut"
                  data-testid="create-reservation-checkOut"
                  type="date"
                  className={`mt-1 ${dateError ? "border-destructive" : ""}`}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  min={checkIn ? addDays(checkIn, 1) : undefined}
                />
              </div>
            </div>

            {/* Nights counter + price */}
            {(() => {
              const pricePerNight = effectivePricePerNight ?? rooms.find((r) => r.number === room)?.price;
              const totalAmount =
                pricePerNight != null && pricePerNight > 0 && nights > 0
                  ? pricePerNight * nights
                  : undefined;
              if (dateError) {
                return (
                  <p className="text-sm font-medium text-destructive">
                    Data wymeldowania musi być po dacie zameldowania
                  </p>
                );
              }
              if (nights > 0) {
                return (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <p>
                      <strong>Liczba nocy:</strong> {nights}
                      {pricePerNight != null && pricePerNight > 0 && (
                        <> · <strong>Cena/dobę:</strong> {pricePerNight} PLN</>
                      )}
                      {totalAmount != null && (
                        <> · <strong>Suma:</strong> {totalAmount.toFixed(0)} PLN</>
                      )}
                    </p>
                  </div>
                );
              }
              return null;
            })()}
            {isNonRefundable && (
              <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
                Stawka non-refundable – brak zwrotu przy anulowaniu
              </p>
            )}

            {/* Adults + Children */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="create-adults">Dorośli</Label>
                <Input
                  id="create-adults"
                  type="number"
                  className="mt-1"
                  min={1}
                  max={20}
                  value={adults}
                  onChange={(e) => setAdults(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="create-children">Dzieci</Label>
                <Input
                  id="create-children"
                  type="number"
                  className="mt-1"
                  min={0}
                  max={20}
                  value={children}
                  onChange={(e) => setChildren(e.target.value)}
                />
              </div>
            </div>

            {/* Meal plan */}
            <div>
              <Label htmlFor="create-mealPlan">Wyżywienie</Label>
              <select
                id="create-mealPlan"
                value={mealPlan}
                onChange={(e) => setMealPlan(e.target.value)}
                className={selectClass}
              >
                <option value="">— brak / do ustalenia —</option>
                {MEAL_PLAN_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="create-notes">Uwagi do rezerwacji</Label>
              <textarea
                id="create-notes"
                className={textareaClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Uwagi widoczne na potwierdzeniu…"
                rows={2}
                maxLength={2000}
              />
            </div>
          </fieldset>

          {/* ── Collapsible: More options ── */}
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMoreOptionsOpen((v) => !v)}
          >
            <svg
              className={`h-4 w-4 transition-transform ${moreOptionsOpen ? "rotate-90" : ""}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            Więcej opcji
            {hasMoreOptionsSet && (
              <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-primary" title="Opcje ustawione" />
            )}
          </button>

          {moreOptionsOpen && (
            <div className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-3">
              {/* Source + Channel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="create-source">Źródło</Label>
                  <select
                    id="create-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— brak —</option>
                    {SOURCE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="create-channel">Kanał</Label>
                  <select
                    id="create-channel"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">— brak —</option>
                    {CHANNEL_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ETA */}
              <div className="max-w-[200px]">
                <Label htmlFor="create-eta">Szacowana godzina przyjazdu (ETA)</Label>
                <Input
                  id="create-eta"
                  type="time"
                  className="mt-1"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                />
              </div>

              {/* Hourly reservation times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="create-checkInTime">Godzina od (rez. godz.)</Label>
                  <Input
                    id="create-checkInTime"
                    type="time"
                    className="mt-1"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="create-checkOutTime">Godzina do</Label>
                  <Input
                    id="create-checkOutTime"
                    type="time"
                    className="mt-1"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Parking */}
              <div>
                <Label htmlFor="create-parking">Miejsce parkingowe</Label>
                <select
                  id="create-parking"
                  data-testid="create-reservation-parking"
                  value={parkingSpotId}
                  onChange={(e) => setParkingSpotId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— brak —</option>
                  {parkingSpots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rate code */}
              <div>
                <Label htmlFor="create-rateCode">Kod stawki</Label>
                <select
                  id="create-rateCode"
                  value={rateCodeId}
                  onChange={(e) => setRateCodeId(e.target.value)}
                  className={selectClass}
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

              {/* Status */}
              <div>
                <Label htmlFor="create-status">Status</Label>
                <select
                  id="create-status"
                  data-testid="create-reservation-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={selectClass}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Beds booked */}
              {roomBeds > 1 && (
                <div>
                  <Label htmlFor="create-beds">Łóżek (rezerwacja zasobowa)</Label>
                  <Input
                    id="create-beds"
                    type="number"
                    className="mt-1"
                    min={1}
                    max={roomBeds}
                    value={bedsBooked}
                    onChange={(e) => setBedsBooked(e.target.value)}
                    placeholder={`1–${roomBeds}`}
                  />
                </div>
              )}

              {/* Internal notes */}
              <div>
                <Label htmlFor="create-internalNotes">Uwagi wewnętrzne (tylko dla personelu)</Label>
                <textarea
                  id="create-internalNotes"
                  className={textareaClass}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Uwagi widoczne tylko dla personelu…"
                  rows={2}
                  maxLength={10000}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive" data-testid="create-reservation-error">{error}</p>}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                saveAndNewRef.current = true;
                handleSubmit();
              }}
              title="Ctrl+Shift+Enter"
            >
              {saving && saveAndNewRef.current ? "Zapisywanie…" : "Zapisz i nowa"}
            </Button>
            <Button ref={saveBtnRef} type="submit" disabled={saving} data-testid="create-reservation-save" title="Ctrl+Enter">
              {saving && !saveAndNewRef.current ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </DialogFooter>
          <p className="text-center text-xs text-muted-foreground">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Ctrl+Enter</kbd> zapisz · <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Ctrl+Shift+Enter</kbd> zapisz i nowa
          </p>
        </form>

      </DialogContent>
    </Dialog>
  );
}
