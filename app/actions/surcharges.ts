"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getEffectivePropertyId } from "@/app/actions/properties";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Lista typów dopłat do selecta (np. przy edycji rezerwacji). Zwraca typy globalne (propertyId=null) oraz dla bieżącego obiektu. */
export async function getSurchargeTypesForSelect(): Promise<
  ActionResult<Array<{ id: string; code: string; name: string; price: number; chargeType: string }>>
> {
  try {
    const propertyId = await getEffectivePropertyId();
    const list = await prisma.surchargeType.findMany({
      where: { isActive: true, OR: [{ propertyId: null }, { propertyId: propertyId ?? undefined }] },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, price: true, chargeType: true },
    });
    return {
      success: true,
      data: list.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        price: Number(s.price),
        chargeType: s.chargeType,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu typów dopłat",
    };
  }
}

export interface ReservationSurchargeForList {
  id: string;
  surchargeTypeId: string;
  code: string;
  name: string;
  price: number;
  chargeType: string;
  quantity: number;
  amountOverride: number | null;
}

/** Lista dopłat przypisanych do rezerwacji. */
export async function getReservationSurcharges(
  reservationId: string
): Promise<ActionResult<ReservationSurchargeForList[]>> {
  try {
    const list = await prisma.reservationSurcharge.findMany({
      where: { reservationId },
      include: { surchargeType: true },
      orderBy: { surchargeType: { code: "asc" } },
    });
    return {
      success: true,
      data: list.map((rs) => ({
        id: rs.id,
        surchargeTypeId: rs.surchargeTypeId,
        code: rs.surchargeType.code,
        name: rs.surchargeType.name,
        price: Number(rs.surchargeType.price),
        chargeType: rs.surchargeType.chargeType,
        quantity: rs.quantity,
        amountOverride: rs.amountOverride != null ? Number(rs.amountOverride) : null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu dopłat rezerwacji",
    };
  }
}

/** Przypisuje dopłatę do rezerwacji. Idempotentne: jeśli już jest ten typ, aktualizuje quantity/amountOverride. */
export async function addReservationSurcharge(
  reservationId: string,
  surchargeTypeId: string,
  quantity?: number,
  amountOverride?: number | null
): Promise<ActionResult<{ id: string }>> {
  try {
    const qty = quantity ?? 1;
    if (qty < 1) return { success: false, error: "Ilość musi być co najmniej 1" };

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };

    const surchargeType = await prisma.surchargeType.findUnique({
      where: { id: surchargeTypeId, isActive: true },
      select: { id: true },
    });
    if (!surchargeType) return { success: false, error: "Typ dopłaty nie istnieje lub jest nieaktywny" };

    const existing = await prisma.reservationSurcharge.findUnique({
      where: { reservationId_surchargeTypeId: { reservationId, surchargeTypeId } },
    });

    if (existing) {
      await prisma.reservationSurcharge.update({
        where: { id: existing.id },
        data: {
          quantity: qty,
          amountOverride: amountOverride != null ? amountOverride : undefined,
        },
      });
      revalidatePath("/rentals");
      revalidatePath("/finance");
      return { success: true, data: { id: existing.id } };
    }

    const rs = await prisma.reservationSurcharge.create({
      data: {
        reservationId,
        surchargeTypeId,
        quantity: qty,
        amountOverride: amountOverride != null ? amountOverride : undefined,
      },
    });
    revalidatePath("/rentals");
    revalidatePath("/finance");
    return { success: true, data: { id: rs.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd przypisywania dopłaty do rezerwacji",
    };
  }
}

/** Usuwa dopłatę z rezerwacji. */
export async function removeReservationSurcharge(
  reservationSurchargeId: string
): Promise<ActionResult<void>> {
  try {
    await prisma.reservationSurcharge.delete({
      where: { id: reservationSurchargeId },
    });
    revalidatePath("/rentals");
    revalidatePath("/finance");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania dopłaty z rezerwacji",
    };
  }
}
