"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export type DictionaryEntry = { code: string; label: string };

export type ReservationDictionaries = {
  sources: DictionaryEntry[];
  channels: DictionaryEntry[];
  segments: DictionaryEntry[];
  cancellationReasons: DictionaryEntry[];
};

const DEFAULT_SOURCES: DictionaryEntry[] = [
  { code: "OTA", label: "OTA" },
  { code: "PHONE", label: "Telefon" },
  { code: "EMAIL", label: "E-mail" },
  { code: "WALK_IN", label: "Osobiście w recepcji" },
  { code: "WEBSITE", label: "Strona WWW hotelu" },
  { code: "BOOKING_ENGINE", label: "Własny silnik rezerwacji" },
  { code: "CHANNEL_MANAGER", label: "Channel Manager" },
  { code: "OTHER", label: "Inne" },
];

const DEFAULT_CHANNELS: DictionaryEntry[] = [
  { code: "DIRECT", label: "Bezpośrednio w hotelu" },
  { code: "BOOKING_COM", label: "Booking.com" },
  { code: "EXPEDIA", label: "Expedia" },
  { code: "AIRBNB", label: "Airbnb" },
  { code: "AGODA", label: "Agoda" },
  { code: "TRIVAGO", label: "Trivago" },
  { code: "HOTELS_COM", label: "Hotels.com" },
  { code: "HOSTELWORLD", label: "Hostelworld" },
  { code: "TRIP_COM", label: "Trip.com" },
  { code: "GOOGLE_HOTELS", label: "Google Hotels" },
  { code: "KAYAK", label: "Kayak" },
  { code: "HRS", label: "HRS" },
  { code: "CORPORATE", label: "Corporate (B2B)" },
  { code: "TRAVEL_AGENT", label: "Biuro podróży" },
  { code: "GDS", label: "GDS (Amadeus, Sabre, Galileo)" },
  { code: "OTHER", label: "Inne" },
];

const DEFAULT_SEGMENTS: DictionaryEntry[] = [
  { code: "BUSINESS", label: "Biznes" },
  { code: "LEISURE", label: "Turystyka" },
  { code: "GROUP", label: "Grupy" },
  { code: "CORPORATE", label: "Korporacja" },
  { code: "GOVERNMENT", label: "Sektor publiczny" },
  { code: "CREW", label: "Załogi" },
  { code: "WHOLESALE", label: "Hurtowy" },
  { code: "PACKAGE", label: "Pakiety" },
  { code: "LONG_STAY", label: "Długoterminowy" },
  { code: "RELOCATION", label: "Przeprowadzka" },
  { code: "MICE", label: "MICE" },
  { code: "OTHER", label: "Inne" },
];

const DEFAULT_CANCELLATION_REASONS: DictionaryEntry[] = [
  { code: "GUEST_REQUEST", label: "Na prośbę gościa" },
  { code: "NO_SHOW", label: "Niestawienie się gościa" },
  { code: "OVERBOOKING", label: "Nadrezerwacja" },
  { code: "FORCE_MAJEURE", label: "Siła wyższa" },
  { code: "PAYMENT_FAILED", label: "Brak płatności" },
  { code: "HOTEL_ERROR", label: "Błąd hotelu" },
  { code: "DOUBLE_BOOKING", label: "Podwójna rezerwacja" },
  { code: "CHANGE_OF_PLANS", label: "Zmiana planów gościa" },
  { code: "MEDICAL_EMERGENCY", label: "Nagły przypadek medyczny" },
  { code: "WEATHER", label: "Warunki pogodowe" },
  { code: "OTHER", label: "Inny powód" },
];

const DEFAULT_DICTIONARIES: ReservationDictionaries = {
  sources: DEFAULT_SOURCES,
  channels: DEFAULT_CHANNELS,
  segments: DEFAULT_SEGMENTS,
  cancellationReasons: DEFAULT_CANCELLATION_REASONS,
};

function normalizeEntry(e: unknown): DictionaryEntry | null {
  if (!e || typeof e !== "object" || !("code" in e) || !("label" in e)) return null;
  const code = String((e as { code: unknown }).code).trim();
  const label = String((e as { label: unknown }).label).trim();
  if (!code) return null;
  return { code, label: label || code };
}

function normalizeList(arr: unknown): DictionaryEntry[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeEntry).filter((e): e is DictionaryEntry => e !== null);
}

export async function getReservationDictionaries(): Promise<
  { success: true; data: ReservationDictionaries } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  const raw = row?.reservationDictionaries as Record<string, unknown> | null | undefined;
  if (!raw || typeof raw !== "object") {
    return { success: true, data: DEFAULT_DICTIONARIES };
  }
  const data: ReservationDictionaries = {
    sources: normalizeList(raw.sources).length > 0 ? normalizeList(raw.sources) : DEFAULT_SOURCES,
    channels: normalizeList(raw.channels).length > 0 ? normalizeList(raw.channels) : DEFAULT_CHANNELS,
    segments: normalizeList(raw.segments).length > 0 ? normalizeList(raw.segments) : DEFAULT_SEGMENTS,
    cancellationReasons:
      normalizeList(raw.cancellationReasons).length > 0
        ? normalizeList(raw.cancellationReasons)
        : DEFAULT_CANCELLATION_REASONS,
  };
  return { success: true, data };
}

/** Odczyt słowników do użycia w formularzach (np. select) – bez wymagania admin.settings. */
export async function getReservationDictionariesForForm(): Promise<ReservationDictionaries> {
  const row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  const raw = row?.reservationDictionaries as Record<string, unknown> | null | undefined;
  if (!raw || typeof raw !== "object") {
    return DEFAULT_DICTIONARIES;
  }
  return {
    sources: normalizeList(raw.sources).length > 0 ? normalizeList(raw.sources) : DEFAULT_SOURCES,
    channels: normalizeList(raw.channels).length > 0 ? normalizeList(raw.channels) : DEFAULT_CHANNELS,
    segments: normalizeList(raw.segments).length > 0 ? normalizeList(raw.segments) : DEFAULT_SEGMENTS,
    cancellationReasons:
      normalizeList(raw.cancellationReasons).length > 0
        ? normalizeList(raw.cancellationReasons)
        : DEFAULT_CANCELLATION_REASONS,
  };
}

export async function updateReservationDictionaries(
  data: ReservationDictionaries
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const normalized: ReservationDictionaries = {
    sources: data.sources?.length ? normalizeList(data.sources) : DEFAULT_SOURCES,
    channels: data.channels?.length ? normalizeList(data.channels) : DEFAULT_CHANNELS,
    segments: data.segments?.length ? normalizeList(data.segments) : DEFAULT_SEGMENTS,
    cancellationReasons: data.cancellationReasons?.length
      ? normalizeList(data.cancellationReasons)
      : DEFAULT_CANCELLATION_REASONS,
  };

  await prisma.hotelConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      name: "",
      reservationDictionaries: normalized as object,
    },
    update: {
      reservationDictionaries: normalized as object,
    },
  });
  return { success: true };
}
