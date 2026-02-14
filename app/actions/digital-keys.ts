"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { isSaltoConfigured, createSaltoGuestKey } from "@/lib/salto";
import { isAssaAbloyConfigured, createAssaAbloyGuestKey } from "@/lib/assa-abloy";
import { isDormakabaConfigured, createDormakabaGuestKey } from "@/lib/dormakaba";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface GenerateRoomAccessCodeResult {
  code: string;
  validFrom: string;
  validTo: string;
  pushedToSalto?: boolean;
  pushedToAssaAbloy?: boolean;
  pushedToDormakaba?: boolean;
}

/**
 * Generuje kod dostępu do pokoju dla rezerwacji (wywołanie z recepcji / check-in).
 * Zapisuje w reservation.digitalKeyCode i opcjonalnie wysyła do skonfigurowanego systemu zamków.
 */
export async function generateRoomAccessCode(
  reservationId: string
): Promise<ActionResult<GenerateRoomAccessCodeResult>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }
    if (reservation.status !== "CONFIRMED" && reservation.status !== "CHECKED_IN") {
      return { success: false, error: "Kod dostępu można wygenerować tylko dla rezerwacji potwierdzonej lub zameldowanej" };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const checkInDate = new Date(reservation.checkIn);
    checkInDate.setUTCHours(0, 0, 0, 0);
    const checkOutDate = new Date(reservation.checkOut);
    checkOutDate.setUTCHours(23, 59, 59, 999);
    const validFrom = checkInDate.toISOString();
    const validTo = checkOutDate.toISOString();

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

    let pushedToSalto = false;
    let pushedToAssaAbloy = false;
    let pushedToDormakaba = false;

    if (isSaltoConfigured()) {
      const r = await createSaltoGuestKey({
        roomNumber: reservation.room.number,
        guestName: reservation.guest.name,
        validFrom: checkInDate,
        validTo: checkOutDate,
        reservationId,
      });
      if (r.success) pushedToSalto = true;
    }
    if (isAssaAbloyConfigured()) {
      const r = await createAssaAbloyGuestKey({
        roomNumber: reservation.room.number,
        guestName: reservation.guest.name,
        validFrom: checkInDate,
        validTo: checkOutDate,
        reservationId,
      });
      if (r.success) pushedToAssaAbloy = true;
    }
    if (isDormakabaConfigured()) {
      const r = await createDormakabaGuestKey({
        roomNumber: reservation.room.number,
        guestName: reservation.guest.name,
        validFrom: checkInDate,
        validTo: checkOutDate,
        reservationId,
      });
      if (r.success) pushedToDormakaba = true;
    }

    await createAuditLog({
      actionType: "CREATE",
      entityType: "DigitalKey",
      entityId: reservationId,
      newValue: {
        reservationId,
        roomNumber: reservation.room.number,
        validFrom,
        validTo,
        generatedVia: "STAFF",
      },
    });

    revalidatePath("/front-office");
    revalidatePath("/guest-app");
    return {
      success: true,
      data: {
        code,
        validFrom,
        validTo,
        pushedToSalto,
        pushedToAssaAbloy,
        pushedToDormakaba,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania kodu dostępu",
    };
  }
}
