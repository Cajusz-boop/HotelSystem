"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { getEffectivePropertyId } from "@/app/actions/properties";
import { getCennikForDate, getEffectivePriceForRoomOnDate } from "@/app/actions/rooms";
import { createReservation } from "@/app/actions/reservations";
import { sendReservationConfirmation, sendReservationConfirmationWithTemplate, sendBookingRequestNotificationToHotel } from "@/app/actions/mailing";
import { getReceptionEmailForBooking } from "@/app/actions/hotel-config";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// --- Typy dla rozbudowanego Booking Engine ---

export type BookingPriceBreakdown = {
  basePrice: number;
  adultPrice: number;
  adultCount: number;
  childPrices: Array<{ age: number; group: string; label: string; price: number }>;
  nightlyTotal: number;
  nights: number;
  subtotal: number;
  mealOptions: Array<{ plan: string; label: string; pricePerPerson: number; total: number }>;
  promoDiscount: number;
  grandTotal: number;
};

export type BookingRestrictions = {
  minStay: number | null;
  maxStay: number | null;
  isNonRefundable: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
};

export type BookingRoomType = {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  translations: unknown;
  maxOccupancy: number | null;
  bedsDescription: string | null;
  features: string;
  available: number;
  priceBreakdown: BookingPriceBreakdown;
  restrictions: BookingRestrictions;
};

/** Dostępność i ceny dla Booking Engine: zakres dat, opcjonalnie typ pokoju. */
export async function getBookingAvailability(
  checkIn: string,
  checkOut: string,
  roomType?: string
): Promise<
  ActionResult<
    Array<{ roomNumber: string; type: string; pricePerNight: number; totalNights: number; totalAmount: number }>
  >
> {
  const from = new Date(checkIn + "T00:00:00Z");
  const to = new Date(checkOut + "T00:00:00Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return { success: false, error: "Nieprawidłowy zakres dat" };
  }
  const propertyId = await getEffectivePropertyId();
  const rooms = await prisma.room.findMany({
    where: {
      ...(propertyId ? { propertyId } : {}),
      activeForSale: true,
      isDeleted: false,
      ...(roomType ? { type: roomType } : {}),
    },
    select: { id: true, number: true, type: true },
    orderBy: { number: "asc" },
  });
  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
      checkIn: { lt: to },
      checkOut: { gt: from },
    },
    select: { roomId: true },
  });
  const occupiedIds = new Set(reservations.map((r: (typeof reservations)[number]) => r.roomId));
  const available = rooms.filter((r: (typeof rooms)[number]) => !occupiedIds.has(r.id));
  const nights = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  const result: Array<{
    roomNumber: string;
    type: string;
    pricePerNight: number;
    totalNights: number;
    totalAmount: number;
  }> = [];
  const cennikRes = await getCennikForDate(checkIn);
  const priceByRoom = new Map<string, number>();
  if (cennikRes.success && cennikRes.data) {
    for (const r of cennikRes.data) {
      if (r.price != null) priceByRoom.set(r.number, r.price);
    }
  }
  for (const r of available) {
    const pricePerNight = priceByRoom.get(r.number) ?? 0;
    result.push({
      roomNumber: r.number,
      type: r.type,
      pricePerNight,
      totalNights: nights,
      totalAmount: pricePerNight * nights,
    });
  }
  return { success: true, data: result };
}

/** Typy pokoi do wyboru w formularzu (unikalne z aktywnych) – lista nazw. */
export async function getRoomTypesForBooking(): Promise<ActionResult<Array<{ type: string }>>> {
  const propertyId = await getEffectivePropertyId();
  const rooms = await prisma.room.findMany({
    where: { ...(propertyId ? { propertyId } : {}), activeForSale: true, isDeleted: false },
    select: { type: true },
    distinct: ["type"],
    orderBy: { type: "asc" },
  });
  return { success: true, data: rooms.map((r: (typeof rooms)[number]) => ({ type: r.type })) };
}

/** Zwraca typy pokoi z pełnym rozbiciem cen (daty, dorośli, dzieci, plany wyżywienia, restrykcje). */
export async function getRoomTypesForBookingWithPrices(params: {
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  childAges?: number[];
  promoCode?: string;
}): Promise<ActionResult<BookingRoomType[]>> {
  const from = new Date(params.checkIn + "T00:00:00Z");
  const to = new Date(params.checkOut + "T00:00:00Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return { success: false, error: "Nieprawidłowy zakres dat" };
  }
  const propertyId = await getEffectivePropertyId();
  const nights = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  const adults = Math.max(0, params.adults);
  const childAges = params.childAges ?? (params.children ? Array(params.children).fill(0) : []);

  const [roomTypes, rooms, occupiedReservations, property, ageGroups, ratePlans] = await Promise.all([
    prisma.roomType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        photoUrl: true,
        translations: true,
        maxOccupancy: true,
        bedsDescription: true,
        basePrice: true,
      },
    }),
    prisma.room.findMany({
      where: { ...(propertyId ? { propertyId } : {}), activeForSale: true, isDeleted: false },
      select: { id: true, number: true, type: true, sellPriority: true, amenities: true },
      orderBy: [{ sellPriority: "asc" }, { number: "asc" }],
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      select: { roomId: true },
    }),
    propertyId ? prisma.property.findUnique({ where: { id: propertyId }, select: { mealPrices: true } }) : null,
    Promise.resolve([]) as Promise<{ group: string; label: string; ageFrom: number; ageTo: number }[]>,
    prisma.ratePlan.findMany({
      where: { validFrom: { lte: from }, validTo: { gte: from } },
      select: {
        roomTypeId: true,
        price: true,
        adultPrice: true,
        child1Price: true,
        child2Price: true,
        child3Price: true,
        minStayNights: true,
        maxStayNights: true,
        isNonRefundable: true,
        closedToArrival: true,
        closedToDeparture: true,
      },
    }),
  ]);

  const occupiedRoomIds = new Set(occupiedReservations.map((r) => r.roomId));
  const mealPrices = (property?.mealPrices as { breakfast?: number; lunch?: number; dinner?: number }) ?? {};
  const breakfastPrice = mealPrices.breakfast ?? 50;
  const lunchPrice = mealPrices.lunch ?? 80;
  const _dinnerPrice = mealPrices.dinner ?? 80;

  const defaultAgeLabels: Record<string, string> = {
    ADULT: "Dorosły",
    CHILD1: "Dziecko 0-6",
    CHILD2: "Dziecko 7-12",
    CHILD3: "Dziecko 13-17",
  };

  const result: BookingRoomType[] = [];

  for (const rt of roomTypes) {
    const roomsOfType = rooms.filter((r) => r.type === rt.name);
    const availableRooms = roomsOfType.filter((r) => !occupiedRoomIds.has(r.id));
    if (availableRooms.length === 0) continue;

    const firstRoomNumber = availableRooms[0].number;
    let nightlyBase = 0;
    for (let d = 0; d < nights; d++) {
      const dStr = new Date(from);
      dStr.setUTCDate(dStr.getUTCDate() + d);
      const dateStr = dStr.toISOString().slice(0, 10);
      const p = await getEffectivePriceForRoomOnDate(firstRoomNumber, dateStr);
      nightlyBase += p ?? Number(rt.basePrice) ?? 0;
    }
    const basePricePerNight = nights > 0 ? nightlyBase / nights : Number(rt.basePrice) ?? 0;

    const plan = ratePlans.find((p) => p.roomTypeId === rt.id);
    const adultPrice = plan?.adultPrice != null ? Number(plan.adultPrice) : Math.round(basePricePerNight * 0.4);
    const child1Price = plan?.child1Price != null ? Number(plan.child1Price) : 0;
    const child2Price = plan?.child2Price != null ? Number(plan.child2Price) : Math.round(adultPrice * 0.5);
    const child3Price = plan?.child3Price != null ? Number(plan.child3Price) : Math.round(adultPrice * 0.7);

    const childPrices = childAges.map((age) => {
      let group = "CHILD1";
      let price = child1Price;
      if (age >= 13) {
        group = "CHILD3";
        price = child3Price;
      } else if (age >= 7) {
        group = "CHILD2";
        price = child2Price;
      }
      const label = ageGroups.find((g) => g.group === group)?.label ?? defaultAgeLabels[group] ?? group;
      return { age, group, label, price };
    });

    const nightlyTotal =
      basePricePerNight + adults * adultPrice + childPrices.reduce((s, c) => s + c.price, 0);
    const subtotal = Math.round(nightlyTotal * nights);
    const pax = adults + childPrices.length;
    const mealOptions = [
      { plan: "RO", label: "Bez wyżywienia", pricePerPerson: 0, total: 0 },
      { plan: "BB", label: "Śniadanie", pricePerPerson: breakfastPrice, total: pax * breakfastPrice * nights },
      {
        plan: "HB",
        label: "Śniadanie + obiad",
        pricePerPerson: breakfastPrice + lunchPrice,
        total: pax * (breakfastPrice + lunchPrice) * nights,
      },
    ];
    const grandTotal = subtotal;

    const features =
      (availableRooms[0].amenities as string[] | null)?.join(", ") ??
      rt.description ??
      "TV, WiFi, łazienka";

    result.push({
      id: rt.id,
      name: rt.name,
      description: rt.description,
      photoUrl: rt.photoUrl,
      translations: rt.translations,
      maxOccupancy: rt.maxOccupancy,
      bedsDescription: rt.bedsDescription,
      features,
      available: availableRooms.length,
      priceBreakdown: {
        basePrice: Math.round(basePricePerNight),
        adultPrice,
        adultCount: adults,
        childPrices,
        nightlyTotal: Math.round(nightlyTotal),
        nights,
        subtotal,
        mealOptions,
        promoDiscount: 0,
        grandTotal,
      },
      restrictions: {
        minStay: plan?.minStayNights ?? 1,
        maxStay: plan?.maxStayNights ?? null,
        isNonRefundable: plan?.isNonRefundable ?? false,
        closedToArrival: plan?.closedToArrival ?? false,
        closedToDeparture: plan?.closedToDeparture ?? false,
      },
    });
  }

  return { success: true, data: result };
}

/** Znajduje wolny pokój danego typu (po nazwie typu) w podanym okresie. */
async function findAvailableRoomByTypeName(
  roomTypeName: string,
  checkIn: string,
  checkOut: string
): Promise<string | null> {
  const from = new Date(checkIn + "T00:00:00Z");
  const to = new Date(checkOut + "T00:00:00Z");
  const propertyId = await getEffectivePropertyId();
  const [rooms, occupied] = await Promise.all([
    prisma.room.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        type: roomTypeName,
        activeForSale: true,
        isDeleted: false,
      },
      select: { id: true, number: true, sellPriority: true },
      orderBy: [{ sellPriority: "asc" }, { number: "asc" }],
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      select: { roomId: true },
    }),
  ]);
  const occupiedIds = new Set(occupied.map((r) => r.roomId));
  const available = rooms.find((r) => !occupiedIds.has(r.id));
  return available?.number ?? null;
}

const MAX_BOOKING_DAYS = 365;
const _ADVANCE_PERCENT = 30;

/** Złożenie rezerwacji z Booking Engine – rozbudowana wersja (typ pokoju, plan wyżywienia, płatność). */
export async function submitBookingFromEngine(params: {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  childAges?: number[];
  mealPlan: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCountry?: string;
  notes?: string;
  marketingConsent?: boolean;
  promoCode?: string;
  bookingType: "INSTANT" | "REQUEST";
  paymentIntent: "FULL" | "ADVANCE" | "NONE";
  totalAmount: number;
}): Promise<
  ActionResult<{
    reservationId: string;
    confirmationNumber: string;
    totalAmount: number;
    paymentLink?: string;
    checkInLink?: string;
    message: string;
  }>
> {
  const name = params.guestName?.trim();
  if (!name) return { success: false, error: "Imię i nazwisko jest wymagane." };
  if (!params.guestEmail?.trim()) return { success: false, error: "Adres e-mail jest wymagany." };
  if (!params.guestPhone?.trim()) return { success: false, error: "Numer telefonu jest wymagany." };

  const from = new Date(params.checkIn + "T00:00:00Z");
  const to = new Date(params.checkOut + "T00:00:00Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy format dat (oczekiwano YYYY-MM-DD)." };
  }
  if (to <= from) {
    return { success: false, error: "Data wymeldowania musi być po dacie zameldowania." };
  }
  const nights = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (nights > MAX_BOOKING_DAYS) {
    return { success: false, error: `Maksymalna długość rezerwacji to ${MAX_BOOKING_DAYS} dni.` };
  }

  const roomType = await prisma.roomType.findUnique({
    where: { id: params.roomTypeId },
    select: { name: true },
  });
  if (!roomType) return { success: false, error: "Wybrany typ pokoju nie istnieje." };

  const roomNumber = await findAvailableRoomByTypeName(roomType.name, params.checkIn, params.checkOut);
  if (!roomNumber) {
    return { success: false, error: "Brak dostępnych pokoi tego typu w podanym okresie. Wybierz inne daty." };
  }

  const status = params.bookingType === "REQUEST" ? "PENDING" : "CONFIRMED";
  const pax = (params.adults ?? 0) + (params.children ?? 0);

  const res = await createReservation({
    guestName: name,
    guestEmail: params.guestEmail.trim(),
    guestPhone: params.guestPhone.trim(),
    room: roomNumber,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    status: status as "PENDING" | "CONFIRMED",
    source: "WEBSITE",
    channel: "DIRECT",
    mealPlan: (params.mealPlan || null) as "RO" | "BB" | "HB" | "FB" | "AI" | "BB_PLUS" | "HB_PLUS" | "UAI" | null | undefined,
    adults: params.adults ?? null,
    children: params.children ?? null,
    childrenAges: params.childAges?.length ? params.childAges : null,
    pax: pax || undefined,
    notes: params.notes?.trim() || null,
  });
  if (!res.success) return res;

  const data = res.data as { id: string; confirmationNumber?: string; guestId?: string };
  const guestId = data.guestId;

  if (guestId) {
    try {
      await prisma.guest.update({
        where: { id: guestId },
        data: {
          ...(params.guestCountry?.trim() && { country: params.guestCountry.trim() }),
          gdprDataProcessingConsent: true,
          gdprDataProcessingDate: new Date(),
          gdprMarketingConsent: params.marketingConsent ?? false,
          ...(params.marketingConsent && { gdprMarketingConsentDate: new Date() }),
        },
      });
    } catch (e) {
      console.error("[submitBookingFromEngine] Guest update:", e);
    }
  }

  const headersList = await headers();
  await createAuditLog({
    actionType: "CREATE",
    entityType: "BookingEngine",
    entityId: data.id,
    newValue: {
      guestName: name,
      roomNumber,
      roomTypeId: params.roomTypeId,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      bookingType: params.bookingType,
      paymentIntent: params.paymentIntent,
    },
    ipAddress: getClientIp(headersList),
  });

  // Link do płatności tworzony na kroku 4 (payment-step), gdy gość wybierze pełną kwotę lub zaliczkę
  const paymentLinkUrl: string | undefined = undefined;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const checkInLink = baseUrl ? `${baseUrl.replace(/\/$/, "")}/check-in/guest/${data.id}` : undefined;

  try {
    const sendResult = await sendReservationConfirmationWithTemplate(data.id);
    if (!sendResult.success && sendResult.error) {
      console.error("[submitBookingFromEngine] sendReservationConfirmationWithTemplate:", sendResult.error);
    }
  } catch (e) {
    console.error("[submitBookingFromEngine] send confirmation:", e);
  }

  const message =
    status === "PENDING"
      ? "Dziękujemy! Twoje zapytanie zostało wysłane. Odpowiemy w ciągu 24 godzin."
      : "Rezerwacja została złożona. Oczekuj na potwierdzenie e-mailem.";

  return {
    success: true,
    data: {
      reservationId: data.id,
      confirmationNumber: data.confirmationNumber ?? "",
      totalAmount: params.totalAmount,
      paymentLink: paymentLinkUrl,
      checkInLink,
      message,
    },
  };
}

/** Złożenie rezerwacji z Booking Engine – wersja uproszczona (wybór po numerze pokoju, backward compatible). */
export async function submitBookingFromEngineSimple(
  guestName: string,
  email: string,
  phone: string,
  roomNumber: string,
  checkIn: string,
  checkOut: string
): Promise<ActionResult<{ reservationId: string; message: string }>> {
  const name = guestName?.trim();
  if (!name) return { success: false, error: "Imię i nazwisko jest wymagane." };

  const from = new Date(checkIn + "T00:00:00Z");
  const to = new Date(checkOut + "T00:00:00Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy format dat (oczekiwano YYYY-MM-DD)." };
  }
  if (to <= from) {
    return { success: false, error: "Data wymeldowania musi być po dacie zameldowania." };
  }
  const nights = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (nights > MAX_BOOKING_DAYS) {
    return { success: false, error: `Maksymalna długość rezerwacji to ${MAX_BOOKING_DAYS} dni.` };
  }

  const availability = await getBookingAvailability(checkIn, checkOut);
  if (!availability.success) return availability;
  const option = availability.data.find((o) => o.roomNumber === roomNumber);
  if (!option) {
    return { success: false, error: "Wybrany pokój nie jest już dostępny. Wybierz inne daty lub pokój." };
  }

  const res = await createReservation({
    guestName: name,
    room: roomNumber,
    checkIn,
    checkOut,
    status: "CONFIRMED",
  });
  if (!res.success) return res;
  const data = res.data as { id: string; guestId?: string };
  if (data.guestId && (email?.trim() || phone?.trim())) {
    try {
      await prisma.guest.update({
        where: { id: data.guestId },
        data: {
          ...(email?.trim() && { email: email.trim() }),
          ...(phone?.trim() && { phone: phone.trim() }),
        },
      });
    } catch (e) {
      console.error("[submitBookingFromEngineSimple] Guest update:", e);
    }
  }

  const headersList = await headers();
  await createAuditLog({
    actionType: "CREATE",
    entityType: "BookingEngine",
    entityId: data.id,
    newValue: { guestName: name, roomNumber, checkIn, checkOut, source: "BOOKING_ENGINE" },
    ipAddress: getClientIp(headersList),
  });

  const confirmationResult = await sendReservationConfirmation(data.id);
  const message = confirmationResult.success
    ? "Rezerwacja została złożona. Oczekuj na potwierdzenie e-mailem."
    : "Rezerwacja została złożona." + (email?.trim() ? " Nie udało się wysłać potwierdzenia e-mailem." : "");

  return {
    success: true,
    data: { reservationId: data.id, message },
  };
}

/** Rezerwacja na zapytanie („Zapytaj o dostępność”) – tworzy rezerwację PENDING i wysyła maile. */
export async function submitBookingRequest(params: {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  message: string;
}): Promise<ActionResult<{ requestId: string; message: string }>> {
  const roomType = await prisma.roomType.findUnique({
    where: { id: params.roomTypeId },
    select: { name: true },
  });
  if (!roomType) return { success: false, error: "Wybrany typ pokoju nie istnieje." };

  const roomNumber = await findAvailableRoomByTypeName(roomType.name, params.checkIn, params.checkOut);
  if (!roomNumber) {
    return { success: false, error: "Brak dostępnych pokoi tego typu. Nasz zespół sprawdzi alternatywy i odpowie." };
  }

  const res = await createReservation({
    guestName: params.guestName.trim(),
    guestEmail: params.guestEmail.trim(),
    guestPhone: params.guestPhone.trim(),
    room: roomNumber,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    status: "PENDING",
    source: "WEBSITE",
    channel: "DIRECT",
    notes: params.message?.trim() || null,
    adults: params.adults ?? null,
    children: params.children ?? null,
  });
  if (!res.success) return res;

  const data = res.data as { id: string; guestId?: string };
  if (data.guestId) {
    try {
      await prisma.guest.update({
        where: { id: data.guestId },
        data: { gdprDataProcessingConsent: true, gdprDataProcessingDate: new Date() },
      });
    } catch (e) {
      console.error("[submitBookingRequest] Guest update:", e);
    }
  }

  const headersList = await headers();
  await createAuditLog({
    actionType: "CREATE",
    entityType: "BookingEngine",
    entityId: data.id,
    newValue: { type: "REQUEST", guestName: params.guestName, roomTypeId: params.roomTypeId, checkIn: params.checkIn, checkOut: params.checkOut },
    ipAddress: getClientIp(headersList),
  });

  try {
    await sendReservationConfirmation(data.id);
  } catch (e) {
    console.error("[submitBookingRequest] send confirmation:", e);
  }

  const receptionEmail = await getReceptionEmailForBooking();
  if (receptionEmail) {
    try {
      await sendBookingRequestNotificationToHotel(receptionEmail, {
        guestName: params.guestName,
        guestEmail: params.guestEmail,
        guestPhone: params.guestPhone,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        roomTypeName: roomType.name,
        message: params.message?.trim() || undefined,
      });
    } catch (e) {
      console.error("[submitBookingRequest] send notification to hotel:", e);
    }
  }

  return {
    success: true,
    data: {
      requestId: data.id,
      message: "Dziękujemy! Twoje zapytanie zostało wysłane. Odpowiemy w ciągu 24 godzin.",
    },
  };
}
