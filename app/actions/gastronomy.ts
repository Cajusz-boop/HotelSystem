"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { chargeOrderToReservation } from "@/app/actions/finance";
import { revalidatePath } from "next/cache"; // eslint-disable-line @typescript-eslint/no-unused-vars

/** Zwraca preferencje dietetyczne i alergeny gościa dla rezerwacji (do ostrzeżeń w gastronomii). */
export async function getGuestDietAndAllergiesForReservation(
  reservationId: string
): Promise<
  ActionResult<{
    guestName: string;
    mealPreferences: { vegetarian?: boolean; vegan?: boolean; glutenFree?: boolean; lactoseFree?: boolean; halal?: boolean; kosher?: boolean; allergies?: string[]; other?: string };
    healthAllergies: string | null;
  }>
> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { guest: { select: { name: true, mealPreferences: true, healthAllergies: true } } },
    });
    if (!reservation?.guest) return { success: false, error: "Rezerwacja lub gość nie znaleziony" };
    const g = reservation.guest;
    const prefs = (g.mealPreferences as Record<string, unknown>) ?? {};
    return {
      success: true,
      data: {
        guestName: g.name,
        mealPreferences: {
          vegetarian: prefs.vegetarian === true,
          vegan: prefs.vegan === true,
          glutenFree: prefs.glutenFree === true,
          lactoseFree: prefs.lactoseFree === true,
          halal: prefs.halal === true,
          kosher: prefs.kosher === true,
          allergies: Array.isArray(prefs.allergies) ? (prefs.allergies as string[]) : [],
          other: typeof prefs.other === "string" ? prefs.other : undefined,
        },
        healthAllergies: g.healthAllergies ?? null,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu danych gościa",
    };
  }
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface MenuItemForUi {
  id: string;
  name: string;
  price: number;
  category: string;
  dietTags?: string[];
  allergens?: string[];
}

export interface OrderItemInput {
  menuItemId: string;
  quantity: number;
}


/** Dodaje pozycję do karty dań (z opcjonalnymi dietami i alergenami). */
export async function createMenuItem(
  name: string,
  price: number,
  category: string,
  dietTags?: string[],
  allergens?: string[]
): Promise<ActionResult<{ id: string }>> {
  try {
    const trimmedName = name?.trim();
    const trimmedCategory = category?.trim();
    if (!trimmedName) return { success: false, error: "Nazwa jest wymagana" };
    if (!trimmedCategory) return { success: false, error: "Kategoria jest wymagana" };
    if (typeof price !== "number" || price < 0) return { success: false, error: "Cena musi być liczbą nieujemną" };

    const created = await prisma.menuItem.create({
      data: {
        name: trimmedName,
        price,
        category: trimmedCategory,
        dietTags: (dietTags?.length ? dietTags : Prisma.JsonNull) as Prisma.InputJsonValue,
        allergens: (allergens?.length ? allergens : Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
    return { success: true, data: { id: created.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd dodawania pozycji",
    };
  }
}

/** Aktualizuje pozycję karty dań (diety i alergeny). */
export async function updateMenuItem(
  id: string,
  payload: { name?: string; price?: number; category?: string; dietTags?: string[] | null; allergens?: string[] | null }
): Promise<ActionResult> {
  try {
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Pozycja nie istnieje" };
    const data: Parameters<typeof prisma.menuItem.update>[0]["data"] = {};
    if (payload.name !== undefined) data.name = payload.name.trim();
    if (payload.price !== undefined) data.price = payload.price;
    if (payload.category !== undefined) data.category = payload.category.trim();
    if (payload.dietTags !== undefined) data.dietTags = (payload.dietTags?.length ? payload.dietTags : Prisma.JsonNull) as Prisma.InputJsonValue;
    if (payload.allergens !== undefined) data.allergens = (payload.allergens?.length ? payload.allergens : Prisma.JsonNull) as Prisma.InputJsonValue;
    await prisma.menuItem.update({ where: { id }, data });
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji pozycji",
    };
  }
}

/** Lista pozycji z karty dań (pogrupowane po kategoriach). */
export async function getMenu(): Promise<
  ActionResult<Array<{ category: string; items: MenuItemForUi[] }>>
> {
  try {
    const items = await prisma.menuItem.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const byCategory = new Map<string, MenuItemForUi[]>();
    for (const i of items) {
      const list = byCategory.get(i.category) ?? [];
      list.push({
        id: i.id,
        name: i.name,
        price: Number(i.price),
        category: i.category,
        dietTags: Array.isArray(i.dietTags) ? (i.dietTags as string[]) : undefined,
        allergens: Array.isArray(i.allergens) ? (i.allergens as string[]) : undefined,
      });
      byCategory.set(i.category, list);
    }

    const result = Array.from(byCategory.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({ category, items }));

    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu karty dań",
    };
  }
}

/** Tworzy zamówienie (room service / restauracja). */
export async function createOrder(
  reservationId: string | null,
  roomId: string | null,
  items: OrderItemInput[]
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!items.length) {
      return { success: false, error: "Zamówienie musi zawierać co najmniej jedną pozycję" };
    }
    if (!reservationId && !roomId) {
      return { success: false, error: "Podaj rezerwację lub pokój" };
    }
    if (reservationId?.trim()) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId.trim() },
        select: { id: true },
      });
      if (!reservation) {
        return { success: false, error: "Rezerwacja nie istnieje" };
      }
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: items.map((x) => x.menuItemId) } },
    });
    type MenuItemRow = { id: string; price: number | null };
    const menuMap = new Map<string, MenuItemRow>(menuItems.map((m) => [m.id, m as unknown as MenuItemRow]));
    const orderItemsToCreate = items
      .filter((x) => x.quantity > 0 && menuMap.has(x.menuItemId))
      .map((x) => {
        const m = menuMap.get(x.menuItemId)!;
        return { menuItemId: m.id, quantity: x.quantity, unitPrice: m.price };
      });

    if (orderItemsToCreate.length === 0) {
      return { success: false, error: "Brak prawidłowych pozycji w zamówieniu" };
    }

    const order = await prisma.order.create({
      data: {
        reservationId: reservationId?.trim() || null,
        roomId: roomId?.trim() || null,
        status: "PENDING",
        orderItems: { create: orderItemsToCreate },
      },
    });

    if (order.reservationId) {
      await chargeOrderToReservation(order.id).catch((err) =>
        console.error("[gastronomy] Błąd doliczenia zamówienia do rachunku:", err)
      );
    }

    return { success: true, data: { id: order.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia zamówienia",
    };
  }
}

/** Aktualizuje status zamówienia. */
export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<ActionResult> {
  try {
    const validStatuses = ["PENDING", "CONFIRMED", "IN_PROGRESS", "DELIVERED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return { success: false, error: "Nieprawidłowy status" };
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return { success: false, error: "Zamówienie nie istnieje" };

    await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji statusu zamówienia",
    };
  }
}

/** Lista zamówień (ostatnie, z możliwością filtrowania). */
export async function getOrders(
  limit = 50
): Promise<
  ActionResult<
    Array<{
      id: string;
      reservationId: string | null;
      roomId: string | null;
      roomNumber: string | null;
      guestName: string | null;
      status: string;
      totalAmount: number;
      itemCount: number;
      createdAt: string;
    }>
  >
> {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        room: { select: { number: true } },
        reservation: { include: { guest: { select: { name: true } } } },
        orderItems: { include: { menuItem: true } },
      },
    });

    const data = orders.map((o) => {
      const total = o.orderItems.reduce(
        (sum, i) => sum + Number(i.unitPrice ?? i.menuItem.price) * i.quantity,
        0
      );
      return {
        id: o.id,
        reservationId: o.reservationId,
        roomId: o.roomId,
        roomNumber: o.room?.number ?? null,
        guestName: o.reservation?.guest?.name ?? null,
        status: o.status,
        totalAmount: Math.round(total * 100) / 100,
        itemCount: o.orderItems.reduce((s, i) => s + i.quantity, 0),
        createdAt: o.createdAt.toISOString(),
      };
    });

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu zamówień",
    };
  }
}

/**
 * Pobiera obciążenia gastronomiczne (dania na pokój) dla rezerwacji.
 * Zwraca transakcje z kategorii F_B oraz z type RESTAURANT/GASTRONOMY/POSTING.
 * Jeśli transakcja ma externalRef z items (z Bistro), zwraca też pozycje.
 */
export async function getRestaurantChargesForReservation(
  reservationId: string
): Promise<
  ActionResult<
    Array<{
      id: string;
      amount: number;
      description: string | null;
      type: string;
      createdAt: string;
      receiptNumber?: string;
      cashierName?: string;
      posSystem?: string;
      items: Array<{ name: string; quantity: number; unitPrice: number }>;
    }>
  >
> {
  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        reservationId,
        status: "ACTIVE",
        OR: [
          { category: "F_B" },
          { type: { in: ["RESTAURANT", "GASTRONOMY", "POSTING"] } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const data = transactions.map((tx) => {
      let receiptNumber: string | undefined;
      let cashierName: string | undefined;
      let posSystem: string | undefined;
      let items: Array<{ name: string; quantity: number; unitPrice: number }> = [];

      if (tx.externalRef) {
        try {
          const ref = JSON.parse(tx.externalRef);
          receiptNumber = ref.receiptNumber;
          cashierName = ref.cashierName;
          posSystem = ref.posSystem;
          if (Array.isArray(ref.items)) {
            items = ref.items.map((it: Record<string, unknown>) => ({
              name: String(it.name ?? "Pozycja"),
              quantity: Number(it.quantity ?? 1),
              unitPrice: Number(it.unitPrice ?? 0),
            }));
          }
        } catch {
          // externalRef is not JSON – may be legacy "order:xxx" format
        }
      }

      return {
        id: tx.id,
        amount: Number(tx.amount),
        description: tx.description,
        type: tx.type,
        createdAt: tx.createdAt.toISOString(),
        receiptNumber,
        cashierName,
        posSystem,
        items,
      };
    });

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu obciążeń gastronomicznych",
    };
  }
}

/**
 * Podsumowanie dzisiejszej aktywności restauracyjnej (dla dashboardu).
 */
export async function getTodayRestaurantSummary(): Promise<
  ActionResult<{
    count: number;
    totalAmount: number;
    recentCharges: Array<{
      roomNumber: string;
      guestName: string;
      amount: number;
      description: string | null;
      createdAt: string;
    }>;
  }>
> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        status: "ACTIVE",
        createdAt: { gte: today, lt: tomorrow },
        OR: [
          { category: "F_B" },
          { type: { in: ["RESTAURANT", "GASTRONOMY", "POSTING"] } },
        ],
      },
      include: {
        reservation: {
          include: {
            guest: { select: { name: true } },
            room: { select: { number: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const count = transactions.length;
    const totalAmount = transactions.reduce((s, t) => s + Number(t.amount), 0);
    const recentCharges = transactions.slice(0, 10).map((t) => ({
      roomNumber: t.reservation.room.number,
      guestName: t.reservation.guest.name,
      amount: Number(t.amount),
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        count,
        totalAmount: Math.round(totalAmount * 100) / 100,
        recentCharges,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu podsumowania restauracji",
    };
  }
}

/**
 * Historia restauracyjna gościa (wszystkie pobyty).
 */
export async function getGuestRestaurantHistory(
  guestId: string
): Promise<
  ActionResult<{
    totalAmount: number;
    totalCharges: number;
    charges: Array<{
      id: string;
      amount: number;
      description: string | null;
      createdAt: string;
      roomNumber: string;
      checkIn: string;
      checkOut: string;
      items: Array<{ name: string; quantity: number; unitPrice: number }>;
    }>;
  }>
> {
  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        status: "ACTIVE",
        reservation: { guestId },
        OR: [
          { category: "F_B" },
          { type: { in: ["RESTAURANT", "GASTRONOMY", "POSTING"] } },
        ],
      },
      include: {
        reservation: {
          include: {
            room: { select: { number: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const charges = transactions.map((tx) => {
      let items: Array<{ name: string; quantity: number; unitPrice: number }> = [];
      if (tx.externalRef) {
        try {
          const ref = JSON.parse(tx.externalRef);
          if (Array.isArray(ref.items)) {
            items = ref.items.map((it: Record<string, unknown>) => ({
              name: String(it.name ?? "Pozycja"),
              quantity: Number(it.quantity ?? 1),
              unitPrice: Number(it.unitPrice ?? 0),
            }));
          }
        } catch { /* ignore */ }
      }
      return {
        id: tx.id,
        amount: Number(tx.amount),
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
        roomNumber: tx.reservation.room.number,
        checkIn: tx.reservation.checkIn.toISOString().slice(0, 10),
        checkOut: tx.reservation.checkOut.toISOString().slice(0, 10),
        items,
      };
    });

    const totalAmount = charges.reduce((s, c) => s + c.amount, 0);

    return {
      success: true,
      data: {
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalCharges: charges.length,
        charges,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu historii restauracyjnej gościa",
    };
  }
}
