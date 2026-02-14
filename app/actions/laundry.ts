"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Lista usług pralni (cennik). */
export async function getLaundryServices(): Promise<
  ActionResult<Array<{ id: string; name: string; price: number; unit: string }>>
> {
  try {
    const list = await prisma.laundryService.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true, unit: true },
    });
    return {
      success: true,
      data: list.map((s) => ({ id: s.id, name: s.name, price: Number(s.price), unit: s.unit })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu usług pralni",
    };
  }
}

/** Dodaje usługę do cennika pralni. */
export async function createLaundryService(
  name: string,
  price: number,
  unit: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const trimmedName = name?.trim();
    const trimmedUnit = (unit ?? "szt").trim() || "szt";
    if (!trimmedName) return { success: false, error: "Nazwa jest wymagana" };
    if (typeof price !== "number" || price < 0) return { success: false, error: "Cena musi być liczbą nieujemną" };

    const created = await prisma.laundryService.create({
      data: { name: trimmedName, price, unit: trimmedUnit },
    });
    revalidatePath("/housekeeping/laundry");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd dodawania usługi",
    };
  }
}

/** Lista zleceń pralni (ostatnie). */
export async function getLaundryOrders(limit = 80): Promise<
  ActionResult<
    Array<{
      id: string;
      reservationId: string;
      roomNumber: string;
      guestName: string;
      status: string;
      totalAmount: number;
      itemCount: number;
      requestedAt: string;
    }>
  >
> {
  try {
    const orders = await prisma.laundryOrder.findMany({
      where: { status: { not: "CANCELLED" } },
      orderBy: { requestedAt: "desc" },
      take: limit,
      include: {
        reservation: { include: { guest: true, room: true } },
        orderItems: { include: { laundryService: true } },
      },
    });

    const data = orders.map((o) => {
      const total = o.orderItems.reduce((s, i) => s + Number(i.amount), 0);
      const itemCount = o.orderItems.reduce((s, i) => s + i.quantity, 0);
      return {
        id: o.id,
        reservationId: o.reservationId,
        roomNumber: o.reservation.room?.number ?? "—",
        guestName: o.reservation.guest.name,
        status: o.status,
        totalAmount: Math.round(total * 100) / 100,
        itemCount,
        requestedAt: o.requestedAt.toISOString(),
      };
    });

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu zleceń pralni",
    };
  }
}

/** Tworzy zlecenie pralni dla rezerwacji. */
export async function createLaundryOrder(
  reservationId: string,
  items: Array<{ laundryServiceId: string; quantity: number }>
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!items.length) return { success: false, error: "Dodaj co najmniej jedną pozycję" };

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { room: true, guest: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };

    const services = await prisma.laundryService.findMany({
      where: { id: { in: items.map((x) => x.laundryServiceId) } },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    const orderItems = items
      .filter((x) => x.quantity > 0 && serviceMap.has(x.laundryServiceId))
      .map((x) => {
        const s = serviceMap.get(x.laundryServiceId)!;
        const amount = Number(s.price) * x.quantity;
        return {
          laundryServiceId: s.id,
          quantity: x.quantity,
          unitPrice: s.price,
          amount,
        };
      });

    if (orderItems.length === 0) return { success: false, error: "Brak prawidłowych pozycji" };

    const order = await prisma.laundryOrder.create({
      data: {
        reservationId,
        status: "PENDING",
        orderItems: { create: orderItems },
      },
    });

    revalidatePath("/housekeeping/laundry");
    return { success: true, data: { id: order.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia zlecenia",
    };
  }
}

/** Aktualizuje status zlecenia pralni. */
export async function updateLaundryOrderStatus(
  orderId: string,
  status: string
): Promise<ActionResult<{ charged?: boolean }>> {
  try {
    const valid = ["PENDING", "PICKED_UP", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"];
    if (!valid.includes(status)) return { success: false, error: "Nieprawidłowy status" };

    const order = await prisma.laundryOrder.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });
    if (!order) return { success: false, error: "Zlecenie nie istnieje" }

    const updateData: { status: string; deliveredAt?: Date } = { status };
    if (status === "DELIVERED") updateData.deliveredAt = new Date();

    await prisma.laundryOrder.update({
      where: { id: orderId },
      data: updateData,
    });

    let charged = false;
    if (status === "DELIVERED" && order.reservationId) {
      const { chargeLaundryOrderToReservation } = await import("@/app/actions/finance");
      const result = await chargeLaundryOrderToReservation(orderId);
      charged = result.success === true && !(result as { skipped?: boolean }).skipped;
    }

    revalidatePath("/housekeeping/laundry");
    return { success: true, data: { charged } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji statusu",
    };
  }
}
