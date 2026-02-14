"use server";

import { prisma } from "@/lib/db";
import { chargeOrderToReservation } from "@/app/actions/finance";

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
        dietTags: dietTags?.length ? dietTags : null,
        allergens: allergens?.length ? allergens : null,
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
    const data: { name?: string; price?: number; category?: string; dietTags?: string[] | null; allergens?: string[] | null } = {};
    if (payload.name !== undefined) data.name = payload.name.trim();
    if (payload.price !== undefined) data.price = payload.price;
    if (payload.category !== undefined) data.category = payload.category.trim();
    if (payload.dietTags !== undefined) data.dietTags = payload.dietTags?.length ? payload.dietTags : null;
    if (payload.allergens !== undefined) data.allergens = payload.allergens?.length ? payload.allergens : null;
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
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));
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
