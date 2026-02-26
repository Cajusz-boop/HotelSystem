"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface AssortmentItemData {
  id: string;
  name: string;
  defaultPrice: number;
  vatRate: number;
  gtuCode: string | null;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Lista pozycji asortymentu (do fakturowania). */
export async function getAssortmentItems(): Promise<
  ActionResult<AssortmentItemData[]>
> {
  try {
    const list = await prisma.assortmentItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return {
      success: true,
      data: list.map((i) => ({
        id: i.id,
        name: i.name,
        defaultPrice: Number(i.defaultPrice),
        vatRate: Number(i.vatRate),
        gtuCode: i.gtuCode,
        category: i.category,
        sortOrder: i.sortOrder,
        isActive: i.isActive,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu asortymentu",
    };
  }
}

/** Tworzy pozycję asortymentu. */
export async function createAssortmentItem(params: {
  name: string;
  defaultPrice: number;
  vatRate: number;
  gtuCode?: string | null;
  category?: string | null;
  sortOrder?: number;
}): Promise<ActionResult<AssortmentItemData>> {
  const { name, defaultPrice, vatRate, gtuCode, category, sortOrder = 0 } = params;
  if (!name?.trim()) return { success: false, error: "Nazwa jest wymagana" };
  if (defaultPrice < 0) return { success: false, error: "Cena nie może być ujemna" };
  if (vatRate < 0 || vatRate > 100) return { success: false, error: "Stawka VAT 0–100%" };
  try {
    const item = await prisma.assortmentItem.create({
      data: {
        name: name.trim(),
        defaultPrice,
        vatRate,
        gtuCode: gtuCode?.trim() || null,
        category: category?.trim() || null,
        sortOrder,
      },
    });
    revalidatePath("/ustawienia/asortyment");
    return {
      success: true,
      data: {
        id: item.id,
        name: item.name,
        defaultPrice: Number(item.defaultPrice),
        vatRate: Number(item.vatRate),
        gtuCode: item.gtuCode,
        category: item.category,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu pozycji",
    };
  }
}

/** Aktualizuje pozycję asortymentu. */
export async function updateAssortmentItem(
  id: string,
  params: Partial<{
    name: string;
    defaultPrice: number;
    vatRate: number;
    gtuCode: string | null;
    category: string | null;
    sortOrder: number;
    isActive: boolean;
  }>
): Promise<ActionResult<AssortmentItemData>> {
  if (!id) return { success: false, error: "Brak ID pozycji" };
  if (params.name !== undefined && !params.name?.trim())
    return { success: false, error: "Nazwa nie może być pusta" };
  if (params.defaultPrice !== undefined && params.defaultPrice < 0)
    return { success: false, error: "Cena nie może być ujemna" };
  if (params.vatRate !== undefined && (params.vatRate < 0 || params.vatRate > 100))
    return { success: false, error: "Stawka VAT 0–100%" };
  try {
    const item = await prisma.assortmentItem.update({
      where: { id },
      data: {
        ...(params.name !== undefined && { name: params.name.trim() }),
        ...(params.defaultPrice !== undefined && { defaultPrice: params.defaultPrice }),
        ...(params.vatRate !== undefined && { vatRate: params.vatRate }),
        ...(params.gtuCode !== undefined && { gtuCode: params.gtuCode?.trim() || null }),
        ...(params.category !== undefined && { category: params.category?.trim() || null }),
        ...(params.sortOrder !== undefined && { sortOrder: params.sortOrder }),
        ...(params.isActive !== undefined && { isActive: params.isActive }),
      },
    });
    revalidatePath("/ustawienia/asortyment");
    return {
      success: true,
      data: {
        id: item.id,
        name: item.name,
        defaultPrice: Number(item.defaultPrice),
        vatRate: Number(item.vatRate),
        gtuCode: item.gtuCode,
        category: item.category,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji pozycji",
    };
  }
}

/** Usuwa pozycję asortymentu. */
export async function deleteAssortmentItem(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: "Brak ID pozycji" };
  try {
    await prisma.assortmentItem.delete({ where: { id } });
    revalidatePath("/ustawienia/asortyment");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania pozycji",
    };
  }
}
