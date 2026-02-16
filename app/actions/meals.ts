"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { MEAL_TYPES, MEAL_PLAN_MEALS, type MealType } from "@/lib/meals-constants";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Oczekiwana liczba posiłków wg planów wyżywienia – rezerwacje z checkIn<=date<checkOut, status CONFIRMED/CHECKED_IN. */
export async function getExpectedMealsForDate(dateStr: string): Promise<
  ActionResult<{ breakfast: number; lunch: number; dinner: number; byPlan: Record<string, { breakfast: number; lunch: number; dinner: number }> }>
> {
  try {
    const date = new Date(dateStr + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return { success: false, error: "Nieprawidłowa data" };

    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lte: date },
        checkOut: { gt: date },
        mealPlan: { not: null },
      },
      include: { guest: true, room: true },
    });

    let breakfast = 0, lunch = 0, dinner = 0;
    const byPlan: Record<string, { breakfast: number; lunch: number; dinner: number }> = {};

    for (const r of reservations) {
      const plan = (r.mealPlan ?? "RO").toUpperCase();
      const meals = MEAL_PLAN_MEALS[plan] ?? MEAL_PLAN_MEALS.BB ?? ["BREAKFAST"];
      const pax = r.pax ?? r.adults ?? 1;

      if (!byPlan[plan]) byPlan[plan] = { breakfast: 0, lunch: 0, dinner: 0 };
      for (const m of meals) {
        if (m === "BREAKFAST") { breakfast += pax; byPlan[plan].breakfast += pax; }
        if (m === "LUNCH") { lunch += pax; byPlan[plan].lunch += pax; }
        if (m === "DINNER") { dinner += pax; byPlan[plan].dinner += pax; }
      }
    }

    return { success: true, data: { breakfast, lunch, dinner, byPlan } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu",
    };
  }
}

/** Zarejestruj spożycie posiłków (tracking). */
export async function recordMealConsumption(
  reservationId: string,
  dateStr: string,
  mealType: MealType,
  paxCount: number
): Promise<ActionResult> {
  try {
    const date = new Date(dateStr + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return { success: false, error: "Nieprawidłowa data" };
    if (!MEAL_TYPES.includes(mealType)) return { success: false, error: "Nieprawidłowy typ posiłku" };
    if (paxCount < 1) return { success: false, error: "Liczba osób musi być >= 1" };

    await prisma.mealConsumption.upsert({
      where: {
        reservationId_date_mealType: { reservationId, date, mealType },
      },
      create: { reservationId, date, mealType, paxCount },
      update: { paxCount },
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu",
    };
  }
}

/** Zarejestrowane spożycia dla daty. */
export async function getMealConsumptionsForDate(dateStr: string): Promise<
  ActionResult<Array<{ id: string; reservationId: string; roomNumber: string; guestName: string; mealPlan: string | null; mealType: string; paxCount: number }>>
> {
  try {
    const date = new Date(dateStr + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return { success: false, error: "Nieprawidłowa data" };

    const list = await prisma.mealConsumption.findMany({
      where: { date },
      include: { reservation: { include: { guest: true, room: true } } },
    });

    const data = list.map((m) => ({
      id: m.id,
      reservationId: m.reservationId,
      roomNumber: m.reservation.room?.number ?? "—",
      guestName: m.reservation.guest.name,
      mealPlan: m.reservation.mealPlan,
      mealType: m.mealType,
      paxCount: m.paxCount,
    }));

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu",
    };
  }
}

/** Rezerwacje z planem wyżywienia na dany dzień – do listy i trackingu. */
export async function getReservationsWithMealPlanForDate(dateStr: string): Promise<
  ActionResult<Array<{ id: string; roomNumber: string; guestName: string; mealPlan: string; pax: number }>>
> {
  try {
    const date = new Date(dateStr + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return { success: false, error: "Nieprawidłowa data" };

    const list = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lte: date },
        checkOut: { gt: date },
        mealPlan: { not: null },
      },
      include: { guest: true, room: true },
    });

    const data = list.map((r) => ({
      id: r.id,
      roomNumber: r.room?.number ?? "—",
      guestName: r.guest.name,
      mealPlan: r.mealPlan!,
      pax: r.pax ?? r.adults ?? 1,
    }));

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu",
    };
  }
}

/** Raport posiłków na dzień – oczekiwane vs zarejestrowane (ile śniadań, obiadów, kolacji). */
export async function getMealReport(dateStr: string): Promise<
  ActionResult<{
    date: string;
    expected: { breakfast: number; lunch: number; dinner: number };
    consumed: { breakfast: number; lunch: number; dinner: number };
    byPlan: Record<string, { breakfast: number; lunch: number; dinner: number }>;
  }>
> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.meals");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu posiłków" };
  }
  try {
    const [expRes, consRes] = await Promise.all([
      getExpectedMealsForDate(dateStr),
      getMealConsumptionsForDate(dateStr),
    ]);
    if (!expRes.success || !expRes.data) return { success: false, error: "error" in expRes ? (expRes.error ?? "Błąd") : "Błąd" };

    const consumed = { breakfast: 0, lunch: 0, dinner: 0 };
    if (consRes.success && consRes.data) {
      for (const c of consRes.data) {
        if (c.mealType === "BREAKFAST") consumed.breakfast += c.paxCount;
        if (c.mealType === "LUNCH") consumed.lunch += c.paxCount;
        if (c.mealType === "DINNER") consumed.dinner += c.paxCount;
      }
    }

    return {
      success: true,
      data: {
        date: dateStr,
        expected: expRes.data,
        consumed,
        byPlan: expRes.data.byPlan ?? {},
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu",
    };
  }
}

/** Raport liczby posiłków wg daty (meal count by date) – dla zakresu dat: śniadania, obiady, kolacje (oczek. i skons.). */
export type MealCountByDateRow = {
  date: string;
  expected: { breakfast: number; lunch: number; dinner: number };
  consumed: { breakfast: number; lunch: number; dinner: number };
};
export type MealCountByDateReport = {
  from: string;
  to: string;
  byDate: MealCountByDateRow[];
};

export async function getMealCountByDateReport(
  fromStr: string,
  toStr: string
): Promise<ActionResult<MealCountByDateReport>> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.meals");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu posiłków" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (days > 365) return { success: false, error: "Zakres dat nie może przekraczać 365 dni" };

    const consumptions = await prisma.mealConsumption.findMany({
      where: {
        date: { gte: from, lte: to },
      },
      select: { date: true, mealType: true, paxCount: true },
    });

    const consumedByDate = new Map<string, { breakfast: number; lunch: number; dinner: number }>();
    for (const c of consumptions) {
      const key = c.date.toISOString().slice(0, 10);
      if (!consumedByDate.has(key)) consumedByDate.set(key, { breakfast: 0, lunch: 0, dinner: 0 });
      const row = consumedByDate.get(key)!;
      if (c.mealType === "BREAKFAST") row.breakfast += c.paxCount;
      if (c.mealType === "LUNCH") row.lunch += c.paxCount;
      if (c.mealType === "DINNER") row.dinner += c.paxCount;
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lte: to },
        checkOut: { gt: from },
        mealPlan: { not: null },
      },
      select: { checkIn: true, checkOut: true, mealPlan: true, pax: true, adults: true },
    });

    const byDate: MealCountByDateRow[] = [];
    const d = new Date(from);
    d.setUTCHours(0, 0, 0, 0);
    while (d <= to) {
      const dateKey = d.toISOString().slice(0, 10);
      let breakfast = 0, lunch = 0, dinner = 0;
      const dayStart = new Date(dateKey + "T00:00:00Z");
      const dayEnd = new Date(dateKey + "T23:59:59.999Z");
      for (const r of reservations) {
        const checkIn = new Date(r.checkIn);
        const checkOut = new Date(r.checkOut);
        if (checkIn > dayEnd || checkOut <= dayStart) continue;
        const plan = (r.mealPlan ?? "RO").toUpperCase();
        const meals = MEAL_PLAN_MEALS[plan as keyof typeof MEAL_PLAN_MEALS] ?? MEAL_PLAN_MEALS.BB;
        const pax = r.pax ?? r.adults ?? 1;
        for (const m of meals) {
          if (m === "BREAKFAST") breakfast += pax;
          if (m === "LUNCH") lunch += pax;
          if (m === "DINNER") dinner += pax;
        }
      }
      const consumed = consumedByDate.get(dateKey) ?? { breakfast: 0, lunch: 0, dinner: 0 };
      byDate.push({
        date: dateKey,
        expected: { breakfast, lunch, dinner },
        consumed,
      });
      d.setUTCDate(d.getUTCDate() + 1);
    }

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        byDate,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu",
    };
  }
}

