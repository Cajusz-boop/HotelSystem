"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import {
  reservationSchema,
  moveReservationSchema,
  type ReservationInput,
  type MoveReservationInput,
} from "@/lib/validations/schemas";
import type { ReservationStatus } from "@prisma/client";
import { createOrUpdateCompany } from "@/app/actions/companies";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Mapuje Prisma Reservation + Guest + Room (+ RateCode) na typ UI */
function toUiReservation(r: {
  id: string;
  room: { number: string };
  guest: { name: string };
  checkIn: Date;
  checkOut: Date;
  status: ReservationStatus;
  pax: number | null;
  rateCode?: { id: string; code: string; name: string; price: unknown } | null;
}) {
  return {
    id: r.id,
    guestName: r.guest.name,
    room: r.room.number,
    checkIn: formatDate(r.checkIn),
    checkOut: formatDate(r.checkOut),
    status: r.status as string,
    pax: r.pax ?? undefined,
    rateCodeId: r.rateCode?.id ?? undefined,
    rateCode: r.rateCode?.code ?? undefined,
    rateCodeName: r.rateCode?.name ?? undefined,
    rateCodePrice: r.rateCode?.price != null ? Number(r.rateCode.price) : undefined,
  };
}

/** Szuka gości po imieniu/nazwisku lub MRZ (Gap 2.2 – wykrywanie duplikatów) */
export async function findGuestByNameOrMrz(
  name: string,
  mrz?: string
): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  try {
    const trimmedName = name.trim();
    const trimmedMrz = mrz?.trim();

    if (!trimmedName && !trimmedMrz) {
      return { success: true, data: [] };
    }

    const conditions: { name?: { contains: string }; mrz?: string }[] = [];
    if (trimmedName.length >= 2) {
      conditions.push({ name: { contains: trimmedName } });
    }
    if (trimmedMrz && trimmedMrz.length >= 5) {
      conditions.push({ mrz: trimmedMrz });
    }

    if (conditions.length === 0) {
      return { success: true, data: [] };
    }

    const guests = await prisma.guest.findMany({
      where: { OR: conditions },
      take: 5,
      select: { id: true, name: true },
    });

    return { success: true, data: guests };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania gościa",
    };
  }
}

/** Tworzy nową rezerwację; zwraca pełny obiekt rezerwacji do dodania do Tape Chart */
export async function createReservation(
  input: ReservationInput
): Promise<ActionResult<ReturnType<typeof toUiReservation>>> {
  const parsed = reservationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Błąd walidacji" };
  }
  const data = parsed.data;

  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    let guest = await prisma.guest.findFirst({ where: { name: data.guestName } });
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          name: data.guestName,
          ...(data.mrz != null && data.mrz !== "" ? { mrz: data.mrz } : {}),
        },
      });
    } else if (data.mrz != null && data.mrz !== "") {
      guest = await prisma.guest.update({
        where: { id: guest.id },
        data: { mrz: data.mrz },
      });
    }

    const room = await prisma.room.findUnique({ where: { number: data.room } });
    if (!room) {
      return { success: false, error: `Pokój ${data.room} nie istnieje` };
    }
    if (!room.activeForSale) {
      return { success: false, error: `Pokój ${data.room} jest wycofany ze sprzedaży. Wybierz inny pokój lub przywróć go w module Pokoje.` };
    }

    const checkInDate = new Date(data.checkIn + "T12:00:00Z");
    const checkOutDate = new Date(data.checkOut + "T12:00:00Z");
    const nights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (24 * 60 * 60 * 1000));
    const roomType = await prisma.roomType.findUnique({ where: { name: room.type } }).catch(() => null);
    if (roomType) {
      const plan = await prisma.ratePlan.findFirst({
        where: {
          roomTypeId: roomType.id,
          validFrom: { lte: checkInDate },
          validTo: { gte: checkInDate },
        },
      }).catch(() => null);
      if (plan) {
        if (plan.minStayNights != null && nights < plan.minStayNights) {
          return { success: false, error: `Min. długość pobytu dla tej stawki sezonowej: ${plan.minStayNights} nocy.` };
        }
        if (plan.maxStayNights != null && nights > plan.maxStayNights) {
          return { success: false, error: `Maks. długość pobytu dla tej stawki sezonowej: ${plan.maxStayNights} nocy.` };
        }
      }
    }

    let companyId: string | null = data.companyId ?? null;
    if (data.companyData) {
      // Upsert Company (incl. user-edited full trading name) so next NIP lookup returns it from DB
      const companyResult = await createOrUpdateCompany({
        nip: data.companyData.nip,
        name: data.companyData.name,
        address: data.companyData.address,
        postalCode: data.companyData.postalCode,
        city: data.companyData.city,
        country: data.companyData.country,
      });
      if (!companyResult.success) {
        return { success: false, error: companyResult.error };
      }
      companyId = companyResult.data.companyId;
    }

    const reservation = await prisma.reservation.create({
      data: {
        guestId: guest.id,
        roomId: room.id,
        ...(companyId ? { companyId } : {}),
        ...(data.rateCodeId != null && data.rateCodeId !== "" ? { rateCodeId: data.rateCodeId } : {}),
        checkIn: new Date(data.checkIn),
        checkOut: new Date(data.checkOut),
        status: data.status,
        pax: data.pax ?? null,
      },
      include: { guest: true, room: true, rateCode: true, company: true },
    });

    await createAuditLog({
      actionType: "CREATE",
      entityType: "Reservation",
      entityId: reservation.id,
      newValue: toUiReservation(reservation) as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/front-office");
    return { success: true, data: toUiReservation(reservation) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu rezerwacji",
    };
  }
}

/** Przenosi rezerwację do innego pokoju (Tape Chart drag) */
export async function moveReservation(
  input: MoveReservationInput
): Promise<ActionResult<ReturnType<typeof toUiReservation>>> {
  const parsed = moveReservationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Błąd walidacji" };
  }
  const { reservationId, newRoomNumber } = parsed.data;

  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true, rateCode: true },
    });
    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }

    const newRoom = await prisma.room.findUnique({ where: { number: newRoomNumber } });
    if (!newRoom) {
      return { success: false, error: `Pokój ${newRoomNumber} nie istnieje` };
    }

    const oldUi = toUiReservation(reservation);

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: { roomId: newRoom.id },
      include: { guest: true, room: true, rateCode: true },
    });
    const newUi = toUiReservation(updated);

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Reservation",
      entityId: reservationId,
      oldValue: { ...oldUi } as unknown as Record<string, unknown>,
      newValue: { ...newUi } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/front-office");
    return { success: true, data: newUi };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd przeniesienia rezerwacji",
    };
  }
}

/** Aktualizuje rezerwację (edycja w Sheet) */
export async function updateReservation(
  reservationId: string,
  input: Partial<ReservationInput>
): Promise<ActionResult<ReturnType<typeof toUiReservation>>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const prev = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true, rateCode: true },
    });
    if (!prev) return { success: false, error: "Rezerwacja nie istnieje" };

    const data: Partial<{
      guestId: string;
      roomId: string;
      rateCodeId: string | null;
      checkIn: Date;
      checkOut: Date;
      status: ReservationStatus;
      pax: number | null;
    }> = {};

    if (input.guestName !== undefined) {
      let guest = await prisma.guest.findFirst({ where: { name: input.guestName } });
      if (!guest) guest = await prisma.guest.create({ data: { name: input.guestName } });
      data.guestId = guest.id;
    }
    if (input.room !== undefined) {
      const room = await prisma.room.findUnique({ where: { number: input.room } });
      if (!room) return { success: false, error: `Pokój ${input.room} nie istnieje` };
      data.roomId = room.id;
    }
    if (input.checkIn !== undefined) data.checkIn = new Date(input.checkIn);
    if (input.checkOut !== undefined) data.checkOut = new Date(input.checkOut);
    if (input.status !== undefined) data.status = input.status;
    if (input.pax !== undefined) data.pax = input.pax ?? null;
    if (input.rateCodeId !== undefined) data.rateCodeId = (input.rateCodeId === "" || input.rateCodeId == null) ? null : input.rateCodeId;

    const effCheckIn = data.checkIn ?? prev.checkIn;
    const effCheckOut = data.checkOut ?? prev.checkOut;
    if (effCheckOut <= effCheckIn) {
      return { success: false, error: "Data wyjazdu musi być po dacie przyjazdu" };
    }
    const nights = Math.round((effCheckOut.getTime() - effCheckIn.getTime()) / (24 * 60 * 60 * 1000));
    const roomIdForPlan = data.roomId ?? prev.roomId;
    const roomForPlan = await prisma.room.findUnique({
      where: { id: roomIdForPlan },
      select: { type: true },
    }).catch(() => null);
    const roomTypeForPlan = roomForPlan
      ? await prisma.roomType.findUnique({ where: { name: roomForPlan.type } }).catch(() => null)
      : null;
    if (roomTypeForPlan) {
      const plan = await prisma.ratePlan.findFirst({
        where: {
          roomTypeId: roomTypeForPlan.id,
          validFrom: { lte: effCheckIn },
          validTo: { gte: effCheckIn },
        },
      }).catch(() => null);
      if (plan) {
        if (plan.minStayNights != null && nights < plan.minStayNights) {
          return { success: false, error: `Min. długość pobytu dla tej stawki sezonowej: ${plan.minStayNights} nocy.` };
        }
        if (plan.maxStayNights != null && nights > plan.maxStayNights) {
          return { success: false, error: `Maks. długość pobytu dla tej stawki sezonowej: ${plan.maxStayNights} nocy.` };
        }
      }
    }

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data,
      include: { guest: true, room: true, rateCode: true },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Reservation",
      entityId: reservationId,
      oldValue: toUiReservation(prev) as unknown as Record<string, unknown>,
      newValue: toUiReservation(updated) as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/front-office");
    return { success: true, data: toUiReservation(updated) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji rezerwacji",
    };
  }
}

/** Aktualizuje status rezerwacji */
export async function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus
): Promise<ActionResult<ReturnType<typeof toUiReservation>>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const prev = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true, rateCode: true },
    });
    if (!prev) return { success: false, error: "Rezerwacja nie istnieje" };

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: { status },
      include: { guest: true, room: true, rateCode: true },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Reservation",
      entityId: reservationId,
      oldValue: toUiReservation(prev) as unknown as Record<string, unknown>,
      newValue: toUiReservation(updated) as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/front-office");
    return { success: true, data: toUiReservation(updated) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji statusu",
    };
  }
}

/** Usuwa rezerwację */
export async function deleteReservation(reservationId: string): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const prev = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true },
    });
    if (!prev) return { success: false, error: "Rezerwacja nie istnieje" };

    const oldUi = toUiReservation(prev);

    await prisma.reservation.delete({ where: { id: reservationId } });

    await createAuditLog({
      actionType: "DELETE",
      entityType: "Reservation",
      entityId: reservationId,
      oldValue: oldUi as unknown as Record<string, unknown>,
      newValue: null,
      ipAddress: ip,
    });

    revalidatePath("/front-office");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usunięcia rezerwacji",
    };
  }
}
