"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createWebCheckInLink(
  reservationId: string
): Promise<ActionResult<{ url: string; token: string; expiresAt: string }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    if (reservation.status !== "CONFIRMED") {
      return { success: false, error: "Link Web Check-in tylko dla rezerwacji potwierdzonych" };
    }
    const { randomBytes } = await import("crypto");
    const token = randomBytes(16).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const tokenRecord = await prisma.webCheckInToken.create({
      data: { reservationId, token, expiresAt },
    });
    
    // Audit log dla wygenerowania linku Web Check-in
    await createAuditLog({
      actionType: "CREATE",
      entityType: "WebCheckInToken",
      entityId: tokenRecord.id,
      newValue: {
        reservationId,
        expiresAt: expiresAt.toISOString(),
        guestName: reservation.guest.name,
        roomNumber: reservation.room.number,
        checkIn: reservation.checkIn.toISOString().slice(0, 10),
      },
    });
    
    revalidatePath("/reports");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? "";
    const url = baseUrl
      ? `${baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`}/check-in/guest/${token}`
      : `/check-in/guest/${token}`;
    return {
      success: true,
      data: { url, token, expiresAt: expiresAt.toISOString() },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania linku Web Check-in",
    };
  }
}

export async function getWebCheckInByToken(token: string): Promise<
  ActionResult<{
    reservationId: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    roomNumber: string;
  }>
> {
  try {
    const row = await prisma.webCheckInToken.findUnique({
      where: { token },
      include: { reservation: { include: { guest: true, room: true } } },
    });
    if (!row) return { success: false, error: "Link nie istnieje lub wygasł" };
    if (new Date() > row.expiresAt) return { success: false, error: "Link wygasł" };
    if (row.reservation.status !== "CONFIRMED") {
      return { success: false, error: "Rezerwacja została już wykorzystana lub anulowana" };
    }
    const r = row.reservation;
    return {
      success: true,
      data: {
        reservationId: r.id,
        guestName: r.guest.name,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
        roomNumber: r.room.number,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu",
    };
  }
}

/** Zdalne podpisanie karty meldunkowej i meldunek (status → CHECKED_IN). */
export async function completeWebCheckIn(
  token: string,
  signatureDataUrl: string
): Promise<ActionResult<{ reservationId: string }>> {
  try {
    const row = await prisma.webCheckInToken.findUnique({
      where: { token },
      include: { 
        reservation: { 
          include: { 
            guest: true, 
            room: true 
          } 
        } 
      },
    });
    if (!row) return { success: false, error: "Link nie istnieje lub wygasł" };
    if (new Date() > row.expiresAt) return { success: false, error: "Link wygasł" };
    if (row.reservation.status !== "CONFIRMED") {
      return { success: false, error: "Rezerwacja została już wykorzystana lub anulowana" };
    }
    
    const previousStatus = row.reservation.status;
    const checkInTime = new Date();
    
    await prisma.reservation.update({
      where: { id: row.reservationId },
      data: {
        status: "CHECKED_IN",
        webCheckInSignedAt: checkInTime,
        webCheckInSignature: signatureDataUrl
          ? ({ dataUrl: signatureDataUrl.slice(0, 50000) } as object)
          : undefined,
      },
    });
    
    // Audit log dla meldunku przez Web Check-in
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Reservation",
      entityId: row.reservationId,
      oldValue: {
        status: previousStatus,
        webCheckInSignedAt: null,
      },
      newValue: {
        status: "CHECKED_IN",
        webCheckInSignedAt: checkInTime.toISOString(),
        checkInMethod: "WEB_CHECK_IN",
        guestName: row.reservation.guest.name,
        roomNumber: row.reservation.room.number,
      },
      // Brak userId - meldunek przez gościa (self-service)
      ipAddress: null,
    });
    
    revalidatePath("/reports");
    return { success: true, data: { reservationId: row.reservationId } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd meldunku",
    };
  }
}
