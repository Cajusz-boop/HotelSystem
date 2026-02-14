"use server";

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface GuestAppReservation {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomNumber: string;
  roomType: string;
  roomFloor: number;
  status: string;
  adults: number;
  children: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  specialRequests: string | null;
  // Digital key
  hasDigitalKey: boolean;
  digitalKeyCode: string | null;
  digitalKeyValidFrom: string | null;
  digitalKeyValidTo: string | null;
  // Timestamps
  webCheckInCompleted: boolean;
  kioskCheckInCompleted: boolean;
}

export interface GuestAppToken {
  id: string;
  token: string;
  guestId: string;
  guestName: string;
  guestEmail: string | null;
  expiresAt: Date;
  reservations: GuestAppReservation[];
}

/**
 * Generuje link dostępowy do aplikacji gościa.
 * Jeden link daje dostęp do wszystkich rezerwacji danego gościa.
 */
export async function createGuestAppLink(
  guestId: string
): Promise<ActionResult<{ url: string; token: string; expiresAt: string }>> {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });
    
    if (!guest) {
      return { success: false, error: "Gość nie istnieje" };
    }
    
    // Generuj token
    const { randomBytes } = await import("crypto");
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dni
    
    // Zapisz token
    const tokenRecord = await prisma.guestAppToken.create({
      data: {
        token,
        guestId,
        expiresAt,
      },
    });
    
    // Audit log
    await createAuditLog({
      actionType: "CREATE",
      entityType: "GuestAppToken",
      entityId: tokenRecord.id,
      newValue: {
        guestId,
        guestName: guest.name,
        expiresAt: expiresAt.toISOString(),
      },
    });
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? "";
    const url = baseUrl
      ? `${baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`}/guest-app/${token}`
      : `/guest-app/${token}`;
    
    return {
      success: true,
      data: { url, token, expiresAt: expiresAt.toISOString() },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania linku",
    };
  }
}

/**
 * Pobiera dane gościa i rezerwacje na podstawie tokena.
 */
export async function getGuestAppData(
  token: string
): Promise<ActionResult<GuestAppToken>> {
  try {
    const tokenRecord = await prisma.guestAppToken.findUnique({
      where: { token },
      include: {
        guest: {
          include: {
            reservations: {
              include: {
                room: true,
                transactions: true,
              },
              orderBy: { checkIn: "desc" },
            },
          },
        },
      },
    });
    
    if (!tokenRecord) {
      return { success: false, error: "Link nie istnieje lub wygasł" };
    }
    
    if (new Date() > tokenRecord.expiresAt) {
      return { success: false, error: "Link wygasł. Poproś o nowy link w recepcji." };
    }
    
    const guest = tokenRecord.guest;
    
    const reservations: GuestAppReservation[] = guest.reservations.map((r) => {
      const checkInDate = new Date(r.checkIn);
      const checkOutDate = new Date(r.checkOut);
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Oblicz płatności
      const totalAmount = Number(r.totalPrice || 0);
      const paidAmount = r.transactions
        .filter((t) => t.type === "PAYMENT" && t.status === "COMPLETED")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      // Klucz cyfrowy - sprawdź czy jest aktywny
      const digitalKey = r.digitalKeyCode as { code: string; validFrom: string; validTo: string } | null;
      const now = new Date();
      const hasValidKey = digitalKey && 
        new Date(digitalKey.validFrom) <= now && 
        new Date(digitalKey.validTo) >= now;
      
      return {
        id: r.id,
        guestName: guest.name,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
        nights,
        roomNumber: r.room.number,
        roomType: r.room.type,
        roomFloor: r.room.floor,
        status: r.status,
        adults: r.adults,
        children: r.children,
        totalAmount,
        paidAmount,
        balanceDue: totalAmount - paidAmount,
        specialRequests: r.specialRequests,
        hasDigitalKey: hasValidKey ?? false,
        digitalKeyCode: hasValidKey && digitalKey ? digitalKey.code : null,
        digitalKeyValidFrom: digitalKey?.validFrom ?? null,
        digitalKeyValidTo: digitalKey?.validTo ?? null,
        webCheckInCompleted: !!r.webCheckInSignedAt,
        kioskCheckInCompleted: !!r.kioskCheckInAt,
      };
    });
    
    return {
      success: true,
      data: {
        id: tokenRecord.id,
        token: tokenRecord.token,
        guestId: guest.id,
        guestName: guest.name,
        guestEmail: guest.email,
        expiresAt: tokenRecord.expiresAt,
        reservations,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania danych",
    };
  }
}

/**
 * Generuje klucz cyfrowy do pokoju.
 * Klucz jest ważny od dnia check-in do dnia check-out.
 */
export async function generateDigitalKey(
  reservationId: string,
  token: string
): Promise<ActionResult<{ code: string; validFrom: string; validTo: string }>> {
  try {
    // Weryfikuj token
    const tokenRecord = await prisma.guestAppToken.findUnique({
      where: { token },
      include: { guest: true },
    });
    
    if (!tokenRecord || new Date() > tokenRecord.expiresAt) {
      return { success: false, error: "Nieprawidłowy lub wygasły token" };
    }
    
    // Pobierz rezerwację
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true },
    });
    
    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }
    
    // Sprawdź czy rezerwacja należy do gościa
    if (reservation.guestId !== tokenRecord.guestId) {
      return { success: false, error: "Brak dostępu do tej rezerwacji" };
    }
    
    // Sprawdź status - klucz tylko dla CHECKED_IN lub CONFIRMED (w dniu przyjazdu)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(reservation.checkIn);
    checkInDate.setHours(0, 0, 0, 0);
    const checkOutDate = new Date(reservation.checkOut);
    checkOutDate.setHours(23, 59, 59, 999);
    
    const isActiveStay = today >= checkInDate && today <= checkOutDate;
    const canHaveKey = reservation.status === "CHECKED_IN" || 
      (reservation.status === "CONFIRMED" && isActiveStay);
    
    if (!canHaveKey) {
      return { success: false, error: "Klucz cyfrowy dostępny tylko podczas pobytu" };
    }
    
    // Generuj 6-cyfrowy kod
    const code = String(Math.floor(100000 + Math.random() * 900000));
    
    // Określ ważność klucza
    const validFrom = checkInDate.toISOString();
    const validTo = checkOutDate.toISOString();
    
    // Zapisz klucz w rezerwacji
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        digitalKeyCode: {
          code,
          validFrom,
          validTo,
          generatedAt: new Date().toISOString(),
        },
      },
    });
    
    // Audit log
    await createAuditLog({
      actionType: "CREATE",
      entityType: "DigitalKey",
      entityId: reservationId,
      newValue: {
        reservationId,
        guestName: reservation.guest.name,
        roomNumber: reservation.room.number,
        validFrom,
        validTo,
        generatedVia: "GUEST_APP",
      },
    });
    
    console.log(`[GUEST APP] Digital key generated for room ${reservation.room.number}`);
    
    return {
      success: true,
      data: { code, validFrom, validTo },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania klucza",
    };
  }
}

/**
 * Rejestruje żądanie pomocy / wiadomość do recepcji.
 */
export async function sendGuestMessage(
  token: string,
  reservationId: string,
  message: string,
  category: "REQUEST" | "PROBLEM" | "QUESTION" | "FEEDBACK"
): Promise<ActionResult<{ messageId: string }>> {
  try {
    // Weryfikuj token
    const tokenRecord = await prisma.guestAppToken.findUnique({
      where: { token },
      include: { guest: true },
    });
    
    if (!tokenRecord || new Date() > tokenRecord.expiresAt) {
      return { success: false, error: "Nieprawidłowy lub wygasły token" };
    }
    
    if (!message.trim()) {
      return { success: false, error: "Wiadomość nie może być pusta" };
    }
    
    // Pobierz rezerwację (opcjonalnie)
    let reservation = null;
    if (reservationId) {
      reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { room: true },
      });
      
      if (reservation && reservation.guestId !== tokenRecord.guestId) {
        return { success: false, error: "Brak dostępu do tej rezerwacji" };
      }
    }
    
    // Zapisz wiadomość (używamy internalNotes jako workaround bez osobnej tabeli)
    // W produkcji należałoby stworzyć tabelę GuestMessage
    const messageId = `msg-${Date.now()}`;
    
    await createAuditLog({
      actionType: "CREATE",
      entityType: "GuestMessage",
      entityId: messageId,
      newValue: {
        guestId: tokenRecord.guestId,
        guestName: tokenRecord.guest.name,
        reservationId: reservationId || null,
        roomNumber: reservation?.room.number ?? null,
        category,
        message: message.slice(0, 1000),
        sentAt: new Date().toISOString(),
        source: "GUEST_APP",
      },
    });
    
    console.log(`[GUEST APP] Message from ${tokenRecord.guest.name}: ${category}`);
    
    return { success: true, data: { messageId } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania wiadomości",
    };
  }
}

/**
 * Pobiera informacje o hotelu dla aplikacji gościa.
 */
export async function getHotelInfo(): Promise<ActionResult<{
  name: string;
  address: string;
  phone: string;
  email: string;
  checkInTime: string;
  checkOutTime: string;
  wifiName: string | null;
  wifiPassword: string | null;
  parkingInfo: string | null;
  restaurantHours: string | null;
}>> {
  // W produkcji pobierałoby z bazy/konfiguracji
  return {
    success: true,
    data: {
      name: process.env.HOTEL_NAME ?? "Hotel",
      address: process.env.HOTEL_ADDRESS ?? "ul. Przykładowa 1, 00-001 Warszawa",
      phone: process.env.HOTEL_PHONE ?? "+48 22 123 45 67",
      email: process.env.HOTEL_EMAIL ?? "recepcja@hotel.pl",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      wifiName: process.env.HOTEL_WIFI_SSID ?? "Hotel-Guest",
      wifiPassword: process.env.HOTEL_WIFI_PASSWORD ?? null,
      parkingInfo: "Parking podziemny -1, wjazd od ul. Bocznej",
      restaurantHours: "Śniadania: 7:00-10:00, Obiad: 12:00-15:00, Kolacja: 18:00-22:00",
    },
  };
}
