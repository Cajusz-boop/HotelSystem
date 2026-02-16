"use server";

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface KioskReservation {
  id: string;
  guestName: string;
  guestFirstName: string;
  guestLastName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomNumber: string;
  roomType: string;
  adults: number;
  children: number;
  status: string;
  notes: string | null;
  isToday: boolean;
}

/**
 * Szuka rezerwacji po nazwisku, numerze potwierdzenia lub ID.
 * Zwraca tylko rezerwacje kwalifikujące się do check-in (dziś lub jutro).
 */
export async function searchKioskReservation(
  query: string
): Promise<ActionResult<KioskReservation[]>> {
  try {
    if (!query || query.trim().length < 2) {
      return { success: false, error: "Podaj minimum 2 znaki" };
    }
    
    const searchTerm = query.trim();
    
    // Pobierz dzisiejszą datę
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Pobierz jutrzejszą datę (dla early check-in)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    // Szukaj rezerwacji gdzie:
    // - check-in jest dziś lub jutro
    // - status CONFIRMED (nie zameldowany jeszcze)
    // - pasuje nazwisko, ID lub numer rezerwacji
    const reservations = await prisma.reservation.findMany({
      where: {
        status: "CONFIRMED",
        checkIn: {
          gte: today,
          lt: dayAfterTomorrow,
        },
        OR: [
          { guest: { name: { contains: searchTerm } } },
          { id: { contains: searchTerm } },
          { id: { startsWith: searchTerm.toLowerCase() } },
        ],
      },
      include: {
        guest: true,
        room: true,
      },
      take: 10,
      orderBy: { checkIn: "asc" },
    });
    
    const results: KioskReservation[] = reservations.map((r) => {
      const checkInDate = new Date(r.checkIn);
      checkInDate.setHours(0, 0, 0, 0);
      const checkOutDate = new Date(r.checkOut);
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const nameParts = r.guest.name.trim().split(/\s+/);
      const guestFirstName = nameParts[0] ?? "";
      const guestLastName = nameParts.slice(1).join(" ") || "";
      return {
        id: r.id,
        guestName: r.guest.name,
        guestFirstName,
        guestLastName,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
        nights,
        roomNumber: r.room.number,
        roomType: r.room.type,
        adults: r.adults ?? 0,
        children: r.children ?? 0,
        status: r.status,
        notes: r.notes,
        isToday: checkInDate.getTime() === today.getTime(),
      };
    });
    
    return { success: true, data: results };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania rezerwacji",
    };
  }
}

/**
 * Pobiera szczegóły rezerwacji dla kiosku.
 */
export async function getKioskReservationById(
  reservationId: string
): Promise<ActionResult<KioskReservation & { guestEmail: string | null; guestPhone: string | null }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        room: true,
      },
    });
    
    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }
    
    if (reservation.status !== "CONFIRMED") {
      return { success: false, error: "Rezerwacja nie jest dostępna do meldunku" };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    const checkInDate = new Date(reservation.checkIn);
    checkInDate.setHours(0, 0, 0, 0);
    
    // Sprawdź czy check-in jest dziś lub jutro
    if (checkInDate < today || checkInDate >= dayAfterTomorrow) {
      return { success: false, error: "Meldunek możliwy tylko w dniu przyjazdu lub dzień wcześniej" };
    }
    
    const checkOutDate = new Date(reservation.checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    const nameParts = reservation.guest.name.trim().split(/\s+/);
    const guestFirstName = nameParts[0] ?? "";
    const guestLastName = nameParts.slice(1).join(" ") || "";
    return {
      success: true,
      data: {
        id: reservation.id,
        guestName: reservation.guest.name,
        guestFirstName,
        guestLastName,
        guestEmail: reservation.guest.email,
        guestPhone: reservation.guest.phone,
        checkIn: reservation.checkIn.toISOString().slice(0, 10),
        checkOut: reservation.checkOut.toISOString().slice(0, 10),
        nights,
        roomNumber: reservation.room.number,
        roomType: reservation.room.type,
        adults: reservation.adults ?? 0,
        children: reservation.children ?? 0,
        status: reservation.status,
        notes: reservation.notes,
        isToday: checkInDate.getTime() === today.getTime(),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania rezerwacji",
    };
  }
}

/**
 * Wykonuje check-in przez kiosk.
 * Zapisuje podpis cyfrowy i zmienia status na CHECKED_IN.
 */
export async function kioskCheckIn(
  reservationId: string,
  signatureDataUrl?: string
): Promise<ActionResult<{ roomNumber: string; checkOutDate: string }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        room: true,
      },
    });
    
    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }
    
    if (reservation.status !== "CONFIRMED") {
      return { success: false, error: "Rezerwacja nie jest dostępna do meldunku" };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    const checkInDate = new Date(reservation.checkIn);
    checkInDate.setHours(0, 0, 0, 0);
    
    // Sprawdź czy check-in jest dziś lub jutro
    if (checkInDate < today || checkInDate >= dayAfterTomorrow) {
      return { success: false, error: "Meldunek możliwy tylko w dniu przyjazdu lub dzień wcześniej" };
    }
    
    const previousStatus = reservation.status;
    const checkInTime = new Date();
    
    // Aktualizuj rezerwację
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CHECKED_IN",
        kioskCheckInAt: checkInTime,
        kioskSignature: signatureDataUrl
          ? ({ dataUrl: signatureDataUrl.slice(0, 50000) } as object)
          : undefined,
      },
    });
    
    // Audit log
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Reservation",
      entityId: reservationId,
      oldValue: {
        status: previousStatus,
        kioskCheckInAt: null,
      },
      newValue: {
        status: "CHECKED_IN",
        kioskCheckInAt: checkInTime.toISOString(),
        checkInMethod: "KIOSK",
        guestName: reservation.guest.name,
        roomNumber: reservation.room.number,
        hasSignature: !!signatureDataUrl,
      },
      // Brak userId - self-service kiosk
      ipAddress: null,
    });
    
    console.log(`[KIOSK] Check-in completed: ${reservation.guest.name} -> Room ${reservation.room.number}`);
    
    return {
      success: true,
      data: {
        roomNumber: reservation.room.number,
        checkOutDate: reservation.checkOut.toISOString().slice(0, 10),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd meldunku",
    };
  }
}

/**
 * Pobiera dzisiejsze statystyki dla kiosku (do ekranu głównego).
 */
export async function getKioskStats(): Promise<
  ActionResult<{
    arrivalsToday: number;
    checkedInToday: number;
    pendingCheckIns: number;
  }>
> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [arrivalsToday, checkedInToday] = await Promise.all([
      // Wszystkie rezerwacje z check-in dziś
      prisma.reservation.count({
        where: {
          checkIn: {
            gte: today,
            lt: tomorrow,
          },
          status: {
            in: ["CONFIRMED", "CHECKED_IN"],
          },
        },
      }),
      // Zameldowane dziś
      prisma.reservation.count({
        where: {
          checkIn: {
            gte: today,
            lt: tomorrow,
          },
          status: "CHECKED_IN",
        },
      }),
    ]);
    
    const pendingCheckIns = arrivalsToday - checkedInToday;
    
    return {
      success: true,
      data: {
        arrivalsToday,
        checkedInToday,
        pendingCheckIns,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statystyk",
    };
  }
}
