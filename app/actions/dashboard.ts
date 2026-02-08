"use server";

import { prisma } from "@/lib/db";

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface ArrivalItem {
  id: string;
  guestName: string;
  room: string;
  checkIn: string;
  status: string;
}

export interface DashboardData {
  vipArrivals: ArrivalItem[];
  dirtyRooms: { number: string; type: string }[];
  oooRooms: { number: string; type: string; reason: string | null; updatedAt: string }[];
  todayCheckIns: ArrivalItem[];
}

/** Pobiera dane do Dashboardu: przyjazdy (dzisiaj/jutro), pokoje DIRTY, OOO */
export async function getDashboardData(): Promise<DashboardData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const todayStr = toDateOnly(today);
  const tomorrowStr = toDateOnly(tomorrow);

  const [arrivals, dirtyRooms, oooRooms] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { gte: today, lt: dayAfter },
      },
      include: { guest: true, room: true },
      orderBy: { checkIn: "asc" },
    }),
    prisma.room.findMany({
      where: { status: "DIRTY" },
      orderBy: { number: "asc" },
      select: { number: true, type: true },
    }),
    prisma.room.findMany({
      where: { status: "OOO" },
      orderBy: { updatedAt: "desc" },
      select: { number: true, type: true, reason: true, updatedAt: true },
    }),
  ]);

  const mapArrival = (r: {
    id: string;
    guest: { name: string };
    room: { number: string };
    checkIn: Date;
    status: string;
  }): ArrivalItem => ({
    id: r.id,
    guestName: r.guest.name,
    room: r.room.number,
    checkIn: toDateOnly(r.checkIn),
    status: r.status,
  });

  const vipArrivals = arrivals.map(mapArrival);
  const todayCheckIns = arrivals
    .filter((r: { checkIn: Date }) => toDateOnly(r.checkIn) === todayStr)
    .map(mapArrival);

  return {
    vipArrivals,
    dirtyRooms: dirtyRooms.map((r: { number: string; type: string }) => ({
      number: r.number,
      type: r.type,
    })),
    oooRooms: oooRooms.map(
      (r: { number: string; type: string; reason: string | null; updatedAt: Date }) => ({
        number: r.number,
        type: r.type,
        reason: r.reason,
        updatedAt: r.updatedAt.toISOString(),
      })
    ),
    todayCheckIns,
  };
}
