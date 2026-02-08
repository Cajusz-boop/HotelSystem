"use server";

import { prisma } from "@/lib/db";
import type { ReservationStatus } from "@prisma/client";

export interface TapeChartReservation {
  id: string;
  guestName: string;
  room: string;
  checkIn: string;
  checkOut: string;
  status: string;
  pax?: number;
  rateCodeId?: string;
  rateCode?: string;
  rateCodeName?: string;
  rateCodePrice?: number;
}

export interface TapeChartRoom {
  number: string;
  type: string;
  status: string;
  price?: number;
  reason?: string;
}

export interface TapeChartData {
  reservations: TapeChartReservation[];
  rooms: TapeChartRoom[];
}

/** Format daty YYYY-MM-DD w UTC – spójnie z MySQL DATE */
function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Dane do Command Palette: goście (z pierwszą rezerwacją dla "Pokaż na grafiku") i pokoje */
export async function getCommandPaletteData(): Promise<{
  guests: { id: string; name: string; reservationId?: string }[];
  rooms: { number: string; type: string }[];
}> {
  const [guests, rooms] = await Promise.all([
    prisma.guest.findMany({
      take: 100,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        reservations: {
          orderBy: { checkIn: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    }),
    prisma.room.findMany({ orderBy: { number: "asc" }, select: { number: true, type: true } }),
  ]);
  return {
    guests: guests.map((g) => ({
      id: g.id,
      name: g.name,
      reservationId: g.reservations[0]?.id,
    })),
    rooms: rooms.map((r) => ({ number: r.number, type: r.type })),
  };
}

function mapReservationToTapeChart(r: {
  id: string;
  guest: { name: string };
  room: { number: string };
  checkIn: Date;
  checkOut: Date;
  status: string;
  pax: number | null;
  rateCode?: { id: string; code: string; name: string; price: unknown } | null;
}) {
  return {
    id: r.id,
    guestName: r.guest.name,
    room: r.room.number,
    checkIn: formatDate(r.checkIn),
    checkOut: formatDate(r.checkOut),
    status: r.status as string,
    pax: r.pax ?? undefined,
    rateCodeId: r.rateCode?.id ?? undefined,
    rateCode: r.rateCode?.code ?? undefined,
    rateCodeName: r.rateCode?.name ?? undefined,
    rateCodePrice: r.rateCode?.price != null ? Number(r.rateCode.price) : undefined,
  };
}

/** Pobiera dane do Tape Chart: rezerwacje i pokoje. Działa także gdy w bazie brak RateCode / rateCodeId (stary schemat). */
export async function getTapeChartData(): Promise<TapeChartData> {
  let reservations: Array<{
    id: string;
    guest: { name: string };
    room: { number: string };
    checkIn: Date;
    checkOut: Date;
    status: string;
    pax: number | null;
    rateCode?: { id: string; code: string; name: string; price: unknown } | null;
  }>;
  let rooms: Array<{ number: string; type: string; status: string; price: unknown; reason: string | null }>;

  try {
    const [resResult, roomResult] = await Promise.all([
      prisma.reservation.findMany({
        include: { guest: true, room: true, rateCode: true },
        orderBy: { checkIn: "asc" },
      }),
      prisma.room.findMany({
        where: { activeForSale: true },
        orderBy: { number: "asc" },
      }),
    ]);
    reservations = resResult;
    rooms = roomResult;
  } catch {
    try {
      const [resResult, roomResult] = await Promise.all([
        prisma.reservation.findMany({
          include: { guest: true, room: true },
          orderBy: { checkIn: "asc" },
        }),
        prisma.room.findMany({ orderBy: { number: "asc" } }),
      ]);
      reservations = resResult as typeof reservations;
      rooms = roomResult;
    } catch (e) {
      throw e;
    }
  }

  return {
    reservations: reservations.map(mapReservationToTapeChart),
    rooms: rooms.map((r) => ({
      number: r.number,
      type: r.type,
      status: r.status as string,
      price: r.price != null ? Number(r.price) : undefined,
      reason: r.reason ?? undefined,
    })),
  };
}
