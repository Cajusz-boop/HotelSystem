"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import {
  reservationSchema,
  moveReservationSchema,
  groupReservationSchema,
  splitReservationSchema,
  validateOptionalEmail,
  type ReservationInput,
  type MoveReservationInput,
  type GroupReservationInput,
  type SplitReservationInput,
} from "@/lib/validations/schemas";
import type { ReservationStatus, RoomStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { createOrUpdateCompany } from "@/app/actions/companies";
import { getEffectivePropertyId } from "@/app/actions/properties";
import {
  createParkingBooking,
  deleteParkingBookingsByReservation,
} from "@/app/actions/parking";
import { postRoomChargeOnCheckout, chargeLocalTax, createVatInvoice } from "@/app/actions/finance";
import { blockRoomExtensionAfterCheckout } from "@/lib/telephony";
import { generateRoomAccessCode } from "@/app/actions/digital-keys";
import { sendWelcomeToTv } from "@/lib/hotel-tv";
import { activateRoomPower, deactivateRoomPower } from "@/lib/energy-system";
import { sendReservationCreatedWebhook } from "@/lib/webhooks";
import { encrypt, decrypt } from "@/lib/encryption";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Data graniczna zamkniętego okresu (po Night Audit). Rezerwacje z checkIn przed tą datą nie mogą być edytowane. */
function getClosedCutoffDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isReservationInClosedPeriod(checkIn: Date, checkOut?: Date): boolean {
  const cutoff = getClosedCutoffDate();
  if (checkIn < cutoff) return true;
  if (checkOut && checkOut < cutoff) return true;
  return false;
}

/**
 * Generuje unikalny numer potwierdzenia rezerwacji.
 * Format: XXYYYY gdzie XX = 2 losowe litery (A-Z), YYYY = 4 losowe cyfry
 * Np. AB1234, XK9087
 */
async function generateConfirmationNumber(): Promise<string> {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // bez I, O (mylone z 1, 0)
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const l1 = letters[Math.floor(Math.random() * letters.length)];
    const l2 = letters[Math.floor(Math.random() * letters.length)];
    const num = String(Math.floor(1000 + Math.random() * 9000)); // 1000-9999
    const candidate = `${l1}${l2}${num}`;

    // Sprawdź unikalność
    const existing = await prisma.reservation.findUnique({
      where: { confirmationNumber: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  // Fallback: użyj timestampu dla gwarancji unikalności
  const ts = Date.now().toString(36).toUpperCase();
  return `R${ts}`;
}

/** Mapuje Prisma Reservation + Guest + Room (+ RateCode, parkingBookings) na typ UI */
function toUiReservation(r: {
  id: string;
  confirmationNumber?: string | null;
  guestId: string;
  room: { number: string };
  guest: { name: string; isBlacklisted?: boolean };
  checkIn: Date;
  checkOut: Date;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  eta?: string | null;
  etd?: string | null;
  status: ReservationStatus;
  source?: string | null;
  channel?: string | null;
  marketSegment?: string | null;
  tripPurpose?: string | null;
  mealPlan?: string | null;
  roomPreferences?: unknown;
  pax: number | null;
  adults?: number | null;
  children?: number | null;
  childrenAges?: unknown;
  petInfo?: unknown;
  paymentStatus?: string | null;
  securityDeposit?: unknown;
  isCreditCardGuaranteed?: boolean;
  cardGuarantee?: unknown;
  advancePayment?: unknown;
  cancellationReason?: string | null;
  cancellationCode?: string | null;
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
  alerts?: unknown;
  agentId?: string | null;
  agentData?: unknown;
  bedsBooked?: number | null;
  notes?: string | null;
  internalNotes?: string | null;
  specialRequests?: string | null;
  rateCode?: { id: string; code: string; name: string; price: unknown } | null;
  rateCodePrice?: unknown; // Decimal | null – nadpisanie ceny za dobę
  parkingBookings?: Array<{ parkingSpotId: string; parkingSpot: { number: string } }>;
  group?: { id: string; name: string | null } | null;
}) {
  const firstParking = r.parkingBookings?.[0];
  return {
    id: r.id,
    confirmationNumber: r.confirmationNumber ?? undefined,
    guestId: r.guestId,
    guestName: r.guest?.name ?? "—",
    guestBlacklisted: r.guest?.isBlacklisted ?? false,
    room: r.room.number,
    checkIn: formatDate(r.checkIn),
    checkOut: formatDate(r.checkOut),
    checkInTime: r.checkInTime ?? undefined,
    checkOutTime: r.checkOutTime ?? undefined,
    eta: r.eta ?? undefined,
    etd: r.etd ?? undefined,
    status: r.status as string,
    source: r.source ?? undefined,
    channel: r.channel ?? undefined,
    marketSegment: r.marketSegment ?? undefined,
    tripPurpose: r.tripPurpose ?? undefined,
    mealPlan: r.mealPlan ?? undefined,
    roomPreferences: r.roomPreferences as Record<string, unknown> | undefined,
    pax: r.pax ?? undefined,
    adults: r.adults ?? undefined,
    children: r.children ?? undefined,
    childrenAges: r.childrenAges as number[] | undefined,
    petInfo: r.petInfo as Record<string, unknown> | undefined,
    paymentStatus: r.paymentStatus ?? undefined,
    securityDeposit: r.securityDeposit as Record<string, unknown> | undefined,
    cardGuarantee: r.isCreditCardGuaranteed ? ({} as Record<string, unknown>) : undefined,
    advancePayment: r.advancePayment as Record<string, unknown> | undefined,
    cancellationReason: r.cancellationReason ?? undefined,
    cancellationCode: r.cancellationCode ?? undefined,
    cancelledAt: r.cancelledAt ?? undefined,
    cancelledBy: r.cancelledBy ?? undefined,
    alerts: r.alerts as Record<string, unknown> | undefined,
    agentId: r.agentId ?? undefined,
    agentData: r.agentData as Record<string, unknown> | undefined,
    bedsBooked: r.bedsBooked ?? undefined,
    notes: r.notes ?? undefined,
    internalNotes: r.internalNotes ?? undefined,
    specialRequests: r.specialRequests ?? undefined,
    rateCodeId: r.rateCode?.id ?? undefined,
    rateCode: r.rateCode?.code ?? undefined,
    rateCodeName: r.rateCode?.name ?? undefined,
    rateCodePrice: r.rateCodePrice != null ? Number(r.rateCodePrice) : (r.rateCode?.price != null ? Number(r.rateCode.price) : undefined),
    groupId: r.group?.id ?? undefined,
    groupName: r.group?.name ?? undefined,
    parkingSpotId: firstParking?.parkingSpotId ?? undefined,
    parkingSpotNumber: firstParking?.parkingSpot?.number ?? undefined,
  };
}

/**
 * Pobiera gościa po ID (karta gościa – edycja klienta).
 * @param guestId - ID gościa
 * @returns ActionResult z danymi gościa lub błędem
 */
export async function getGuestById(
  guestId: string
): Promise<
  ActionResult<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    photoUrl: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelation: string | null;
    occupation: string | null;
    guestType: string;
    segment: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    nationality: string | null;
    gender: string | null;
    street: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    documentType: string | null;
    documentNumber: string | null;
    documentExpiry: string | null;
    documentIssuedBy: string | null;
    mrz: string | null;
    isVip: boolean;
    vipLevel: string | null;
    isBlacklisted: boolean;
    preferences: Record<string, unknown> | null;
    totalStays: number;
    lastStayDate: string | null;
    mealPreferences: {
      vegetarian?: boolean;
      vegan?: boolean;
      glutenFree?: boolean;
      lactoseFree?: boolean;
      halal?: boolean;
      kosher?: boolean;
      allergies?: string[];
      other?: string;
    } | null;
    healthAllergies: string | null;
    healthNotes: string | null;
    favoriteMinibarItems: Array<{ itemId?: string; name: string; quantity?: number }> | null;
    staffNotes: string | null;
    // RODO
    gdprDataProcessingConsent: boolean;
    gdprDataProcessingDate: string | null;
    gdprMarketingConsent: boolean;
    gdprMarketingConsentDate: string | null;
    gdprThirdPartyConsent: boolean;
    gdprThirdPartyConsentDate: string | null;
    gdprConsentWithdrawnAt: string | null;
    gdprAnonymizedAt: string | null;
    gdprNotes: string | null;
    customFields: Record<string, unknown> | null;
  }>
> {
  if (!guestId || typeof guestId !== "string" || !guestId.trim()) {
    return { success: false, error: "ID gościa jest wymagane" };
  }
  try {
    let session: Awaited<ReturnType<typeof getSession>> = null;
    try {
      session = await getSession();
    } catch (error) {
      console.error("[getGuestById] getSession error:", error instanceof Error ? error.message : String(error));
    }
    if (session) {
      const allowed = await can(session.role, "module.guests");
      if (!allowed) return { success: false, error: "Brak uprawnień do przeglądania karty gościa" };
    }
    const guest = await prisma.guest.findUnique({
      where: { id: guestId.trim() },
    });
    if (!guest)
      return { success: false, error: "Gość nie istnieje" };
    return {
      success: true,
      data: {
        id: guest.id,
        name: guest.name,
        email: guest.email ?? null,
        phone: guest.phone ?? null,
        photoUrl: guest.photoUrl ?? null,
        emergencyContactName: guest.emergencyContactName ?? null,
        emergencyContactPhone: guest.emergencyContactPhone ?? null,
        emergencyContactRelation: guest.emergencyContactRelation ?? null,
        occupation: guest.occupation ?? null,
        guestType: guest.guestType,
        segment: guest.segment ?? null,
        dateOfBirth: guest.dateOfBirth ? guest.dateOfBirth.toISOString().slice(0, 10) : null,
        placeOfBirth: guest.placeOfBirth ?? null,
        nationality: guest.nationality ?? null,
        gender: guest.gender ?? null,
        street: guest.street ?? null,
        city: guest.city ?? null,
        postalCode: guest.postalCode ?? null,
        country: guest.country ?? null,
        documentType: guest.documentType ?? null,
        documentNumber: guest.documentNumber ?? null,
        documentExpiry: guest.documentExpiry ? guest.documentExpiry.toISOString().slice(0, 10) : null,
        documentIssuedBy: guest.documentIssuedBy ?? null,
        mrz: decrypt(guest.mrz) ?? null,
        isVip: guest.isVip,
        vipLevel: guest.vipLevel ?? null,
        isBlacklisted: guest.isBlacklisted,
        preferences: guest.preferences as Record<string, unknown> | null,
        totalStays: guest.totalStays,
        lastStayDate: guest.lastStayDate ? guest.lastStayDate.toISOString().slice(0, 10) : null,
        mealPreferences: guest.mealPreferences as {
          vegetarian?: boolean;
          vegan?: boolean;
          glutenFree?: boolean;
          lactoseFree?: boolean;
          halal?: boolean;
          kosher?: boolean;
          allergies?: string[];
          other?: string;
        } | null,
        healthAllergies: guest.healthAllergies ?? null,
        healthNotes: guest.healthNotes ?? null,
        favoriteMinibarItems: guest.favoriteMinibarItems as Array<{ itemId?: string; name: string; quantity?: number }> | null,
        staffNotes: guest.staffNotes ?? null,
        // RODO
        gdprDataProcessingConsent: guest.gdprDataProcessingConsent,
        gdprDataProcessingDate: guest.gdprDataProcessingDate?.toISOString() ?? null,
        gdprMarketingConsent: guest.gdprMarketingConsent,
        gdprMarketingConsentDate: guest.gdprMarketingConsentDate?.toISOString() ?? null,
        gdprThirdPartyConsent: guest.gdprThirdPartyConsent,
        gdprThirdPartyConsentDate: guest.gdprThirdPartyConsentDate?.toISOString() ?? null,
        gdprConsentWithdrawnAt: guest.gdprConsentWithdrawnAt?.toISOString() ?? null,
        gdprAnonymizedAt: guest.gdprAnonymizedAt?.toISOString() ?? null,
        gdprNotes: guest.gdprNotes ?? null,
        customFields: guest.customFields as Record<string, unknown> | null,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania gościa",
    };
  }
}

/**
 * Szuka gości po imieniu/nazwisku lub MRZ (wykrywanie duplikatów).
 * @param name - fragment imienia/nazwiska (min. 2 znaki)
 * @param mrz - opcjonalnie MRZ (min. 5 znaków)
 * @returns ActionResult z tablicą { id, name } (max 5 wyników)
 */
export async function findGuestByNameOrMrz(
  name: string,
  mrz?: string
): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  try {
    const trimmedName = name.trim();
    const trimmedMrz = mrz?.trim();

    if (!trimmedName && !trimmedMrz) {
      return { success: true, data: [] };
    }

    const conditions: { name?: { contains: string }; mrz?: string }[] = [];
    if (trimmedName.length >= 2) {
      conditions.push({ name: { contains: trimmedName } });
    }
    if (trimmedMrz && trimmedMrz.length >= 5) {
      conditions.push({ mrz: trimmedMrz });
    }

    if (conditions.length === 0) {
      return { success: true, data: [] };
    }

    const guests = await prisma.guest.findMany({
      where: { OR: conditions },
      take: 5,
      select: { id: true, name: true },
    });

    return { success: true, data: guests };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania gościa",
    };
  }
}

/** Wynik wyszukiwania gościa do formularza meldunkowego (autouzupełnianie) */
export interface GuestCheckInSuggestion {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
}

/**
 * Wyszukiwanie gości do autouzupełniania formularza meldunkowego.
 * Szuka po imieniu/nazwisku, emailu lub numerze telefonu (min. 2 znaki).
 * Można wpisywać w dowolne pole – wynik uzupełni resztę.
 */
export async function findGuestsForCheckIn(
  query: string
): Promise<ActionResult<GuestCheckInSuggestion[]>> {
  try {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { success: true, data: [] };
    }
    const digitsOnly = trimmed.replace(/\D/g, "");
    const hasDigits = digitsOnly.length >= 2;

    const conditions: Prisma.GuestWhereInput[] = [
      { name: { contains: trimmed } },
      { email: { contains: trimmed } },
      { phone: { contains: trimmed } },
    ];
    if (hasDigits) {
      conditions.push({ phone: { contains: digitsOnly } });
    }

    const guests = await prisma.guest.findMany({
      where: { OR: conditions, isBlacklisted: false },
      take: 8,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dateOfBirth: true,
      },
      orderBy: { name: "asc" },
    });

    const data: GuestCheckInSuggestion[] = guests.map((g) => ({
      id: g.id,
      name: g.name,
      email: g.email ?? null,
      phone: g.phone ?? null,
      dateOfBirth: g.dateOfBirth
        ? g.dateOfBirth.toISOString().slice(0, 10)
        : null,
    }));

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania gościa",
    };
  }
}

/**
 * Lista rezerwacji gościa (historia pobytów) – do kartoteki gościa.
 * @param guestId - ID gościa
 * @returns ActionResult z tablicą rezerwacji (toUiReservation)
 */
export async function getReservationsByGuestId(
  guestId: string
): Promise<ActionResult<ReturnType<typeof toUiReservation>[]>> {
  if (!guestId || typeof guestId !== "string" || !guestId.trim()) {
    return { success: false, error: "ID gościa jest wymagane" };
  }
  try {
    const list = await prisma.reservation.findMany({
      where: { guestId: guestId.trim() },
      orderBy: { checkIn: "desc" },
      include: {
        guest: true,
        room: true,
        rateCode: true,
        parkingBookings: { include: { parkingSpot: true } },
        group: true,
      },
    });
    return { success: true, data: list.map(toUiReservation) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania historii rezerwacji",
    };
  }
}

/**
 * Pobiera dane rezerwacji do edycji (email, telefon, źródło, kanał, wyżywienie, dorośli, dzieci, eta, uwagi wewnętrzne).
 */
export async function getReservationEditData(
  reservationId: string
): Promise<ActionResult<{
  guestEmail: string | null;
  guestPhone: string | null;
  source: string | null;
  channel: string | null;
  mealPlan: string | null;
  adults: number | null;
  children: number | null;
  eta: string | null;
  internalNotes: string | null;
  marketSegment: string | null;
  externalReservationNumber: string | null;
  currency: string | null;
  reminderAt: Date | null;
  notesVisibleOnChart: boolean;
  extraStatus: string | null;
  advanceDueDate: string | null;
}>> {
  if (!reservationId?.trim()) return { success: false, error: "ID rezerwacji wymagane" };
  try {
    const res = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        source: true,
        channel: true,
        mealPlan: true,
        adults: true,
        children: true,
        eta: true,
        internalNotes: true,
        marketSegment: true,
        externalReservationNumber: true,
        currency: true,
        reminderAt: true,
        notesVisibleOnChart: true,
        extraStatus: true,
        advanceDueDate: true,
        guest: { select: { email: true, phone: true } },
      },
    });
    if (!res) return { success: false, error: "Rezerwacja nie istnieje" };
    return {
      success: true,
      data: {
        guestEmail: res.guest?.email ?? null,
        guestPhone: res.guest?.phone ?? null,
        source: res.source,
        channel: res.channel,
        mealPlan: res.mealPlan,
        adults: res.adults,
        children: res.children,
        eta: res.eta,
        internalNotes: res.internalNotes,
        marketSegment: res.marketSegment ?? null,
        externalReservationNumber: res.externalReservationNumber ?? null,
        currency: res.currency ?? null,
        reminderAt: res.reminderAt ?? null,
        notesVisibleOnChart: res.notesVisibleOnChart ?? false,
        extraStatus: res.extraStatus ?? null,
        advanceDueDate: res.advanceDueDate ? res.advanceDueDate.toISOString().slice(0, 10) : null,
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd" };
  }
}

/**
 * Pobiera dane firmy (NIP) powiązane z rezerwacją — do formularza rozliczenia.
 */
export async function getReservationCompany(
  reservationId: string
): Promise<ActionResult<{ nip: string; name: string; address?: string | null; postalCode?: string | null; city?: string | null } | null>> {
  if (!reservationId?.trim()) return { success: true, data: null };
  try {
    const res = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { company: { select: { nip: true, name: true, address: true, postalCode: true, city: true } } },
    });
    if (!res?.company) return { success: true, data: null };
    const c = res.company;
    return {
      success: true,
      data: {
        nip: c.nip ?? "",
        name: c.name ?? "",
        address: c.address,
        postalCode: c.postalCode,
        city: c.city,
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd" };
  }
}

/**
 * Tworzy nową rezerwację; zwraca pełny obiekt rezerwacji do dodania do Tape Chart.
 * @param input - dane rezerwacji (walidowane przez reservationSchema)
 * @returns ActionResult z toUiReservation lub błędem walidacji/zapisu
 */
export async function createReservation(
  input: ReservationInput
): Promise<ActionResult<ReturnType<typeof toUiReservation>>> {
  const parsed = reservationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Błąd walidacji" };
  }
  const data = parsed.data;

  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const guestEmail = data.guestEmail?.trim() || null;
    const guestPhone = data.guestPhone?.trim() || null;
    const guestIdInput = data.guestId?.trim() || null;

    let guest: { id: string; name: string; isBlacklisted: boolean } | null = null;

    if (guestIdInput) {
      guest = await prisma.guest.findUnique({
        where: { id: guestIdInput },
        select: { id: true, name: true, isBlacklisted: true },
      });
      if (!guest) {
        return { success: false, error: "Wybrany gość nie istnieje w bazie. Wybierz innego lub wpisz dane nowego gościa." };
      }
    }

    if (!guest) {
      guest = await prisma.guest.findFirst({
        where: { name: data.guestName },
        select: { id: true, name: true, isBlacklisted: true },
      });
    }

    let guestMatched = false;
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          name: data.guestName,
          ...(guestEmail ? { email: guestEmail } : {}),
          ...(guestPhone ? { phone: guestPhone } : {}),
          ...(data.mrz != null && data.mrz !== "" ? { mrz: encrypt(data.mrz) } : {}),
          ...(data.guestDateOfBirth != null && data.guestDateOfBirth !== ""
            ? { dateOfBirth: new Date(data.guestDateOfBirth) }
            : {}),
        },
      });
    } else {
      guestMatched = true;
      if (guest.isBlacklisted) {
        return {
          success: false,
          error: `Nie można utworzyć rezerwacji – gość "${guest.name}" znajduje się na czarnej liście. Skontaktuj się z managerem, aby odblokować gościa.`,
        };
      }

      const updateData: { mrz?: string; dateOfBirth?: Date; email?: string | null; phone?: string | null } = {};
      if (data.mrz != null && data.mrz !== "") updateData.mrz = encrypt(data.mrz);
      if (data.guestDateOfBirth != null && data.guestDateOfBirth !== "") {
        updateData.dateOfBirth = new Date(data.guestDateOfBirth);
      }
      if (guestEmail) updateData.email = guestEmail;
      if (guestPhone) updateData.phone = guestPhone;
      if (Object.keys(updateData).length > 0) {
        guest = await prisma.guest.update({
          where: { id: guest.id },
          data: updateData,
          select: { id: true, name: true, isBlacklisted: true },
        });
      }
    }

    const room = await prisma.room.findUnique({ where: { number: data.room } });
    if (!room) {
      return { success: false, error: `Pokój ${data.room} nie istnieje` };
    }
    if (!room.activeForSale) {
      return { success: false, error: `Pokój ${data.room} jest wycofany ze sprzedaży. Wybierz inny pokój lub przywróć go w module Pokoje.` };
    }

    const roomBeds = room.beds ?? 1;
    const requestedBeds = data.bedsBooked ?? roomBeds; // null/undefined = cały pokój
    if (requestedBeds < 1 || requestedBeds > roomBeds) {
      return { success: false, error: `Liczba łóżek musi być od 1 do ${roomBeds} dla tego pokoju.` };
    }
    const checkInDate = new Date(data.checkIn + "T12:00:00Z");
    const checkOutDate = new Date(data.checkOut + "T12:00:00Z");
    const cutoff = getClosedCutoffDate();
    if (checkInDate < cutoff) {
      return {
        success: false,
        error: "Nie można tworzyć rezerwacji z datą przyjazdu w przeszłości (przed audytem). Wybierz datę od dziś.",
      };
    }
    const overlapping = await prisma.reservation.findMany({
      where: {
        roomId: room.id,
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
      select: { bedsBooked: true },
    });
    const usedBeds = overlapping.reduce(
      (sum, res) => sum + (res.bedsBooked ?? roomBeds),
      0
    );
    let overbookingAllowed = false;
    if (usedBeds + requestedBeds > roomBeds) {
      const propertyId = room.propertyId ?? (await getEffectivePropertyId());
      const property = propertyId
        ? await prisma.property.findUnique({
            where: { id: propertyId },
            select: { overbookingLimitPercent: true },
          })
        : null;
      const limitPercent = property?.overbookingLimitPercent ?? 0;
      const maxBeds = roomBeds * (1 + limitPercent / 100);
      if (usedBeds + requestedBeds > maxBeds) {
        return {
          success: false,
          error: `W tym okresie dostępne jest ${Math.max(0, roomBeds - usedBeds)} z ${roomBeds} łóżek${limitPercent > 0 ? ` (limit overbooking ${limitPercent}%: ${Math.floor(maxBeds)} ł.)` : ""}. Zmień daty lub liczbę łóżek.`,
        };
      }
      overbookingAllowed = true;
    }
    const nights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000));
    let roomType: Awaited<ReturnType<typeof prisma.roomType.findUnique>> = null;
    try {
      roomType = await prisma.roomType.findUnique({ where: { name: room.type } });
    } catch (error) {
      console.error("[createReservation] roomType.findUnique error:", error instanceof Error ? error.message : String(error));
    }
    if (roomType) {
      let plan: Awaited<ReturnType<typeof prisma.ratePlan.findFirst>> = null;
      try {
        plan = await prisma.ratePlan.findFirst({
          where: {
            roomTypeId: roomType.id,
            validFrom: { lte: checkInDate },
            validTo: { gte: checkInDate },
          },
        });
      } catch (error) {
        console.error("[createReservation] ratePlan.findFirst error:", error instanceof Error ? error.message : String(error));
      }
      if (plan) {
        if (plan.minStayNights != null && nights < plan.minStayNights) {
          return { success: false, error: `Min. długość pobytu dla tej stawki sezonowej: ${plan.minStayNights} nocy.` };
        }
        if (plan.maxStayNights != null && nights > plan.maxStayNights) {
          return { success: false, error: `Maks. długość pobytu dla tej stawki sezonowej: ${plan.maxStayNights} nocy.` };
        }
      }
    }

    let companyId: string | null = data.companyId ?? null;
    if (data.companyData) {
      // Upsert Company (incl. user-edited full trading name) so next NIP lookup returns it from DB
      const companyResult = await createOrUpdateCompany({
        nip: data.companyData.nip,
        name: data.companyData.name,
        address: data.companyData.address,
        postalCode: data.companyData.postalCode,
        city: data.companyData.city,
        country: data.companyData.country,
      });
      if (!companyResult.success) {
        return { success: false, error: companyResult.error };
      }
      companyId = companyResult.data.companyId;
    }

    // Generuj unikalny numer potwierdzenia
    const confirmationNumber = await generateConfirmationNumber();

    const reservation = await prisma.reservation.create({
      data: {
        confirmationNumber,
        guestId: guest.id,
        roomId: room.id,
        ...(companyId ? { companyId } : {}),
        ...(data.rateCodeId != null && data.rateCodeId !== "" ? { rateCodeId: data.rateCodeId } : {}),
        ...(data.rateCodePrice != null && data.rateCodePrice > 0 ? { rateCodePrice: data.rateCodePrice } : {}),
        checkIn: new Date(data.checkIn),
        checkOut: new Date(data.checkOut),
        checkInTime: data.checkInTime?.trim() || null,
        checkOutTime: data.checkOutTime?.trim() || null,
        eta: data.eta?.trim() || null,
        etd: data.etd?.trim() || null,
        status: (data.status === "REQUEST" ? "PENDING" : data.status) as ReservationStatus,
        source: data.source ?? null,
        channel: data.channel ?? null,
        marketSegment: data.marketSegment ?? null,
        tripPurpose: data.tripPurpose ?? null,
        mealPlan: data.mealPlan ?? null,
        ...(data.roomPreferences ? { roomPreferences: data.roomPreferences } : {}),
        pax: data.pax ?? null,
        adults: data.adults ?? null,
        children: data.children ?? null,
        ...(data.childrenAges && data.childrenAges.length > 0 ? { childrenAges: data.childrenAges } : {}),
        ...(data.petInfo ? { petInfo: data.petInfo } : {}),
        ...(data.paymentStatus ? { paymentStatus: data.paymentStatus } : {}),
        ...(data.securityDeposit ? { securityDeposit: data.securityDeposit } : {}),
        ...(data.cardGuarantee !== undefined ? { isCreditCardGuaranteed: Boolean(data.cardGuarantee) } : {}),
        ...(data.advancePayment ? { advancePayment: data.advancePayment } : {}),
        ...(data.alerts ? { alerts: data.alerts } : {}),
        ...(data.agentId ? { agentId: data.agentId } : {}),
        ...(data.agentData ? { agentData: data.agentData } : {}),
        bedsBooked: data.bedsBooked ?? null,
        ...(data.notes != null && data.notes !== "" ? { notes: data.notes } : {}),
        ...(data.internalNotes != null && data.internalNotes !== "" ? { internalNotes: data.internalNotes } : {}),
        ...(data.specialRequests != null && data.specialRequests !== "" ? { specialRequests: data.specialRequests } : {}),
        ...(data.customFormData && Object.keys(data.customFormData).length > 0
          ? { metadata: JSON.stringify(data.customFormData) }
          : {}),
      },
      include: { guest: true, room: true, rateCode: true, company: true },
    });

    if (data.parkingSpotId && data.parkingSpotId.trim()) {
      const parkingResult = await createParkingBooking({
        parkingSpotId: data.parkingSpotId.trim(),
        reservationId: reservation.id,
        startDate: new Date(data.checkIn),
        endDate: new Date(data.checkOut),
      });
      if (!parkingResult.success) {
        await prisma.reservation.delete({ where: { id: reservation.id } });
        return { success: false, error: parkingResult.error };
      }
    }

    const reservationWithParking = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: { guest: true, room: true, rateCode: true, company: true, parkingBookings: { include: { parkingSpot: true } }, group: true },
    });
    const resToReturn = reservationWithParking ?? reservation;

    await createAuditLog({
      actionType: "CREATE",
      entityType: "Reservation",
      entityId: reservation.id,
      newValue: toUiReservation(resToReturn) as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    void sendReservationCreatedWebhook({
      event: "reservation.created",
      id: reservation.id,
      confirmationNumber: reservation.confirmationNumber,
      guestName: reservation.guest.name,
      roomNumber: reservation.room.number,
      checkIn: formatDate(reservation.checkIn),
      checkOut: formatDate(reservation.checkOut),
      status: reservation.status,
      source: reservation.source,
      channel: reservation.channel,
      pax: reservation.pax,
      createdAt: reservation.createdAt.toISOString(),
    });

    revalidatePath("/front-office");
    return {
      success: true,
      data: toUiReservation(resToReturn),
      ...(overbookingAllowed && { overbooking: true }),
      ...(guest.isBlacklisted && { guestBlacklisted: true }),
      ...(guestMatched && { guestMatched: true }),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu rezerwacji",
    };
  }
}

/**
 * Ustawia lub usuwa gościa z czarnej listy.
 * @param guestId - ID gościa
 * @param isBlacklisted - true = na czarnej liście, false = zdjęcie z listy
 * @returns ActionResult z isBlacklisted
 */
export async function updateGuestBlacklist(
  guestId: string,
  isBlacklisted: boolean
): Promise<ActionResult<{ isBlacklisted: boolean }>> {
  if (!guestId || typeof guestId !== "string" || !guestId.trim()) {
    return { success: false, error: "ID gościa jest wymagane" };
  }
  try {
    await prisma.guest.update({
      where: { id: guestId.trim() },
      data: { isBlacklisted },
    });
    return { success: true, data: { isBlacklisted } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji",
    };
  }
}

/** Aktualizuje dane gościa (karta gościa – edycja klienta). */
export async function updateGuest(
  guestId: string,
  data: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    photoUrl?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
    occupation?: string | null;
    guestType?: string;
    segment?: string | null;
    dateOfBirth?: string | null;
    placeOfBirth?: string | null;
    nationality?: string | null;
    gender?: string | null;
    street?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    documentExpiry?: string | null;
    documentIssuedBy?: string | null;
    mrz?: string | null;
    isVip?: boolean;
    vipLevel?: string | null;
    preferences?: Record<string, unknown> | null;
    mealPreferences?: {
      vegetarian?: boolean;
      vegan?: boolean;
      glutenFree?: boolean;
      lactoseFree?: boolean;
      halal?: boolean;
      kosher?: boolean;
      allergies?: string[];
      other?: string;
    } | null;
    healthAllergies?: string | null;
    healthNotes?: string | null;
    favoriteMinibarItems?: Array<{ itemId?: string; name: string; quantity?: number }> | null;
    staffNotes?: string | null;
    // RODO
    gdprDataProcessingConsent?: boolean;
    gdprMarketingConsent?: boolean;
    gdprThirdPartyConsent?: boolean;
    gdprNotes?: string | null;
    customFields?: Record<string, unknown> | null;
  }
): Promise<ActionResult<void>> {
  try {
    if (data.email !== undefined) {
      const emailCheck = validateOptionalEmail(data.email);
      if (!emailCheck.ok) return { success: false, error: emailCheck.error };
    }
    const now = new Date();
    
    // Jeśli zmieniono zgody, zapisz datę zmiany
    const gdprUpdates: Record<string, unknown> = {};
    if (data.gdprDataProcessingConsent !== undefined) {
      gdprUpdates.gdprDataProcessingConsent = data.gdprDataProcessingConsent;
      gdprUpdates.gdprDataProcessingDate = data.gdprDataProcessingConsent ? now : null;
    }
    if (data.gdprMarketingConsent !== undefined) {
      gdprUpdates.gdprMarketingConsent = data.gdprMarketingConsent;
      gdprUpdates.gdprMarketingConsentDate = data.gdprMarketingConsent ? now : null;
    }
    if (data.gdprThirdPartyConsent !== undefined) {
      gdprUpdates.gdprThirdPartyConsent = data.gdprThirdPartyConsent;
      gdprUpdates.gdprThirdPartyConsentDate = data.gdprThirdPartyConsent ? now : null;
    }
    if (data.gdprNotes !== undefined) {
      gdprUpdates.gdprNotes = data.gdprNotes?.trim() ?? null;
    }

    await prisma.guest.update({
      where: { id: guestId },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.email !== undefined && { email: data.email?.trim() ?? null }),
        ...(data.phone !== undefined && { phone: data.phone?.trim() ?? null }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl?.trim() ?? null }),
        ...(data.emergencyContactName !== undefined && { emergencyContactName: data.emergencyContactName?.trim() ?? null }),
        ...(data.emergencyContactPhone !== undefined && { emergencyContactPhone: data.emergencyContactPhone?.trim() ?? null }),
        ...(data.emergencyContactRelation !== undefined && { emergencyContactRelation: data.emergencyContactRelation ?? null }),
        ...(data.occupation !== undefined && { occupation: data.occupation?.trim() ?? null }),
        ...(data.guestType !== undefined && { guestType: data.guestType }),
        ...(data.segment !== undefined && { segment: data.segment ?? null }),
        ...(data.dateOfBirth !== undefined && { 
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null 
        }),
        ...(data.placeOfBirth !== undefined && { placeOfBirth: data.placeOfBirth?.trim() ?? null }),
        ...(data.nationality !== undefined && { nationality: data.nationality?.trim() ?? null }),
        ...(data.gender !== undefined && { gender: data.gender?.trim() ?? null }),
        ...(data.street !== undefined && { street: data.street?.trim() ?? null }),
        ...(data.city !== undefined && { city: data.city?.trim() ?? null }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode?.trim() ?? null }),
        ...(data.country !== undefined && { country: data.country?.trim() ?? null }),
        ...(data.documentType !== undefined && { documentType: data.documentType ?? null }),
        ...(data.documentNumber !== undefined && { documentNumber: data.documentNumber?.trim() ?? null }),
        ...(data.documentExpiry !== undefined && { 
          documentExpiry: data.documentExpiry ? new Date(data.documentExpiry) : null 
        }),
        ...(data.documentIssuedBy !== undefined && { documentIssuedBy: data.documentIssuedBy?.trim() ?? null }),
        ...(data.mrz !== undefined && { mrz: data.mrz?.trim() ? encrypt(data.mrz.trim()) : null }),
        ...(data.isVip !== undefined && { isVip: data.isVip }),
        ...(data.vipLevel !== undefined && { vipLevel: data.vipLevel ?? null }),
        ...(data.preferences !== undefined && { preferences: data.preferences as object ?? null }),
        ...(data.mealPreferences !== undefined && { mealPreferences: data.mealPreferences as object ?? null }),
        ...(data.healthAllergies !== undefined && { healthAllergies: data.healthAllergies?.trim() ?? null }),
        ...(data.healthNotes !== undefined && { healthNotes: data.healthNotes?.trim() ?? null }),
        ...(data.favoriteMinibarItems !== undefined && { favoriteMinibarItems: data.favoriteMinibarItems as object ?? null }),
        ...(data.staffNotes !== undefined && { staffNotes: data.staffNotes?.trim() ?? null }),
        ...(data.customFields !== undefined && { customFields: data.customFields as object ?? null }),
        ...gdprUpdates,
      },
    });
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji gościa",
    };
  }
}

/**
 * Wycofuje wszystkie zgody RODO dla gościa.
 */
export async function withdrawAllGdprConsents(
  guestId: string
): Promise<ActionResult<void>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { id: true, name: true },
    });
    if (!guest) return { success: false, error: "Gość nie istnieje" };

    await prisma.guest.update({
      where: { id: guestId },
      data: {
        gdprDataProcessingConsent: false,
        gdprDataProcessingDate: null,
        gdprMarketingConsent: false,
        gdprMarketingConsentDate: null,
        gdprThirdPartyConsent: false,
        gdprThirdPartyConsentDate: null,
        gdprConsentWithdrawnAt: new Date(),
      },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "GuestGdprConsent",
      entityId: guestId,
      oldValue: { action: "withdraw_all_consents" },
      newValue: { withdrawnAt: new Date().toISOString() },
      ipAddress: ip,
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wycofywania zgód RODO",
    };
  }
}

/**
 * Anonimizuje dane gościa (prawo do bycia zapomnianym).
 * Zachowuje rezerwacje ale usuwa dane osobowe.
 */
export async function anonymizeGuestData(
  guestId: string
): Promise<ActionResult<void>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });
    if (!guest) return { success: false, error: "Gość nie istnieje" };

    // Anonimizuj dane osobowe
    const anonymizedName = `Anonimowy_${guestId.slice(-8)}`;
    
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        name: anonymizedName,
        email: null,
        phone: null,
        dateOfBirth: null,
        placeOfBirth: null,
        nationality: null,
        gender: null,
        street: null,
        city: null,
        postalCode: null,
        country: null,
        documentType: null,
        documentNumber: null,
        documentExpiry: null,
        documentIssuedBy: null,
        mrz: null,
        preferences: Prisma.JsonNull,
        mealPreferences: Prisma.JsonNull,
        healthAllergies: null,
        healthNotes: null,
        favoriteMinibarItems: Prisma.JsonNull,
        staffNotes: null,
        // Zachowaj flagi lojalnościowe ale zresetuj dane
        loyaltyCardNumber: null,
        loyaltyPoints: 0,
        loyaltyTotalPoints: 0,
        loyaltyTotalStays: 0,
        loyaltyEnrolledAt: null,
        // Ustaw daty RODO
        gdprDataProcessingConsent: false,
        gdprMarketingConsent: false,
        gdprThirdPartyConsent: false,
        gdprAnonymizedAt: new Date(),
        gdprNotes: `Dane zanonimizowane na żądanie ${new Date().toISOString()}`,
      },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "GuestGdprAnonymize",
      entityId: guestId,
      oldValue: { originalName: guest.name },
      newValue: { anonymizedTo: anonymizedName, anonymizedAt: new Date().toISOString() },
      ipAddress: ip,
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd anonimizacji danych",
    };
  }
}

/**
 * Eksportuje wszystkie dane gościa (RODO - prawo dostępu do danych).
 * Zwraca pełne dane w formacie odpowiednim do eksportu CSV/PDF.
 */
export interface GuestExportData {
  exportDate: string;
  guest: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    photoUrl: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelation: string | null;
    occupation: string | null;
    guestType: string;
    segment: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    nationality: string | null;
    gender: string | null;
    street: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    documentType: string | null;
    documentNumber: string | null;
    documentExpiry: string | null;
    documentIssuedBy: string | null;
    isVip: boolean;
    vipLevel: string | null;
    isBlacklisted: boolean;
    totalStays: number;
    lastStayDate: string | null;
    mealPreferences: Record<string, unknown> | null;
    healthAllergies: string | null;
    healthNotes: string | null;
    favoriteMinibarItems: unknown[] | null;
    staffNotes: string | null;
    loyaltyCardNumber: string | null;
    loyaltyPoints: number;
    loyaltyTotalPoints: number;
    loyaltyTotalStays: number;
    loyaltyEnrolledAt: string | null;
    loyaltyTierName: string | null;
    gdprDataProcessingConsent: boolean;
    gdprDataProcessingDate: string | null;
    gdprMarketingConsent: boolean;
    gdprMarketingConsentDate: string | null;
    gdprThirdPartyConsent: boolean;
    gdprThirdPartyConsentDate: string | null;
    gdprConsentWithdrawnAt: string | null;
    gdprAnonymizedAt: string | null;
    gdprNotes: string | null;
    createdAt: string;
    updatedAt: string;
  };
  reservations: Array<{
    id: string;
    confirmationNumber: string | null;
    roomNumber: string;
    checkIn: string;
    checkOut: string;
    status: string;
    source: string | null;
    channel: string | null;
    mealPlan: string | null;
    pax: number | null;
    adults: number | null;
    children: number | null;
    notes: string | null;
    createdAt: string;
  }>;
  loyaltyTransactions: Array<{
    id: string;
    type: string;
    points: number;
    balanceAfter: number;
    reason: string | null;
    createdAt: string;
  }>;
}

export async function exportGuestData(
  guestId: string
): Promise<ActionResult<GuestExportData>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        loyaltyTier: { select: { name: true } },
      },
    });
    if (!guest) return { success: false, error: "Gość nie istnieje" };

    // Pobierz rezerwacje
    const reservations = await prisma.reservation.findMany({
      where: { guestId },
      include: { room: { select: { number: true } } },
      orderBy: { checkIn: "desc" },
    });

    // Pobierz transakcje lojalnościowe
    const loyaltyTransactions = await prisma.loyaltyTransaction.findMany({
      where: { guestId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const exportData: GuestExportData = {
      exportDate: new Date().toISOString(),
      guest: {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        photoUrl: guest.photoUrl,
        emergencyContactName: guest.emergencyContactName,
        emergencyContactPhone: guest.emergencyContactPhone,
        emergencyContactRelation: guest.emergencyContactRelation,
        occupation: guest.occupation,
        guestType: guest.guestType,
        segment: guest.segment,
        dateOfBirth: guest.dateOfBirth?.toISOString().split("T")[0] ?? null,
        placeOfBirth: guest.placeOfBirth,
        nationality: guest.nationality,
        gender: guest.gender,
        street: guest.street,
        city: guest.city,
        postalCode: guest.postalCode,
        country: guest.country,
        documentType: guest.documentType,
        documentNumber: guest.documentNumber,
        documentExpiry: guest.documentExpiry?.toISOString().split("T")[0] ?? null,
        documentIssuedBy: guest.documentIssuedBy,
        isVip: guest.isVip,
        vipLevel: guest.vipLevel,
        isBlacklisted: guest.isBlacklisted,
        totalStays: guest.totalStays,
        lastStayDate: guest.lastStayDate?.toISOString().split("T")[0] ?? null,
        mealPreferences: guest.mealPreferences as Record<string, unknown> | null,
        healthAllergies: guest.healthAllergies,
        healthNotes: guest.healthNotes,
        favoriteMinibarItems: guest.favoriteMinibarItems as unknown[] | null,
        staffNotes: guest.staffNotes,
        loyaltyCardNumber: guest.loyaltyCardNumber,
        loyaltyPoints: guest.loyaltyPoints,
        loyaltyTotalPoints: guest.loyaltyTotalPoints,
        loyaltyTotalStays: guest.loyaltyTotalStays,
        loyaltyEnrolledAt: guest.loyaltyEnrolledAt?.toISOString() ?? null,
        loyaltyTierName: guest.loyaltyTier?.name ?? null,
        gdprDataProcessingConsent: guest.gdprDataProcessingConsent,
        gdprDataProcessingDate: guest.gdprDataProcessingDate?.toISOString() ?? null,
        gdprMarketingConsent: guest.gdprMarketingConsent,
        gdprMarketingConsentDate: guest.gdprMarketingConsentDate?.toISOString() ?? null,
        gdprThirdPartyConsent: guest.gdprThirdPartyConsent,
        gdprThirdPartyConsentDate: guest.gdprThirdPartyConsentDate?.toISOString() ?? null,
        gdprConsentWithdrawnAt: guest.gdprConsentWithdrawnAt?.toISOString() ?? null,
        gdprAnonymizedAt: guest.gdprAnonymizedAt?.toISOString() ?? null,
        gdprNotes: guest.gdprNotes,
        createdAt: guest.createdAt.toISOString(),
        updatedAt: guest.updatedAt.toISOString(),
      },
      reservations: reservations.map((r) => ({
        id: r.id,
        confirmationNumber: r.confirmationNumber,
        roomNumber: r.room.number,
        checkIn: r.checkIn.toISOString().split("T")[0] ?? "",
        checkOut: r.checkOut.toISOString().split("T")[0] ?? "",
        status: r.status,
        source: r.source,
        channel: r.channel,
        mealPlan: r.mealPlan,
        pax: r.pax,
        adults: r.adults,
        children: r.children,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
      })),
      loyaltyTransactions: loyaltyTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        points: t.points,
        balanceAfter: t.balanceAfter,
        reason: t.reason,
        createdAt: t.createdAt.toISOString(),
      })),
    };

    // Audit log (READ not in Prisma enum – use UPDATE for export access)
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "GuestDataExport",
      entityId: guestId,
      newValue: { exportedAt: exportData.exportDate },
      ipAddress: ip,
    });

    return { success: true, data: exportData };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd eksportu danych",
    };
  }
}

// ===== HISTORIA RODO =====

/**
 * Dane historii RODO gościa.
 */
export interface GdprHistoryEntry {
  id: string;
  timestamp: string;
  actionType: string;
  description: string;
  details: Record<string, unknown> | null;
}

/**
 * Pobiera historię zmian RODO dla gościa z logu audytu.
 */
export async function getGuestGdprHistory(
  guestId: string,
  options?: { limit?: number }
): Promise<ActionResult<GdprHistoryEntry[]>> {
  try {
    const { limit = 50 } = options ?? {};

    // Pobierz logi audytu związane z RODO dla tego gościa
    const logs = await prisma.auditLog.findMany({
      where: {
        entityId: guestId,
        entityType: {
          in: [
            "GuestGdprConsent",
            "GuestDataExport",
            "GuestAnonymization",
            "Guest", // dla zmian pól GDPR
          ],
        },
      },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    const history: GdprHistoryEntry[] = logs.map((log) => {
      let description = "";
      const newVal = log.newValue as Record<string, unknown> | null;
      const oldVal = log.oldValue as Record<string, unknown> | null;

      switch (log.entityType) {
        case "GuestGdprConsent":
          if (oldVal?.action === "withdraw_all_consents") {
            description = "Wycofano wszystkie zgody RODO";
          } else if (newVal?.gdprDataProcessingConsent !== undefined) {
            const consent = newVal.gdprDataProcessingConsent ? "udzielono" : "wycofano";
            description = `Zgoda na przetwarzanie danych: ${consent}`;
          } else if (newVal?.gdprMarketingConsent !== undefined) {
            const consent = newVal.gdprMarketingConsent ? "udzielono" : "wycofano";
            description = `Zgoda marketingowa: ${consent}`;
          } else if (newVal?.gdprThirdPartyConsent !== undefined) {
            const consent = newVal.gdprThirdPartyConsent ? "udzielono" : "wycofano";
            description = `Zgoda na udostępnianie partnerom: ${consent}`;
          } else {
            description = "Zmiana zgód RODO";
          }
          break;
        case "GuestDataExport":
          description = "Eksport danych gościa (Art. 15 RODO)";
          break;
        case "GuestAnonymization":
          description = "Anonimizacja danych (Art. 17 RODO - prawo do bycia zapomnianym)";
          break;
        case "Guest":
          // Sprawdź czy to zmiana pól GDPR
          if (newVal?.gdprAnonymizedAt) {
            description = "Dane zanonimizowane";
          } else if (newVal?.gdprConsentWithdrawnAt) {
            description = "Wycofanie zgód";
          } else {
            description = "Aktualizacja danych gościa";
          }
          break;
        default:
          description = `Operacja: ${log.actionType}`;
      }

      return {
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        actionType: log.actionType,
        description,
        details: newVal ?? oldVal ?? null,
      };
    });

    return { success: true, data: history };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania historii RODO",
    };
  }
}

// ===== AUTOUZUPEŁNIANIE PÓL Z POPRZEDNICH POBYTÓW =====

/**
 * Dane do autouzupełniania pól gościa.
 */
export interface GuestAutoFillData {
  // Dane podstawowe
  name: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  gender: string | null;
  // Adres
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  // Dokument
  documentType: string | null;
  documentNumber: string | null;
  documentExpiry: string | null;
  documentIssuedBy: string | null;
  // Preferencje z poprzednich pobytów
  preferredRoomType: string | null;
  preferredFloor: string | null;
  preferredBedType: string | null;
  // Najczęstsze wybory
  mostCommonRateCode: string | null;
  mostCommonMealPlan: string | null;
  // Statystyki
  totalStays: number;
  averageStayLength: number | null;
  averagePax: number | null;
}

/**
 * Pobiera dane gościa do autouzupełniania na podstawie ID lub dopasowania (imię + MRZ).
 * Użyteczne przy meldunku - gdy gość już był w hotelu, możemy wstępnie wypełnić pola.
 */
export async function getGuestAutoFillData(
  options: { guestId?: string; name?: string; mrz?: string; email?: string; phone?: string }
): Promise<ActionResult<GuestAutoFillData | null>> {
  try {
    const { guestId, name, mrz, email, phone } = options;

    // Znajdź gościa
    type GuestWithReservations = Awaited<ReturnType<typeof prisma.guest.findUnique<{ where: { id: string }; include: { reservations: { select: { id: true; checkIn: true; checkOut: true; pax: true; rateCodeId: true; mealPlan: true; roomPreferences: true; room: { select: { type: true; floor: true } } }; orderBy: { checkIn: "desc" }; take: 20 } } }>>>;
    let guest: GuestWithReservations = null;

    if (guestId) {
      guest = await prisma.guest.findUnique({
        where: { id: guestId },
        include: {
          reservations: {
            select: {
              id: true,
              checkIn: true,
              checkOut: true,
              pax: true,
              rateCodeId: true,
              mealPlan: true,
              roomPreferences: true,
              room: {
                select: { type: true, floor: true },
              },
            },
            orderBy: { checkIn: "desc" },
            take: 20,
          },
        },
      });
    } else {
      // Szukaj po różnych kryteriach
      const searchConditions: object[] = [];
      
      if (mrz && mrz.length >= 10) {
        searchConditions.push({ mrz: { contains: mrz.slice(0, 15) } });
      }
      if (email) {
        searchConditions.push({ email: email.toLowerCase().trim() });
      }
      if (phone) {
        const normalizedPhone = phone.replace(/[\s\-\+\(\)]/g, "");
        if (normalizedPhone.length >= 6) {
          searchConditions.push({ phone: { contains: normalizedPhone.slice(-6) } });
        }
      }
      if (name && name.trim().length >= 3) {
        searchConditions.push({ name: { contains: name.trim() } });
      }

      if (searchConditions.length > 0) {
        guest = await prisma.guest.findFirst({
          where: { OR: searchConditions },
          include: {
            reservations: {
              select: {
                id: true,
                checkIn: true,
                checkOut: true,
                pax: true,
                rateCodeId: true,
                mealPlan: true,
                roomPreferences: true,
                room: {
                  select: { type: true, floor: true },
                },
              },
              orderBy: { checkIn: "desc" },
              take: 20,
            },
          },
          orderBy: { totalStays: "desc" }, // Preferuj gościa z większą liczbą pobytów
        });
      }
    }

    if (!guest) {
      return { success: true, data: null };
    }

    // Oblicz statystyki z rezerwacji
    const reservations = guest.reservations;
    let totalStayLength = 0;
    let totalPax = 0;
    let paxCount = 0;
    const roomTypes: Record<string, number> = {};
    const floors: Record<string, number> = {};
    const rateCodes: Record<string, number> = {};
    const mealPlans: Record<string, number> = {};
    let preferredBedType: string | null = null;

    for (const res of reservations) {
      // Długość pobytu
      const checkIn = new Date(res.checkIn);
      const checkOut = new Date(res.checkOut);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      totalStayLength += nights;

      // Pax
      if (res.pax) {
        totalPax += res.pax;
        paxCount++;
      }

      // Typ pokoju
      if (res.room?.type) {
        roomTypes[res.room.type] = (roomTypes[res.room.type] ?? 0) + 1;
      }

      // Piętro
      if (res.room?.floor) {
        floors[res.room.floor] = (floors[res.room.floor] ?? 0) + 1;
      }

      // Rate code
      if (res.rateCodeId) {
        rateCodes[res.rateCodeId] = (rateCodes[res.rateCodeId] ?? 0) + 1;
      }

      // Meal plan
      if (res.mealPlan) {
        mealPlans[res.mealPlan] = (mealPlans[res.mealPlan] ?? 0) + 1;
      }

      // Bed type z preferencji
      const prefs = res.roomPreferences as Record<string, string> | null;
      if (prefs?.bedType && !preferredBedType) {
        preferredBedType = prefs.bedType;
      }
    }

    // Znajdź najczęstsze wartości
    const getMostCommon = (counts: Record<string, number>): string | null => {
      const entries = Object.entries(counts);
      if (entries.length === 0) return null;
      entries.sort((a, b) => b[1] - a[1]);
      return entries[0][0];
    };

    const autoFillData: GuestAutoFillData = {
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      dateOfBirth: guest.dateOfBirth?.toISOString().split("T")[0] ?? null,
      nationality: guest.nationality,
      gender: guest.gender,
      street: guest.street,
      city: guest.city,
      postalCode: guest.postalCode,
      country: guest.country,
      documentType: guest.documentType,
      documentNumber: guest.documentNumber,
      documentExpiry: guest.documentExpiry?.toISOString().split("T")[0] ?? null,
      documentIssuedBy: guest.documentIssuedBy,
      preferredRoomType: getMostCommon(roomTypes),
      preferredFloor: getMostCommon(floors),
      preferredBedType: preferredBedType ?? (guest.preferences as Record<string, string> | null)?.bedType ?? null,
      mostCommonRateCode: getMostCommon(rateCodes),
      mostCommonMealPlan: getMostCommon(mealPlans),
      totalStays: guest.totalStays,
      averageStayLength: reservations.length > 0 ? Math.round(totalStayLength / reservations.length * 10) / 10 : null,
      averagePax: paxCount > 0 ? Math.round(totalPax / paxCount * 10) / 10 : null,
    };

    return { success: true, data: autoFillData };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania danych do autouzupełniania",
    };
  }
}

// ===== RELACJE MIĘDZY GOŚĆMI =====

export interface GuestRelationData {
  id: string;
  relatedGuestId: string;
  relatedGuestName: string;
  relationType: string;
  note: string | null;
  direction: "from" | "to";  // "from" = ten gość jest źródłem, "to" = ten gość jest celem
}

/**
 * Pobiera wszystkie relacje gościa (zarówno jako źródło jak i cel).
 */
export async function getGuestRelations(
  guestId: string
): Promise<ActionResult<GuestRelationData[]>> {
  try {
    const [asSource, asTarget] = await Promise.all([
      prisma.guestRelation.findMany({
        where: { sourceGuestId: guestId },
        include: { targetGuest: { select: { id: true, name: true } } },
      }),
      prisma.guestRelation.findMany({
        where: { targetGuestId: guestId },
        include: { sourceGuest: { select: { id: true, name: true } } },
      }),
    ]);

    const relations: GuestRelationData[] = [
      ...asSource.map((r) => ({
        id: r.id,
        relatedGuestId: r.targetGuest.id,
        relatedGuestName: r.targetGuest.name,
        relationType: r.relationType,
        note: r.note,
        direction: "from" as const,
      })),
      ...asTarget.map((r) => ({
        id: r.id,
        relatedGuestId: r.sourceGuest.id,
        relatedGuestName: r.sourceGuest.name,
        relationType: getInverseRelationType(r.relationType),
        note: r.note,
        direction: "to" as const,
      })),
    ];

    return { success: true, data: relations };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania relacji",
    };
  }
}

// Zwraca odwrotny typ relacji (np. CHILD -> PARENT)
function getInverseRelationType(type: string): string {
  switch (type) {
    case "CHILD": return "PARENT";
    case "PARENT": return "CHILD";
    case "SPOUSE": return "SPOUSE";
    case "SIBLING": return "SIBLING";
    case "FRIEND": return "FRIEND";
    case "COLLEAGUE": return "COLLEAGUE";
    case "ASSISTANT": return "EMPLOYER";
    case "EMPLOYER": return "ASSISTANT";
    default: return type;
  }
}

/**
 * Dodaje relację między dwoma gośćmi.
 */
export async function addGuestRelation(
  sourceGuestId: string,
  targetGuestId: string,
  relationType: string,
  note?: string
): Promise<ActionResult<GuestRelationData>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    if (sourceGuestId === targetGuestId) {
      return { success: false, error: "Nie można utworzyć relacji gościa z samym sobą" };
    }

    // Sprawdź czy relacja już istnieje (w obu kierunkach)
    const existing = await prisma.guestRelation.findFirst({
      where: {
        OR: [
          { sourceGuestId, targetGuestId },
          { sourceGuestId: targetGuestId, targetGuestId: sourceGuestId },
        ],
      },
    });
    if (existing) {
      return { success: false, error: "Relacja między tymi gośćmi już istnieje" };
    }

    // Pobierz dane docelowego gościa
    const targetGuest = await prisma.guest.findUnique({
      where: { id: targetGuestId },
      select: { id: true, name: true },
    });
    if (!targetGuest) {
      return { success: false, error: "Gość docelowy nie istnieje" };
    }

    const relation = await prisma.guestRelation.create({
      data: {
        sourceGuestId,
        targetGuestId,
        relationType,
        note: note?.trim() || null,
      },
    });

    await createAuditLog({
      actionType: "CREATE",
      entityType: "GuestRelation",
      entityId: relation.id,
      newValue: { sourceGuestId, targetGuestId, relationType },
      ipAddress: ip,
    });

    return {
      success: true,
      data: {
        id: relation.id,
        relatedGuestId: targetGuest.id,
        relatedGuestName: targetGuest.name,
        relationType,
        note: relation.note,
        direction: "from",
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd dodawania relacji",
    };
  }
}

/**
 * Usuwa relację między gośćmi.
 */
export async function removeGuestRelation(
  relationId: string
): Promise<ActionResult<void>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const relation = await prisma.guestRelation.findUnique({
      where: { id: relationId },
    });
    if (!relation) {
      return { success: false, error: "Relacja nie istnieje" };
    }

    await prisma.guestRelation.delete({ where: { id: relationId } });

    await createAuditLog({
      actionType: "DELETE",
      entityType: "GuestRelation",
      entityId: relationId,
      oldValue: relation as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania relacji",
    };
  }
}

/**
 * Wyszukuje gości po nazwie (do wyboru przy dodawaniu relacji).
 */
export async function searchGuestsForRelation(
  query: string,
  excludeGuestId: string,
  limit = 10
): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  try {
    const guests = await prisma.guest.findMany({
      where: {
        id: { not: excludeGuestId },
        name: { contains: query },
      },
      select: { id: true, name: true },
      take: limit,
      orderBy: { name: "asc" },
    });
    return { success: true, data: guests };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania",
    };
  }
}

// ===== WYSZUKIWARKA GOŚCI =====

export interface GuestSearchResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  documentNumber: string | null;
  isVip: boolean;
  isBlacklisted: boolean;
  totalStays: number;
  lastStayDate: string | null;
  guestType: string;
  segment: string | null;
}

/**
 * Zaawansowane wyszukiwanie gości po różnych kryteriach.
 */
export async function searchGuests(
  query: string,
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: "name" | "lastStay" | "totalStays" | "createdAt";
    sortOrder?: "asc" | "desc";
    onlyVip?: boolean;
    onlyBlacklisted?: boolean;
    guestType?: string;
    segment?: string;
  }
): Promise<ActionResult<{ guests: GuestSearchResult[]; total: number }>> {
  try {
    const {
      limit = 20,
      offset = 0,
      sortBy = "name",
      sortOrder = "asc",
      onlyVip,
      onlyBlacklisted,
      guestType,
      segment,
    } = options ?? {};

    const trimmedQuery = query.trim();

    // Buduj warunki wyszukiwania
    const whereConditions: Prisma.GuestWhereInput = {
      AND: [
        // Filtrowanie wg tekstu
        trimmedQuery.length > 0
          ? {
              OR: [
                { name: { contains: trimmedQuery } },
                { email: { contains: trimmedQuery } },
                { phone: { contains: trimmedQuery } },
                { documentNumber: { contains: trimmedQuery } },
                { loyaltyCardNumber: { contains: trimmedQuery } },
              ],
            }
          : {},
        // Filtrowanie wg flag
        ...(onlyVip ? [{ isVip: true }] : []),
        ...(onlyBlacklisted ? [{ isBlacklisted: true }] : []),
        ...(guestType ? [{ guestType }] : []),
        ...(segment ? [{ segment }] : []),
      ],
    };

    // Mapuj sortowanie
    const orderBy: Prisma.GuestOrderByWithRelationInput =
      sortBy === "lastStay"
        ? { lastStayDate: sortOrder }
        : sortBy === "totalStays"
        ? { totalStays: sortOrder }
        : sortBy === "createdAt"
        ? { createdAt: sortOrder }
        : { name: sortOrder };

    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where: whereConditions,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          documentNumber: true,
          isVip: true,
          isBlacklisted: true,
          totalStays: true,
          lastStayDate: true,
          guestType: true,
          segment: true,
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.guest.count({ where: whereConditions }),
    ]);

    return {
      success: true,
      data: {
        guests: guests.map((g) => ({
          ...g,
          lastStayDate: g.lastStayDate?.toISOString().split("T")[0] ?? null,
        })),
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania gości",
    };
  }
}

/** Parametry zaawansowanego filtrowania gości (CRM). */
export type FilteredGuestsParams = {
  search?: string;
  segment?: string;
  country?: string;
  nationality?: string;
  isVip?: boolean;
  isBlacklisted?: boolean;
  lastStayFrom?: string;
  lastStayTo?: string;
  minStays?: number;
  maxStays?: number;
  minAge?: number;
  maxAge?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

/** Lista gości z zaawansowanym filtrowaniem (CRM). */
export type GuestListEntry = GuestSearchResult;

function buildGuestFilterWhere(params: FilteredGuestsParams): Prisma.GuestWhereInput {
  const where: Prisma.GuestWhereInput = {};
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { documentNumber: { contains: q } },
      { loyaltyCardNumber: { contains: q } },
    ];
  }
  if (params.segment) where.segment = params.segment;
  if (params.country) where.country = params.country;
  if (params.nationality) where.nationality = params.nationality;
  if (params.isVip !== undefined) where.isVip = params.isVip;
  if (params.isBlacklisted !== undefined) where.isBlacklisted = params.isBlacklisted;
  if (params.lastStayFrom || params.lastStayTo) {
    where.lastStayDate = {};
    if (params.lastStayFrom) where.lastStayDate.gte = new Date(params.lastStayFrom);
    if (params.lastStayTo) where.lastStayDate.lte = new Date(params.lastStayTo);
  }
  if (params.minStays != null || params.maxStays != null) {
    where.totalStays = {};
    if (params.minStays != null) where.totalStays.gte = params.minStays;
    if (params.maxStays != null) where.totalStays.lte = params.maxStays;
  }
  if (params.minAge != null || params.maxAge != null) {
    const now = new Date();
    where.dateOfBirth = {};
    if (params.maxAge != null) {
      where.dateOfBirth.gte = new Date(now.getFullYear() - params.maxAge, now.getMonth(), now.getDate());
    }
    if (params.minAge != null) {
      where.dateOfBirth.lte = new Date(now.getFullYear() - params.minAge, now.getMonth(), now.getDate());
    }
  }
  return where;
}

export async function getFilteredGuests(
  params: FilteredGuestsParams
): Promise<ActionResult<{ data: GuestListEntry[]; total: number }>> {
  try {
    const where = buildGuestFilterWhere(params);
    const sortBy = params.sortBy || "name";
    const sortDir = params.sortDir || "asc";
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const orderBy = sortBy === "lastStayDate" ? { lastStayDate: sortDir } : sortBy === "totalStays" ? { totalStays: sortDir } : sortBy === "createdAt" ? { createdAt: sortDir } : sortBy === "email" ? { email: sortDir } : { name: sortDir };

    const [data, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          documentNumber: true,
          isVip: true,
          isBlacklisted: true,
          totalStays: true,
          lastStayDate: true,
          guestType: true,
          segment: true,
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.guest.count({ where }),
    ]);

    return {
      success: true,
      data: {
        data: data.map((g) => ({
          ...g,
          lastStayDate: g.lastStayDate?.toISOString().split("T")[0] ?? null,
        })),
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd filtrowania gości",
    };
  }
}

/** Wiersz gościa do eksportu CSV/Excel. */
export type GuestExportEntry = {
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  nationality: string | null;
  segment: string | null;
  isVip: boolean;
  isBlacklisted: boolean;
  totalStays: number;
  lastStayDate: string | null;
  dateOfBirth: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  documentType: string | null;
  documentNumber: string | null;
};

export async function getGuestsForExport(
  params: FilteredGuestsParams
): Promise<ActionResult<GuestExportEntry[]>> {
  try {
    const where = buildGuestFilterWhere(params);
    const guests = await prisma.guest.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        name: true,
        email: true,
        phone: true,
        country: true,
        nationality: true,
        segment: true,
        isVip: true,
        isBlacklisted: true,
        totalStays: true,
        lastStayDate: true,
        dateOfBirth: true,
        street: true,
        city: true,
        postalCode: true,
        documentType: true,
        documentNumber: true,
      },
    });
    return {
      success: true,
      data: guests.map((g) => ({
        name: g.name,
        email: g.email ?? null,
        phone: g.phone ?? null,
        country: g.country ?? null,
        nationality: g.nationality ?? null,
        segment: g.segment ?? null,
        isVip: g.isVip,
        isBlacklisted: g.isBlacklisted,
        totalStays: g.totalStays,
        lastStayDate: g.lastStayDate?.toISOString().split("T")[0] ?? null,
        dateOfBirth: g.dateOfBirth?.toISOString().split("T")[0] ?? null,
        street: g.street ?? null,
        city: g.city ?? null,
        postalCode: g.postalCode ?? null,
        documentType: g.documentType ?? null,
        documentNumber: g.documentNumber ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd eksportu gości",
    };
  }
}

/** Rabat gościa na okres. */
export type GuestDiscountData = {
  id: string;
  guestId: string;
  percentage: number;
  dateFrom: string;
  dateTo: string;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
};

export async function getGuestDiscounts(guestId: string): Promise<ActionResult<GuestDiscountData[]>> {
  try {
    const list = await prisma.guestDiscount.findMany({
      where: { guestId },
      orderBy: [{ dateFrom: "desc" }, { createdAt: "desc" }],
    });
    return {
      success: true,
      data: list.map((d) => ({
        id: d.id,
        guestId: d.guestId,
        percentage: Number(d.percentage),
        dateFrom: d.dateFrom.toISOString().split("T")[0],
        dateTo: d.dateTo.toISOString().split("T")[0],
        reason: d.reason ?? null,
        isActive: d.isActive,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd pobierania rabatów" };
  }
}

export async function createGuestDiscount(params: {
  guestId: string;
  percentage: number;
  dateFrom: string;
  dateTo: string;
  reason?: string;
}): Promise<ActionResult<GuestDiscountData>> {
  try {
    const d = await prisma.guestDiscount.create({
      data: {
        guestId: params.guestId,
        percentage: params.percentage,
        dateFrom: new Date(params.dateFrom),
        dateTo: new Date(params.dateTo),
        reason: params.reason?.trim() || null,
        isActive: true,
      },
    });
    return {
      success: true,
      data: {
        id: d.id,
        guestId: d.guestId,
        percentage: Number(d.percentage),
        dateFrom: d.dateFrom.toISOString().split("T")[0],
        dateTo: d.dateTo.toISOString().split("T")[0],
        reason: d.reason ?? null,
        isActive: d.isActive,
        createdAt: d.createdAt.toISOString(),
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd tworzenia rabatu" };
  }
}

export async function deleteGuestDiscount(id: string): Promise<ActionResult<void>> {
  try {
    await prisma.guestDiscount.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd usuwania rabatu" };
  }
}

export async function getActiveGuestDiscount(
  guestId: string,
  date: string
): Promise<ActionResult<GuestDiscountData | null>> {
  try {
    const d = await prisma.guestDiscount.findFirst({
      where: {
        guestId,
        isActive: true,
        dateFrom: { lte: new Date(date) },
        dateTo: { gte: new Date(date) },
      },
      orderBy: { percentage: "desc" },
    });
    if (!d)
      return { success: true, data: null };
    return {
      success: true,
      data: {
        id: d.id,
        guestId: d.guestId,
        percentage: Number(d.percentage),
        dateFrom: d.dateFrom.toISOString().split("T")[0],
        dateTo: d.dateTo.toISOString().split("T")[0],
        reason: d.reason ?? null,
        isActive: d.isActive,
        createdAt: d.createdAt.toISOString(),
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd sprawdzania rabatu" };
  }
}

/** Dokument gościa (faktura / rachunek / proforma). */
export type GuestDocumentEntry = {
  type: "invoice" | "receipt" | "proforma";
  id: string;
  number: string;
  amount: number;
  issuedAt: string;
  status?: string;
};

export async function getGuestDocuments(guestId: string): Promise<ActionResult<GuestDocumentEntry[]>> {
  try {
    const reservationIds = await prisma.reservation.findMany({
      where: { guestId },
      select: { id: true },
    });
    const resIds = reservationIds.map((r) => r.id);
    if (resIds.length === 0) return { success: true, data: [] };

    const [invoices, receipts, proformas] = await Promise.all([
      prisma.invoice.findMany({
        where: { reservationId: { in: resIds } },
        orderBy: { issuedAt: "desc" },
        select: { id: true, number: true, amountGross: true, issuedAt: true },
      }),
      prisma.receipt.findMany({
        where: { reservationId: { in: resIds } },
        orderBy: { issuedAt: "desc" },
        select: { id: true, number: true, amount: true, issuedAt: true, isPaid: true },
      }),
      prisma.proforma.findMany({
        where: { reservationId: { in: resIds } },
        orderBy: { issuedAt: "desc" },
        select: { id: true, number: true, amount: true, issuedAt: true },
      }),
    ]);

    const entries: GuestDocumentEntry[] = [
      ...invoices.map((i) => ({
        type: "invoice" as const,
        id: i.id,
        number: i.number,
        amount: Number(i.amountGross),
        issuedAt: i.issuedAt.toISOString().split("T")[0],
        status: "Zapłacona",
      })),
      ...receipts.map((r) => ({
        type: "receipt" as const,
        id: r.id,
        number: r.number,
        amount: Number(r.amount),
        issuedAt: r.issuedAt.toISOString().split("T")[0],
        status: r.isPaid ? "Zapłacona" : "—",
      })),
      ...proformas.map((p) => ({
        type: "proforma" as const,
        id: p.id,
        number: p.number,
        amount: Number(p.amount),
        issuedAt: p.issuedAt.toISOString().split("T")[0],
        status: "—",
      })),
    ];
    entries.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    return { success: true, data: entries };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd pobierania dokumentów" };
  }
}

export async function createGroupReservation(
  input: GroupReservationInput
): Promise<
  ActionResult<{
    group: { id: string; name?: string };
    reservations: ReturnType<typeof toUiReservation>[];
  }>
> {
  const parsed = groupReservationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Błąd walidacji" };
  }
  const data = parsed.data;

  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const result = await prisma.$transaction(async (trx) => {
      const group = await trx.reservationGroup.create({
        data: {
          name: data.groupName ?? null,
          note: data.note ?? null,
        },
      });

      const uiReservations: ReturnType<typeof toUiReservation>[] = [];

      for (const res of data.reservations) {
        const guestName = res.guestName.trim();
        let guest = await trx.guest.findFirst({ where: { name: guestName } });
        if (!guest) {
          guest = await trx.guest.create({
            data: { name: guestName },
          });
        } else if (guest.isBlacklisted) {
          // Blokada dla gości z czarnej listy
          throw new Error(`Gość "${guestName}" znajduje się na czarnej liście. Skontaktuj się z managerem.`);
        }

        const room = await trx.room.findUnique({ where: { number: res.room } });
        if (!room) {
          throw new Error(`Pokój ${res.room} nie istnieje`);
        }
        if (!room.activeForSale) {
          throw new Error(`Pokój ${res.room} jest wycofany ze sprzedaży.`);
        }

        const checkInDate = new Date(res.checkIn + "T12:00:00Z");
        const checkOutDate = new Date(res.checkOut + "T12:00:00Z");
        if (!(checkOutDate > checkInDate)) {
          throw new Error("Data wyjazdu musi być po dacie przyjazdu");
        }
        const nights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000));

        let roomType: Awaited<ReturnType<typeof trx.roomType.findUnique>> = null;
        try {
          roomType = await trx.roomType.findUnique({ where: { name: room.type } });
        } catch (error) {
          console.error("[createGroupReservation] roomType.findUnique error:", error instanceof Error ? error.message : String(error));
        }
        if (roomType) {
          let plan: Awaited<ReturnType<typeof trx.ratePlan.findFirst>> = null;
          try {
            plan = await trx.ratePlan.findFirst({
              where: {
                roomTypeId: roomType.id,
                validFrom: { lte: checkInDate },
                validTo: { gte: checkInDate },
              },
            });
          } catch (error) {
            console.error("[createGroupReservation] ratePlan.findFirst error:", error instanceof Error ? error.message : String(error));
          }
          if (plan) {
            if (plan.minStayNights != null && nights < plan.minStayNights) {
              throw new Error(`Min. długość pobytu dla tej stawki: ${plan.minStayNights} nocy.`);
            }
            if (plan.maxStayNights != null && nights > plan.maxStayNights) {
              throw new Error(`Maks. długość pobytu dla tej stawki: ${plan.maxStayNights} nocy.`);
            }
          }
        }

        // Generuj unikalny numer potwierdzenia
        const confirmationNumber = await generateConfirmationNumber();

        const created = await trx.reservation.create({
          data: {
            confirmationNumber,
            guestId: guest.id,
            roomId: room.id,
            checkIn: new Date(res.checkIn),
            checkOut: new Date(res.checkOut),
            status: res.status as ReservationStatus,
            source: res.source ?? null,
            channel: res.channel ?? null,
            marketSegment: res.marketSegment ?? null,
            tripPurpose: res.tripPurpose ?? null,
            mealPlan: res.mealPlan ?? null,
            paymentStatus: res.paymentStatus ?? null,
            ...(res.securityDeposit ? { securityDeposit: res.securityDeposit } : {}),
            ...((res as { isCreditCardGuaranteed?: boolean }).isCreditCardGuaranteed ? { isCreditCardGuaranteed: true } : {}),
            ...(res.advancePayment ? { advancePayment: res.advancePayment } : {}),
            ...(res.alerts ? { alerts: res.alerts } : {}),
            ...(res.agentId ? { agentId: res.agentId } : {}),
            ...(res.agentData ? { agentData: res.agentData } : {}),
            pax: res.pax ?? null,
            groupId: group.id,
            ...(res.rateCodeId ? { rateCodeId: res.rateCodeId } : {}),
          },
          include: { guest: true, room: true, rateCode: true, group: true },
        });
        uiReservations.push(toUiReservation(created));
      }

      return {
        group,
        reservations: uiReservations,
      };
    });

    await Promise.all([
      createAuditLog({
        actionType: "CREATE",
        entityType: "ReservationGroup",
        entityId: result.group.id,
        newValue: {
          id: result.group.id,
          name: result.group.name,
          reservationCount: result.reservations.length,
        },
        ipAddress: ip,
      }),
      ...result.reservations.map((reservation) =>
        createAuditLog({
          actionType: "CREATE",
          entityType: "Reservation",
          entityId: reservation.id,
          newValue: reservation as unknown as Record<string, unknown>,
          ipAddress: ip,
        })
      ),
    ]);

    revalidatePath("/front-office");
    return {
      success: true,
      data: {
        group: { id: result.group.id, name: result.group.name ?? undefined },
        reservations: result.reservations,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd rezerwacji grupowej",
    };
  }
}

/** Przenosi rezerwację do innego pokoju (Tape Chart drag) */
export async function moveReservation(
  input: MoveReservationInput
): Promise<ActionResult<ReturnType<typeof toUiReservation>>> {
  const parsed = moveReservationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Błąd walidacji" };
  }
  const { reservationId, newRoomNumber, newCheckIn, newCheckOut, skipRevalidate } = parsed.data;

  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true, rateCode: true },
    });
    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }

    if (isReservationInClosedPeriod(reservation.checkIn, reservation.checkOut)) {
      return {
        success: false,
        error: "Nie można edytować rezerwacji w zamkniętym okresie (po Night Audit).",
      };
    }

    const newRoom = await prisma.room.findUnique({ where: { number: newRoomNumber } });
    if (!newRoom) {
      return { success: false, error: `Pokój ${newRoomNumber} nie istnieje` };
    }

    // Walidacja statusu pokoju: OOO całkowicie blokuje, DIRTY tylko ostrzega
    if (newRoom.status === "OOO") {
      return {
        success: false,
        error: `Pokój ${newRoomNumber} jest wyłączony ze sprzedaży (OOO). Zmień status pokoju przed przeniesieniem rezerwacji.`,
      };
    }

    // Efektywne daty: nowe jeśli podane, w przeciwnym razie obecne
    const effectiveCheckIn = newCheckIn ? new Date(newCheckIn) : reservation.checkIn;
    const effectiveCheckOut = newCheckOut ? new Date(newCheckOut) : reservation.checkOut;

    // Walidacja: sprawdź nakładanie się z innymi rezerwacjami w nowym pokoju (używamy efektywnych dat)
    const overlappingInNewRoom = await prisma.reservation.findFirst({
      where: {
        roomId: newRoom.id,
        id: { not: reservationId },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        checkIn: { lt: effectiveCheckOut },
        checkOut: { gt: effectiveCheckIn },
      },
      select: { id: true, guest: { select: { name: true } }, checkIn: true, checkOut: true },
    });

    if (overlappingInNewRoom) {
      // Sprawdź czy dozwolony overbooking
      const roomMeta = await prisma.room.findUnique({
        where: { id: newRoom.id },
        select: { propertyId: true, beds: true },
      });
      const propId = roomMeta?.propertyId ?? (await getEffectivePropertyId());
      const property = propId
        ? await prisma.property.findUnique({
            where: { id: propId },
            select: { overbookingLimitPercent: true },
          })
        : null;
      const limitPercent = property?.overbookingLimitPercent ?? 0;

      // Jeśli overbooking nie jest dozwolony (0%) - blokuj
      if (limitPercent === 0) {
        return {
          success: false,
          error: `Pokój ${newRoomNumber} jest zajęty w podanym terminie. Odśwież grafik, jeśli nie widzisz rezerwacji.`,
        };
      }

      // Jeśli overbooking dozwolony - sprawdź limit rezerwacji (nie łóżek)
      const overlappingCount = await prisma.reservation.count({
        where: {
          roomId: newRoom.id,
          id: { not: reservationId },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          checkIn: { lt: effectiveCheckOut },
          checkOut: { gt: effectiveCheckIn },
        },
      });
      const maxReservations = Math.ceil(1 * (1 + limitPercent / 100)); // 1 rezerwacja + limit %
      if (overlappingCount + 1 > maxReservations) {
        return {
          success: false,
          error: `Pokój ${newRoomNumber} przekracza limit overbookingu w terminie ${formatDate(effectiveCheckIn)} - ${formatDate(effectiveCheckOut)}`,
        };
      }
    }

    const oldUi = toUiReservation(reservation);

    const updateData: { roomId: string; checkIn?: Date; checkOut?: Date } = { roomId: newRoom.id };
    if (newCheckIn) updateData.checkIn = effectiveCheckIn;
    if (newCheckOut) updateData.checkOut = effectiveCheckOut;

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: updateData,
      include: { guest: true, room: true, rateCode: true },
    });
    const newUi = toUiReservation(updated);

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Reservation",
      entityId: reservationId,
      oldValue: { ...oldUi } as unknown as Record<string, unknown>,
      newValue: { ...newUi } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    if (!skipRevalidate) revalidatePath("/front-office");
    return { success: true, data: newUi };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd przeniesienia rezerwacji",
    };
  }
}

/** Aktualizuje rezerwację (edycja w Sheet) */
export async function updateReservation(
  reservationId: string,
  input: Partial<ReservationInput>
): Promise<ActionResult<ReturnType<typeof toUiReservation>>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const prev = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true, rateCode: true },
    });
    if (!prev) return { success: false, error: "Rezerwacja nie istnieje" };

    if (isReservationInClosedPeriod(prev.checkIn, prev.checkOut)) {
      return {
        success: false,
        error: "Nie można edytować rezerwacji w zamkniętym okresie (po Night Audit).",
      };
    }

    const data: Partial<{
      guestId: string;
      roomId: string;
      rateCodeId: string | null;
      checkIn: Date;
      checkOut: Date;
      checkInTime: string | null;
      checkOutTime: string | null;
      eta: string | null;
      etd: string | null;
      status: ReservationStatus;
      source: string | null;
      channel: string | null;
      marketSegment: string | null;
      tripPurpose: string | null;
      mealPlan: string | null;
      roomPreferences: object | null;
      pax: number | null;
      adults: number | null;
      children: number | null;
      childrenAges: number[] | null;
      petInfo: object | null;
      paymentStatus: string | null;
      securityDeposit: object | null;
      cardGuarantee: object | null;
      isCreditCardGuaranteed: boolean;
      advancePayment: object | null;
      cancellationReason: string | null;
      cancellationCode: string | null;
      cancelledAt: Date | null;
      cancelledBy: string | null;
      alerts: object | null;
      agentId: string | null;
      agentData: object | null;
      bedsBooked: number | null;
      notes: string | null;
      internalNotes: string | null;
      specialRequests: string | null;
      rateCodePrice: number | null;
      externalReservationNumber: string | null;
      currency: string | null;
      reminderAt: Date | null;
      notesVisibleOnChart: boolean;
      extraStatus: string | null;
      advanceDueDate: Date | null;
    }> = {};

    if (input.guestName !== undefined) {
      let guest = await prisma.guest.findFirst({ where: { name: input.guestName } });
      if (!guest) {
        guest = await prisma.guest.create({ data: { name: input.guestName } });
      } else if (guest.isBlacklisted) {
        // Sprawdź, czy gość jest na czarnej liście przy zmianie gościa
        return {
          success: false,
          error: `Nie można przypisać rezerwacji do gościa "${guest.name}" – znajduje się na czarnej liście. Skontaktuj się z managerem.`,
        };
      }
      data.guestId = guest.id;
    }
    if (input.room !== undefined) {
      const room = await prisma.room.findUnique({ where: { number: input.room } });
      if (!room) return { success: false, error: `Pokój ${input.room} nie istnieje` };
      data.roomId = room.id;
    }
    if (input.checkIn !== undefined) data.checkIn = new Date(input.checkIn);
    if (input.checkOut !== undefined) data.checkOut = new Date(input.checkOut);
    if (input.checkInTime !== undefined) data.checkInTime = (input.checkInTime === "" || input.checkInTime == null) ? null : input.checkInTime;
    if (input.checkOutTime !== undefined) data.checkOutTime = (input.checkOutTime === "" || input.checkOutTime == null) ? null : input.checkOutTime;
    if (input.eta !== undefined) data.eta = (input.eta === "" || input.eta == null) ? null : input.eta;
    if (input.etd !== undefined) data.etd = (input.etd === "" || input.etd == null) ? null : input.etd;
    if (input.status !== undefined) {
      const statusStr = String(input.status ?? "").trim();
      if (!statusStr) {
        return { success: false, error: "Wybierz status rezerwacji" };
      }
      data.status = input.status as ReservationStatus;
    }
    if (input.source !== undefined) data.source = (input.source == null || String(input.source).trim() === "") ? null : input.source;
    if (input.channel !== undefined) data.channel = (input.channel == null || String(input.channel).trim() === "") ? null : input.channel;
    if (input.marketSegment !== undefined) data.marketSegment = (input.marketSegment == null || String(input.marketSegment).trim() === "") ? null : input.marketSegment;
    if (input.tripPurpose !== undefined) data.tripPurpose = (input.tripPurpose == null || String(input.tripPurpose).trim() === "") ? null : input.tripPurpose;
    if (input.mealPlan !== undefined) data.mealPlan = (input.mealPlan == null || String(input.mealPlan).trim() === "") ? null : input.mealPlan;
    if (input.roomPreferences !== undefined) data.roomPreferences = input.roomPreferences ?? null;
    if (input.pax !== undefined) data.pax = input.pax ?? null;
    if (input.adults !== undefined) data.adults = input.adults ?? null;
    if (input.children !== undefined) data.children = input.children ?? null;
    if (input.childrenAges !== undefined) data.childrenAges = input.childrenAges ?? null;
    if (input.petInfo !== undefined) data.petInfo = input.petInfo ?? null;
    if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus ?? null;
    if (input.securityDeposit !== undefined) {
      const sd = input.securityDeposit as { amount?: unknown } | null;
      if (sd && typeof sd === "object" && typeof sd.amount === "number" && (sd.amount < 0 || !Number.isFinite(sd.amount))) {
        return { success: false, error: "Kwota depozytu/kaucji nie może być ujemna" };
      }
      data.securityDeposit = input.securityDeposit ?? null;
    }
    if (input.cardGuarantee !== undefined) data.isCreditCardGuaranteed = Boolean(input.cardGuarantee);
    if (input.advancePayment !== undefined) {
      const ap = input.advancePayment as { amount?: unknown } | null;
      if (ap && typeof ap === "object" && typeof ap.amount === "number" && (ap.amount < 0 || !Number.isFinite(ap.amount))) {
        return { success: false, error: "Kwota przedpłaty nie może być ujemna" };
      }
      data.advancePayment = input.advancePayment ?? null;
    }
    if (input.cancellationReason !== undefined) data.cancellationReason = input.cancellationReason ?? null;
    if (input.cancellationCode !== undefined) data.cancellationCode = input.cancellationCode ?? null;
    if (input.cancelledAt !== undefined) data.cancelledAt = input.cancelledAt ? new Date(input.cancelledAt) : null;
    if (input.cancelledBy !== undefined) data.cancelledBy = input.cancelledBy ?? null;
    if (input.alerts !== undefined) data.alerts = input.alerts ?? null;
    if (input.agentId !== undefined) data.agentId = input.agentId ?? null;
    if (input.agentData !== undefined) data.agentData = input.agentData ?? null;
    if (input.rateCodeId !== undefined) data.rateCodeId = (input.rateCodeId === "" || input.rateCodeId == null) ? null : input.rateCodeId;
    if (input.rateCodePrice !== undefined) (data as Record<string, unknown>).rateCodePrice = input.rateCodePrice != null && input.rateCodePrice > 0 ? input.rateCodePrice : null;
    if (input.notes !== undefined) data.notes = (input.notes === "" || input.notes == null) ? null : input.notes;
    if (input.internalNotes !== undefined) data.internalNotes = (input.internalNotes === "" || input.internalNotes == null) ? null : input.internalNotes;
    if (input.specialRequests !== undefined) data.specialRequests = (input.specialRequests === "" || input.specialRequests == null) ? null : input.specialRequests;
    if (input.bedsBooked !== undefined) data.bedsBooked = input.bedsBooked == null ? null : Number(input.bedsBooked);
    if (input.marketSegment !== undefined) (data as Record<string, unknown>).marketSegment = (input.marketSegment == null || String(input.marketSegment).trim() === "") ? null : input.marketSegment;
    if (input.externalReservationNumber !== undefined) (data as Record<string, unknown>).externalReservationNumber = (input.externalReservationNumber === "" || input.externalReservationNumber == null) ? null : input.externalReservationNumber;
    if (input.currency !== undefined) (data as Record<string, unknown>).currency = (input.currency === "" || input.currency == null) ? null : input.currency;
    if (input.reminderAt !== undefined) (data as Record<string, unknown>).reminderAt = input.reminderAt ? new Date(input.reminderAt) : null;
    if (input.notesVisibleOnChart !== undefined) data.notesVisibleOnChart = Boolean(input.notesVisibleOnChart);
    if ((input as { showNotesOnChart?: boolean }).showNotesOnChart !== undefined) data.notesVisibleOnChart = Boolean((input as { showNotesOnChart?: boolean }).showNotesOnChart);
    if (input.extraStatus !== undefined) (data as Record<string, unknown>).extraStatus = (input.extraStatus === "" || input.extraStatus == null) ? null : input.extraStatus;
    if (input.advanceDueDate !== undefined) (data as Record<string, unknown>).advanceDueDate = input.advanceDueDate ? new Date(input.advanceDueDate) : null;

    // Firma / NIP (dla faktury VAT)
    if (input.companyId !== undefined) {
      (data as Record<string, unknown>).companyId = input.companyId && input.companyId.trim() ? input.companyId.trim() : null;
    }
    if (input.companyData && typeof input.companyData === "object" && input.companyData.nip?.trim()) {
      const companyResult = await createOrUpdateCompany({
        nip: input.companyData.nip.trim(),
        name: input.companyData.name?.trim() ?? "",
        address: input.companyData.address?.trim() || undefined,
        postalCode: input.companyData.postalCode?.trim() || undefined,
        city: input.companyData.city?.trim() || undefined,
        country: input.companyData.country?.trim() || undefined,
      });
      if (!companyResult.success) {
        return { success: false, error: companyResult.error ?? "Błąd zapisu firmy" };
      }
      (data as Record<string, unknown>).companyId = companyResult.data.companyId;
    }

    const effCheckIn = data.checkIn ?? prev.checkIn;
    const effParkingSpotId = input.parkingSpotId !== undefined
      ? (input.parkingSpotId && input.parkingSpotId.trim() ? input.parkingSpotId.trim() : null)
      : undefined;
    const effCheckOut = data.checkOut ?? prev.checkOut;
    if (effCheckOut <= effCheckIn) {
      return { success: false, error: "Data wyjazdu musi być po dacie przyjazdu" };
    }

    // Walidacja nakładania się z innymi rezerwacjami przy zmianie dat lub pokoju
    const roomIdToCheck = data.roomId ?? prev.roomId;
    const datesOrRoomChanged =
      data.checkIn !== undefined ||
      data.checkOut !== undefined ||
      data.roomId !== undefined;

    if (datesOrRoomChanged) {
      const overlapping = await prisma.reservation.findFirst({
        where: {
          roomId: roomIdToCheck,
          id: { not: reservationId },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          checkIn: { lt: effCheckOut },
          checkOut: { gt: effCheckIn },
        },
        select: { id: true, guest: { select: { name: true } }, checkIn: true, checkOut: true },
      });

      if (overlapping) {
        // Sprawdź czy dozwolony overbooking
        const roomMeta = await prisma.room.findUnique({
          where: { id: roomIdToCheck },
          select: { propertyId: true, number: true, beds: true },
        });
        const propId = roomMeta?.propertyId ?? (await getEffectivePropertyId());
        const property = propId
          ? await prisma.property.findUnique({
              where: { id: propId },
              select: { overbookingLimitPercent: true },
            })
          : null;
        const limitPercent = property?.overbookingLimitPercent ?? 0;

        // Jeśli overbooking nie jest dozwolony (0%) - blokuj
        if (limitPercent === 0) {
          return {
            success: false,
            error: `Pokój ${roomMeta?.number ?? "?"} jest zajęty w wybranym terminie.`,
          };
        }

        // Jeśli overbooking dozwolony - sprawdź limit
        const overlappingCount = await prisma.reservation.count({
          where: {
            roomId: roomIdToCheck,
            id: { not: reservationId },
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            checkIn: { lt: effCheckOut },
            checkOut: { gt: effCheckIn },
          },
        });
        const maxReservations = Math.ceil(1 * (1 + limitPercent / 100));
        if (overlappingCount + 1 > maxReservations) {
          return {
            success: false,
            error: `Pokój ${roomMeta?.number ?? "?"} przekracza limit overbookingu w wybranym terminie`,
          };
        }
      }
    }

    const nights = Math.round((effCheckOut.getTime() - effCheckIn.getTime()) / (24 * 60 * 60 * 1000));
    const roomIdForPlan = data.roomId ?? prev.roomId;
    let roomForPlan: { type: string } | null = null;
    try {
      roomForPlan = await prisma.room.findUnique({
        where: { id: roomIdForPlan },
        select: { type: true },
      });
    } catch (error) {
      console.error("[updateReservation] room.findUnique (for plan) error:", error instanceof Error ? error.message : String(error));
    }
    let roomTypeForPlan: Awaited<ReturnType<typeof prisma.roomType.findUnique>> = null;
    if (roomForPlan) {
      try {
        roomTypeForPlan = await prisma.roomType.findUnique({ where: { name: roomForPlan.type } });
      } catch (error) {
        console.error("[updateReservation] roomType.findUnique error:", error instanceof Error ? error.message : String(error));
      }
    }
    if (roomTypeForPlan) {
      let plan: Awaited<ReturnType<typeof prisma.ratePlan.findFirst>> = null;
      try {
        plan = await prisma.ratePlan.findFirst({
          where: {
            roomTypeId: roomTypeForPlan.id,
            validFrom: { lte: effCheckIn },
            validTo: { gte: effCheckIn },
          },
        });
      } catch (error) {
        console.error("[updateReservation] ratePlan.findFirst error:", error instanceof Error ? error.message : String(error));
      }
      if (plan) {
        if (plan.minStayNights != null && nights < plan.minStayNights) {
          return { success: false, error: `Min. długość pobytu dla tej stawki sezonowej: ${plan.minStayNights} nocy.` };
        }
        if (plan.maxStayNights != null && nights > plan.maxStayNights) {
          return { success: false, error: `Maks. długość pobytu dla tej stawki sezonowej: ${plan.maxStayNights} nocy.` };
        }
      }
    }

    if (data.bedsBooked !== undefined) {
      const roomForBeds = await prisma.room.findUnique({
        where: { id: roomIdForPlan },
        select: { beds: true },
      });
      const roomBeds = roomForBeds?.beds ?? 1;
      const requested = data.bedsBooked ?? roomBeds;
      if (requested < 1 || requested > roomBeds) {
        return { success: false, error: `Liczba łóżek musi być od 1 do ${roomBeds}.` };
      }
      const overlapping = await prisma.reservation.findMany({
        where: {
          roomId: roomIdForPlan,
          id: { not: reservationId },
          checkIn: { lt: effCheckOut },
          checkOut: { gt: effCheckIn },
        },
        select: { bedsBooked: true },
      });
      const usedBeds = overlapping.reduce(
        (sum, res) => sum + (res.bedsBooked ?? roomBeds),
        0
      );
      if (usedBeds + requested > roomBeds) {
        const roomMeta = await prisma.room.findUnique({
          where: { id: roomIdForPlan },
          select: { propertyId: true },
        });
        const propId = roomMeta?.propertyId ?? (await getEffectivePropertyId());
        const property = propId
          ? await prisma.property.findUnique({
              where: { id: propId },
              select: { overbookingLimitPercent: true },
            })
          : null;
        const limitPercent = property?.overbookingLimitPercent ?? 0;
        const maxBeds = roomBeds * (1 + limitPercent / 100);
        if (usedBeds + requested > maxBeds) {
          return { success: false, error: `W tym okresie dostępne jest ${Math.max(0, roomBeds - usedBeds)} z ${roomBeds} łóżek.` };
        }
      }
    }

    // Optymistyczna blokada: odrzuć zapis, jeśli rezerwacja została zmieniona w międzyczasie (np. w drugiej karcie)
    const fresh = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { updatedAt: true },
    });
    if (!fresh || fresh.updatedAt.getTime() !== prev.updatedAt.getTime()) {
      return {
        success: false,
        error: "Rezerwacja została zmieniona w międzyczasie (np. w innej karcie). Odśwież i zapisz ponownie.",
      };
    }

    // Aktualizacja email/telefon na gościu (gdy przekazane w input)
    const guestIdToUpdate = data.guestId ?? prev.guestId;
    if (guestIdToUpdate && (input.guestEmail !== undefined || input.guestPhone !== undefined)) {
      const guestData: { email?: string | null; phone?: string | null } = {};
      if (input.guestEmail !== undefined) {
        const emailVal = input.guestEmail?.trim() || null;
        if (emailVal && !validateOptionalEmail(emailVal).ok) {
          return { success: false, error: "Nieprawidłowy format adresu email" };
        }
        guestData.email = emailVal;
      }
      if (input.guestPhone !== undefined) guestData.phone = input.guestPhone?.trim() || null;
      await prisma.guest.update({
        where: { id: guestIdToUpdate },
        data: guestData,
      });
    }

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: data as Prisma.ReservationUpdateInput,
      include: { guest: true, room: true, rateCode: true },
    });

    if (data.status === "CHECKED_IN" && prev.status !== "CHECKED_IN") {
      await generateRoomAccessCode(reservationId).catch((err) =>
        console.error("[generateRoomAccessCode on check-in]", err)
      );
      await sendWelcomeToTv({
        roomNumber: updated.room.number,
        guestName: updated.guest.name,
        reservationId,
      }).catch((err) => console.error("[sendWelcomeToTv on check-in]", err));
      await activateRoomPower(updated.room.number).catch((err) =>
        console.error("[activateRoomPower on check-in]", err)
      );
    }
    if (data.status === "CHECKED_OUT" && prev.status !== "CHECKED_OUT") {
      await updateGuestStayStats(prev.guestId, updated.checkOut);
      await postRoomChargeOnCheckout(reservationId).catch((err) =>
        console.error("[postRoomChargeOnCheckout]", err)
      );
      await chargeLocalTax(reservationId).catch((err) =>
        console.error("[chargeLocalTax on checkout]", err)
      );
      await createVatInvoice(reservationId).catch((err) =>
        console.error("[createVatInvoice on checkout]", err)
      );
      await prisma.room.update({
        where: { id: prev.roomId },
        data: { status: "DIRTY" as RoomStatus },
      }).catch((err) => console.error("[set room DIRTY on checkout]", err));
      await blockRoomExtensionAfterCheckout(prev.roomId).catch((err) =>
        console.error("[blockRoomExtensionAfterCheckout]", err)
      );
      const roomForPower = await prisma.room.findUnique({ where: { id: prev.roomId }, select: { number: true } });
      if (roomForPower) {
        await deactivateRoomPower(roomForPower.number).catch((err) =>
          console.error("[deactivateRoomPower on checkout]", err)
        );
      }
      revalidatePath("/housekeeping");
    }

    if (data.checkIn !== undefined || data.checkOut !== undefined) {
      await prisma.parkingBooking.updateMany({
        where: { reservationId },
        data: { startDate: updated.checkIn, endDate: updated.checkOut },
      });
    }

    if (effParkingSpotId !== undefined) {
      await deleteParkingBookingsByReservation(reservationId);
      if (effParkingSpotId) {
        const parkingResult = await createParkingBooking({
          parkingSpotId: effParkingSpotId,
          reservationId,
          startDate: updated.checkIn,
          endDate: updated.checkOut,
        });
        if (!parkingResult.success) {
          return { success: false, error: parkingResult.error };
        }
      }
    }

    const finalUpdated = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true, rateCode: true, parkingBookings: { include: { parkingSpot: true } }, group: true },
    }) ?? updated;

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Reservation",
      entityId: reservationId,
      oldValue: toUiReservation(prev) as unknown as Record<string, unknown>,
      newValue: toUiReservation(finalUpdated) as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/front-office");
    return { success: true, data: toUiReservation(finalUpdated) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji rezerwacji",
    };
  }
}

/** Dzieli rezerwację na dwie: pierwsza kończy się w splitDate, druga zaczyna w splitDate (opcjonalnie inny pokój). */
export async function splitReservation(
  input: SplitReservationInput
): Promise<
  ActionResult<{ first: ReturnType<typeof toUiReservation>; second: ReturnType<typeof toUiReservation> }>
> {
  const parsed = splitReservationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Błąd walidacji" };
  }
  const { reservationId, splitDate, secondRoomNumber } = parsed.data;
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const prev = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true, rateCode: true },
    });
    if (!prev) return { success: false, error: "Rezerwacja nie istnieje" };

    if (isReservationInClosedPeriod(prev.checkIn, prev.checkOut)) {
      return {
        success: false,
        error: "Nie można edytować rezerwacji w zamkniętym okresie (po Night Audit).",
      };
    }

    const splitD = new Date(splitDate + "T12:00:00Z");
    const checkIn = new Date(prev.checkIn);
    const checkOut = new Date(prev.checkOut);
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000));
    if (nights < 2) {
      return {
        success: false,
        error: "Nie można podzielić rezerwacji na 1 noc (potrzeba co najmniej 2 nocy).",
      };
    }
    if (splitD <= checkIn || splitD >= checkOut) {
      return {
        success: false,
        error: "Data podziału musi być między datą zameldowania a wymeldowania.",
      };
    }

    let secondRoomId = prev.roomId;
    if (secondRoomNumber != null && secondRoomNumber.trim() !== "" && secondRoomNumber.trim() !== prev.room.number) {
      const secondRoom = await prisma.room.findUnique({ where: { number: secondRoomNumber.trim() } });
      if (!secondRoom) return { success: false, error: `Pokój ${secondRoomNumber} nie istnieje` };
      if (!secondRoom.activeForSale) return { success: false, error: `Pokój ${secondRoomNumber} jest wycofany ze sprzedaży` };
      secondRoomId = secondRoom.id;
    }

    // Generuj numer potwierdzenia dla nowej rezerwacji przed transakcją
    const secondConfirmationNumber = await generateConfirmationNumber();

    const [updatedFirst, newSecond] = await prisma.$transaction([
      prisma.reservation.update({
        where: { id: reservationId },
        data: { checkOut: splitD },
        include: { guest: true, room: true, rateCode: true, parkingBookings: { include: { parkingSpot: true } }, group: true },
      }),
      prisma.reservation.create({
        data: {
          confirmationNumber: secondConfirmationNumber,
          guestId: prev.guestId,
          roomId: secondRoomId,
          checkIn: splitD,
          checkOut: checkOut,
          status: prev.status,
          pax: prev.pax,
          rateCodeId: prev.rateCodeId,
          companyId: prev.companyId,
          groupId: prev.groupId,
        },
        include: { guest: true, room: true, rateCode: true, parkingBookings: { include: { parkingSpot: true } }, group: true },
      }),
    ]);

    await prisma.parkingBooking.updateMany({
      where: { reservationId },
      data: { endDate: splitD },
    });

    await Promise.all([
      createAuditLog({
        actionType: "UPDATE",
        entityType: "Reservation",
        entityId: reservationId,
        oldValue: toUiReservation(prev) as unknown as Record<string, unknown>,
        newValue: toUiReservation(updatedFirst) as unknown as Record<string, unknown>,
        ipAddress: ip,
      }),
      createAuditLog({
        actionType: "CREATE",
        entityType: "Reservation",
        entityId: newSecond.id,
        newValue: toUiReservation(newSecond) as unknown as Record<string, unknown>,
        ipAddress: ip,
      }),
    ]);

    revalidatePath("/front-office");
    return {
      success: true,
      data: {
        first: toUiReservation(updatedFirst),
        second: toUiReservation(newSecond),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd podziału rezerwacji",
    };
  }
}

/** Aktualizuje status rezerwacji */
export async function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus
): Promise<ActionResult<ReturnType<typeof toUiReservation>>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const prev = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true, rateCode: true },
    });
    if (!prev) return { success: false, error: "Rezerwacja nie istnieje" };

    // Przy check-in: walidacja statusu pokoju
    if (status === "CHECKED_IN" && prev.status !== "CHECKED_IN") {
      const room = await prisma.room.findUnique({
        where: { id: prev.roomId },
        select: { status: true, number: true },
      });
      if (room?.status === "OOO") {
        return {
          success: false,
          error: `Pokój ${room.number} jest wyłączony ze sprzedaży (OOO). Zmień status pokoju przed zameldowaniem gościa.`,
        };
      }
      if (room?.status === "DIRTY") {
        console.warn(
          `[check-in-warn] Rezerwacja ${reservationId}: pokój ${room.number} ma status DIRTY. Gość zostanie zameldowany, ale pokój wymaga sprzątania.`
        );
      }
    }

    // Przy check-out: ostrzeżenie o nieopłaconych rachunkach z restauracji
    if (status === "CHECKED_OUT" && prev.status !== "CHECKED_OUT") {
      const unpaidCharges = await prisma.transaction.aggregate({
        where: {
          reservationId,
          status: "ACTIVE",
          OR: [
            { category: "F_B" },
            { type: { in: ["RESTAURANT", "GASTRONOMY", "POSTING"] } },
          ],
        },
        _sum: { amount: true },
        _count: true,
      });
      const restaurantTotal = Number(unpaidCharges._sum.amount ?? 0);
      const restaurantCount = unpaidCharges._count ?? 0;
      if (restaurantTotal > 0 && restaurantCount > 0) {
        // Sprawdź czy jest wystarczająca ilość płatności na pokrycie
        const payments = await prisma.transaction.aggregate({
          where: {
            reservationId,
            status: "ACTIVE",
            type: { in: ["PAYMENT", "DEPOSIT"] },
          },
          _sum: { amount: true },
        });
        const allCharges = await prisma.transaction.aggregate({
          where: {
            reservationId,
            status: "ACTIVE",
            type: { notIn: ["PAYMENT", "DEPOSIT", "VOID", "REFUND"] },
          },
          _sum: { amount: true },
        });
        const totalPaid = Number(payments._sum.amount ?? 0);
        const totalOwed = Number(allCharges._sum.amount ?? 0);
        if (totalOwed > totalPaid) {
          console.warn(
            `[checkout-warn] Rezerwacja ${reservationId}: nieopłacone rachunki restauracyjne: ${restaurantCount} szt., ${restaurantTotal.toFixed(2)} PLN. Saldo: ${(totalOwed - totalPaid).toFixed(2)} PLN do zapłaty.`
          );
        }
      }
    }

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: { status },
      include: { guest: true, room: true, rateCode: true },
    });

    if (status === "CHECKED_IN" && prev.status !== "CHECKED_IN") {
      await generateRoomAccessCode(reservationId).catch((err) =>
        console.error("[generateRoomAccessCode on check-in]", err)
      );
      await sendWelcomeToTv({
        roomNumber: updated.room.number,
        guestName: updated.guest.name,
        reservationId,
      }).catch((err) => console.error("[sendWelcomeToTv on check-in]", err));
      await activateRoomPower(updated.room.number).catch((err) =>
        console.error("[activateRoomPower on check-in]", err)
      );
    }
    // Przy check-out: statystyki gościa + obciążenie ROOM + automatyczna faktura VAT (gdy firma) + pokój na DIRTY
    if (status === "CHECKED_OUT" && prev.status !== "CHECKED_OUT") {
      await updateGuestStayStats(prev.guestId, updated.checkOut);
      await postRoomChargeOnCheckout(reservationId).catch((err) =>
        console.error("[postRoomChargeOnCheckout]", err)
      );
      await chargeLocalTax(reservationId).catch((err) =>
        console.error("[chargeLocalTax on checkout]", err)
      );
      await createVatInvoice(reservationId).catch((err) =>
        console.error("[createVatInvoice on checkout]", err)
      );
      await prisma.room.update({
        where: { id: prev.roomId },
        data: { status: "DIRTY" as RoomStatus },
      }).catch((err) => console.error("[set room DIRTY on checkout]", err));
      await blockRoomExtensionAfterCheckout(prev.roomId).catch((err) =>
        console.error("[blockRoomExtensionAfterCheckout]", err)
      );
      const room = await prisma.room.findUnique({ where: { id: prev.roomId }, select: { number: true } });
      if (room) {
        await deactivateRoomPower(room.number).catch((err) =>
          console.error("[deactivateRoomPower on checkout]", err)
        );
      }
    }

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Reservation",
      entityId: reservationId,
      oldValue: toUiReservation(prev) as unknown as Record<string, unknown>,
      newValue: toUiReservation(updated) as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/front-office");
    revalidatePath("/housekeeping");
    return { success: true, data: toUiReservation(updated) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji statusu",
    };
  }
}

/**
 * Aktualizuje statystyki pobytów gościa (totalStays, lastStayDate).
 * Wywoływane przy check-out.
 */
async function updateGuestStayStats(guestId: string, checkOutDate: Date): Promise<void> {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { totalStays: true, lastStayDate: true },
    });

    if (!guest) return;

    // Aktualizuj licznik pobytów i datę ostatniego pobytu
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        totalStays: guest.totalStays + 1,
        lastStayDate: checkOutDate,
      },
    });

    // Jeśli gość ma kartę lojalnościową, zaktualizuj też loyaltyTotalStays
    const guestWithLoyalty = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { loyaltyCardNumber: true, loyaltyTotalStays: true },
    });

    if (guestWithLoyalty?.loyaltyCardNumber) {
      await prisma.guest.update({
        where: { id: guestId },
        data: {
          loyaltyTotalStays: guestWithLoyalty.loyaltyTotalStays + 1,
        },
      });
    }
  } catch (e) {
    // Nie przerywaj głównego flow przy błędzie aktualizacji statystyk
    console.error("Błąd aktualizacji statystyk gościa:", e);
  }
}

/**
 * Usuwa rezerwację. Gdy rezerwacja należała do grupy i była ostatnia – usuwa pustą grupę.
 * @param reservationId - ID rezerwacji
 * @param cancellationReason - opcjonalny powód usunięcia (zapisany w audit log)
 * @returns ActionResult
 */
export async function deleteReservation(reservationId: string, cancellationReason?: string | null): Promise<ActionResult> {
  if (!reservationId || typeof reservationId !== "string" || !reservationId.trim()) {
    return { success: false, error: "ID rezerwacji jest wymagane" };
  }

  // Sprawdź uprawnienia - tylko użytkownicy z uprawnieniem reservation.cancel mogą usuwać rezerwacje
  let session: Awaited<ReturnType<typeof getSession>> = null;
  try {
    session = await getSession();
  } catch (error) {
    console.error("[deleteReservation] getSession error:", error instanceof Error ? error.message : String(error));
  }
  if (session) {
    const allowed = await can(session.role, "reservation.cancel");
    if (!allowed) {
      return { success: false, error: "Brak uprawnień do usuwania rezerwacji. Wymagane uprawnienie: reservation.cancel" };
    }
  }

  const headersList = await headers();
  const ip = getClientIp(headersList);
  const id = reservationId.trim();

  try {
    const prev = await prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, room: true },
    });
    if (!prev) return { success: false, error: "Rezerwacja nie istnieje" };

    const oldUi = toUiReservation(prev);
    const oldValueForAudit = {
      ...(oldUi as unknown as Record<string, unknown>),
      ...(cancellationReason != null && cancellationReason.trim() !== "" ? { cancellationReason: cancellationReason.trim(), deletionReason: cancellationReason.trim() } : {}),
    };
    const groupIdToCheck = prev.groupId;

    await prisma.reservation.delete({ where: { id } });

    // Jeżeli rezerwacja należała do grupy – jeśli to była ostatnia, usuń pustą grupę
    if (groupIdToCheck) {
      const remaining = await prisma.reservation.count({
        where: { groupId: groupIdToCheck },
      });
      if (remaining === 0) {
        try {
          await prisma.reservationGroup.delete({ where: { id: groupIdToCheck } });
        } catch (error) {
          console.error("[deleteReservation] reservationGroup.delete error:", error instanceof Error ? error.message : String(error));
        }
      }
    }

    await createAuditLog({
      actionType: "DELETE",
      entityType: "Reservation",
      entityId: id,
      oldValue: oldValueForAudit,
      newValue: null,
      ipAddress: ip,
    });

    revalidatePath("/front-office");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usunięcia rezerwacji",
    };
  }
}

/**
 * Szuka rezerwacji po numerze potwierdzenia.
 * @param confirmationNumber - numer potwierdzenia (min. 3 znaki)
 * @returns ActionResult z rezerwacją lub null gdy brak
 */
export async function findReservationByConfirmationNumber(
  confirmationNumber: string
): Promise<ActionResult<ReturnType<typeof toUiReservation> | null>> {
  if (!confirmationNumber || typeof confirmationNumber !== "string") {
    return { success: true, data: null };
  }
  try {
    const trimmed = confirmationNumber.trim().toUpperCase();
    if (trimmed.length < 3) {
      return { success: true, data: null };
    }

    const reservation = await prisma.reservation.findUnique({
      where: { confirmationNumber: trimmed },
      include: {
        guest: true,
        room: true,
        rateCode: true,
        parkingBookings: { include: { parkingSpot: true } },
        group: true,
      },
    });

    if (!reservation) {
      return { success: true, data: null };
    }

    return { success: true, data: toUiReservation(reservation) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania",
    };
  }
}

/** Szuka rezerwacji po fragmencie numeru potwierdzenia */
export async function searchReservationsByConfirmationNumber(
  query: string
): Promise<ActionResult<ReturnType<typeof toUiReservation>[]>> {
  try {
    const trimmed = query.trim().toUpperCase();
    if (trimmed.length < 2) {
      return { success: true, data: [] };
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        confirmationNumber: { contains: trimmed },
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        guest: true,
        room: true,
        rateCode: true,
        parkingBookings: { include: { parkingSpot: true } },
        group: true,
      },
    });

    return { success: true, data: reservations.map(toUiReservation) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania",
    };
  }
}

// ==================== HISTORIA ZMIAN ====================

/** Interfejs dla wpisu historii zmian rezerwacji */
export interface ReservationAuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string | null;
  actionType: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  changes: { field: string; oldValue: unknown; newValue: unknown }[];
}

/**
 * Pobiera historię zmian dla danej rezerwacji.
 * Zwraca wpisy z audit logu posortowane od najnowszych.
 */
export async function getReservationAuditLog(
  reservationId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<ActionResult<{ entries: ReservationAuditLogEntry[]; total: number }>> {
  try {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    // Pobierz całkowitą liczbę wpisów
    const total = await prisma.auditLog.count({
      where: {
        entityType: "Reservation",
        entityId: reservationId,
      },
    });

    // Pobierz wpisy audit logu
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "Reservation",
        entityId: reservationId,
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    });

    // Mapuj na format UI z wykrytymi zmianami
    const entries: ReservationAuditLogEntry[] = auditLogs.map((log) => {
      const oldValue = log.oldValue as Record<string, unknown> | null;
      const newValue = log.newValue as Record<string, unknown> | null;

      // Wykryj zmienione pola
      const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

      if (oldValue && newValue) {
        // Porównaj wszystkie klucze z newValue
        for (const key of Object.keys(newValue)) {
          const oldVal = oldValue[key];
          const newVal = newValue[key];

          // Porównuj jako JSON aby uwzględnić obiekty i tablice
          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changes.push({
              field: key,
              oldValue: oldVal,
              newValue: newVal,
            });
          }
        }

        // Sprawdź czy jakieś klucze zostały usunięte
        for (const key of Object.keys(oldValue)) {
          if (!(key in newValue)) {
            changes.push({
              field: key,
              oldValue: oldValue[key],
              newValue: undefined,
            });
          }
        }
      } else if (newValue) {
        // Nowy rekord - wszystkie pola to zmiany
        for (const key of Object.keys(newValue)) {
          changes.push({
            field: key,
            oldValue: undefined,
            newValue: newValue[key],
          });
        }
      }

      return {
        id: log.id,
        timestamp: log.timestamp,
        userId: log.userId,
        actionType: log.actionType,
        oldValue,
        newValue,
        ipAddress: log.ipAddress,
        changes,
      };
    });

    return {
      success: true,
      data: { entries, total },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania historii zmian",
    };
  }
}

/**
 * Pobiera najnowszą zmianę dla rezerwacji (np. do wyświetlenia "ostatnio modyfikowano").
 */
export async function getLastReservationChange(
  reservationId: string
): Promise<ActionResult<ReservationAuditLogEntry | null>> {
  try {
    const log = await prisma.auditLog.findFirst({
      where: {
        entityType: "Reservation",
        entityId: reservationId,
      },
      orderBy: { timestamp: "desc" },
    });

    if (!log) {
      return { success: true, data: null };
    }

    const oldValue = log.oldValue as Record<string, unknown> | null;
    const newValue = log.newValue as Record<string, unknown> | null;

    const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
    if (oldValue && newValue) {
      for (const key of Object.keys(newValue)) {
        if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
          changes.push({
            field: key,
            oldValue: oldValue[key],
            newValue: newValue[key],
          });
        }
      }
    }

    return {
      success: true,
      data: {
        id: log.id,
        timestamp: log.timestamp,
        userId: log.userId,
        actionType: log.actionType,
        oldValue,
        newValue,
        ipAddress: log.ipAddress,
        changes,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania historii zmian",
    };
  }
}

/**
 * Pobiera statystyki zmian rezerwacji (liczba modyfikacji, anulacji, itp.).
 */
export async function getReservationAuditStats(
  reservationId: string
): Promise<
  ActionResult<{
    totalChanges: number;
    createCount: number;
    updateCount: number;
    statusChanges: number;
    lastModified: Date | null;
    createdAt: Date | null;
  }>
> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: "Reservation",
        entityId: reservationId,
      },
      orderBy: { timestamp: "asc" },
      select: {
        actionType: true,
        timestamp: true,
        oldValue: true,
        newValue: true,
      },
    });

    let createCount = 0;
    let updateCount = 0;
    let statusChanges = 0;
    let createdAt: Date | null = null;
    let lastModified: Date | null = null;

    for (const log of logs) {
      if (log.actionType === "CREATE") {
        createCount++;
        if (!createdAt) createdAt = log.timestamp;
      } else if (log.actionType === "UPDATE") {
        updateCount++;
        lastModified = log.timestamp;

        // Sprawdź czy zmienił się status
        const oldValue = log.oldValue as Record<string, unknown> | null;
        const newValue = log.newValue as Record<string, unknown> | null;
        if (oldValue && newValue && oldValue.status !== newValue.status) {
          statusChanges++;
        }
      }
    }

    // Jeśli nie było UPDATE, ostatnia modyfikacja to data utworzenia
    if (!lastModified && createdAt) {
      lastModified = createdAt;
    }

    return {
      success: true,
      data: {
        totalChanges: logs.length,
        createCount,
        updateCount,
        statusChanges,
        lastModified,
        createdAt,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statystyk",
    };
  }
}

// ==================== VOUCHER / POTWIERDZENIE ====================

/** Dane vouchera rezerwacji */
export interface ReservationVoucher {
  // Dane hotelu
  hotel: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    logo?: string;
  };
  // Dane rezerwacji
  reservation: {
    confirmationNumber: string;
    status: string;
    createdAt: string;
  };
  // Dane gościa
  guest: {
    name: string;
    email?: string;
    phone?: string;
  };
  // Szczegóły pobytu
  stay: {
    checkIn: string;
    checkOut: string;
    checkInTime?: string;
    checkOutTime?: string;
    nights: number;
    roomNumber: string;
    roomType: string;
    roomDescription?: string;
    pax?: number;
    adults?: number;
    children?: number;
  };
  // Wyżywienie i usługi
  services: {
    mealPlan?: string;
    mealPlanDescription?: string;
    parking?: boolean;
    specialRequests?: string;
  };
  // Finanse
  payment: {
    totalPrice?: number;
    currency: string;
    paymentStatus?: string;
    advancePayment?: {
      required: boolean;
      amount?: number;
      dueDate?: string;
      paid?: boolean;
    };
    cardGuarantee?: boolean;
  };
  // Warunki
  terms: {
    cancellationPolicy?: string;
    checkInInstructions?: string;
    notes?: string;
  };
  // Metadane
  meta: {
    generatedAt: string;
    voucherVersion: string;
    locale: string;
  };
}

/**
 * Generuje dane vouchera/potwierdzenia rezerwacji.
 * Zwraca strukturę danych gotową do renderowania PDF lub drukowania.
 */
export async function generateReservationVoucher(
  reservationId: string,
  options?: {
    locale?: string;
    includePrice?: boolean;
    includeTerms?: boolean;
  }
): Promise<ActionResult<ReservationVoucher>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        room: true,
        rateCode: true,
        parkingBookings: { include: { parkingSpot: true } },
        company: true,
      },
    });

    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }

    const locale = options?.locale ?? "pl-PL";
    const includePrice = options?.includePrice ?? true;
    const includeTerms = options?.includeTerms ?? true;

    // Oblicz liczbę nocy
    const checkInDate = new Date(reservation.checkIn);
    const checkOutDate = new Date(reservation.checkOut);
    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Formatuj daty według locale
    const dateFormatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Pobierz dane parkingu
    const hasParking = reservation.parkingBookings.length > 0;

    // Pobierz dane przedpłaty
    const advancePayment = reservation.advancePayment as Record<string, unknown> | null;
    const _cardGuarantee = reservation.isCreditCardGuaranteed ? ({} as Record<string, unknown>) : null;

    // Mapuj plan wyżywienia na czytelny opis
    const mealPlanDescriptions: Record<string, string> = {
      RO: "Bez wyżywienia (Room Only)",
      BB: "Śniadanie (Bed & Breakfast)",
      HB: "Śniadanie i obiadokolacja (Half Board)",
      FB: "Pełne wyżywienie (Full Board)",
      AI: "All Inclusive",
      BB_PLUS: "Śniadanie rozszerzone",
      HB_PLUS: "Half Board Plus",
      FB_PLUS: "Full Board Plus",
    };

    const voucher: ReservationVoucher = {
      hotel: {
        name: process.env.HOTEL_NAME ?? "Hotel",
        address: process.env.HOTEL_ADDRESS ?? "",
        phone: process.env.HOTEL_PHONE ?? "",
        email: process.env.HOTEL_EMAIL ?? "",
        website: process.env.HOTEL_WEBSITE,
        logo: process.env.HOTEL_LOGO_URL,
      },
      reservation: {
        confirmationNumber: reservation.confirmationNumber ?? reservation.id.slice(0, 8).toUpperCase(),
        status: reservation.status,
        createdAt: dateFormatter.format(new Date(reservation.createdAt)),
      },
      guest: {
        name: reservation.guest.name,
        email: reservation.guest.email ?? undefined,
        phone: reservation.guest.phone ?? undefined,
      },
      stay: {
        checkIn: dateFormatter.format(checkInDate),
        checkOut: dateFormatter.format(checkOutDate),
        checkInTime: reservation.checkInTime ?? "14:00",
        checkOutTime: reservation.checkOutTime ?? "11:00",
        nights,
        roomNumber: reservation.room.number,
        roomType: reservation.room.type,
        roomDescription: reservation.room.description ?? undefined,
        pax: reservation.pax ?? undefined,
        adults: reservation.adults ?? undefined,
        children: reservation.children ?? undefined,
      },
      services: {
        mealPlan: reservation.mealPlan ?? undefined,
        mealPlanDescription: reservation.mealPlan
          ? mealPlanDescriptions[reservation.mealPlan] ?? reservation.mealPlan
          : undefined,
        parking: hasParking,
        specialRequests: reservation.specialRequests ?? undefined,
      },
      payment: includePrice
        ? {
            totalPrice: reservation.rateCode?.price
              ? Number(reservation.rateCode.price) * nights
              : undefined,
            currency: "PLN",
            paymentStatus: reservation.paymentStatus ?? undefined,
            advancePayment: advancePayment
              ? {
                  required: Boolean(advancePayment.required),
                  amount: advancePayment.amount as number | undefined,
                  dueDate: advancePayment.dueDate as string | undefined,
                  paid: Boolean(advancePayment.paid),
                }
              : undefined,
            cardGuarantee: reservation.isCreditCardGuaranteed ?? false,
          }
        : {
            currency: "PLN",
          },
      terms: includeTerms
        ? {
            cancellationPolicy:
              "Bezpłatna anulacja do 24 godzin przed przyjazdem. W przypadku późniejszej anulacji lub niestawienia się naliczana jest opłata za pierwszą dobę.",
            checkInInstructions:
              "Prosimy o zameldowanie między godziną 14:00 a 22:00. W przypadku późniejszego przyjazdu prosimy o kontakt.",
            notes: reservation.notes ?? undefined,
          }
        : {},
      meta: {
        generatedAt: new Date().toISOString(),
        voucherVersion: "1.0",
        locale,
      },
    };

    return { success: true, data: voucher };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania vouchera",
    };
  }
}

/**
 * Generuje HTML vouchera do drukowania lub konwersji na PDF.
 */
export async function generateReservationVoucherHTML(
  reservationId: string,
  options?: {
    locale?: string;
    includePrice?: boolean;
    includeTerms?: boolean;
  }
): Promise<ActionResult<string>> {
  const voucherResult = await generateReservationVoucher(reservationId, options);

  if (!voucherResult.success || !voucherResult.data) {
    return { success: false, error: "error" in voucherResult ? (voucherResult.error ?? "Błąd generowania vouchera") : "Błąd generowania vouchera" };
  }

  const v = voucherResult.data;

  const html = `
<!DOCTYPE html>
<html lang="${v.meta.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Potwierdzenie rezerwacji - ${v.reservation.confirmationNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; padding: 40px; }
    .voucher { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
    .header h1 { font-size: 24px; color: #2563eb; margin-bottom: 5px; }
    .header .subtitle { color: #666; font-size: 12px; }
    .confirmation-box { background: #f0f9ff; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px; }
    .confirmation-box .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
    .confirmation-box .number { font-size: 28px; font-weight: bold; color: #2563eb; letter-spacing: 3px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: bold; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .field { margin-bottom: 10px; }
    .field .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .field .value { font-size: 14px; font-weight: 500; }
    .highlight { background: #fef3c7; padding: 15px; border-radius: 6px; margin-top: 15px; }
    .terms { font-size: 11px; color: #666; background: #f9fafb; padding: 15px; border-radius: 6px; margin-top: 20px; }
    .terms h4 { color: #374151; margin-bottom: 10px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666; }
    @media print { body { padding: 20px; } .voucher { border: none; padding: 20px; } }
  </style>
</head>
<body>
  <div class="voucher">
    <div class="header">
      <h1>${v.hotel.name}</h1>
      <div class="subtitle">${v.hotel.address}</div>
      <div class="subtitle">Tel: ${v.hotel.phone} | Email: ${v.hotel.email}</div>
    </div>

    <div class="confirmation-box">
      <div class="label">Numer potwierdzenia</div>
      <div class="number">${v.reservation.confirmationNumber}</div>
    </div>

    <div class="section">
      <div class="section-title">Dane gościa</div>
      <div class="grid">
        <div class="field">
          <div class="label">Imię i nazwisko</div>
          <div class="value">${v.guest.name}</div>
        </div>
        ${v.guest.email ? `<div class="field"><div class="label">Email</div><div class="value">${v.guest.email}</div></div>` : ""}
        ${v.guest.phone ? `<div class="field"><div class="label">Telefon</div><div class="value">${v.guest.phone}</div></div>` : ""}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Szczegóły pobytu</div>
      <div class="grid">
        <div class="field">
          <div class="label">Data przyjazdu</div>
          <div class="value">${v.stay.checkIn} (od ${v.stay.checkInTime})</div>
        </div>
        <div class="field">
          <div class="label">Data wyjazdu</div>
          <div class="value">${v.stay.checkOut} (do ${v.stay.checkOutTime})</div>
        </div>
        <div class="field">
          <div class="label">Liczba nocy</div>
          <div class="value">${v.stay.nights}</div>
        </div>
        <div class="field">
          <div class="label">Pokój</div>
          <div class="value">${v.stay.roomNumber} (${v.stay.roomType})</div>
        </div>
        ${v.stay.pax ? `<div class="field"><div class="label">Liczba osób</div><div class="value">${v.stay.pax}</div></div>` : ""}
        ${v.services.mealPlanDescription ? `<div class="field"><div class="label">Wyżywienie</div><div class="value">${v.services.mealPlanDescription}</div></div>` : ""}
      </div>
    </div>

    ${
      v.payment.totalPrice
        ? `
    <div class="section">
      <div class="section-title">Płatność</div>
      <div class="highlight">
        <div class="field">
          <div class="label">Wartość rezerwacji</div>
          <div class="value" style="font-size: 20px;">${v.payment.totalPrice.toFixed(2)} ${v.payment.currency}</div>
        </div>
        ${v.payment.paymentStatus ? `<div class="field"><div class="label">Status płatności</div><div class="value">${v.payment.paymentStatus}</div></div>` : ""}
      </div>
    </div>
    `
        : ""
    }

    ${
      v.services.specialRequests
        ? `
    <div class="section">
      <div class="section-title">Specjalne życzenia</div>
      <p>${v.services.specialRequests}</p>
    </div>
    `
        : ""
    }

    ${
      v.terms.cancellationPolicy
        ? `
    <div class="terms">
      <h4>Warunki rezerwacji</h4>
      <p><strong>Zasady anulacji:</strong> ${v.terms.cancellationPolicy}</p>
      ${v.terms.checkInInstructions ? `<p style="margin-top: 10px;"><strong>Informacje o zameldowaniu:</strong> ${v.terms.checkInInstructions}</p>` : ""}
    </div>
    `
        : ""
    }

    <div class="footer">
      <p>Dokument wygenerowany: ${new Date(v.meta.generatedAt).toLocaleString(v.meta.locale)}</p>
      <p>Dziękujemy za wybór ${v.hotel.name}!</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { success: true, data: html };
}

// ==================== ŁĄCZENIE REZERWACJI ====================

/**
 * Opcje łączenia rezerwacji.
 */
export interface MergeReservationsInput {
  /** ID rezerwacji głównej (zachowana po połączeniu) */
  primaryReservationId: string;
  /** ID rezerwacji do połączenia (zostaną anulowane/usunięte) */
  secondaryReservationIds: string[];
  /** Strategia łączenia dat */
  dateStrategy: "extend" | "earliest_to_latest" | "custom";
  /** Niestandardowe daty (jeśli dateStrategy === "custom") */
  customDates?: {
    checkIn: string;
    checkOut: string;
  };
  /** Co zrobić z rezerwacjami wtórnymi */
  secondaryAction: "cancel" | "delete";
  /** Czy przenieść transakcje z rezerwacji wtórnych */
  transferTransactions?: boolean;
  /** Uwagi do połączenia */
  mergeNotes?: string;
}

/**
 * Wynik łączenia rezerwacji.
 */
export interface MergeReservationsResult {
  mergedReservation: ReturnType<typeof toUiReservation>;
  processedSecondaryIds: string[];
  mergeDetails: {
    originalCheckIn: string;
    originalCheckOut: string;
    newCheckIn: string;
    newCheckOut: string;
    nightsAdded: number;
    transactionsTransferred: number;
  };
}

/**
 * Łączy wiele rezerwacji w jedną.
 *
 * Warunki:
 * - Wszystkie rezerwacje muszą być dla tego samego gościa
 * - Rezerwacje powinny być w stanach CONFIRMED, CHECKED_IN lub REQUEST
 * - Rezerwacje wtórne zostaną anulowane lub usunięte
 */
export async function mergeReservations(
  input: MergeReservationsInput
): Promise<ActionResult<MergeReservationsResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    // Pobierz rezerwację główną
    const primaryReservation = await prisma.reservation.findUnique({
      where: { id: input.primaryReservationId },
      include: {
        guest: true,
        room: true,
        rateCode: true,
        transactions: true,
      },
    });

    if (!primaryReservation) {
      return { success: false, error: "Rezerwacja główna nie istnieje" };
    }

    // Sprawdź status rezerwacji głównej
    if (!["CONFIRMED", "CHECKED_IN", "REQUEST", "GUARANTEED", "WAITLIST"].includes(primaryReservation.status)) {
      return {
        success: false,
        error: `Rezerwacja główna ma status ${primaryReservation.status} - nie można łączyć`,
      };
    }

    // Pobierz rezerwacje wtórne
    const secondaryReservations = await prisma.reservation.findMany({
      where: { id: { in: input.secondaryReservationIds } },
      include: {
        guest: true,
        room: true,
        transactions: true,
      },
    });

    if (secondaryReservations.length === 0) {
      return { success: false, error: "Nie znaleziono rezerwacji do połączenia" };
    }

    if (secondaryReservations.length !== input.secondaryReservationIds.length) {
      return {
        success: false,
        error: "Niektóre rezerwacje wtórne nie istnieją",
      };
    }

    // Sprawdź czy wszystkie rezerwacje są dla tego samego gościa
    const guestId = primaryReservation.guestId;
    for (const res of secondaryReservations) {
      if (res.guestId !== guestId) {
        return {
          success: false,
          error: `Rezerwacja ${res.id} należy do innego gościa - nie można połączyć`,
        };
      }
    }

    // Sprawdź statusy rezerwacji wtórnych
    for (const res of secondaryReservations) {
      if (!["CONFIRMED", "CHECKED_IN", "REQUEST", "GUARANTEED", "WAITLIST"].includes(res.status)) {
        return {
          success: false,
          error: `Rezerwacja ${res.id} ma status ${res.status} - nie można łączyć`,
        };
      }
    }

    // Oblicz nowe daty
    let newCheckIn: Date;
    let newCheckOut: Date;

    if (input.dateStrategy === "custom" && input.customDates) {
      newCheckIn = new Date(input.customDates.checkIn);
      newCheckOut = new Date(input.customDates.checkOut);
    } else if (input.dateStrategy === "earliest_to_latest") {
      // Znajdź najwcześniejszą datę checkIn i najpóźniejszą checkOut
      const allCheckIns = [
        primaryReservation.checkIn,
        ...secondaryReservations.map((r) => r.checkIn),
      ];
      const allCheckOuts = [
        primaryReservation.checkOut,
        ...secondaryReservations.map((r) => r.checkOut),
      ];

      newCheckIn = new Date(Math.min(...allCheckIns.map((d) => new Date(d).getTime())));
      newCheckOut = new Date(Math.max(...allCheckOuts.map((d) => new Date(d).getTime())));
    } else {
      // "extend" - rozszerz rezerwację główną o dni z wtórnych
      newCheckIn = new Date(primaryReservation.checkIn);
      newCheckOut = new Date(primaryReservation.checkOut);

      for (const res of secondaryReservations) {
        const secCheckIn = new Date(res.checkIn);
        const secCheckOut = new Date(res.checkOut);

        if (secCheckIn < newCheckIn) newCheckIn = secCheckIn;
        if (secCheckOut > newCheckOut) newCheckOut = secCheckOut;
      }
    }

    // Walidacja dat
    if (newCheckOut <= newCheckIn) {
      return { success: false, error: "Data wyjazdu musi być po dacie przyjazdu" };
    }

    // Oblicz różnice
    const originalCheckIn = new Date(primaryReservation.checkIn);
    const originalCheckOut = new Date(primaryReservation.checkOut);
    const originalNights = Math.round(
      (originalCheckOut.getTime() - originalCheckIn.getTime()) / (24 * 60 * 60 * 1000)
    );
    const newNights = Math.round(
      (newCheckOut.getTime() - newCheckIn.getTime()) / (24 * 60 * 60 * 1000)
    );
    const nightsAdded = newNights - originalNights;

    // Wykonaj łączenie w transakcji
    const result = await prisma.$transaction(async (trx) => {
      // Aktualizuj rezerwację główną
      const updatedReservation = await trx.reservation.update({
        where: { id: input.primaryReservationId },
        data: {
          checkIn: newCheckIn,
          checkOut: newCheckOut,
          internalNotes: input.mergeNotes
            ? `${primaryReservation.internalNotes ? primaryReservation.internalNotes + "\n" : ""}[MERGE] ${input.mergeNotes}`
            : primaryReservation.internalNotes,
        },
        include: {
          guest: true,
          room: true,
          rateCode: true,
          parkingBookings: { include: { parkingSpot: true } },
          group: true,
        },
      });

      let transactionsTransferred = 0;

      // Przenieś transakcje jeśli wymagane
      if (input.transferTransactions) {
        for (const res of secondaryReservations) {
          const transferred = await trx.transaction.updateMany({
            where: { reservationId: res.id },
            data: { reservationId: input.primaryReservationId },
          });
          transactionsTransferred += transferred.count;
        }
      }

      // Anuluj lub usuń rezerwacje wtórne
      const processedIds: string[] = [];

      for (const res of secondaryReservations) {
        if (input.secondaryAction === "delete") {
          // Najpierw usuń transakcje jeśli nie były przeniesione
          if (!input.transferTransactions) {
            await trx.transaction.deleteMany({
              where: { reservationId: res.id },
            });
          }
          await trx.reservation.delete({
            where: { id: res.id },
          });
        } else {
          // Anuluj rezerwację
          await trx.reservation.update({
            where: { id: res.id },
            data: {
              status: "CANCELLED",
              cancellationReason: `Połączono z rezerwacją ${primaryReservation.confirmationNumber ?? primaryReservation.id}`,
              cancellationCode: "OTHER",
              cancelledAt: new Date(),
              cancelledBy: "SYSTEM_MERGE",
            },
          });
        }
        processedIds.push(res.id);
      }

      return {
        updatedReservation,
        processedIds,
        transactionsTransferred,
      };
    });

    // Zapisz audit log
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Reservation",
      entityId: input.primaryReservationId,
      oldValue: {
        checkIn: originalCheckIn.toISOString().split("T")[0],
        checkOut: originalCheckOut.toISOString().split("T")[0],
        mergedFrom: null,
      },
      newValue: {
        checkIn: newCheckIn.toISOString().split("T")[0],
        checkOut: newCheckOut.toISOString().split("T")[0],
        mergedFrom: input.secondaryReservationIds,
        mergeAction: input.secondaryAction,
      },
      ipAddress: ip,
    });

    // Audit log dla każdej połączonej rezerwacji
    for (const resId of result.processedIds) {
      await createAuditLog({
        actionType: input.secondaryAction === "delete" ? "DELETE" : "UPDATE",
        entityType: "Reservation",
        entityId: resId,
        oldValue: { status: "CONFIRMED" },
        newValue: {
          status: input.secondaryAction === "delete" ? "DELETED" : "CANCELLED",
          mergedInto: input.primaryReservationId,
        },
        ipAddress: ip,
      });
    }

    return {
      success: true,
      data: {
        mergedReservation: toUiReservation(result.updatedReservation),
        processedSecondaryIds: result.processedIds,
        mergeDetails: {
          originalCheckIn: originalCheckIn.toISOString().split("T")[0],
          originalCheckOut: originalCheckOut.toISOString().split("T")[0],
          newCheckIn: newCheckIn.toISOString().split("T")[0],
          newCheckOut: newCheckOut.toISOString().split("T")[0],
          nightsAdded,
          transactionsTransferred: result.transactionsTransferred,
        },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd łączenia rezerwacji",
    };
  }
}

/**
 * Sprawdza czy rezerwacje można połączyć i zwraca podgląd wyniku.
 */
export async function previewMergeReservations(
  primaryReservationId: string,
  secondaryReservationIds: string[]
): Promise<
  ActionResult<{
    canMerge: boolean;
    reason?: string;
    preview: {
      primaryGuest: string;
      primaryRoom: string;
      primaryDates: { checkIn: string; checkOut: string };
      secondaryReservations: {
        id: string;
        guest: string;
        room: string;
        dates: { checkIn: string; checkOut: string };
      }[];
      mergedDates: { checkIn: string; checkOut: string };
      totalNights: number;
    };
  }>
> {
  try {
    const primaryReservation = await prisma.reservation.findUnique({
      where: { id: primaryReservationId },
      include: { guest: true, room: true },
    });

    if (!primaryReservation) {
      return { success: false, error: "Rezerwacja główna nie istnieje" };
    }

    const secondaryReservations = await prisma.reservation.findMany({
      where: { id: { in: secondaryReservationIds } },
      include: { guest: true, room: true },
    });

    // Sprawdź czy wszystkie rezerwacje należą do tego samego gościa
    const guestId = primaryReservation.guestId;
    let canMerge = true;
    let reason: string | undefined;

    for (const res of secondaryReservations) {
      if (res.guestId !== guestId) {
        canMerge = false;
        reason = `Rezerwacja ${res.id} należy do innego gościa`;
        break;
      }
    }

    // Oblicz połączone daty
    const allCheckIns = [
      primaryReservation.checkIn,
      ...secondaryReservations.map((r) => r.checkIn),
    ];
    const allCheckOuts = [
      primaryReservation.checkOut,
      ...secondaryReservations.map((r) => r.checkOut),
    ];

    const mergedCheckIn = new Date(Math.min(...allCheckIns.map((d) => new Date(d).getTime())));
    const mergedCheckOut = new Date(Math.max(...allCheckOuts.map((d) => new Date(d).getTime())));
    const totalNights = Math.round(
      (mergedCheckOut.getTime() - mergedCheckIn.getTime()) / (24 * 60 * 60 * 1000)
    );

    return {
      success: true,
      data: {
        canMerge,
        reason,
        preview: {
          primaryGuest: primaryReservation.guest.name,
          primaryRoom: primaryReservation.room.number,
          primaryDates: {
            checkIn: primaryReservation.checkIn.toISOString().split("T")[0],
            checkOut: primaryReservation.checkOut.toISOString().split("T")[0],
          },
          secondaryReservations: secondaryReservations.map((res) => ({
            id: res.id,
            guest: res.guest.name,
            room: res.room.number,
            dates: {
              checkIn: res.checkIn.toISOString().split("T")[0],
              checkOut: res.checkOut.toISOString().split("T")[0],
            },
          })),
          mergedDates: {
            checkIn: mergedCheckIn.toISOString().split("T")[0],
            checkOut: mergedCheckOut.toISOString().split("T")[0],
          },
          totalNights,
        },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd podglądu łączenia",
    };
  }
}

// ==================== AUTOMATYCZNA KONWERSJA STATUSÓW ====================

/**
 * Opcje automatycznej konwersji rezerwacji REQUEST → CONFIRMED.
 */
export interface AutoConfirmOptions {
  /** Liczba godzin po których REQUEST automatycznie staje się CONFIRMED */
  hoursThreshold?: number;
  /** Czy wysyłać powiadomienie email do gościa */
  sendNotification?: boolean;
  /** Limit przetworzonych rezerwacji (dla bezpieczeństwa) */
  limit?: number;
  /** Dry run - tylko sprawdź ile rezerwacji zostałoby skonwertowanych */
  dryRun?: boolean;
}

/**
 * Wynik automatycznej konwersji.
 */
export interface AutoConfirmResult {
  processedCount: number;
  convertedIds: string[];
  skippedCount: number;
  skippedReasons: { id: string; reason: string }[];
  nextRunRecommendation?: string;
}

/**
 * Automatycznie konwertuje rezerwacje ze statusu REQUEST na CONFIRMED
 * po upływie określonego czasu.
 *
 * Przeznaczone do uruchamiania jako cron job lub scheduled task.
 */
export async function autoConfirmRequestReservations(
  options?: AutoConfirmOptions
): Promise<ActionResult<AutoConfirmResult>> {
  const hoursThreshold = options?.hoursThreshold ?? 24; // domyślnie 24 godziny
  const limit = options?.limit ?? 100;
  const dryRun = options?.dryRun ?? false;

  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    // Oblicz próg czasowy
    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - hoursThreshold);

    // Znajdź rezerwacje REQUEST starsze niż próg (w Prisma enum brak REQUEST – zapytanie zwróci [] jeśli brak takiego statusu)
    const requestReservations = await prisma.reservation.findMany({
      where: {
        status: "REQUEST" as ReservationStatus,
        createdAt: {
          lte: thresholdDate,
        },
        // Nie konwertuj rezerwacji które już minęły datę przyjazdu
        checkIn: {
          gte: new Date(),
        },
      },
      take: limit,
      orderBy: { createdAt: "asc" },
      include: {
        guest: true,
        room: true,
      },
    });

    if (requestReservations.length === 0) {
      return {
        success: true,
        data: {
          processedCount: 0,
          convertedIds: [],
          skippedCount: 0,
          skippedReasons: [],
          nextRunRecommendation: `Brak rezerwacji REQUEST starszych niż ${hoursThreshold} godzin`,
        },
      };
    }

    const convertedIds: string[] = [];
    const skippedReasons: { id: string; reason: string }[] = [];

    for (const reservation of requestReservations) {
      // Sprawdź czy pokój jest nadal dostępny w tym terminie
      const conflictingReservation = await prisma.reservation.findFirst({
        where: {
          id: { not: reservation.id },
          roomId: reservation.roomId,
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
          OR: [
            {
              AND: [
                { checkIn: { lte: reservation.checkIn } },
                { checkOut: { gt: reservation.checkIn } },
              ],
            },
            {
              AND: [
                { checkIn: { lt: reservation.checkOut } },
                { checkOut: { gte: reservation.checkOut } },
              ],
            },
            {
              AND: [
                { checkIn: { gte: reservation.checkIn } },
                { checkOut: { lte: reservation.checkOut } },
              ],
            },
          ],
        },
      });

      if (conflictingReservation) {
        skippedReasons.push({
          id: reservation.id,
          reason: `Konflikt z rezerwacją ${conflictingReservation.id} - pokój ${reservation.room.number} jest zajęty`,
        });
        continue;
      }

      // Sprawdź czy pokój jest aktywny
      if (!reservation.room.activeForSale) {
        skippedReasons.push({
          id: reservation.id,
          reason: `Pokój ${reservation.room.number} jest wycofany ze sprzedaży`,
        });
        continue;
      }

      if (!dryRun) {
        // Konwertuj rezerwację
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: {
            status: "CONFIRMED",
            internalNotes: reservation.internalNotes
              ? `${reservation.internalNotes}\n[AUTO] Automatycznie potwierdzona po ${hoursThreshold}h (${new Date().toISOString()})`
              : `[AUTO] Automatycznie potwierdzona po ${hoursThreshold}h (${new Date().toISOString()})`,
          },
        });

        // Audit log
        await createAuditLog({
          actionType: "UPDATE",
          entityType: "Reservation",
          entityId: reservation.id,
          oldValue: { status: "REQUEST" },
          newValue: {
            status: "CONFIRMED",
            autoConfirmedAfterHours: hoursThreshold,
          },
          ipAddress: ip,
        });

        // TODO: Wysłać powiadomienie email do gościa jeśli sendNotification === true
        // if (options?.sendNotification && reservation.guest.email) {
        //   await sendConfirmationEmail(reservation.guest.email, reservation);
        // }
      }

      convertedIds.push(reservation.id);
    }

    return {
      success: true,
      data: {
        processedCount: requestReservations.length,
        convertedIds,
        skippedCount: skippedReasons.length,
        skippedReasons,
        nextRunRecommendation: dryRun
          ? `Dry run: ${convertedIds.length} rezerwacji zostałoby skonwertowanych`
          : undefined,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd automatycznej konwersji",
    };
  }
}

/**
 * Pobiera statystyki rezerwacji REQUEST oczekujących na automatyczną konwersję.
 */
export async function getRequestReservationsStats(): Promise<
  ActionResult<{
    total: number;
    olderThan24h: number;
    olderThan48h: number;
    olderThan72h: number;
    byRoom: { roomNumber: string; count: number }[];
    oldestCreatedAt: Date | null;
  }>
> {
  try {
    const now = new Date();
    const threshold24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threshold48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const threshold72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const [total, olderThan24h, olderThan48h, olderThan72h, byRoom, oldest] = await Promise.all([
      prisma.reservation.count({ where: { status: "REQUEST" as ReservationStatus } }),
      prisma.reservation.count({
        where: { status: "REQUEST" as ReservationStatus, createdAt: { lte: threshold24h } },
      }),
      prisma.reservation.count({
        where: { status: "REQUEST" as ReservationStatus, createdAt: { lte: threshold48h } },
      }),
      prisma.reservation.count({
        where: { status: "REQUEST" as ReservationStatus, createdAt: { lte: threshold72h } },
      }),
      prisma.reservation.groupBy({
        by: ["roomId"],
        where: { status: "REQUEST" as ReservationStatus },
        _count: { id: true },
      }),
      prisma.reservation.findFirst({
        where: { status: "REQUEST" as ReservationStatus },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    // Pobierz numery pokoi dla statystyk
    const roomIds = byRoom.map((r) => r.roomId);
    const rooms = await prisma.room.findMany({
      where: { id: { in: roomIds } },
      select: { id: true, number: true },
    });

    const roomMap = new Map(rooms.map((r) => [r.id, r.number]));

    return {
      success: true,
      data: {
        total,
        olderThan24h,
        olderThan48h,
        olderThan72h,
        byRoom: byRoom.map((r) => ({
          roomNumber: roomMap.get(r.roomId) ?? "?",
          count: r._count.id,
        })),
        oldestCreatedAt: oldest?.createdAt ?? null,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statystyk",
    };
  }
}

/**
 * Ręcznie potwierdza wszystkie rezerwacje REQUEST dla danego pokoju.
 */
export async function confirmAllRequestsForRoom(
  roomNumber: string
): Promise<ActionResult<{ confirmedCount: number; confirmedIds: string[] }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const room = await prisma.room.findUnique({
      where: { number: roomNumber },
    });

    if (!room) {
      return { success: false, error: "Pokój nie istnieje" };
    }

    const requestReservations = await prisma.reservation.findMany({
      where: {
        roomId: room.id,
        status: "REQUEST" as ReservationStatus,
        checkIn: { gte: new Date() },
      },
    });

    if (requestReservations.length === 0) {
      return {
        success: true,
        data: { confirmedCount: 0, confirmedIds: [] },
      };
    }

    const confirmedIds: string[] = [];

    for (const reservation of requestReservations) {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "CONFIRMED" },
      });

      await createAuditLog({
        actionType: "UPDATE",
        entityType: "Reservation",
        entityId: reservation.id,
        oldValue: { status: "REQUEST" },
        newValue: { status: "CONFIRMED", confirmedManually: true },
        ipAddress: ip,
      });

      confirmedIds.push(reservation.id);
    }

    return {
      success: true,
      data: {
        confirmedCount: confirmedIds.length,
        confirmedIds,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd potwierdzania rezerwacji",
    };
  }
}

// ==================== WALK-IN ====================

/**
 * Dane wejściowe dla walk-in (szybka rezerwacja z natychmiastowym check-in).
 */
export interface WalkInInput {
  /** Imię i nazwisko gościa */
  guestName: string;
  /** Email gościa (opcjonalnie) */
  guestEmail?: string;
  /** Telefon gościa (opcjonalnie) */
  guestPhone?: string;
  /** Numer pokoju */
  roomNumber: string;
  /** Data wymeldowania (YYYY-MM-DD) */
  checkOut: string;
  /** Liczba nocy (alternatywa do checkOut - oblicza checkOut automatycznie) */
  nights?: number;
  /** Liczba osób */
  pax?: number;
  /** Liczba dorosłych */
  adults?: number;
  /** Liczba dzieci */
  children?: number;
  /** ID kodu stawki (opcjonalnie) */
  rateCodeId?: string;
  /** Uwagi */
  notes?: string;
  /** Metoda płatności przy zameldowaniu */
  paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "NONE";
  /** Kwota pobranej przedpłaty */
  prepaymentAmount?: number;
  /** Dane dokumentu tożsamości (opcjonalnie - do meldunku) */
  documentType?: string;
  documentNumber?: string;
  /** Rejestracja pojazdu (jeśli parking) */
  vehicleRegistration?: string;
}

/**
 * Wynik walk-in.
 */
export interface WalkInResult {
  reservation: ReturnType<typeof toUiReservation>;
  checkInTime: string;
  roomAssigned: string;
  nightsStay: number;
  totalEstimate?: number;
}

/**
 * Tworzy rezerwację walk-in z natychmiastowym check-in.
 *
 * Funkcja:
 * 1. Sprawdza dostępność pokoju
 * 2. Tworzy/znajduje gościa
 * 3. Tworzy rezerwację ze statusem CHECKED_IN
 * 4. Opcjonalnie rejestruje płatność
 */
export async function createWalkIn(
  input: WalkInInput
): Promise<ActionResult<WalkInResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    // Walidacja podstawowa
    if (!input.guestName?.trim()) {
      return { success: false, error: "Imię i nazwisko gościa jest wymagane" };
    }

    if (!input.roomNumber?.trim()) {
      return { success: false, error: "Numer pokoju jest wymagany" };
    }

    // Pobierz pokój
    const room = await prisma.room.findUnique({
      where: { number: input.roomNumber },
    });

    if (!room) {
      return { success: false, error: `Pokój ${input.roomNumber} nie istnieje` };
    }

    if (!room.activeForSale) {
      return { success: false, error: `Pokój ${input.roomNumber} jest wycofany ze sprzedaży` };
    }

    // Oblicz daty
    const today = new Date();
    const checkIn = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let checkOut: Date;

    if (input.nights && input.nights > 0) {
      checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + input.nights);
    } else if (input.checkOut) {
      checkOut = new Date(input.checkOut);
    } else {
      // Domyślnie 1 noc
      checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 1);
    }

    if (checkOut <= checkIn) {
      return { success: false, error: "Data wymeldowania musi być po dzisiejszej dacie" };
    }

    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000));

    // Sprawdź dostępność pokoju na podany okres
    const conflictingReservation = await prisma.reservation.findFirst({
      where: {
        roomId: room.id,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        OR: [
          {
            AND: [{ checkIn: { lte: checkIn } }, { checkOut: { gt: checkIn } }],
          },
          {
            AND: [{ checkIn: { lt: checkOut } }, { checkOut: { gte: checkOut } }],
          },
          {
            AND: [{ checkIn: { gte: checkIn } }, { checkOut: { lte: checkOut } }],
          },
        ],
      },
      include: { guest: true },
    });

    if (conflictingReservation) {
      return {
        success: false,
        error: `Pokój ${input.roomNumber} jest zajęty w podanym terminie.`,
      };
    }

    // Sprawdź status pokoju (powinien być CLEAN)
    if (room.status !== "CLEAN") {
      // Ostrzeżenie, ale nie blokuj
      console.warn(`Walk-in: Pokój ${input.roomNumber} ma status ${room.status}, nie CLEAN`);
    }

    // Znajdź lub utwórz gościa
    const guestName = input.guestName.trim();
    let guest = await prisma.guest.findFirst({
      where: {
        name: guestName,
        ...(input.guestEmail ? { email: input.guestEmail } : {}),
      },
    });

    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          name: guestName,
          email: input.guestEmail ?? null,
          phone: input.guestPhone ?? null,
        },
      });
    }

    // Generuj numer potwierdzenia
    const confirmationNumber = await generateConfirmationNumber();

    // Pobierz kod stawki jeśli podany
    let rateCode: Awaited<ReturnType<typeof prisma.rateCode.findUnique>> = null;
    if (input.rateCodeId) {
      rateCode = await prisma.rateCode.findUnique({
        where: { id: input.rateCodeId },
      });
    }

    // Aktualna godzina zameldowania
    const checkInTime = new Date().toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Utwórz rezerwację z natychmiastowym check-in
    const reservation = await prisma.reservation.create({
      data: {
        confirmationNumber,
        guestId: guest.id,
        roomId: room.id,
        checkIn,
        checkOut,
        checkInTime,
        status: "CHECKED_IN",
        source: "WALK_IN",
        channel: "DIRECT",
        pax: input.pax ?? input.adults ?? 1,
        adults: input.adults ?? input.pax ?? 1,
        children: input.children ?? 0,
        ...(input.rateCodeId ? { rateCodeId: input.rateCodeId } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        internalNotes: `[WALK-IN] Zameldowany ${new Date().toISOString()}`,
        paymentStatus: input.prepaymentAmount && input.prepaymentAmount > 0 ? "PARTIAL" : "UNPAID",
      },
      include: {
        guest: true,
        room: true,
        rateCode: true,
        parkingBookings: { include: { parkingSpot: true } },
        group: true,
      },
    });

    // Zapisz transakcję przedpłaty jeśli podana
    if (input.prepaymentAmount && input.prepaymentAmount > 0) {
      await prisma.transaction.create({
        data: {
          reservationId: reservation.id,
          amount: input.prepaymentAmount,
          type: "DEPOSIT",
          description: `Walk-in - przedpłata (${input.paymentMethod ?? "CASH"})`,
        },
      });
    }

    // Zaktualizuj status pokoju na DIRTY (dla housekeepingu po wymeldowaniu)
    // Nie zmieniamy teraz, bo gość jest zameldowany

    // Audit log
    await createAuditLog({
      actionType: "CREATE",
      entityType: "Reservation",
      entityId: reservation.id,
      newValue: {
        ...reservation,
        walkIn: true,
        checkInTime,
      },
      ipAddress: ip,
    });

    // Oblicz szacunkową cenę
    let totalEstimate: number | undefined;
    if (rateCode?.price) {
      totalEstimate = Number(rateCode.price) * nights;
    }

    return {
      success: true,
      data: {
        reservation: toUiReservation(reservation),
        checkInTime,
        roomAssigned: room.number,
        nightsStay: nights,
        totalEstimate,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia walk-in",
    };
  }
}

/**
 * Pobiera listę dostępnych pokoi dla walk-in (dzisiaj).
 */
export async function getAvailableRoomsForWalkIn(): Promise<
  ActionResult<
    {
      roomNumber: string;
      type: string;
      status: string;
      floor: string | null;
      beds: number;
      maxOccupancy: number;
      price: number | null;
    }[]
  >
> {
  try {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Pobierz wszystkie pokoje aktywne
    const allRooms = await prisma.room.findMany({
      where: { activeForSale: true },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    });

    // Pobierz zajęte pokoje dzisiaj
    const occupiedRoomIds = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lte: todayStart },
        checkOut: { gt: todayStart },
      },
      select: { roomId: true },
    });

    const occupiedSet = new Set(occupiedRoomIds.map((r) => r.roomId));

    // Filtruj dostępne pokoje
    const availableRooms = allRooms
      .filter((room) => !occupiedSet.has(room.id))
      .map((room) => ({
        roomNumber: room.number,
        type: room.type,
        status: room.status,
        floor: room.floor,
        beds: room.beds,
        maxOccupancy: room.maxOccupancy,
        price: room.price ? Number(room.price) : null,
      }));

    return { success: true, data: availableRooms };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania dostępnych pokoi",
    };
  }
}

/**
 * Pobiera sugerowaną cenę dla walk-in.
 */
export async function getWalkInSuggestedPrice(
  roomNumber: string,
  nights: number
): Promise<ActionResult<{ basePrice: number; total: number; currency: string }>> {
  try {
    const room = await prisma.room.findUnique({
      where: { number: roomNumber },
    });

    if (!room) {
      return { success: false, error: "Pokój nie istnieje" };
    }

    const basePrice = room.price ? Number(room.price) : 0;

    return {
      success: true,
      data: {
        basePrice,
        total: basePrice * nights,
        currency: "PLN",
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania ceny",
    };
  }
}

// ==================== AUTO-ASSIGN POKOJU ====================

/**
 * Opcje automatycznego przypisania pokoju.
 */
export interface AutoAssignRoomOptions {
  /** Preferowany typ pokoju */
  roomTypeId?: string;
  /** Preferowane piętro */
  preferredFloor?: string;
  /** Preferowany widok */
  preferredView?: string;
  /** Czy pokój musi być czysty */
  requireClean?: boolean;
  /** Minimalna liczba łóżek */
  minBeds?: number;
  /** Minimalna pojemność */
  minOccupancy?: number;
  /** Preferencje z rezerwacji */
  roomPreferences?: {
    quiet?: boolean;
    highFloor?: boolean;
    nearElevator?: boolean;
    accessible?: boolean;
    smoking?: boolean;
    nonSmoking?: boolean;
    balcony?: boolean;
  };
}

/**
 * Wynik automatycznego przypisania pokoju.
 */
export interface AutoAssignResult {
  assignedRoom: {
    id: string;
    number: string;
    type: string;
    floor: string | null;
    status: string;
  };
  matchScore: number;
  matchDetails: string[];
  alternativeRooms: {
    number: string;
    type: string;
    score: number;
  }[];
}

/**
 * Automatycznie przypisuje pokój do rezerwacji.
 *
 * Algorytm:
 * 1. Pobiera wszystkie pokoje aktywne
 * 2. Filtruje dostępne w podanym terminie
 * 3. Filtruje po typie pokoju jeśli podany
 * 4. Oblicza "score" dla każdego pokoju według preferencji
 * 5. Wybiera pokój z najwyższym score
 */
export async function autoAssignRoom(
  checkIn: string | Date,
  checkOut: string | Date,
  options?: AutoAssignRoomOptions
): Promise<ActionResult<AutoAssignResult>> {
  try {
    const checkInDate = typeof checkIn === "string" ? new Date(checkIn) : checkIn;
    const checkOutDate = typeof checkOut === "string" ? new Date(checkOut) : checkOut;

    if (checkOutDate <= checkInDate) {
      return { success: false, error: "Data wymeldowania musi być po dacie zameldowania" };
    }

    // Pobierz wszystkie pokoje aktywne
    let roomQuery: { activeForSale: boolean; roomTypeId?: string } = {
      activeForSale: true,
    };

    if (options?.roomTypeId) {
      roomQuery = { ...roomQuery, roomTypeId: options.roomTypeId };
    }

    const allRooms = await prisma.room.findMany({
      where: roomQuery,
    });

    if (allRooms.length === 0) {
      return {
        success: false,
        error: options?.roomTypeId
          ? "Brak pokoi tego typu"
          : "Brak dostępnych pokoi",
      };
    }

    // Pobierz zajęte pokoje w tym terminie
    const occupiedReservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        OR: [
          {
            AND: [{ checkIn: { lte: checkInDate } }, { checkOut: { gt: checkInDate } }],
          },
          {
            AND: [{ checkIn: { lt: checkOutDate } }, { checkOut: { gte: checkOutDate } }],
          },
          {
            AND: [{ checkIn: { gte: checkInDate } }, { checkOut: { lte: checkOutDate } }],
          },
        ],
      },
      select: { roomId: true },
    });

    const occupiedRoomIds = new Set(occupiedReservations.map((r) => r.roomId));

    // Filtruj dostępne pokoje
    let availableRooms = allRooms.filter((room) => !occupiedRoomIds.has(room.id));

    // Dodatkowe filtry
    if (options?.requireClean) {
      availableRooms = availableRooms.filter((room) => room.status === "CLEAN");
    }

    if (options?.minBeds) {
      availableRooms = availableRooms.filter((room) => room.beds >= options.minBeds!);
    }

    if (options?.minOccupancy) {
      availableRooms = availableRooms.filter(
        (room) => room.maxOccupancy >= options.minOccupancy!
      );
    }

    if (availableRooms.length === 0) {
      return {
        success: false,
        error: "Brak dostępnych pokoi spełniających kryteria w podanym terminie",
      };
    }

    // Oblicz score dla każdego pokoju
    const scoredRooms = availableRooms.map((room) => {
      let score = 100; // bazowy score
      const matchDetails: string[] = [];

      // Bonus za status CLEAN
      if (room.status === "CLEAN") {
        score += 20;
        matchDetails.push("Pokój czysty");
      } else if (room.status === "DIRTY") {
        score -= 10;
      } else if (room.status === "OOO") {
        score -= 50;
      }

      // Preferowane piętro
      if (options?.preferredFloor && room.floor === options.preferredFloor) {
        score += 15;
        matchDetails.push(`Preferowane piętro: ${room.floor}`);
      }

      // Preferencje pokoju
      if (options?.roomPreferences) {
        const prefs = options.roomPreferences;

        // Wysokie piętro
        if (prefs.highFloor && room.floor) {
          const floorNum = parseInt(room.floor);
          if (!isNaN(floorNum) && floorNum >= 3) {
            score += 10;
            matchDetails.push("Wysokie piętro");
          }
        }

        // Dostępność dla niepełnosprawnych (zakładamy że parter)
        if (prefs.accessible && room.floor === "0") {
          score += 15;
          matchDetails.push("Dostępny dla niepełnosprawnych");
        }

        // Niepalący (domyślnie wszystkie pokoje)
        if (prefs.nonSmoking) {
          score += 5;
          matchDetails.push("Niepalący");
        }
      }

      // Mniejsze pokoje mają lekką preferencję (efektywność)
      if (room.beds === 1) {
        score += 5;
      }

      return {
        room,
        score,
        matchDetails,
      };
    });

    // Sortuj według score malejąco
    scoredRooms.sort((a, b) => b.score - a.score);

    const bestMatch = scoredRooms[0];
    const alternatives = scoredRooms.slice(1, 4).map((sr) => ({
      number: sr.room.number,
      type: sr.room.type,
      score: sr.score,
    }));

    return {
      success: true,
      data: {
        assignedRoom: {
          id: bestMatch.room.id,
          number: bestMatch.room.number,
          type: bestMatch.room.type,
          floor: bestMatch.room.floor,
          status: bestMatch.room.status,
        },
        matchScore: bestMatch.score,
        matchDetails: bestMatch.matchDetails,
        alternativeRooms: alternatives,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd auto-przypisania pokoju",
    };
  }
}

/**
 * Tworzy rezerwację z automatycznym przypisaniem pokoju.
 */
export async function createReservationWithAutoAssign(
  data: Omit<Parameters<typeof createReservation>[0], "room"> & {
    roomTypeId?: string;
    roomPreferences?: AutoAssignRoomOptions["roomPreferences"];
  }
): Promise<ActionResult<ReturnType<typeof toUiReservation>>> {
  try {
    // Automatycznie przypisz pokój
    const autoAssignResult = await autoAssignRoom(data.checkIn, data.checkOut, {
      roomTypeId: data.roomTypeId,
      roomPreferences: data.roomPreferences,
      requireClean: false, // nie wymagaj czystego przy rezerwacji (może być posprzątany)
      minOccupancy: data.pax,
    });

    if (!autoAssignResult.success || !autoAssignResult.data) {
      return {
        success: false,
        error: "error" in autoAssignResult ? (autoAssignResult.error ?? "Nie udało się automatycznie przypisać pokoju") : "Nie udało się automatycznie przypisać pokoju",
      };
    }

    // Utwórz rezerwację z przypisanym pokojem
    const reservationResult = await createReservation({
      ...data,
      room: autoAssignResult.data.assignedRoom.number,
    });

    return reservationResult;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia rezerwacji",
    };
  }
}

/**
 * Zmienia pokój dla istniejącej rezerwacji (z auto-assign).
 */
export async function reassignRoomForReservation(
  reservationId: string,
  options?: AutoAssignRoomOptions
): Promise<ActionResult<AutoAssignResult & { previousRoom: string }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { room: true },
    });

    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }

    // Automatycznie przypisz nowy pokój (wykluczając obecny)
    const autoAssignResult = await autoAssignRoom(
      reservation.checkIn,
      reservation.checkOut,
      options
    );

    if (!autoAssignResult.success || !autoAssignResult.data) {
      return {
        success: false,
        error: "error" in autoAssignResult ? (autoAssignResult.error ?? "Nie udało się znaleźć alternatywnego pokoju") : "Nie udało się znaleźć alternatywnego pokoju",
      };
    }

    const previousRoom = reservation.room.number;
    const newRoomId = autoAssignResult.data.assignedRoom.id;

    // Aktualizuj rezerwację
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        roomId: newRoomId,
        internalNotes: reservation.internalNotes
          ? `${reservation.internalNotes}\n[REASSIGN] Zmiana pokoju z ${previousRoom} na ${autoAssignResult.data.assignedRoom.number} (${new Date().toISOString()})`
          : `[REASSIGN] Zmiana pokoju z ${previousRoom} na ${autoAssignResult.data.assignedRoom.number} (${new Date().toISOString()})`,
      },
    });

    // Audit log
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Reservation",
      entityId: reservationId,
      oldValue: { roomId: reservation.roomId, roomNumber: previousRoom },
      newValue: {
        roomId: newRoomId,
        roomNumber: autoAssignResult.data.assignedRoom.number,
        autoAssigned: true,
      },
      ipAddress: ip,
    });

    return {
      success: true,
      data: {
        ...autoAssignResult.data,
        previousRoom,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zmiany pokoju",
    };
  }
}

// ============================================================================
// DEDUPLIKACJA GOŚCI (Merge Duplicate Profiles)
// ============================================================================

/**
 * Typ danych potencjalnego duplikatu gościa.
 */
export interface PotentialDuplicateGuest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  documentNumber: string | null;
  dateOfBirth: string | null;
  totalStays: number;
  lastStayDate: string | null;
  isVip: boolean;
  isBlacklisted: boolean;
  matchScore: number; // 0-100 - jak bardzo podobny
  matchReasons: string[]; // powody dopasowania
}

/**
 * Oblicza podobieństwo dwóch stringów (Levenshtein distance normalized).
 */
function stringSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 100;
  if (a.length === 0 || b.length === 0) return 0;

  // Proste porównanie - contains
  if (a.includes(b) || b.includes(a)) return 70;

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(a.length, b.length);
  const distance = matrix[b.length][a.length];
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Normalizuje numer telefonu (usuwa spacje, myślniki, +48 etc.)
 */
function normalizePhone(phone: string | null): string {
  if (!phone) return "";
  return phone.replace(/[\s\-\+\(\)]/g, "").replace(/^48/, "").replace(/^0/, "");
}

/**
 * Normalizuje email (lowercase, trim)
 */
function normalizeEmail(email: string | null): string {
  if (!email) return "";
  return email.toLowerCase().trim();
}

/**
 * Wyszukuje potencjalne duplikaty dla danego gościa.
 * Algorytm punktowy: każde dopasowanie dodaje punkty.
 */
export async function findPotentialDuplicates(
  guestId: string,
  options?: {
    minScore?: number; // minimalny wynik podobieństwa (domyślnie 50)
    limit?: number; // max liczba wyników (domyślnie 10)
  }
): Promise<ActionResult<PotentialDuplicateGuest[]>> {
  try {
    const { minScore = 50, limit = 10 } = options ?? {};

    // Pobierz dane gościa źródłowego
    const sourceGuest = await prisma.guest.findUnique({
      where: { id: guestId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        documentNumber: true,
        mrz: true,
        dateOfBirth: true,
        city: true,
        street: true,
      },
    });

    if (!sourceGuest) {
      return { success: false, error: "Gość nie istnieje" };
    }

    // Przygotuj znormalizowane dane do porównania
    const srcName = sourceGuest.name.toLowerCase().trim();
    const srcEmail = normalizeEmail(sourceGuest.email);
    const srcPhone = normalizePhone(sourceGuest.phone);
    const srcDoc = sourceGuest.documentNumber?.toUpperCase().trim() ?? "";
    const srcMrz = (decrypt(sourceGuest.mrz) ?? "")?.toUpperCase().trim() ?? "";

    // Buduj warunki OR dla wstępnego filtrowania (szybkie przeszukanie)
    const searchConditions: object[] = [];

    // Szukaj po częściowym imieniu (pierwsze i ostatnie słowo)
    const nameParts = srcName.split(/\s+/).filter(p => p.length >= 2);
    if (nameParts.length > 0) {
      for (const part of nameParts) {
        searchConditions.push({ name: { contains: part } });
      }
    }

    // Szukaj po email (jeśli istnieje)
    if (srcEmail) {
      searchConditions.push({ email: srcEmail });
      // Szukaj też po domenie email
      const emailDomain = srcEmail.split("@")[1];
      if (emailDomain) {
        searchConditions.push({ email: { endsWith: `@${emailDomain}` } });
      }
    }

    // Szukaj po telefonie (jeśli istnieje)
    if (srcPhone && srcPhone.length >= 6) {
      searchConditions.push({ phone: { contains: srcPhone.slice(-6) } });
    }

    // Szukaj po numerze dokumentu (jeśli istnieje)
    if (srcDoc && srcDoc.length >= 4) {
      searchConditions.push({ documentNumber: srcDoc });
      searchConditions.push({ documentNumber: { contains: srcDoc.slice(-5) } });
    }

    // Szukaj po MRZ (jeśli istnieje)
    if (srcMrz && srcMrz.length >= 10) {
      searchConditions.push({ mrz: { contains: srcMrz.slice(0, 10) } });
    }

    if (searchConditions.length === 0) {
      // Brak danych do porównania - zwróć pustą listę
      return { success: true, data: [] };
    }

    // Pobierz kandydatów (wyklucz siebie)
    const candidates = await prisma.guest.findMany({
      where: {
        id: { not: guestId },
        OR: searchConditions,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        documentNumber: true,
        mrz: true,
        dateOfBirth: true,
        totalStays: true,
        lastStayDate: true,
        isVip: true,
        isBlacklisted: true,
        city: true,
        street: true,
      },
      take: 100, // Limit wstępnych kandydatów
    });

    // Oblicz scoring dla każdego kandydata
    const scoredCandidates: PotentialDuplicateGuest[] = [];

    for (const candidate of candidates) {
      let score = 0;
      const matchReasons: string[] = [];

      const candName = candidate.name.toLowerCase().trim();
      const candEmail = normalizeEmail(candidate.email);
      const candPhone = normalizePhone(candidate.phone);
      const candDoc = candidate.documentNumber?.toUpperCase().trim() ?? "";
      const candMrz = (decrypt(candidate.mrz) ?? "")?.toUpperCase().trim() ?? "";

      // 1. Dopasowanie numeru dokumentu (najwyższy priorytet) - 50 pkt
      if (srcDoc && candDoc && srcDoc === candDoc) {
        score += 50;
        matchReasons.push("Identyczny numer dokumentu");
      } else if (srcDoc && candDoc && srcDoc.length >= 4 && candDoc.includes(srcDoc.slice(-5))) {
        score += 30;
        matchReasons.push("Podobny numer dokumentu");
      }

      // 2. Dopasowanie MRZ - 50 pkt
      if (srcMrz && candMrz && srcMrz.length >= 10 && candMrz.length >= 10) {
        if (srcMrz === candMrz) {
          score += 50;
          matchReasons.push("Identyczny MRZ");
        } else if (srcMrz.slice(0, 15) === candMrz.slice(0, 15)) {
          score += 35;
          matchReasons.push("Podobny MRZ");
        }
      }

      // 3. Dopasowanie email - 40 pkt
      if (srcEmail && candEmail) {
        if (srcEmail === candEmail) {
          score += 40;
          matchReasons.push("Identyczny e-mail");
        } else {
          // Porównaj część przed @
          const srcLocal = srcEmail.split("@")[0] ?? "";
          const candLocal = candEmail.split("@")[0] ?? "";
          const emailSim = stringSimilarity(srcLocal, candLocal);
          if (emailSim >= 80) {
            score += 25;
            matchReasons.push("Podobny e-mail");
          }
        }
      }

      // 4. Dopasowanie telefonu - 35 pkt
      if (srcPhone && candPhone && srcPhone.length >= 6 && candPhone.length >= 6) {
        if (srcPhone === candPhone) {
          score += 35;
          matchReasons.push("Identyczny telefon");
        } else if (srcPhone.slice(-6) === candPhone.slice(-6)) {
          score += 25;
          matchReasons.push("Podobny telefon");
        }
      }

      // 5. Dopasowanie imienia i nazwiska - 30 pkt
      const nameSim = stringSimilarity(srcName, candName);
      if (nameSim === 100) {
        score += 30;
        matchReasons.push("Identyczne imię i nazwisko");
      } else if (nameSim >= 85) {
        score += 25;
        matchReasons.push("Bardzo podobne imię i nazwisko");
      } else if (nameSim >= 70) {
        score += 15;
        matchReasons.push("Podobne imię i nazwisko");
      }

      // 6. Dopasowanie daty urodzenia - 20 pkt
      if (sourceGuest.dateOfBirth && candidate.dateOfBirth) {
        const srcDob = sourceGuest.dateOfBirth.toISOString().slice(0, 10);
        const candDob = candidate.dateOfBirth.toISOString().slice(0, 10);
        if (srcDob === candDob) {
          score += 20;
          matchReasons.push("Identyczna data urodzenia");
        }
      }

      // 7. Dopasowanie adresu - 10 pkt
      if (sourceGuest.city && candidate.city) {
        const citySim = stringSimilarity(sourceGuest.city, candidate.city);
        if (citySim >= 90) {
          score += 5;
          matchReasons.push("To samo miasto");
        }
      }
      if (sourceGuest.street && candidate.street) {
        const streetSim = stringSimilarity(sourceGuest.street, candidate.street);
        if (streetSim >= 80) {
          score += 5;
          matchReasons.push("Podobny adres");
        }
      }

      // Normalizuj wynik do 0-100
      score = Math.min(100, score);

      // Dodaj do wyników jeśli przekracza próg
      if (score >= minScore && matchReasons.length > 0) {
        scoredCandidates.push({
          id: candidate.id,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          documentNumber: candidate.documentNumber,
          dateOfBirth: candidate.dateOfBirth?.toISOString().slice(0, 10) ?? null,
          totalStays: candidate.totalStays,
          lastStayDate: candidate.lastStayDate?.toISOString().slice(0, 10) ?? null,
          isVip: candidate.isVip,
          isBlacklisted: candidate.isBlacklisted,
          matchScore: score,
          matchReasons,
        });
      }
    }

    // Sortuj po score malejąco i ogranicz wyniki
    scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);
    const topResults = scoredCandidates.slice(0, limit);

    return { success: true, data: topResults };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania duplikatów",
    };
  }
}

/**
 * Wynik operacji scalania gości.
 */
export interface MergeGuestsResult {
  mergedGuestId: string;
  deletedGuestId: string;
  transferredReservations: number;
  transferredLoyaltyTransactions: number;
  transferredRelations: number;
  mergedFields: string[]; // pola, które zostały uzupełnione z profilu źródłowego
}

/**
 * Scala dwa profile gości w jeden.
 * 
 * WAŻNE: Profil źródłowy (sourceGuestId) zostanie usunięty.
 * Wszystkie dane z profilu źródłowego zostaną przeniesione do profilu docelowego (targetGuestId).
 * 
 * Logika scalania pól:
 * - Jeśli pole docelowe jest puste, użyj wartości źródłowej
 * - Jeśli oba są wypełnione, zachowaj wartość docelową (chyba że źródłowa jest "lepsza")
 * - totalStays = suma obu
 * - lastStayDate = późniejsza z dwóch
 * - isVip = true jeśli którykolwiek jest VIP
 * - isBlacklisted = true jeśli którykolwiek jest na czarnej liście
 */
export async function mergeGuests(
  sourceGuestId: string,
  targetGuestId: string
): Promise<ActionResult<MergeGuestsResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    // Walidacja - nie można scalić gościa z samym sobą
    if (sourceGuestId === targetGuestId) {
      return { success: false, error: "Nie można scalić gościa z samym sobą" };
    }

    // Pobierz oba profile
    const [sourceGuest, targetGuest] = await Promise.all([
      prisma.guest.findUnique({
        where: { id: sourceGuestId },
        include: {
          reservations: { select: { id: true } },
          loyaltyTransactions: { select: { id: true } },
          relationsAsSource: { select: { id: true, targetGuestId: true } },
          relationsAsTarget: { select: { id: true, sourceGuestId: true } },
          waitlistEntries: { select: { id: true } },
        },
      }),
      prisma.guest.findUnique({
        where: { id: targetGuestId },
        include: {
          reservations: { select: { id: true } },
          loyaltyTransactions: { select: { id: true } },
          relationsAsSource: { select: { id: true, targetGuestId: true } },
          relationsAsTarget: { select: { id: true, sourceGuestId: true } },
        },
      }),
    ]);

    if (!sourceGuest) {
      return { success: false, error: "Profil źródłowy nie istnieje" };
    }
    if (!targetGuest) {
      return { success: false, error: "Profil docelowy nie istnieje" };
    }

    // Przygotuj dane do scalenia
    const mergedFields: string[] = [];
    const updateData: Record<string, unknown> = {};

    // Funkcja pomocnicza - użyj wartości źródłowej jeśli docelowa jest pusta
    const mergeField = (fieldName: string, srcVal: unknown, tgtVal: unknown) => {
      if (!tgtVal && srcVal) {
        updateData[fieldName] = srcVal;
        mergedFields.push(fieldName);
      }
    };

    // Scala pola tekstowe
    mergeField("email", sourceGuest.email, targetGuest.email);
    mergeField("phone", sourceGuest.phone, targetGuest.phone);
    mergeField("photoUrl", sourceGuest.photoUrl, targetGuest.photoUrl);
    mergeField("emergencyContactName", sourceGuest.emergencyContactName, targetGuest.emergencyContactName);
    mergeField("emergencyContactPhone", sourceGuest.emergencyContactPhone, targetGuest.emergencyContactPhone);
    mergeField("emergencyContactRelation", sourceGuest.emergencyContactRelation, targetGuest.emergencyContactRelation);
    mergeField("occupation", sourceGuest.occupation, targetGuest.occupation);
    mergeField("segment", sourceGuest.segment, targetGuest.segment);
    mergeField("dateOfBirth", sourceGuest.dateOfBirth, targetGuest.dateOfBirth);
    mergeField("placeOfBirth", sourceGuest.placeOfBirth, targetGuest.placeOfBirth);
    mergeField("nationality", sourceGuest.nationality, targetGuest.nationality);
    mergeField("gender", sourceGuest.gender, targetGuest.gender);
    mergeField("street", sourceGuest.street, targetGuest.street);
    mergeField("city", sourceGuest.city, targetGuest.city);
    mergeField("postalCode", sourceGuest.postalCode, targetGuest.postalCode);
    mergeField("country", sourceGuest.country, targetGuest.country);
    mergeField("documentType", sourceGuest.documentType, targetGuest.documentType);
    mergeField("documentNumber", sourceGuest.documentNumber, targetGuest.documentNumber);
    mergeField("documentExpiry", sourceGuest.documentExpiry, targetGuest.documentExpiry);
    mergeField("documentIssuedBy", sourceGuest.documentIssuedBy, targetGuest.documentIssuedBy);
    mergeField("mrz", sourceGuest.mrz, targetGuest.mrz);
    mergeField("vipLevel", sourceGuest.vipLevel, targetGuest.vipLevel);
    mergeField("healthAllergies", sourceGuest.healthAllergies, targetGuest.healthAllergies);
    mergeField("healthNotes", sourceGuest.healthNotes, targetGuest.healthNotes);

    // Preferencje - scal JSON obiekty
    if (sourceGuest.preferences && !targetGuest.preferences) {
      updateData.preferences = sourceGuest.preferences;
      mergedFields.push("preferences");
    }
    if (sourceGuest.mealPreferences && !targetGuest.mealPreferences) {
      updateData.mealPreferences = sourceGuest.mealPreferences;
      mergedFields.push("mealPreferences");
    }
    if (sourceGuest.favoriteMinibarItems && !targetGuest.favoriteMinibarItems) {
      updateData.favoriteMinibarItems = sourceGuest.favoriteMinibarItems;
      mergedFields.push("favoriteMinibarItems");
    }

    // Scal uwagi dla personelu (dołącz z oznaczeniem)
    if (sourceGuest.staffNotes) {
      if (targetGuest.staffNotes) {
        updateData.staffNotes = `${targetGuest.staffNotes}\n\n[Scalono z profilu ${sourceGuest.name}]:\n${sourceGuest.staffNotes}`;
        mergedFields.push("staffNotes (dołączono)");
      } else {
        updateData.staffNotes = sourceGuest.staffNotes;
        mergedFields.push("staffNotes");
      }
    }

    // Statystyki - sumuj pobyty
    updateData.totalStays = targetGuest.totalStays + sourceGuest.totalStays;
    if (sourceGuest.totalStays > 0) {
      mergedFields.push("totalStays (zsumowano)");
    }

    // Data ostatniego pobytu - weź późniejszą
    if (sourceGuest.lastStayDate && targetGuest.lastStayDate) {
      if (sourceGuest.lastStayDate > targetGuest.lastStayDate) {
        updateData.lastStayDate = sourceGuest.lastStayDate;
        mergedFields.push("lastStayDate");
      }
    } else if (sourceGuest.lastStayDate && !targetGuest.lastStayDate) {
      updateData.lastStayDate = sourceGuest.lastStayDate;
      mergedFields.push("lastStayDate");
    }

    // VIP - zachowaj jeśli którykolwiek jest VIP
    if (sourceGuest.isVip && !targetGuest.isVip) {
      updateData.isVip = true;
      mergedFields.push("isVip");
    }

    // Czarna lista - zachowaj jeśli którykolwiek jest na czarnej liście
    if (sourceGuest.isBlacklisted && !targetGuest.isBlacklisted) {
      updateData.isBlacklisted = true;
      mergedFields.push("isBlacklisted");
    }

    // Program lojalnościowy - sumuj punkty
    if (sourceGuest.loyaltyPoints && sourceGuest.loyaltyPoints > 0) {
      updateData.loyaltyPoints = (targetGuest.loyaltyPoints ?? 0) + sourceGuest.loyaltyPoints;
      updateData.loyaltyTotalPoints = (targetGuest.loyaltyTotalPoints ?? 0) + (sourceGuest.loyaltyTotalPoints ?? 0);
      mergedFields.push("loyaltyPoints (zsumowano)");
    }

    // Zachowaj numer karty lojalnościowej (jeśli docelowy nie ma, a źródłowy ma)
    if (sourceGuest.loyaltyCardNumber && !targetGuest.loyaltyCardNumber) {
      updateData.loyaltyCardNumber = sourceGuest.loyaltyCardNumber;
      updateData.loyaltyEnrolledAt = sourceGuest.loyaltyEnrolledAt;
      mergedFields.push("loyaltyCardNumber");
    }

    // RODO - zachowaj najbardziej restrykcyjne (najnowsze wycofanie, zgody z docelowego)
    if (sourceGuest.gdprConsentWithdrawnAt && !targetGuest.gdprConsentWithdrawnAt) {
      updateData.gdprConsentWithdrawnAt = sourceGuest.gdprConsentWithdrawnAt;
      mergedFields.push("gdprConsentWithdrawnAt");
    }
    if (sourceGuest.gdprAnonymizedAt && !targetGuest.gdprAnonymizedAt) {
      updateData.gdprAnonymizedAt = sourceGuest.gdprAnonymizedAt;
      mergedFields.push("gdprAnonymizedAt");
    }

    // Wykonaj transakcję
    const result = await prisma.$transaction(async (tx) => {
      // 1. Przenieś wszystkie rezerwacje
      const resCount = sourceGuest.reservations.length;
      if (resCount > 0) {
        await tx.reservation.updateMany({
          where: { guestId: sourceGuestId },
          data: { guestId: targetGuestId },
        });
      }

      // 2. Przenieś transakcje lojalnościowe
      const loyaltyCount = sourceGuest.loyaltyTransactions.length;
      if (loyaltyCount > 0) {
        await tx.loyaltyTransaction.updateMany({
          where: { guestId: sourceGuestId },
          data: { guestId: targetGuestId },
        });
      }

      // 3. Przenieś wpisy na liście oczekujących
      if (sourceGuest.waitlistEntries && sourceGuest.waitlistEntries.length > 0) {
        await tx.waitlistEntry.updateMany({
          where: { guestId: sourceGuestId },
          data: { guestId: targetGuestId },
        });
      }

      // 4. Obsłuż relacje gości
      // Pobierz istniejące relacje docelowego gościa
      const targetRelationsAsSource = new Set(targetGuest.relationsAsSource.map(r => r.targetGuestId));
      const targetRelationsAsTarget = new Set(targetGuest.relationsAsTarget.map(r => r.sourceGuestId));

      let transferredRelations = 0;

      // Przenieś relacje gdzie source jest źródłowym gościem
      for (const rel of sourceGuest.relationsAsSource) {
        if (rel.targetGuestId === targetGuestId) {
          // Relacja wskazuje na gościa docelowego - usuń (nie ma sensu)
          await tx.guestRelation.delete({ where: { id: rel.id } });
        } else if (!targetRelationsAsSource.has(rel.targetGuestId)) {
          // Przenieś do gościa docelowego
          await tx.guestRelation.update({
            where: { id: rel.id },
            data: { sourceGuestId: targetGuestId },
          });
          transferredRelations++;
        } else {
          // Relacja już istnieje - usuń duplikat
          await tx.guestRelation.delete({ where: { id: rel.id } });
        }
      }

      // Przenieś relacje gdzie target jest źródłowym gościem
      for (const rel of sourceGuest.relationsAsTarget) {
        if (rel.sourceGuestId === targetGuestId) {
          // Relacja od gościa docelowego - usuń
          await tx.guestRelation.delete({ where: { id: rel.id } });
        } else if (!targetRelationsAsTarget.has(rel.sourceGuestId)) {
          // Przenieś do gościa docelowego
          await tx.guestRelation.update({
            where: { id: rel.id },
            data: { targetGuestId: targetGuestId },
          });
          transferredRelations++;
        } else {
          // Relacja już istnieje - usuń duplikat
          await tx.guestRelation.delete({ where: { id: rel.id } });
        }
      }

      // 5. Zaktualizuj profil docelowy scalanymi danymi
      await tx.guest.update({
        where: { id: targetGuestId },
        data: updateData,
      });

      // 6. Audit log przed usunięciem źródłowego profilu
      await createAuditLog({
        actionType: "DELETE",
        entityType: "GuestMerge",
        entityId: sourceGuestId,
        oldValue: {
          sourceGuest: {
            id: sourceGuest.id,
            name: sourceGuest.name,
            email: sourceGuest.email,
            phone: sourceGuest.phone,
            documentNumber: sourceGuest.documentNumber,
            totalStays: sourceGuest.totalStays,
          },
        },
        newValue: {
          targetGuestId,
          targetGuestName: targetGuest.name,
          transferredReservations: resCount,
          transferredLoyaltyTransactions: loyaltyCount,
          transferredRelations,
          mergedFields,
        },
        ipAddress: ip,
      });

      // 7. Usuń profil źródłowy
      await tx.guest.delete({
        where: { id: sourceGuestId },
      });

      return {
        mergedGuestId: targetGuestId,
        deletedGuestId: sourceGuestId,
        transferredReservations: resCount,
        transferredLoyaltyTransactions: loyaltyCount,
        transferredRelations,
        mergedFields,
      };
    });

    revalidatePath("/guests");
    revalidatePath(`/guests/${targetGuestId}`);

    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd scalania profili gości",
    };
  }
}

/**
 * Wyszukuje globalnie potencjalne duplikaty wśród wszystkich gości.
 * Używane do audytu jakości danych.
 */
export async function findAllDuplicateCandidates(
  options?: {
    limit?: number;
    minScore?: number;
  }
): Promise<ActionResult<Array<{
  guest1: { id: string; name: string; email: string | null; phone: string | null };
  guest2: { id: string; name: string; email: string | null; phone: string | null };
  matchScore: number;
  matchReasons: string[];
}>>> {
  try {
    const { limit = 50, minScore = 70 } = options ?? {};

    // Pobierz gości z potencjalnie duplikatowymi danymi
    // Szukamy po: identycznym email, identycznym telefonie, identycznym dokumencie
    const [duplicateEmails, duplicatePhones, duplicateDocs] = await Promise.all([
      // Goście z tym samym email
      prisma.$queryRaw<Array<{ email: string; ids: string }>>`
        SELECT email, GROUP_CONCAT(id) as ids
        FROM Guest
        WHERE email IS NOT NULL AND email != ''
        GROUP BY email
        HAVING COUNT(*) > 1
        LIMIT 100
      `,
      // Goście z tym samym telefonem
      prisma.$queryRaw<Array<{ phone: string; ids: string }>>`
        SELECT phone, GROUP_CONCAT(id) as ids
        FROM Guest
        WHERE phone IS NOT NULL AND phone != ''
        GROUP BY phone
        HAVING COUNT(*) > 1
        LIMIT 100
      `,
      // Goście z tym samym dokumentem
      prisma.$queryRaw<Array<{ documentNumber: string; ids: string }>>`
        SELECT documentNumber, GROUP_CONCAT(id) as ids
        FROM Guest
        WHERE documentNumber IS NOT NULL AND documentNumber != ''
        GROUP BY documentNumber
        HAVING COUNT(*) > 1
        LIMIT 100
      `,
    ]);

    // Zbierz unikalne pary do sprawdzenia
    const pairsToCheck = new Set<string>();
    
    const addPairs = (ids: string) => {
      const idList = ids.split(",");
      for (let i = 0; i < idList.length; i++) {
        for (let j = i + 1; j < idList.length; j++) {
          const pair = [idList[i], idList[j]].sort().join("|");
          pairsToCheck.add(pair);
        }
      }
    };

    for (const row of duplicateEmails) addPairs(row.ids);
    for (const row of duplicatePhones) addPairs(row.ids);
    for (const row of duplicateDocs) addPairs(row.ids);

    // Pobierz dane dla wszystkich gości w parach
    const allGuestIds = new Set<string>();
    for (const pair of pairsToCheck) {
      const [id1, id2] = pair.split("|");
      allGuestIds.add(id1);
      allGuestIds.add(id2);
    }

    const guests = await prisma.guest.findMany({
      where: { id: { in: Array.from(allGuestIds) } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        documentNumber: true,
        dateOfBirth: true,
      },
    });

    const guestMap = new Map(guests.map(g => [g.id, g]));

    // Oblicz scoring dla każdej pary
    const results: Array<{
      guest1: { id: string; name: string; email: string | null; phone: string | null };
      guest2: { id: string; name: string; email: string | null; phone: string | null };
      matchScore: number;
      matchReasons: string[];
    }> = [];

    for (const pair of pairsToCheck) {
      const [id1, id2] = pair.split("|");
      const g1 = guestMap.get(id1);
      const g2 = guestMap.get(id2);
      if (!g1 || !g2) continue;

      let score = 0;
      const reasons: string[] = [];

      // Email
      if (g1.email && g2.email && normalizeEmail(g1.email) === normalizeEmail(g2.email)) {
        score += 40;
        reasons.push("Identyczny e-mail");
      }

      // Telefon
      if (g1.phone && g2.phone && normalizePhone(g1.phone) === normalizePhone(g2.phone)) {
        score += 35;
        reasons.push("Identyczny telefon");
      }

      // Dokument
      if (g1.documentNumber && g2.documentNumber && 
          g1.documentNumber.toUpperCase() === g2.documentNumber.toUpperCase()) {
        score += 50;
        reasons.push("Identyczny numer dokumentu");
      }

      // Imię
      const nameSim = stringSimilarity(g1.name, g2.name);
      if (nameSim >= 85) {
        score += 25;
        reasons.push("Bardzo podobne imię");
      } else if (nameSim >= 70) {
        score += 15;
        reasons.push("Podobne imię");
      }

      // Data urodzenia
      if (g1.dateOfBirth && g2.dateOfBirth && 
          g1.dateOfBirth.toISOString().slice(0, 10) === g2.dateOfBirth.toISOString().slice(0, 10)) {
        score += 20;
        reasons.push("Identyczna data urodzenia");
      }

      score = Math.min(100, score);

      if (score >= minScore && reasons.length > 0) {
        results.push({
          guest1: { id: g1.id, name: g1.name, email: g1.email, phone: g1.phone },
          guest2: { id: g2.id, name: g2.name, email: g2.email, phone: g2.phone },
          matchScore: score,
          matchReasons: reasons,
        });
      }
    }

    // Sortuj po score malejąco
    results.sort((a, b) => b.matchScore - a.matchScore);

    return { success: true, data: results.slice(0, limit) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania duplikatów",
    };
  }
}

/**
 * Sprawdza saldo rezerwacji przed check-outem.
 * Zwraca informacje o nieopłaconych rachunkach restauracyjnych i ogólnym saldzie.
 */
export async function getCheckoutBalanceWarning(
  reservationId: string
): Promise<ActionResult<{
  hasUnpaidBalance: boolean;
  totalOwed: number;
  totalPaid: number;
  balance: number;
  restaurantCharges: number;
  restaurantCount: number;
}>> {
  try {
    const charges = await prisma.transaction.aggregate({
      where: {
        reservationId,
        status: "ACTIVE",
        type: { notIn: ["PAYMENT", "DEPOSIT", "VOID", "REFUND"] },
      },
      _sum: { amount: true },
    });
    const payments = await prisma.transaction.aggregate({
      where: {
        reservationId,
        status: "ACTIVE",
        type: { in: ["PAYMENT", "DEPOSIT"] },
      },
      _sum: { amount: true },
    });
    const restaurant = await prisma.transaction.aggregate({
      where: {
        reservationId,
        status: "ACTIVE",
        OR: [
          { category: "F_B" },
          { type: { in: ["RESTAURANT", "GASTRONOMY", "POSTING"] } },
        ],
      },
      _sum: { amount: true },
      _count: true,
    });

    const totalOwed = Number(charges._sum.amount ?? 0);
    const totalPaid = Number(payments._sum.amount ?? 0);
    const balance = totalOwed - totalPaid;
    const restaurantCharges = Number(restaurant._sum.amount ?? 0);
    const restaurantCount = restaurant._count ?? 0;

    return {
      success: true,
      data: {
        hasUnpaidBalance: balance > 0,
        totalOwed: Math.round(totalOwed * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        restaurantCharges: Math.round(restaurantCharges * 100) / 100,
        restaurantCount,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd sprawdzania salda",
    };
  }
}
