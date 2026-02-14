"use server";

import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Raport GUS (uproszczony): liczba noclegów, gości w okresie – do eksportu CSV. */
export async function getGusReport(
  dateFrom: string,
  dateTo: string
): Promise<
  ActionResult<{
    dateFrom: string;
    dateTo: string;
    totalNights: number;
    totalGuests: number;
    rows: Array<{ date: string; nights: number; guests: number }>;
  }>
> {
  try {
    const from = new Date(dateFrom + "T00:00:00Z");
    const to = new Date(dateTo + "T23:59:59Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
        checkIn: { lte: to },
        checkOut: { gt: from },
      },
      include: { guest: true },
    });
    let totalNights = 0;
    let totalGuests = 0;
    const dayMap = new Map<string, { nights: number; guests: number }>();
    for (const r of reservations) {
      const checkIn = new Date(r.checkIn);
      const checkOut = new Date(r.checkOut);
      const start = checkIn < from ? from : checkIn;
      const end = checkOut > to ? to : checkOut;
      const nights = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
      const pax = r.pax ?? 1;
      totalNights += nights;
      totalGuests += nights * pax;
      const d = new Date(start);
      while (d < end) {
        const key = d.toISOString().slice(0, 10);
        const prev = dayMap.get(key) ?? { nights: 0, guests: 0 };
        dayMap.set(key, { nights: prev.nights + 1, guests: prev.guests + pax });
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }
    const rows = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, { nights, guests }]) => ({ date, nights, guests }));
    return {
      success: true,
      data: {
        dateFrom,
        dateTo,
        totalNights,
        totalGuests,
        rows,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu GUS",
    };
  }
}

/** Raport policyjny / Straż Graniczna (melding gości, dane cudzoziemców): lista gości zameldowanych na daną datę, z polami dokumentu i obywatelstwa. */
export type PoliceReportRow = {
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  nationality: string | null;
  documentType: string | null;
  documentNumber: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  country: string | null;
};

export async function getPoliceReport(
  dateStr: string
): Promise<ActionResult<PoliceReportRow[]>> {
  try {
    const date = new Date(dateStr + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Nieprawidłowa data" };
    }
    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lte: date },
        checkOut: { gt: date },
      },
      include: { guest: true, room: true },
    });
    const data: PoliceReportRow[] = reservations.map((r) => ({
      guestName: r.guest.name,
      roomNumber: r.room.number,
      checkIn: r.checkIn.toISOString().slice(0, 10),
      checkOut: r.checkOut.toISOString().slice(0, 10),
      nationality: r.guest.nationality ?? null,
      documentType: r.guest.documentType ?? null,
      documentNumber: r.guest.documentNumber ?? null,
      dateOfBirth: r.guest.dateOfBirth ? r.guest.dateOfBirth.toISOString().slice(0, 10) : null,
      placeOfBirth: r.guest.placeOfBirth ?? null,
      country: r.guest.country ?? null,
    }));
    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu policyjnego",
    };
  }
}
