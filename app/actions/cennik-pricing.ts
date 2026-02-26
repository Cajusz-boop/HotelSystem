"use server";

import { getEffectivePropertyId } from "@/app/actions/properties";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// --- Daily Rate Overrides ---

export type DailyRateOverrideRow = {
  id: string;
  propertyId: string;
  roomTypeId: string;
  roomTypeName: string;
  date: string;
  price: number | null;
  pricePerPerson: number | null;
  adultPrice: number | null;
  child1Price: number | null;
  child2Price: number | null;
  child3Price: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  isClosed: boolean;
  reason: string | null;
};

export async function getDailyRateOverrides(params: {
  propertyId?: string | null;
  roomTypeId?: string;
  dateFrom: string;
  dateTo: string;
}): Promise<ActionResult<DailyRateOverrideRow[]>> {
  try {
    const propertyId = params.propertyId ?? (await getEffectivePropertyId());
    if (!propertyId) return { success: true, data: [] };
    const dateFrom = new Date(params.dateFrom + "T00:00:00Z");
    const dateTo = new Date(params.dateTo + "T23:59:59.999Z");
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      return { success: false, error: "Nieprawidłowy zakres dat." };
    }
    const where: {
      propertyId: string;
      date: { gte: Date; lte: Date };
      roomTypeId?: string;
    } = {
      propertyId,
      date: { gte: dateFrom, lte: dateTo },
    };
    if (params.roomTypeId) where.roomTypeId = params.roomTypeId;
    const list = await prisma.dailyRateOverride.findMany({
      where,
      include: { roomType: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { roomTypeId: "asc" }],
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        propertyId: r.propertyId,
        roomTypeId: r.roomTypeId,
        roomTypeName: r.roomType.name,
        date: r.date.toISOString().slice(0, 10),
        price: r.price != null ? Number(r.price) : null,
        pricePerPerson: r.pricePerPerson != null ? Number(r.pricePerPerson) : null,
        adultPrice: r.adultPrice != null ? Number(r.adultPrice) : null,
        child1Price: r.child1Price != null ? Number(r.child1Price) : null,
        child2Price: r.child2Price != null ? Number(r.child2Price) : null,
        child3Price: r.child3Price != null ? Number(r.child3Price) : null,
        closedToArrival: r.closedToArrival,
        closedToDeparture: r.closedToDeparture,
        isClosed: r.isClosed,
        reason: r.reason,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu nadpisań cen",
    };
  }
}

export async function setDailyRateOverride(params: {
  propertyId?: string | null;
  roomTypeId: string;
  date: string;
  price?: number | null;
  pricePerPerson?: number | null;
  adultPrice?: number | null;
  child1Price?: number | null;
  child2Price?: number | null;
  child3Price?: number | null;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  isClosed?: boolean;
  reason?: string | null;
}): Promise<ActionResult<DailyRateOverrideRow>> {
  try {
    const propertyId = params.propertyId ?? (await getEffectivePropertyId());
    if (!propertyId) return { success: false, error: "Nie wybrano obiektu." };
    const date = new Date(params.date + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return { success: false, error: "Nieprawidłowa data." };

    const data = {
      price: params.price ?? null,
      pricePerPerson: params.pricePerPerson ?? null,
      adultPrice: params.adultPrice ?? null,
      child1Price: params.child1Price ?? null,
      child2Price: params.child2Price ?? null,
      child3Price: params.child3Price ?? null,
      closedToArrival: params.closedToArrival ?? false,
      closedToDeparture: params.closedToDeparture ?? false,
      isClosed: params.isClosed ?? false,
      reason: params.reason?.trim() || null,
    };

    const r = await prisma.dailyRateOverride.upsert({
      where: {
        propertyId_roomTypeId_date: {
          propertyId,
          roomTypeId: params.roomTypeId,
          date,
        },
      },
      create: {
        propertyId,
        roomTypeId: params.roomTypeId,
        date,
        ...data,
      },
      update: data,
      include: { roomType: { select: { name: true } } },
    });
    revalidatePath("/cennik");
    return {
      success: true,
      data: {
        id: r.id,
        propertyId: r.propertyId,
        roomTypeId: r.roomTypeId,
        roomTypeName: r.roomType.name,
        date: r.date.toISOString().slice(0, 10),
        price: r.price != null ? Number(r.price) : null,
        pricePerPerson: r.pricePerPerson != null ? Number(r.pricePerPerson) : null,
        adultPrice: r.adultPrice != null ? Number(r.adultPrice) : null,
        child1Price: r.child1Price != null ? Number(r.child1Price) : null,
        child2Price: r.child2Price != null ? Number(r.child2Price) : null,
        child3Price: r.child3Price != null ? Number(r.child3Price) : null,
        closedToArrival: r.closedToArrival,
        closedToDeparture: r.closedToDeparture,
        isClosed: r.isClosed,
        reason: r.reason,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu nadpisania",
    };
  }
}

export async function deleteDailyRateOverride(params: {
  propertyId?: string | null;
  roomTypeId: string;
  date: string;
}): Promise<ActionResult> {
  try {
    const propertyId = params.propertyId ?? (await getEffectivePropertyId());
    if (!propertyId) return { success: false, error: "Nie wybrano obiektu." };
    const date = new Date(params.date + "T12:00:00Z");
    await prisma.dailyRateOverride.deleteMany({
      where: {
        propertyId,
        roomTypeId: params.roomTypeId,
        date,
      },
    });
    revalidatePath("/cennik");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania nadpisania",
    };
  }
}

export async function bulkSetDailyRateOverrides(params: {
  propertyId?: string | null;
  roomTypeIds: string[];
  dateFrom: string;
  dateTo: string;
  price?: number | null;
  adjustmentType?: "SET" | "PERCENT_ADD" | "FIXED_ADD";
  adjustmentValue?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  isClosed?: boolean;
  reason?: string | null;
}): Promise<ActionResult<{ created: number; updated: number }>> {
  try {
    const propertyId = params.propertyId ?? (await getEffectivePropertyId());
    if (!propertyId) return { success: false, error: "Nie wybrano obiektu." };
    const dateFrom = new Date(params.dateFrom + "T00:00:00Z");
    const dateTo = new Date(params.dateTo + "T00:00:00Z");
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime()) || dateTo < dateFrom) {
      return { success: false, error: "Nieprawidłowy zakres dat." };
    }
    let created = 0;
    let updated = 0;
    for (let d = new Date(dateFrom); d <= dateTo; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      for (const roomTypeId of params.roomTypeIds) {
        const existing = await prisma.dailyRateOverride.findUnique({
          where: {
            propertyId_roomTypeId_date: {
              propertyId,
              roomTypeId,
              date: new Date(dateStr + "T12:00:00Z"),
            },
          },
        });
        let price: number | null = params.price ?? null;
        if (params.adjustmentType && params.adjustmentValue != null && existing?.price != null) {
          const base = Number(existing.price);
          if (params.adjustmentType === "PERCENT_ADD") {
            price = base * (1 + params.adjustmentValue / 100);
          } else if (params.adjustmentType === "FIXED_ADD") {
            price = base + params.adjustmentValue;
          }
        } else if (params.adjustmentType === "SET" && params.adjustmentValue != null) {
          price = params.adjustmentValue;
        }
        await prisma.dailyRateOverride.upsert({
          where: {
            propertyId_roomTypeId_date: {
              propertyId,
              roomTypeId,
              date: new Date(dateStr + "T12:00:00Z"),
            },
          },
          create: {
            propertyId,
            roomTypeId,
            date: new Date(dateStr + "T12:00:00Z"),
            price,
            closedToArrival: params.closedToArrival ?? false,
            closedToDeparture: params.closedToDeparture ?? false,
            isClosed: params.isClosed ?? false,
            reason: params.reason?.trim() || null,
          },
          update: {
            ...(price != null && { price }),
            closedToArrival: params.closedToArrival ?? false,
            closedToDeparture: params.closedToDeparture ?? false,
            isClosed: params.isClosed ?? false,
            reason: params.reason?.trim() || null,
          },
        });
        if (existing) updated++;
        else created++;
      }
    }
    revalidatePath("/cennik");
    return { success: true, data: { created, updated } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zmiany hurtowej",
    };
  }
}

// --- Long Stay Discounts ---

export type LongStayDiscountRow = {
  id: string;
  minNights: number;
  discountPercent: number | null;
  discountFixed: number | null;
  isActive: boolean;
};

export async function getLongStayDiscounts(
  propertyId?: string | null
): Promise<ActionResult<LongStayDiscountRow[]>> {
  try {
    const pid = propertyId ?? (await getEffectivePropertyId());
    if (!pid) return { success: true, data: [] };
    const list = await prisma.longStayDiscount.findMany({
      where: { propertyId: pid },
      orderBy: { minNights: "asc" },
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        minNights: r.minNights,
        discountPercent: r.discountPercent != null ? Number(r.discountPercent) : null,
        discountFixed: r.discountFixed != null ? Number(r.discountFixed) : null,
        isActive: r.isActive,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rabatów",
    };
  }
}

export async function saveLongStayDiscount(params: {
  propertyId?: string | null;
  minNights: number;
  discountPercent?: number | null;
  discountFixed?: number | null;
  isActive: boolean;
}): Promise<ActionResult<LongStayDiscountRow>> {
  try {
    const propertyId = params.propertyId ?? (await getEffectivePropertyId());
    if (!propertyId) return { success: false, error: "Nie wybrano obiektu." };
    const r = await prisma.longStayDiscount.upsert({
      where: {
        propertyId_minNights: {
          propertyId,
          minNights: params.minNights,
        },
      },
      create: {
        propertyId,
        minNights: params.minNights,
        discountPercent: params.discountPercent ?? null,
        discountFixed: params.discountFixed ?? null,
        isActive: params.isActive,
      },
      update: {
        discountPercent: params.discountPercent ?? null,
        discountFixed: params.discountFixed ?? null,
        isActive: params.isActive,
      },
    });
    revalidatePath("/cennik");
    return {
      success: true,
      data: {
        id: r.id,
        minNights: r.minNights,
        discountPercent: r.discountPercent != null ? Number(r.discountPercent) : null,
        discountFixed: r.discountFixed != null ? Number(r.discountFixed) : null,
        isActive: r.isActive,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu rabatu",
    };
  }
}

export async function deleteLongStayDiscount(id: string): Promise<ActionResult> {
  try {
    await prisma.longStayDiscount.delete({ where: { id } });
    revalidatePath("/cennik");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania rabatu",
    };
  }
}

// --- Service Rates ---

export type ServiceRateRow = {
  id: string;
  name: string;
  code: string;
  price: number;
  calculationMethod: string;
  vatRate: number | null;
  isActive: boolean;
  sortOrder: number;
};

export async function getServiceRates(
  propertyId?: string | null
): Promise<ActionResult<ServiceRateRow[]>> {
  try {
    const pid = propertyId ?? (await getEffectivePropertyId());
    if (!pid) return { success: true, data: [] };
    const list = await prisma.serviceRate.findMany({
      where: { propertyId: pid },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        price: Number(r.price),
        calculationMethod: r.calculationMethod,
        vatRate: r.vatRate != null ? Number(r.vatRate) : null,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu usług",
    };
  }
}

export async function saveServiceRate(params: {
  id?: string;
  propertyId?: string | null;
  name: string;
  code: string;
  price: number;
  calculationMethod: string;
  vatRate?: number | null;
  isActive: boolean;
  sortOrder?: number;
}): Promise<ActionResult<ServiceRateRow>> {
  try {
    const propertyId = params.propertyId ?? (await getEffectivePropertyId());
    if (!propertyId) return { success: false, error: "Nie wybrano obiektu." };
    const data = {
      name: params.name.trim(),
      code: params.code.trim().toUpperCase(),
      price: params.price,
      calculationMethod: params.calculationMethod || "PER_NIGHT",
      vatRate: params.vatRate ?? null,
      isActive: params.isActive,
      sortOrder: params.sortOrder ?? 0,
    };
    let r;
    if (params.id) {
      r = await prisma.serviceRate.update({
        where: { id: params.id },
        data,
      });
    } else {
      r = await prisma.serviceRate.create({
        data: { propertyId, ...data },
      });
    }
    revalidatePath("/cennik");
    return {
      success: true,
      data: {
        id: r.id,
        name: r.name,
        code: r.code,
        price: Number(r.price),
        calculationMethod: r.calculationMethod,
        vatRate: r.vatRate != null ? Number(r.vatRate) : null,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu usługi",
    };
  }
}

export async function deleteServiceRate(id: string): Promise<ActionResult> {
  try {
    await prisma.serviceRate.delete({ where: { id } });
    revalidatePath("/cennik");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania usługi",
    };
  }
}

// --- Age Groups ---

export type AgeGroupConfigRow = {
  id: string;
  group: string;
  label: string;
  ageFrom: number;
  ageTo: number;
  sortOrder: number;
};

export async function getAgeGroupConfig(
  propertyId?: string | null
): Promise<ActionResult<AgeGroupConfigRow[]>> {
  try {
    const pid = propertyId ?? (await getEffectivePropertyId());
    if (!pid) return { success: true, data: [] };
    const list = await prisma.ageGroupConfig.findMany({
      where: { propertyId: pid },
      orderBy: { sortOrder: "asc" },
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        group: r.group,
        label: r.label,
        ageFrom: r.ageFrom,
        ageTo: r.ageTo,
        sortOrder: r.sortOrder,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu grup wiekowych",
    };
  }
}

const DEFAULT_AGE_GROUPS = [
  { group: "ADULT", label: "Dorosły", ageFrom: 18, ageTo: 99 },
  { group: "CHILD1", label: "Dziecko 0-6", ageFrom: 0, ageTo: 6 },
  { group: "CHILD2", label: "Dziecko 7-12", ageFrom: 7, ageTo: 12 },
  { group: "CHILD3", label: "Dziecko 13-17", ageFrom: 13, ageTo: 17 },
];

export async function saveAgeGroupConfig(params: {
  propertyId?: string | null;
  groups: Array<{ group: string; label: string; ageFrom: number; ageTo: number }>;
}): Promise<ActionResult<AgeGroupConfigRow[]>> {
  try {
    const propertyId = params.propertyId ?? (await getEffectivePropertyId());
    if (!propertyId) return { success: false, error: "Nie wybrano obiektu." };
    const groups = params.groups.length > 0 ? params.groups : DEFAULT_AGE_GROUPS;
    await prisma.ageGroupConfig.deleteMany({ where: { propertyId } });
    const created: AgeGroupConfigRow[] = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const r = await prisma.ageGroupConfig.create({
        data: {
          propertyId,
          group: g.group,
          label: g.label.trim() || g.group,
          ageFrom: g.ageFrom,
          ageTo: g.ageTo,
          sortOrder: i,
        },
      });
      created.push({
        id: r.id,
        group: r.group,
        label: r.label,
        ageFrom: r.ageFrom,
        ageTo: r.ageTo,
        sortOrder: r.sortOrder,
      });
    }
    revalidatePath("/cennik");
    return {
      success: true,
      data: created,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu grup wiekowych",
    };
  }
}

// --- Seasons (table) ---

export type SeasonRow = {
  id: string;
  name: string;
  color: string | null;
  dateFrom: string;
  dateTo: string;
  year: number;
  sortOrder: number;
  isActive: boolean;
};

export async function getSeasonsFromTable(params?: {
  propertyId?: string | null;
  year?: number;
}): Promise<ActionResult<SeasonRow[]>> {
  try {
    const propertyId = params?.propertyId ?? (await getEffectivePropertyId());
    if (!propertyId) return { success: true, data: [] };
    const where: { propertyId: string; year?: number } = { propertyId };
    if (params?.year != null) where.year = params.year;
    const list = await prisma.season.findMany({
      where,
      orderBy: [{ year: "asc" }, { sortOrder: "asc" }, { dateFrom: "asc" }],
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        dateFrom: r.dateFrom.toISOString().slice(0, 10),
        dateTo: r.dateTo.toISOString().slice(0, 10),
        year: r.year,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu sezonów",
    };
  }
}

export async function saveSeason(params: {
  id?: string;
  propertyId?: string | null;
  name: string;
  color?: string | null;
  dateFrom: string;
  dateTo: string;
  year: number;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<ActionResult<SeasonRow>> {
  try {
    const propertyId = params.propertyId ?? (await getEffectivePropertyId());
    if (!propertyId) return { success: false, error: "Nie wybrano obiektu." };
    const dateFrom = new Date(params.dateFrom + "T12:00:00Z");
    const dateTo = new Date(params.dateTo + "T12:00:00Z");
    const data = {
      name: params.name.trim(),
      color: params.color?.trim() || null,
      dateFrom,
      dateTo,
      year: params.year,
      sortOrder: params.sortOrder ?? 0,
      isActive: params.isActive ?? true,
    };
    let r;
    if (params.id) {
      r = await prisma.season.update({
        where: { id: params.id },
        data,
      });
    } else {
      r = await prisma.season.create({
        data: { propertyId, ...data },
      });
    }
    revalidatePath("/cennik");
    return {
      success: true,
      data: {
        id: r.id,
        name: r.name,
        color: r.color,
        dateFrom: r.dateFrom.toISOString().slice(0, 10),
        dateTo: r.dateTo.toISOString().slice(0, 10),
        year: r.year,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu sezonu",
    };
  }
}

export async function deleteSeason(id: string): Promise<ActionResult> {
  try {
    await prisma.season.delete({ where: { id } });
    revalidatePath("/cennik");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania sezonu",
    };
  }
}

/** Kopiuj sezony z poprzedniego roku na wybrany rok */
export async function copySeasonsFromYearToYear(
  fromYear: number,
  toYear: number
): Promise<ActionResult<{ copied: number }>> {
  try {
    const propertyId = await getEffectivePropertyId();
    if (!propertyId) return { success: false, error: "Nie wybrano obiektu." };
    const source = await prisma.season.findMany({
      where: { propertyId, year: fromYear },
      orderBy: { sortOrder: "asc" },
    });
    let copied = 0;
    for (const s of source) {
      const from = new Date(s.dateFrom);
      const to = new Date(s.dateTo);
      from.setFullYear(toYear);
      to.setFullYear(toYear);
      await prisma.season.create({
        data: {
          propertyId,
          name: s.name,
          color: s.color,
          dateFrom: from,
          dateTo: to,
          year: toYear,
          sortOrder: s.sortOrder,
          isActive: s.isActive,
        },
      });
      copied++;
    }
    revalidatePath("/cennik");
    return { success: true, data: { copied } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd kopiowania sezonów",
    };
  }
}
