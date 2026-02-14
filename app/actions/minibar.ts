"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface MinibarItemForUi {
  id: string;
  name: string;
  price: number;
  unit: string;
}

/** Lista pozycji minibaru. */
export async function getMinibarItems(): Promise<
  ActionResult<MinibarItemForUi[]>
> {
  try {
    const list = await prisma.minibarItem.findMany({
      orderBy: { name: "asc" },
    });
    return {
      success: true,
      data: list.map((i) => ({
        id: i.id,
        name: i.name,
        price: Number(i.price),
        unit: i.unit,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu minibaru",
    };
  }
}

/** Dodaje pozycję minibaru. */
export async function createMinibarItem(data: {
  name: string;
  price: number;
  unit?: string;
}): Promise<ActionResult<MinibarItemForUi>> {
  if (!data.name?.trim()) return { success: false, error: "Nazwa wymagana" };
  if (data.price < 0 || !Number.isFinite(data.price)) {
    return { success: false, error: "Cena musi być liczbą nieujemną" };
  }
  try {
    const created = await prisma.minibarItem.create({
      data: {
        name: data.name.trim(),
        price: data.price,
        unit: data.unit ?? "szt",
      },
    });
    revalidatePath("/housekeeping");
    return {
      success: true,
      data: {
        id: created.id,
        name: created.name,
        price: Number(created.price),
        unit: created.unit,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu",
    };
  }
}

/** Aktualizuje pozycję minibaru. */
export async function updateMinibarItem(
  id: string,
  data: { name?: string; price?: number; unit?: string }
): Promise<ActionResult<MinibarItemForUi>> {
  try {
    const updated = await prisma.minibarItem.update({
      where: { id },
      data: {
        ...(data.name != null && { name: data.name.trim() }),
        ...(data.price != null && Number.isFinite(data.price) && { price: data.price }),
        ...(data.unit != null && { unit: data.unit }),
      },
    });
    revalidatePath("/housekeeping");
    return {
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        price: Number(updated.price),
        unit: updated.unit,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu",
    };
  }
}

/** Usuwa pozycję minibaru. */
export async function deleteMinibarItem(id: string): Promise<ActionResult> {
  try {
    await prisma.minibarItem.delete({ where: { id } });
    revalidatePath("/housekeeping");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania",
    };
  }
}

/** Dolicza zużycie minibaru do rachunku rezerwacji (MinibarConsumption + Transaction MINIBAR). */
export async function addMinibarToReservation(
  reservationId: string,
  items: Array<{ minibarItemId: string; quantity: number }>
): Promise<ActionResult<{ transactionIds: string[] }>> {
  if (!items.length) return { success: false, error: "Brak pozycji" };
  const hasNegative = items.some((x) => typeof x.quantity !== "number" || x.quantity < 0);
  if (hasNegative) {
    return { success: false, error: "Ilość zużycia minibaru nie może być ujemna" };
  }
  try {
    const headersList = await headers();
    const ipAddress = getClientIp(headersList);
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    const transactionIds: string[] = [];
    for (const { minibarItemId, quantity } of items) {
      if (quantity <= 0) continue;
      const item = await prisma.minibarItem.findUnique({
        where: { id: minibarItemId },
      });
      if (!item) continue;
      const amount = Math.round(Number(item.price) * quantity * 100) / 100;
      const consumption = await prisma.minibarConsumption.create({
        data: {
          reservationId,
          minibarItemId,
          quantity,
          amount,
        },
      });
      await createAuditLog({
        actionType: "CREATE",
        entityType: "MinibarConsumption",
        entityId: consumption.id,
        newValue: { reservationId, minibarItemId, itemName: item.name, quantity, amount },
        ipAddress,
      });
      const tx = await prisma.transaction.create({
        data: {
          reservationId,
          amount,
          type: "MINIBAR",
          isReadOnly: false,
        },
      });
      transactionIds.push(tx.id);
    }
    if (transactionIds.length === 0) {
      return { success: false, error: "Brak prawidłowych pozycji" };
    }
    revalidatePath("/finance");
    revalidatePath("/reports");
    return { success: true, data: { transactionIds } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd doliczania minibaru",
    };
  }
}

/** Lista zużyć minibaru dla rezerwacji. */
export async function getMinibarConsumptionsForReservation(
  reservationId: string
): Promise<
  ActionResult<
    Array<{ id: string; itemName: string; quantity: number; amount: number }>
  >
> {
  try {
    const list = await prisma.minibarConsumption.findMany({
      where: { reservationId },
      include: { minibarItem: true },
      orderBy: { createdAt: "desc" },
    });
    return {
      success: true,
      data: list.map((c) => ({
        id: c.id,
        itemName: c.minibarItem.name,
        quantity: c.quantity,
        amount: Number(c.amount),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu",
    };
  }
}

export type MinibarConsumptionReportRow = {
  itemName: string;
  totalQuantity: number;
  totalAmount: number;
};
export type MinibarConsumptionReport = {
  from: string;
  to: string;
  byItem: MinibarConsumptionReportRow[];
  totalAmount: number;
  totalRecords: number;
};

/** Raport zużycia minibaru w zakresie dat (wg pozycji: łączna ilość i kwota). */
export async function getMinibarConsumptionReport(
  fromStr: string,
  toStr: string
): Promise<ActionResult<MinibarConsumptionReport>> {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.kpi");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu minibaru" };
  }
  try {
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const consumptions = await prisma.minibarConsumption.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        minibarItemId: true,
        quantity: true,
        amount: true,
        minibarItem: { select: { name: true } },
      },
    });

    const byItem = new Map<string, { quantity: number; amount: number }>();
    let totalAmount = 0;
    for (const c of consumptions) {
      const name = c.minibarItem?.name ?? "—";
      const cur = byItem.get(name) ?? { quantity: 0, amount: 0 };
      cur.quantity += c.quantity;
      cur.amount += Number(c.amount);
      byItem.set(name, cur);
      totalAmount += Number(c.amount);
    }
    const byItemArr: MinibarConsumptionReportRow[] = Array.from(byItem.entries())
      .map(([itemName, data]) => ({
        itemName,
        totalQuantity: data.quantity,
        totalAmount: Math.round(data.amount * 100) / 100,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
    totalAmount = Math.round(totalAmount * 100) / 100;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        byItem: byItemArr,
        totalAmount,
        totalRecords: consumptions.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu minibaru",
    };
  }
}
