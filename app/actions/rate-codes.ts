"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface RateCodeForUi {
  id: string;
  code: string;
  name: string;
  price: number | null;
}

/** Lista kodów stawek */
export async function getRateCodes(): Promise<ActionResult<RateCodeForUi[]>> {
  try {
    const list = await prisma.rateCode.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, price: true },
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        price: r.price != null ? Number(r.price) : null,
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
}): Promise<ActionResult<RateCodeForUi>> {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();
  if (!code || !name) {
    return { success: false, error: "Kod i nazwa wymagane." };
  }
  if (data.price != null && (data.price < 0 || !Number.isFinite(data.price))) {
    return { success: false, error: "Cena musi być liczbą nieujemną." };
  }
  try {
    const created = await prisma.rateCode.create({
      data: {
        code,
        name,
        price: data.price ?? null,
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
  data: { code?: string; name?: string; price?: number | null }
): Promise<ActionResult<RateCodeForUi>> {
  if (data.price != null && (data.price < 0 || !Number.isFinite(data.price))) {
    return { success: false, error: "Cena musi być liczbą nieujemną." };
  }
  try {
    const updated = await prisma.rateCode.update({
      where: { id },
      data: {
        ...(data.code != null && { code: data.code.trim().toUpperCase() }),
        ...(data.name != null && { name: data.name.trim() }),
        ...(data.price !== undefined && { price: data.price }),
      },
    });
    revalidatePath("/cennik");
    revalidatePath("/front-office");
    return {
      success: true,
      data: {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        price: updated.price != null ? Number(updated.price) : null,
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
