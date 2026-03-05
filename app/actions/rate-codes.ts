"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { autoExportConfigSnapshot } from "@/lib/config-snapshot";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface RateCodeForUi {
  id: string;
  code: string;
  name: string;
  price: number | null;
  basePrice: number | null;
  pricePerPerson: number | null;
}

/** Oblicza cenę za dobę dla RateCode: wzór (basePrice + pricePerPerson × pax) lub stała price */
export function computeRateCodePricePerNight(
  rc: { price?: number | null; basePrice?: number | null; pricePerPerson?: number | null },
  pax: number
): number | null {
  if (rc.basePrice != null && rc.pricePerPerson != null && Number.isFinite(rc.basePrice) && Number.isFinite(rc.pricePerPerson)) {
    const p = Math.max(1, pax);
    return rc.basePrice + rc.pricePerPerson * p;
  }
  if (rc.price != null && Number.isFinite(rc.price)) return rc.price;
  return null;
}

/** Lista kodów stawek */
export async function getRateCodes(): Promise<ActionResult<RateCodeForUi[]>> {
  try {
    const list = await prisma.rateCode.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, price: true, basePrice: true, pricePerPerson: true },
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        price: r.price != null ? Number(r.price) : null,
        basePrice: r.basePrice != null ? Number(r.basePrice) : null,
        pricePerPerson: r.pricePerPerson != null ? Number(r.pricePerPerson) : null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu kodów stawek",
    };
  }
}

/** Tworzy kod stawki */
export async function createRateCode(data: {
  code: string;
  name: string;
  price?: number | null;
  basePrice?: number | null;
  pricePerPerson?: number | null;
}): Promise<ActionResult<RateCodeForUi>> {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();
  if (!code || !name) {
    return { success: false, error: "Kod i nazwa wymagane." };
  }
  if (data.price != null && (data.price < 0 || !Number.isFinite(data.price))) {
    return { success: false, error: "Cena musi być liczbą nieujemną." };
  }
  if (data.basePrice != null && (data.basePrice < 0 || !Number.isFinite(data.basePrice))) {
    return { success: false, error: "Cena bazowa musi być liczbą nieujemną." };
  }
  if (data.pricePerPerson != null && (data.pricePerPerson < 0 || !Number.isFinite(data.pricePerPerson))) {
    return { success: false, error: "Cena za osobę musi być liczbą nieujemną." };
  }
  try {
    const created = await prisma.rateCode.create({
      data: {
        code,
        name,
        price: data.price ?? null,
        basePrice: data.basePrice ?? null,
        pricePerPerson: data.pricePerPerson ?? null,
      },
    });
    revalidatePath("/cennik");
    revalidatePath("/front-office");
    return {
      success: true,
      data: {
        id: created.id,
        code: created.code,
        name: created.name,
        price: created.price != null ? Number(created.price) : null,
        basePrice: created.basePrice != null ? Number(created.basePrice) : null,
        pricePerPerson: created.pricePerPerson != null ? Number(created.pricePerPerson) : null,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu kodu stawki",
    };
  }
}

/** Aktualizuje kod stawki */
export async function updateRateCode(
  id: string,
  data: { code?: string; name?: string; price?: number | null; basePrice?: number | null; pricePerPerson?: number | null }
): Promise<ActionResult<RateCodeForUi>> {
  if (data.price != null && (data.price < 0 || !Number.isFinite(data.price))) {
    return { success: false, error: "Cena musi być liczbą nieujemną." };
  }
  if (data.basePrice != null && (data.basePrice < 0 || !Number.isFinite(data.basePrice))) {
    return { success: false, error: "Cena bazowa musi być liczbą nieujemną." };
  }
  if (data.pricePerPerson != null && (data.pricePerPerson < 0 || !Number.isFinite(data.pricePerPerson))) {
    return { success: false, error: "Cena za osobę musi być liczbą nieujemną." };
  }
  try {
    const updated = await prisma.rateCode.update({
      where: { id },
      data: {
        ...(data.code != null && { code: data.code.trim().toUpperCase() }),
        ...(data.name != null && { name: data.name.trim() }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
        ...(data.pricePerPerson !== undefined && { pricePerPerson: data.pricePerPerson }),
      },
    });
    autoExportConfigSnapshot();
    revalidatePath("/cennik");
    revalidatePath("/front-office");
    return {
      success: true,
      data: {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        price: updated.price != null ? Number(updated.price) : null,
        basePrice: updated.basePrice != null ? Number(updated.basePrice) : null,
        pricePerPerson: updated.pricePerPerson != null ? Number(updated.pricePerPerson) : null,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji kodu stawki",
    };
  }
}

/** Usuwa kod stawki */
export async function deleteRateCode(id: string): Promise<ActionResult> {
  try {
    await prisma.rateCode.delete({ where: { id } });
    revalidatePath("/cennik");
    revalidatePath("/front-office");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usunięcia kodu stawki",
    };
  }
}
