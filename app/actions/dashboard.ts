"use server";

import { prisma } from "@/lib/db";
import { getEffectivePropertyId } from "@/app/actions/properties";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { unstable_cache } from "next/cache";

/** Maks. zakres dat raportu (dni) – unikanie timeoutu przy bardzo dużym zakresie (np. 2 lata). */
const MAX_REPORT_DAYS = 366;

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function checkReportDateRange(from: Date, to: Date): string | null {
  const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (days > MAX_REPORT_DAYS) {
    return `Zakres dat nie może przekraczać ${MAX_REPORT_DAYS} dni. Wybierz krótszy okres (np. miesiąc lub kwartał).`;
  }
  return null;
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
  /** Liczba pokoi OOO zgłoszonych dziś (updatedAt >= start of today) */
  oooNewTodayCount: number;
  todayCheckIns: ArrivalItem[];
}

/** Wewnętrzna logika dashboardu (cacheable – parametry zamiast cookies). */
async function _getDashboardDataInternal(propertyId: string | null, todayDateStr: string): Promise<DashboardData> {
  const today = new Date(todayDateStr + "T00:00:00");
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const todayStr = toDateOnly(today);
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);

  const baseWhere = propertyId ? { propertyId } : {};
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
      where: { status: "DIRTY", ...baseWhere },
      orderBy: { number: "asc" },
      select: { number: true, type: true },
    }),
    prisma.room.findMany({
      where: { status: "OOO", ...baseWhere },
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

  const oooMapped = oooRooms.map(
    (r: { number: string; type: string; reason: string | null; updatedAt: Date }) => ({
      number: r.number,
      type: r.type,
      reason: r.reason,
      updatedAt: r.updatedAt.toISOString(),
    })
  );
  const oooNewTodayCount = oooRooms.filter(
    (r: { updatedAt: Date }) => r.updatedAt >= startOfToday
  ).length;

  return {
    vipArrivals,
    dirtyRooms: dirtyRooms.map((r: { number: string; type: string }) => ({
      number: r.number,
      type: r.type,
    })),
    oooRooms: oooMapped,
    oooNewTodayCount,
    todayCheckIns,
  };
}

const getCachedDashboardData = unstable_cache(
  _getDashboardDataInternal,
  ["dashboard-data"],
  { revalidate: 60 }
);

/** Pobiera dane do Dashboardu: przyjazdy (dzisiaj/jutro), pokoje DIRTY, OOO */
export async function getDashboardData(): Promise<DashboardData> {
  const propertyId = await getEffectivePropertyId();
  const todayStr = toDateOnly(new Date());
  return getCachedDashboardData(propertyId, todayStr);
}

export interface KpiReport {
  from: string;
  to: string;
  availableRoomNights: number;
  soldRoomNights: number;
  occupancyPercent: number;
  roomRevenue: number;
  adr: number | null;
  revPar: number | null;
}

/** Wewnętrzna logika KPI (cacheable). */
async function _getKpiReportInternal(
  fromStr: string,
  toStr: string,
  propertyId: string | null
): Promise<{ success: true; data: KpiReport } | { success: false; error: string }> {
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const roomWhere = { activeForSale: true, ...(propertyId ? { propertyId } : {}) };
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
    const roomCount = await prisma.room.count({ where: roomWhere });
    const availableRoomNights = roomCount * days;

    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        room: roomWhere,
        OR: [
          { checkIn: { lte: to }, checkOut: { gt: from } },
        ],
      },
      include: { room: true },
    });

    let soldRoomNights = 0;
    const fromTime = from.getTime();
    const toTime = to.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    for (const r of reservations) {
      const cin = new Date(r.checkIn).getTime();
      const cout = new Date(r.checkOut).getTime();
      const overlapStart = Math.max(cin, fromTime);
      const overlapEnd = Math.min(cout, toTime);
      if (overlapEnd > overlapStart) {
        soldRoomNights += Math.ceil((overlapEnd - overlapStart) / dayMs);
      }
    }

    const reservationIds = reservations.map((r) => r.id);
    const transactions = await prisma.transaction.findMany({
      where: {
        reservationId: { in: reservationIds },
        type: "ROOM",
        createdAt: { gte: from, lte: to },
      },
      select: { amount: true },
    });
    const roomRevenue = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

    const occupancyPercent =
      availableRoomNights > 0 ? (soldRoomNights / availableRoomNights) * 100 : 0;
    const adr = soldRoomNights > 0 ? roomRevenue / soldRoomNights : null;
    const revPar = availableRoomNights > 0 ? roomRevenue / availableRoomNights : null;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        availableRoomNights,
        soldRoomNights,
        occupancyPercent: Math.round(occupancyPercent * 100) / 100,
        roomRevenue: Math.round(roomRevenue * 100) / 100,
        adr: adr != null ? Math.round(adr * 100) / 100 : null,
        revPar: revPar != null ? Math.round(revPar * 100) / 100 : null,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd KPI",
    };
  }
}

const getCachedKpiReport = unstable_cache(
  _getKpiReportInternal,
  ["kpi-report"],
  { revalidate: 60 }
);

/** KPI dla okresu: Occupancy, ADR, RevPAR. Pokój dostępny = activeForSale. Sprzedane noce = rezerwacje CONFIRMED/CHECKED_IN/CHECKED_OUT. Przychód = transakcje ROOM w okresie. */
export async function getKpiReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: KpiReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu KPI" };
  }
  const propertyId = await getEffectivePropertyId();
  return getCachedKpiReport(fromStr, toStr, propertyId);
}

export type OccupancyReportDay = {
  date: string;
  totalRooms: number;
  occupiedRooms: number;
  occupancyPercent: number;
};

export type OccupancyReport = {
  from: string;
  to: string;
  days: OccupancyReportDay[];
  avgOccupancyPercent: number;
};

/** Wewnętrzna logika raportu obłożenia (cacheable). */
async function _getOccupancyReportInternal(
  fromStr: string,
  toStr: string,
  propertyId: string | null
): Promise<{ success: true; data: OccupancyReport } | { success: false; error: string }> {
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const rangeErr = checkReportDateRange(from, to);
    if (rangeErr) return { success: false, error: rangeErr };
    const roomWhere = { activeForSale: true, ...(propertyId ? { propertyId } : {}) };
    const rooms = await prisma.room.findMany({
      where: roomWhere,
      select: { id: true, number: true },
    });
    const totalRooms = rooms.length;
    const roomIds = new Set(rooms.map((r) => r.id));

    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        roomId: { in: rooms.map((r) => r.id) },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      select: { roomId: true, checkIn: true, checkOut: true },
    });

    const days: OccupancyReportDay[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    let sumPercent = 0;
    let dayCount = 0;
    for (let t = from.getTime(); t <= to.getTime(); t += dayMs) {
      const d = new Date(t);
      const dateStr = d.toISOString().slice(0, 10);
      const nextDay = new Date(t + dayMs);
      let occupied = 0;
      for (const r of reservations) {
        if (!roomIds.has(r.roomId)) continue;
        const cin = new Date(r.checkIn).getTime();
        const cout = new Date(r.checkOut).getTime();
        if (cin < nextDay.getTime() && cout > t) occupied++;
      }
      const occupancyPercent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 10000) / 100 : 0;
      days.push({ date: dateStr, totalRooms, occupiedRooms: occupied, occupancyPercent });
      sumPercent += occupancyPercent;
      dayCount++;
    }
    const avgOccupancyPercent = dayCount > 0 ? Math.round((sumPercent / dayCount) * 100) / 100 : 0;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        days,
        avgOccupancyPercent,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu obłożenia",
    };
  }
}

const getCachedOccupancyReport = unstable_cache(
  _getOccupancyReportInternal,
  ["occupancy-report"],
  { revalidate: 60 }
);

/** Raport obłożenia (Occupancy Report %): obłożenie dzienne w okresie. */
export async function getOccupancyReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: OccupancyReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu obłożenia" };
  }
  const propertyId = await getEffectivePropertyId();
  return getCachedOccupancyReport(fromStr, toStr, propertyId);
}

export type RevParReportDay = {
  date: string;
  totalRooms: number;
  roomRevenue: number;
  revPar: number;
};

export type RevParReport = {
  from: string;
  to: string;
  days: RevParReportDay[];
  totalRevenue: number;
  avgRevPar: number;
};

/** Wewnętrzna logika raportu RevPAR (cacheable). */
async function _getRevParReportInternal(
  fromStr: string,
  toStr: string,
  propertyId: string | null
): Promise<{ success: true; data: RevParReport } | { success: false; error: string }> {
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const roomWhere = { activeForSale: true, ...(propertyId ? { propertyId } : {}) };
    const totalRooms = await prisma.room.count({ where: roomWhere });
    if (totalRooms === 0) {
      return {
        success: true,
        data: {
          from: fromStr,
          to: toStr,
          days: [],
          totalRevenue: 0,
          avgRevPar: 0,
        },
      };
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        type: "ROOM",
        createdAt: { gte: from, lte: to },
      },
      select: { amount: true, createdAt: true },
    });

    const dayMs = 24 * 60 * 60 * 1000;
    const revenueByDay = new Map<string, number>();
    for (let t = from.getTime(); t <= to.getTime(); t += dayMs) {
      const dateStr = new Date(t).toISOString().slice(0, 10);
      revenueByDay.set(dateStr, 0);
    }
    for (const tx of transactions) {
      const dateStr = new Date(tx.createdAt).toISOString().slice(0, 10);
      const cur = revenueByDay.get(dateStr) ?? 0;
      revenueByDay.set(dateStr, cur + Number(tx.amount));
    }

    const days: RevParReportDay[] = [];
    let totalRevenue = 0;
    for (let t = from.getTime(); t <= to.getTime(); t += dayMs) {
      const dateStr = new Date(t).toISOString().slice(0, 10);
      const roomRevenue = Math.round((revenueByDay.get(dateStr) ?? 0) * 100) / 100;
      const revPar = totalRooms > 0 ? Math.round((roomRevenue / totalRooms) * 100) / 100 : 0;
      days.push({ date: dateStr, totalRooms, roomRevenue, revPar });
      totalRevenue += roomRevenue;
    }
    const avgRevPar = days.length > 0 ? Math.round((totalRevenue / totalRooms / days.length) * 100) / 100 : 0;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        days,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgRevPar,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu RevPAR",
    };
  }
}

const getCachedRevParReport = unstable_cache(
  _getRevParReportInternal,
  ["revpar-report"],
  { revalidate: 60 }
);

/** Raport RevPAR (Revenue Per Available Room) – dzienny przychód z pokoi / liczba dostępnych pokoi. */
export async function getRevParReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: RevParReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu RevPAR" };
  }
  const propertyId = await getEffectivePropertyId();
  return getCachedRevParReport(fromStr, toStr, propertyId);
}

export type AdrReportDay = {
  date: string;
  roomRevenue: number;
  soldRoomNights: number;
  adr: number | null;
};

export type AdrReport = {
  from: string;
  to: string;
  days: AdrReportDay[];
  totalRevenue: number;
  totalSoldRoomNights: number;
  avgAdr: number | null;
};

/** Raport ADR (Average Daily Rate) – dzienny przychód z pokoi / sprzedane pokojo-noce. */
export async function getAdrReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: AdrReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu ADR" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const propertyId = await getEffectivePropertyId();
    const roomWhere = { activeForSale: true, ...(propertyId ? { propertyId } : {}) };
    const roomIds = (await prisma.room.findMany({ where: roomWhere, select: { id: true } })).map((r) => r.id);

    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        roomId: { in: roomIds },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      select: { roomId: true, checkIn: true, checkOut: true },
    });

    const transactions = await prisma.transaction.findMany({
      where: { type: "ROOM", createdAt: { gte: from, lte: to } },
      select: { amount: true, createdAt: true },
    });

    const dayMs = 24 * 60 * 60 * 1000;
    const days: AdrReportDay[] = [];
    let totalRevenue = 0;
    let totalSoldRoomNights = 0;
    for (let t = from.getTime(); t <= to.getTime(); t += dayMs) {
      const d = new Date(t);
      const dateStr = d.toISOString().slice(0, 10);
      const nextDay = new Date(t + dayMs);
      let sold = 0;
      for (const r of reservations) {
        const cin = new Date(r.checkIn).getTime();
        const cout = new Date(r.checkOut).getTime();
        if (cin < nextDay.getTime() && cout > t) sold++;
      }
      const dayRevenue = transactions
        .filter((tx) => new Date(tx.createdAt).toISOString().slice(0, 10) === dateStr)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const roomRevenue = Math.round(dayRevenue * 100) / 100;
      const adr = sold > 0 ? Math.round((roomRevenue / sold) * 100) / 100 : null;
      days.push({ date: dateStr, roomRevenue, soldRoomNights: sold, adr });
      totalRevenue += roomRevenue;
      totalSoldRoomNights += sold;
    }
    const avgAdr = totalSoldRoomNights > 0 ? Math.round((totalRevenue / totalSoldRoomNights) * 100) / 100 : null;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        days,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalSoldRoomNights,
        avgAdr,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu ADR",
    };
  }
}

export type RevenueByTypeRow = { type: string; amount: number };
export type RevenueReport = {
  from: string;
  to: string;
  byType: RevenueByTypeRow[];
  total: number;
};

/** Raport przychodów (Revenue Report) – suma przychodów wg typu transakcji (ROOM, MINIBAR, GASTRONOMY, itd.). VOID pomijamy (anulowania osobno). */
export async function getRevenueReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: RevenueReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu przychodów" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const rangeErr = checkReportDateRange(from, to);
    if (rangeErr) return { success: false, error: rangeErr };

    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        type: { not: "VOID" },
      },
      select: { type: true, amount: true },
    });

    const byType = new Map<string, number>();
    for (const tx of transactions) {
      const t = tx.type || "OTHER";
      byType.set(t, (byType.get(t) ?? 0) + Number(tx.amount));
    }
    const byTypeArr: RevenueByTypeRow[] = Array.from(byType.entries())
      .map(([type, amount]) => ({ type, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
    const total = Math.round(byTypeArr.reduce((s, r) => s + r.amount, 0) * 100) / 100;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        byType: byTypeArr,
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu przychodów",
    };
  }
}

export type RevenueBySegmentRow = { segment: string; amount: number; reservationCount: number };
export type RevenueBySegmentReport = {
  from: string;
  to: string;
  bySegment: RevenueBySegmentRow[];
  total: number;
};

/** Raport przychodów wg segmentu rynkowego (market segment rezerwacji). */
export async function getRevenueBySegmentReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: RevenueBySegmentReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu przychodów wg segmentu" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const allTx = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        type: { not: "VOID" },
      },
      select: { amount: true, reservationId: true },
    });
    const transactions = allTx.filter((t) => t.reservationId != null);

    const reservationIds = [...new Set(transactions.map((t) => t.reservationId).filter(Boolean))] as string[];
    const reservations = await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: { id: true, marketSegment: true },
    });
    const segmentByRes = new Map<string, string>(reservations.map((r) => [r.id, (r.marketSegment ?? "—") as string]));

    const bySegment = new Map<string, { amount: number; reservations: Set<string> }>();
    for (const tx of transactions) {
      const seg: string = tx.reservationId ? (segmentByRes.get(tx.reservationId) ?? "—") : "—";
      const cur = bySegment.get(seg) ?? { amount: 0, reservations: new Set<string>() };
      cur.amount += Number(tx.amount);
      if (tx.reservationId) cur.reservations.add(tx.reservationId);
      bySegment.set(seg, cur);
    }
    const bySegmentArr: RevenueBySegmentRow[] = Array.from(bySegment.entries())
      .map(([segment, data]) => ({
        segment,
        amount: Math.round(data.amount * 100) / 100,
        reservationCount: data.reservations.size,
      }))
      .sort((a, b) => b.amount - a.amount);
    const total = Math.round(bySegmentArr.reduce((s, r) => s + r.amount, 0) * 100) / 100;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        bySegment: bySegmentArr,
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu przychodów wg segmentu",
    };
  }
}

export type RevenueByRoomTypeRow = { roomType: string; amount: number; reservationCount: number };
export type RevenueByRoomTypeReport = {
  from: string;
  to: string;
  byRoomType: RevenueByRoomTypeRow[];
  total: number;
};

/** Raport przychodów wg typu pokoju (Revenue by room type). */
export async function getRevenueByRoomTypeReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: RevenueByRoomTypeReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu przychodów wg typu pokoju" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const allTx = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        type: { not: "VOID" },
      },
      select: { amount: true, reservationId: true },
    });
    const transactions = allTx.filter((t) => t.reservationId != null);

    const reservationIds = [...new Set(transactions.map((t) => t.reservationId).filter(Boolean))] as string[];
    const reservations = await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: { id: true, room: { select: { type: true } } },
    });
    const roomTypeByRes = new Map<string, string>(reservations.map((r) => [r.id, (r.room?.type ?? "—") as string]));

    const byRoomType = new Map<string, { amount: number; reservations: Set<string> }>();
    for (const tx of transactions) {
      const rt: string = tx.reservationId ? (roomTypeByRes.get(tx.reservationId) ?? "—") : "—";
      const cur = byRoomType.get(rt) ?? { amount: 0, reservations: new Set<string>() };
      cur.amount += Number(tx.amount);
      if (tx.reservationId) cur.reservations.add(tx.reservationId);
      byRoomType.set(rt, cur);
    }
    const byRoomTypeArr: RevenueByRoomTypeRow[] = Array.from(byRoomType.entries())
      .map(([roomType, data]) => ({
        roomType,
        amount: Math.round(data.amount * 100) / 100,
        reservationCount: data.reservations.size,
      }))
      .sort((a, b) => b.amount - a.amount);
    const total = Math.round(byRoomTypeArr.reduce((s, r) => s + r.amount, 0) * 100) / 100;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        byRoomType: byRoomTypeArr,
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu przychodów wg typu pokoju",
    };
  }
}

export type RevenueBySourceRow = { source: string; amount: number; reservationCount: number };
export type RevenueBySourceReport = {
  from: string;
  to: string;
  bySource: RevenueBySourceRow[];
  total: number;
};

/** Raport przychodów wg źródła rezerwacji (OTA, telefon, strona itd.). */
export async function getRevenueBySourceReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: RevenueBySourceReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu przychodów wg źródła" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const allTx = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        type: { not: "VOID" },
      },
      select: { amount: true, reservationId: true },
    });
    const transactions = allTx.filter((t) => t.reservationId != null);

    const reservationIds = [...new Set(transactions.map((t) => t.reservationId).filter(Boolean))] as string[];
    const reservations = await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: { id: true, source: true },
    });
    const sourceByRes = new Map<string, string>(reservations.map((r) => [r.id, (r.source ?? "—") as string]));

    const bySource = new Map<string, { amount: number; reservations: Set<string> }>();
    for (const tx of transactions) {
      const src: string = tx.reservationId ? (sourceByRes.get(tx.reservationId) ?? "—") : "—";
      const cur = bySource.get(src) ?? { amount: 0, reservations: new Set<string>() };
      cur.amount += Number(tx.amount);
      if (tx.reservationId) cur.reservations.add(tx.reservationId);
      bySource.set(src, cur);
    }
    const bySourceArr: RevenueBySourceRow[] = Array.from(bySource.entries())
      .map(([source, data]) => ({
        source,
        amount: Math.round(data.amount * 100) / 100,
        reservationCount: data.reservations.size,
      }))
      .sort((a, b) => b.amount - a.amount);
    const total = Math.round(bySourceArr.reduce((s, r) => s + r.amount, 0) * 100) / 100;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        bySource: bySourceArr,
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu przychodów wg źródła rezerwacji",
    };
  }
}

export type RevenueByChannelRow = { channel: string; amount: number; reservationCount: number };
export type RevenueByChannelReport = {
  from: string;
  to: string;
  byChannel: RevenueByChannelRow[];
  total: number;
};

/** Raport przychodów wg kanału (Booking.com, Expedia, bezpośrednie itd.). */
export async function getRevenueByChannelReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: RevenueByChannelReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu przychodów wg kanału" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const allTx = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        type: { not: "VOID" },
      },
      select: { amount: true, reservationId: true },
    });
    const transactions = allTx.filter((t) => t.reservationId != null);

    const reservationIds = [...new Set(transactions.map((t) => t.reservationId).filter(Boolean))] as string[];
    const reservations = await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: { id: true, channel: true },
    });
    const channelByRes = new Map<string, string>(reservations.map((r) => [r.id, (r.channel ?? "—") as string]));

    const byChannel = new Map<string, { amount: number; reservations: Set<string> }>();
    for (const tx of transactions) {
      const ch: string = tx.reservationId ? (channelByRes.get(tx.reservationId) ?? "—") : "—";
      const cur = byChannel.get(ch) ?? { amount: 0, reservations: new Set<string>() };
      cur.amount += Number(tx.amount);
      if (tx.reservationId) cur.reservations.add(tx.reservationId);
      byChannel.set(ch, cur);
    }
    const byChannelArr: RevenueByChannelRow[] = Array.from(byChannel.entries())
      .map(([channel, data]) => ({
        channel,
        amount: Math.round(data.amount * 100) / 100,
        reservationCount: data.reservations.size,
      }))
      .sort((a, b) => b.amount - a.amount);
    const total = Math.round(byChannelArr.reduce((s, r) => s + r.amount, 0) * 100) / 100;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        byChannel: byChannelArr,
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu przychodów wg kanału",
    };
  }
}

export type RevenueByGuestSegmentRow = { guestSegment: string; amount: number; reservationCount: number };
export type RevenueByGuestSegmentReport = {
  from: string;
  to: string;
  byGuestSegment: RevenueByGuestSegmentRow[];
  total: number;
};

/** Raport przychodów wg segmentu gościa (biznes, leisure, grupy itd.). */
export async function getRevenueByGuestSegmentReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: RevenueByGuestSegmentReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu przychodów wg segmentu gościa" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const allTx = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        type: { not: "VOID" },
      },
      select: { amount: true, reservationId: true },
    });
    const transactions = allTx.filter((t) => t.reservationId != null);

    const reservationIds = [...new Set(transactions.map((t) => t.reservationId).filter(Boolean))] as string[];
    const reservations = await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: { id: true, guest: { select: { segment: true } } },
    });
    const guestSegmentByRes = new Map<string, string>(reservations.map((r) => [r.id, (r.guest?.segment ?? "—") as string]));

    const byGuestSegment = new Map<string, { amount: number; reservations: Set<string> }>();
    for (const tx of transactions) {
      const seg: string = tx.reservationId ? (guestSegmentByRes.get(tx.reservationId) ?? "—") : "—";
      const cur = byGuestSegment.get(seg) ?? { amount: 0, reservations: new Set<string>() };
      cur.amount += Number(tx.amount);
      if (tx.reservationId) cur.reservations.add(tx.reservationId);
      byGuestSegment.set(seg, cur);
    }
    const byGuestSegmentArr: RevenueByGuestSegmentRow[] = Array.from(byGuestSegment.entries())
      .map(([guestSegment, data]) => ({
        guestSegment,
        amount: Math.round(data.amount * 100) / 100,
        reservationCount: data.reservations.size,
      }))
      .sort((a, b) => b.amount - a.amount);
    const total = Math.round(byGuestSegmentArr.reduce((s, r) => s + r.amount, 0) * 100) / 100;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        byGuestSegment: byGuestSegmentArr,
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu przychodów wg segmentu gościa",
    };
  }
}

export type RevenueByRateCodeRow = { rateCode: string; amount: number; reservationCount: number };
export type RevenueByRateCodeReport = {
  from: string;
  to: string;
  byRateCode: RevenueByRateCodeRow[];
  total: number;
};

/** Raport przychodów wg kodu stawki (BB, RO, HB itd.). */
export async function getRevenueByRateCodeReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: RevenueByRateCodeReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu przychodów wg kodu stawki" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const allTx = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        type: { not: "VOID" },
      },
      select: { amount: true, reservationId: true },
    });
    const transactions = allTx.filter((t) => t.reservationId != null);

    const reservationIds = [...new Set(transactions.map((t) => t.reservationId).filter(Boolean))] as string[];
    const reservations = await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: { id: true, rateCode: { select: { code: true } } },
    });
    const rateCodeByRes = new Map<string, string>(reservations.map((r) => [r.id, (r.rateCode?.code ?? "—") as string]));

    const byRateCode = new Map<string, { amount: number; reservations: Set<string> }>();
    for (const tx of transactions) {
      const rc: string = tx.reservationId ? (rateCodeByRes.get(tx.reservationId) ?? "—") : "—";
      const cur = byRateCode.get(rc) ?? { amount: 0, reservations: new Set<string>() };
      cur.amount += Number(tx.amount);
      if (tx.reservationId) cur.reservations.add(tx.reservationId);
      byRateCode.set(rc, cur);
    }
    const byRateCodeArr: RevenueByRateCodeRow[] = Array.from(byRateCode.entries())
      .map(([rateCode, data]) => ({
        rateCode,
        amount: Math.round(data.amount * 100) / 100,
        reservationCount: data.reservations.size,
      }))
      .sort((a, b) => b.amount - a.amount);
    const total = Math.round(byRateCodeArr.reduce((s, r) => s + r.amount, 0) * 100) / 100;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        byRateCode: byRateCodeArr,
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu przychodów wg kodu stawki",
    };
  }
}

export type NoShowRow = {
  id: string;
  confirmationNumber: string | null;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  source: string | null;
  channel: string | null;
};
export type NoShowReport = {
  from: string;
  to: string;
  reservations: NoShowRow[];
  totalCount: number;
};

/** Raport no-show (rezerwacje ze statusem NO_SHOW w podanym zakresie dat zameldowania). */
export async function getNoShowReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: NoShowReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu no-show" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const propertyId = await getEffectivePropertyId();
    const roomWhere = propertyId ? { room: { propertyId } } : {};

    const reservations = await prisma.reservation.findMany({
      where: {
        ...roomWhere,
        status: "NO_SHOW",
        checkIn: { gte: from, lte: to },
      },
      select: {
        id: true,
        confirmationNumber: true,
        checkIn: true,
        checkOut: true,
        source: true,
        channel: true,
        guest: { select: { name: true } },
        room: { select: { number: true } },
      },
      orderBy: [{ checkIn: "asc" }, { id: "asc" }],
    });

    const rows: NoShowRow[] = reservations.map((r) => ({
      id: r.id,
      confirmationNumber: r.confirmationNumber ?? null,
      guestName: r.guest?.name ?? "—",
      roomNumber: r.room?.number ?? "—",
      checkIn: toDateOnly(new Date(r.checkIn)),
      checkOut: toDateOnly(new Date(r.checkOut)),
      source: r.source ?? null,
      channel: r.channel ?? null,
    }));

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        reservations: rows,
        totalCount: rows.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu no-show",
    };
  }
}

export type CancellationRow = {
  id: string;
  confirmationNumber: string | null;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancellationCode: string | null;
};
export type CancellationReport = {
  from: string;
  to: string;
  reservations: CancellationRow[];
  totalCount: number;
};

/** Raport anulacji (rezerwacje anulowane w podanym zakresie dat anulowania). */
export async function getCancellationReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: CancellationReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu anulacji" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const propertyId = await getEffectivePropertyId();
    const roomWhere = propertyId ? { room: { propertyId } } : {};

    const reservations = await prisma.reservation.findMany({
      where: {
        ...roomWhere,
        status: "CANCELLED",
        cancelledAt: { not: null, gte: from, lte: to },
      },
      select: {
        id: true,
        confirmationNumber: true,
        checkIn: true,
        checkOut: true,
        cancelledAt: true,
        cancellationReason: true,
        cancellationCode: true,
        guest: { select: { name: true } },
        room: { select: { number: true } },
      },
      orderBy: [{ cancelledAt: "desc" }, { id: "asc" }],
    });

    const rows: CancellationRow[] = reservations.map((r) => ({
      id: r.id,
      confirmationNumber: r.confirmationNumber ?? null,
      guestName: r.guest?.name ?? "—",
      roomNumber: r.room?.number ?? "—",
      checkIn: toDateOnly(new Date(r.checkIn)),
      checkOut: toDateOnly(new Date(r.checkOut)),
      cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString().slice(0, 19).replace("T", " ") : null,
      cancellationReason: r.cancellationReason ?? null,
      cancellationCode: r.cancellationCode ?? null,
    }));

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        reservations: rows,
        totalCount: rows.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu anulacji",
    };
  }
}

export type DailyCheckInRow = {
  id: string;
  confirmationNumber: string | null;
  guestName: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: string;
};
export type DailyCheckInsReport = {
  from: string;
  to: string;
  byDate: Record<string, DailyCheckInRow[]>;
  dates: string[];
  totalCount: number;
};

/** Raport dziennych check-in-ów (rezerwacje z zameldowaniem w podanym zakresie, status CONFIRMED lub CHECKED_IN). */
export async function getDailyCheckInsReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: DailyCheckInsReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu check-in-ów" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const propertyId = await getEffectivePropertyId();
    const roomWhere = propertyId ? { room: { propertyId } } : {};

    const reservations = await prisma.reservation.findMany({
      where: {
        ...roomWhere,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { gte: from, lte: to },
      },
      select: {
        id: true,
        confirmationNumber: true,
        checkIn: true,
        checkOut: true,
        status: true,
        guest: { select: { name: true } },
        room: { select: { number: true, type: true } },
      },
      orderBy: [{ checkIn: "asc" }, { id: "asc" }],
    });

    const byDate: Record<string, DailyCheckInRow[]> = {};
    const datesSet = new Set<string>();
    for (const r of reservations) {
      const dateKey = toDateOnly(new Date(r.checkIn));
      datesSet.add(dateKey);
      const row: DailyCheckInRow = {
        id: r.id,
        confirmationNumber: r.confirmationNumber ?? null,
        guestName: r.guest?.name ?? "—",
        roomNumber: r.room?.number ?? "—",
        roomType: r.room?.type ?? "—",
        checkIn: dateKey,
        checkOut: toDateOnly(new Date(r.checkOut)),
        status: r.status,
      };
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(row);
    }
    const dates = Array.from(datesSet).sort();

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        byDate,
        dates,
        totalCount: reservations.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu check-in-ów",
    };
  }
}

export type DailyCheckOutRow = {
  id: string;
  confirmationNumber: string | null;
  guestName: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: string;
};
export type DailyCheckOutsReport = {
  from: string;
  to: string;
  byDate: Record<string, DailyCheckOutRow[]>;
  dates: string[];
  totalCount: number;
};

/** Raport dziennych check-out-ów (rezerwacje z wymeldowaniem w podanym zakresie, status CONFIRMED lub CHECKED_IN). */
export async function getDailyCheckOutsReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: DailyCheckOutsReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu check-out-ów" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const propertyId = await getEffectivePropertyId();
    const roomWhere = propertyId ? { room: { propertyId } } : {};

    const reservations = await prisma.reservation.findMany({
      where: {
        ...roomWhere,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkOut: { gte: from, lte: to },
      },
      select: {
        id: true,
        confirmationNumber: true,
        checkIn: true,
        checkOut: true,
        status: true,
        guest: { select: { name: true } },
        room: { select: { number: true, type: true } },
      },
      orderBy: [{ checkOut: "asc" }, { id: "asc" }],
    });

    const byDate: Record<string, DailyCheckOutRow[]> = {};
    const datesSet = new Set<string>();
    for (const r of reservations) {
      const dateKey = toDateOnly(new Date(r.checkOut));
      datesSet.add(dateKey);
      const row: DailyCheckOutRow = {
        id: r.id,
        confirmationNumber: r.confirmationNumber ?? null,
        guestName: r.guest?.name ?? "—",
        roomNumber: r.room?.number ?? "—",
        roomType: r.room?.type ?? "—",
        checkIn: toDateOnly(new Date(r.checkIn)),
        checkOut: dateKey,
        status: r.status,
      };
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(row);
    }
    const dates = Array.from(datesSet).sort();

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        byDate,
        dates,
        totalCount: reservations.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu check-out-ów",
    };
  }
}

export type InHouseGuestRow = {
  id: string;
  confirmationNumber: string | null;
  guestName: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
};
export type InHouseGuestsReport = {
  reservations: InHouseGuestRow[];
  totalCount: number;
};

/** Raport "In-house guests" (aktualni goście – rezerwacje ze statusem CHECKED_IN). */
export async function getInHouseGuestsReport(): Promise<
  { success: true; data: InHouseGuestsReport } | { success: false; error: string }
> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu in-house" };
  }
  try {
    const propertyId = await getEffectivePropertyId();
    const roomWhere = propertyId ? { room: { propertyId } } : {};

    const reservations = await prisma.reservation.findMany({
      where: {
        ...roomWhere,
        status: "CHECKED_IN",
      },
      select: {
        id: true,
        confirmationNumber: true,
        checkIn: true,
        checkOut: true,
        guest: { select: { name: true } },
        room: { select: { number: true, type: true } },
      },
      orderBy: [{ room: { number: "asc" } }, { id: "asc" }],
    });

    const rows: InHouseGuestRow[] = reservations.map((r) => {
      const checkIn = new Date(r.checkIn);
      const checkOut = new Date(r.checkOut);
      const nights = Math.max(0, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000)));
      return {
        id: r.id,
        confirmationNumber: r.confirmationNumber ?? null,
        guestName: r.guest?.name ?? "—",
        roomNumber: r.room?.number ?? "—",
        roomType: r.room?.type ?? "—",
        checkIn: toDateOnly(checkIn),
        checkOut: toDateOnly(checkOut),
        nights,
      };
    });

    return {
      success: true,
      data: {
        reservations: rows,
        totalCount: rows.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu in-house guests",
    };
  }
}

export type HousekeepingWorkloadRow = { housekeeper: string; roomCount: number };
export type HousekeepingWorkloadReport = {
  from: string;
  to: string;
  byDate: Record<string, HousekeepingWorkloadRow[]>;
  dates: string[];
  totalRooms: number;
};

/** Raport sprzątania (housekeeping workload – kto, kiedy, ile pokoi). */
export async function getHousekeepingWorkloadReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: HousekeepingWorkloadReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu sprzątania" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const propertyId = await getEffectivePropertyId();
    const where: { scheduledDate: { gte: Date; lte: Date }; propertyId?: string } = {
      scheduledDate: { gte: from, lte: to },
    };
    if (propertyId) where.propertyId = propertyId;

    const schedules = await prisma.cleaningSchedule.findMany({
      where,
      select: { scheduledDate: true, assignedTo: true, roomId: true },
    });

    const byDateMap = new Map<string, Map<string, number>>();
    let totalRooms = 0;
    for (const s of schedules) {
      const dateKey = toDateOnly(new Date(s.scheduledDate));
      const housekeeper = s.assignedTo ?? "—";
      if (!byDateMap.has(dateKey)) byDateMap.set(dateKey, new Map());
      const dayMap = byDateMap.get(dateKey)!;
      dayMap.set(housekeeper, (dayMap.get(housekeeper) ?? 0) + 1);
      totalRooms += 1;
    }
    const dates = Array.from(byDateMap.keys()).sort();
    const byDate: Record<string, HousekeepingWorkloadRow[]> = {};
    for (const [dateKey, dayMap] of byDateMap) {
      byDate[dateKey] = Array.from(dayMap.entries())
        .map(([housekeeper, roomCount]) => ({ housekeeper, roomCount }))
        .sort((a, b) => b.roomCount - a.roomCount);
    }

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        byDate,
        dates,
        totalRooms,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu sprzątania",
    };
  }
}

export type ReservationsPeriodRow = {
  id: string;
  confirmationNumber: string | null;
  guestName: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalAmount: number;
};
export type ReservationsPeriodReport = {
  from: string;
  to: string;
  reservations: ReservationsPeriodRow[];
  totalCount: number;
};

/** Raport rezerwacji w okresie X–Y (rezerwacje zachodzące na podany zakres dat). */
export async function getReservationsPeriodReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: ReservationsPeriodReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu rezerwacji" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const propertyId = await getEffectivePropertyId();
    const roomWhere = propertyId ? { room: { propertyId } } : {};

    const reservations = await prisma.reservation.findMany({
      where: {
        ...roomWhere,
        checkIn: { lte: to },
        checkOut: { gte: from },
      },
      select: {
        id: true,
        confirmationNumber: true,
        checkIn: true,
        checkOut: true,
        status: true,
        guest: { select: { name: true } },
        room: { select: { number: true, type: true, propertyId: true } },
      },
      orderBy: [{ checkIn: "asc" }, { id: "asc" }],
    });

    const ids = reservations.map((r) => r.id);
    const sums = await prisma.transaction.groupBy({
      by: ["reservationId"],
      where: {
        reservationId: { in: ids },
        type: { not: "VOID" },
      },
      _sum: { amount: true },
    });
    const amountByRes = new Map<string, number>(sums.map((s) => [s.reservationId!, Number(s._sum.amount ?? 0)]));

    const rows: ReservationsPeriodRow[] = reservations.map((r) => ({
      id: r.id,
      confirmationNumber: r.confirmationNumber ?? null,
      guestName: r.guest?.name ?? "—",
      roomNumber: r.room?.number ?? "—",
      roomType: r.room?.type ?? "—",
      checkIn: toDateOnly(new Date(r.checkIn)),
      checkOut: toDateOnly(new Date(r.checkOut)),
      status: r.status,
      totalAmount: Math.round((amountByRes.get(r.id) ?? 0) * 100) / 100,
    }));

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        reservations: rows,
        totalCount: rows.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu rezerwacji w okresie",
    };
  }
}

export type MaintenanceIssueRow = {
  id: string;
  roomNumber: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  reportedAt: string;
  reportedBy: string | null;
  resolvedAt: string | null;
};
export type MaintenanceIssuesReport = {
  from: string;
  to: string;
  issues: MaintenanceIssueRow[];
  totalCount: number;
};

/** Raport usterek (maintenance issues w zakresie dat zgłoszenia). */
export async function getMaintenanceIssuesReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: MaintenanceIssuesReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu usterek" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const propertyId = await getEffectivePropertyId();
    const roomWhere = propertyId ? { room: { propertyId } } : {};

    const issues = await prisma.maintenanceIssue.findMany({
      where: {
        ...roomWhere,
        reportedAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        title: true,
        category: true,
        priority: true,
        status: true,
        reportedAt: true,
        reportedBy: true,
        resolvedAt: true,
        room: { select: { number: true } },
      },
      orderBy: [{ reportedAt: "desc" }, { id: "asc" }],
    });

    const rows: MaintenanceIssueRow[] = issues.map((i) => ({
      id: i.id,
      roomNumber: i.room?.number ?? "—",
      title: i.title,
      category: i.category,
      priority: i.priority,
      status: i.status,
      reportedAt: i.reportedAt.toISOString().slice(0, 19).replace("T", " "),
      reportedBy: i.reportedBy ?? null,
      resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString().slice(0, 19).replace("T", " ") : null,
    }));

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        issues: rows,
        totalCount: rows.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu usterek",
    };
  }
}

export type VipGuestRow = {
  id: string;
  guestName: string;
  email: string | null;
  phone: string | null;
  vipLevel: string | null;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
  confirmationNumber: string | null;
};
export type VipGuestsReport = {
  from: string;
  to: string;
  guests: VipGuestRow[];
  totalCount: number;
};

/** Raport gości VIP (rezerwacje z gościem isVip w zakresie dat zameldowania/wymeldowania). */
export async function getVipGuestsReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: VipGuestsReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu gości VIP" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }
    const propertyId = await getEffectivePropertyId();
    const roomWhere = propertyId ? { room: { propertyId } } : {};

    const reservations = await prisma.reservation.findMany({
      where: {
        ...roomWhere,
        guest: { isVip: true },
        checkIn: { lte: to },
        checkOut: { gte: from },
      },
      select: {
        id: true,
        confirmationNumber: true,
        checkIn: true,
        checkOut: true,
        status: true,
        guest: { select: { name: true, email: true, phone: true, vipLevel: true } },
        room: { select: { number: true } },
      },
      orderBy: [{ checkIn: "asc" }, { id: "asc" }],
    });

    const rows: VipGuestRow[] = reservations.map((r) => ({
      id: r.id,
      guestName: r.guest?.name ?? "—",
      email: r.guest?.email ?? null,
      phone: r.guest?.phone ?? null,
      vipLevel: r.guest?.vipLevel ?? null,
      roomNumber: r.room?.number ?? "—",
      checkIn: toDateOnly(new Date(r.checkIn)),
      checkOut: toDateOnly(new Date(r.checkOut)),
      status: r.status,
      confirmationNumber: r.confirmationNumber ?? null,
    }));

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        guests: rows,
        totalCount: rows.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu gości VIP",
    };
  }
}

export type BirthdayGuestRow = {
  id: string;
  guestName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string;
  birthdayInPeriod: string;
};
export type BirthdayReport = {
  from: string;
  to: string;
  guests: BirthdayGuestRow[];
  totalCount: number;
};

/** Raport urodzin gości (birthday report) – goście, których data urodzin (m-d) przypada w podanym zakresie dat. */
export async function getBirthdayReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: BirthdayReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu urodzin" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const guests = await prisma.guest.findMany({
      where: { dateOfBirth: { not: null } },
      select: { id: true, name: true, email: true, phone: true, dateOfBirth: true },
      orderBy: { name: "asc" },
    });

    const monthDaySet = new Set<string>();
    const d = new Date(from);
    d.setUTCHours(0, 0, 0, 0);
    while (d <= to) {
      monthDaySet.add(`${d.getUTCMonth() + 1}-${d.getUTCDate()}`);
      d.setUTCDate(d.getUTCDate() + 1);
    }

    const rows: BirthdayGuestRow[] = [];
    for (const g of guests) {
      if (!g.dateOfBirth) continue;
      const bd = new Date(g.dateOfBirth);
      const monthDay = `${bd.getUTCMonth() + 1}-${bd.getUTCDate()}`;
      if (!monthDaySet.has(monthDay)) continue;
      const year = from.getUTCFullYear();
      const birthdayInPeriod = `${year}-${String(bd.getUTCMonth() + 1).padStart(2, "0")}-${String(bd.getUTCDate()).padStart(2, "0")}`;
      rows.push({
        id: g.id,
        guestName: g.name,
        email: g.email ?? null,
        phone: g.phone ?? null,
        dateOfBirth: g.dateOfBirth.toISOString().slice(0, 10),
        birthdayInPeriod,
      });
    }

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        guests: rows,
        totalCount: rows.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu urodzin",
    };
  }
}

export type OccupancyForecastReport = OccupancyReport;

/** Raport prognozowany (forecast – expected occupancy next 30/90 days). */
export async function getOccupancyForecastReport(
  days: number
): Promise<{ success: true; data: OccupancyForecastReport } | { success: false; error: string }> {
  if (days < 1 || days > 365) {
    return { success: false, error: "Liczba dni musi być od 1 do 365" };
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const fromStr = today.toISOString().slice(0, 10);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + days - 1);
  end.setUTCHours(23, 59, 59, 999);
  const toStr = end.toISOString().slice(0, 10);
  return getOccupancyReport(fromStr, toStr);
}

export type YearOverYearMonthRow = {
  month: string;
  thisYearOccupancy: number;
  lastYearOccupancy: number;
  thisYearRevenue: number;
  lastYearRevenue: number;
  occupancyChangePercent: number | null;
  revenueChangePercent: number | null;
};
export type YearOverYearReport = {
  year: number;
  lastYear: number;
  byMonth: YearOverYearMonthRow[];
  thisYearAvgOccupancy: number;
  lastYearAvgOccupancy: number;
  thisYearTotalRevenue: number;
  lastYearTotalRevenue: number;
};

/** Raport porównawczy rok-do-roku (YoY) – obłożenie i przychód miesięcznie: bieżący rok vs poprzedni. */
export async function getYearOverYearReport(
  year: number
): Promise<{ success: true; data: YearOverYearReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu YoY" };
  }
  try {
    const propertyId = await getEffectivePropertyId();
    const roomWhere = { activeForSale: true, ...(propertyId ? { propertyId } : {}) };
    const rooms = await prisma.room.findMany({
      where: roomWhere,
      select: { id: true },
    });
    const totalRooms = rooms.length;
    const roomIds = rooms.map((r) => r.id);
    if (totalRooms === 0) {
      return {
        success: true,
        data: {
          year,
          lastYear: year - 1,
          byMonth: [],
          thisYearAvgOccupancy: 0,
          lastYearAvgOccupancy: 0,
          thisYearTotalRevenue: 0,
          lastYearTotalRevenue: 0,
        },
      };
    }

    const byMonth = new Map<
      string,
      { thisOcc: number; lastOcc: number; thisRev: number; lastRev: number }
    >();
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      byMonth.set(key, { thisOcc: 0, lastOcc: 0, thisRev: 0, lastRev: 0 });
    }

    const thisYearStart = new Date(year, 0, 1);
    const thisYearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    const lastYearStart = new Date(year - 1, 0, 1);
    const lastYearEnd = new Date(year - 1, 11, 31, 23, 59, 59, 999);

    const [reservationsThis, reservationsLast, transactionsThis, transactionsLast] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
          roomId: { in: roomIds },
          checkIn: { lte: thisYearEnd },
          checkOut: { gt: thisYearStart },
        },
        select: { roomId: true, checkIn: true, checkOut: true },
      }),
      prisma.reservation.findMany({
        where: {
          status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
          roomId: { in: roomIds },
          checkIn: { lte: lastYearEnd },
          checkOut: { gt: lastYearStart },
        },
        select: { roomId: true, checkIn: true, checkOut: true },
      }),
      prisma.transaction.findMany({
        where: {
          type: "ROOM",
          createdAt: { gte: thisYearStart, lte: thisYearEnd },
        },
        select: { amount: true, createdAt: true },
      }),
      prisma.transaction.findMany({
        where: {
          type: "ROOM",
          createdAt: { gte: lastYearStart, lte: lastYearEnd },
        },
        select: { amount: true, createdAt: true },
      }),
    ]);

    const _dayMs = 24 * 60 * 60 * 1000;
    const roomIdsSet = new Set(roomIds);
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const daysInMonth = new Date(year, m, 0).getDate();
      let thisOccSum = 0;
      let lastOccSum = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStartThis = new Date(year, m - 1, d).getTime();
        const dayEndThis = new Date(year, m - 1, d, 23, 59, 59, 999).getTime();
        const dayStartLast = new Date(year - 1, m - 1, d).getTime();
        const dayEndLast = new Date(year - 1, m - 1, d, 23, 59, 59, 999).getTime();
        let dayThis = 0;
        let dayLast = 0;
        for (const r of reservationsThis) {
          if (!roomIdsSet.has(r.roomId)) continue;
          const cin = new Date(r.checkIn).getTime();
          const cout = new Date(r.checkOut).getTime();
          if (cin <= dayEndThis && cout > dayStartThis) dayThis++;
        }
        for (const r of reservationsLast) {
          if (!roomIdsSet.has(r.roomId)) continue;
          const cin = new Date(r.checkIn).getTime();
          const cout = new Date(r.checkOut).getTime();
          if (cin <= dayEndLast && cout > dayStartLast) dayLast++;
        }
        thisOccSum += (dayThis / totalRooms) * 100;
        lastOccSum += (dayLast / totalRooms) * 100;
      }
      const cur = byMonth.get(key)!;
      cur.thisOcc = Math.round((thisOccSum / daysInMonth) * 100) / 100;
      cur.lastOcc = Math.round((lastOccSum / daysInMonth) * 100) / 100;
    }

    for (const tx of transactionsThis) {
      const key = new Date(tx.createdAt).toISOString().slice(0, 7);
      const cur = byMonth.get(key);
      if (cur) cur.thisRev += Number(tx.amount);
    }
    for (const tx of transactionsLast) {
      const keyLast = new Date(tx.createdAt).toISOString().slice(0, 7);
      const keyThis = `${year}-${keyLast.slice(5)}`;
      const cur = byMonth.get(keyThis);
      if (cur) cur.lastRev += Number(tx.amount);
    }

    let thisYearTotalRevenue = 0;
    let lastYearTotalRevenue = 0;
    let thisYearSumOcc = 0;
    let lastYearSumOcc = 0;
    const byMonthArr: YearOverYearMonthRow[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const cur = byMonth.get(key)!;
      cur.thisRev = Math.round(cur.thisRev * 100) / 100;
      cur.lastRev = Math.round(cur.lastRev * 100) / 100;
      thisYearTotalRevenue += cur.thisRev;
      lastYearTotalRevenue += cur.lastRev;
      thisYearSumOcc += cur.thisOcc;
      lastYearSumOcc += cur.lastOcc;
      const occChange =
        cur.lastOcc !== 0 ? Math.round(((cur.thisOcc - cur.lastOcc) / cur.lastOcc) * 10000) / 100 : null;
      const revChange =
        cur.lastRev !== 0 ? Math.round(((cur.thisRev - cur.lastRev) / cur.lastRev) * 10000) / 100 : null;
      byMonthArr.push({
        month: key,
        thisYearOccupancy: cur.thisOcc,
        lastYearOccupancy: cur.lastOcc,
        thisYearRevenue: cur.thisRev,
        lastYearRevenue: cur.lastRev,
        occupancyChangePercent: occChange,
        revenueChangePercent: revChange,
      });
    }

    const thisYearAvgOccupancy = byMonthArr.length > 0 ? Math.round((thisYearSumOcc / 12) * 100) / 100 : 0;
    const lastYearAvgOccupancy = byMonthArr.length > 0 ? Math.round((lastYearSumOcc / 12) * 100) / 100 : 0;

    return {
      success: true,
      data: {
        year,
        lastYear: year - 1,
        byMonth: byMonthArr,
        thisYearAvgOccupancy,
        lastYearAvgOccupancy,
        thisYearTotalRevenue: Math.round(thisYearTotalRevenue * 100) / 100,
        lastYearTotalRevenue: Math.round(lastYearTotalRevenue * 100) / 100,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu YoY",
    };
  }
}

export type MonthOverMonthReport = {
  year: number;
  month: number;
  lastYear: number;
  lastMonth: number;
  thisMonthOccupancy: number;
  lastMonthOccupancy: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  occupancyChangePercent: number | null;
  revenueChangePercent: number | null;
};

/** Raport porównawczy miesiąc-do-miesiąca (MoM) – obłożenie i przychód: bieżący miesiąc vs poprzedni. */
export async function getMonthOverMonthReport(
  year: number,
  month: number
): Promise<{ success: true; data: MonthOverMonthReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu MoM" };
  }
  try {
    if (month < 1 || month > 12) return { success: false, error: "Nieprawidłowy miesiąc" };
    const lastMonthDate = new Date(year, month - 2, 1);
    const lastYear = lastMonthDate.getFullYear();
    const lastMonth = lastMonthDate.getMonth() + 1;

    const fromStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const lastFromStr = `${lastYear}-${String(lastMonth).padStart(2, "0")}-01`;
    const lastLastDay = new Date(lastYear, lastMonth, 0).getDate();
    const lastToStr = `${lastYear}-${String(lastMonth).padStart(2, "0")}-${String(lastLastDay).padStart(2, "0")}`;

    const [occThis, occLast, revThis, revLast] = await Promise.all([
      getOccupancyReport(fromStr, toStr),
      getOccupancyReport(lastFromStr, lastToStr),
      getRevenueReport(fromStr, toStr),
      getRevenueReport(lastFromStr, lastToStr),
    ]);

    if (!occThis.success || !occLast.success || !revThis.success || !revLast.success) {
      return { success: false, error: "Błąd pobierania danych" };
    }

    const thisMonthOccupancy = occThis.data.avgOccupancyPercent;
    const lastMonthOccupancy = occLast.data.avgOccupancyPercent;
    const thisMonthRevenue = revThis.data.total;
    const lastMonthRevenue = revLast.data.total;
    const occupancyChangePercent =
      lastMonthOccupancy !== 0
        ? Math.round(((thisMonthOccupancy - lastMonthOccupancy) / lastMonthOccupancy) * 10000) / 100
        : null;
    const revenueChangePercent =
      lastMonthRevenue !== 0
        ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 10000) / 100
        : null;

    return {
      success: true,
      data: {
        year,
        month,
        lastYear,
        lastMonth,
        thisMonthOccupancy,
        lastMonthOccupancy,
        thisMonthRevenue,
        lastMonthRevenue,
        occupancyChangePercent,
        revenueChangePercent,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu MoM",
    };
  }
}

export type CashShiftRow = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number | null;
  expectedCashAtClose: number | null;
  difference: number | null;
  openedByName: string | null;
  closedByName: string | null;
};
export type CashShiftReport = {
  from: string;
  to: string;
  shifts: CashShiftRow[];
  totalCount: number;
};

/** Raport kasowy (cash report by shift) – zmiany kasowe w zakresie dat (wg daty otwarcia). */
export async function getCashShiftReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: CashShiftReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu kasowego" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const shifts = await prisma.cashShift.findMany({
      where: { openedAt: { gte: from, lte: to } },
      select: {
        id: true,
        openedAt: true,
        closedAt: true,
        openingBalance: true,
        closingBalance: true,
        expectedCashAtClose: true,
        difference: true,
        openedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    const rows: CashShiftRow[] = shifts.map((s) => ({
      id: s.id,
      openedAt: s.openedAt.toISOString().slice(0, 19).replace("T", " "),
      closedAt: s.closedAt ? s.closedAt.toISOString().slice(0, 19).replace("T", " ") : null,
      openingBalance: Math.round(Number(s.openingBalance) * 100) / 100,
      closingBalance: s.closingBalance != null ? Math.round(Number(s.closingBalance) * 100) / 100 : null,
      expectedCashAtClose: s.expectedCashAtClose != null ? Math.round(Number(s.expectedCashAtClose) * 100) / 100 : null,
      difference: s.difference != null ? Math.round(Number(s.difference) * 100) / 100 : null,
      openedByName: s.openedBy?.name ?? null,
      closedByName: s.closedBy?.name ?? null,
    }));

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        shifts: rows,
        totalCount: rows.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu kasowego",
    };
  }
}

export type BankReconciliationDayRow = {
  date: string;
  totalAmount: number;
  transactionCount: number;
};
export type BankReconciliationReport = {
  from: string;
  to: string;
  byDate: BankReconciliationDayRow[];
  totalAmount: number;
  totalCount: number;
};

/** Raport bankowy (bank reconciliation) – dzienne sumy transakcji (bez VOID) do porównania z wyciągiem bankowym. */
export async function getBankReconciliationReport(
  fromStr: string,
  toStr: string
): Promise<{ success: true; data: BankReconciliationReport } | { success: false; error: string }> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu bankowego" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        type: { not: "VOID" },
      },
      select: { amount: true, createdAt: true },
    });

    const byDate = new Map<string, { amount: number; count: number }>();
    let totalAmount = 0;
    let totalCount = 0;
    for (const tx of transactions) {
      const dateKey = new Date(tx.createdAt).toISOString().slice(0, 10);
      const cur = byDate.get(dateKey) ?? { amount: 0, count: 0 };
      cur.amount += Number(tx.amount);
      cur.count += 1;
      byDate.set(dateKey, cur);
      totalAmount += Number(tx.amount);
      totalCount += 1;
    }
    const byDateArr: BankReconciliationDayRow[] = Array.from(byDate.entries())
      .map(([date, data]) => ({
        date,
        totalAmount: Math.round(data.amount * 100) / 100,
        transactionCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    totalAmount = Math.round(totalAmount * 100) / 100;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        byDate: byDateArr,
        totalAmount,
        totalCount,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu bankowego",
    };
  }
}
