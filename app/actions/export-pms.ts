"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export type ExportOptions = {
  guests?: boolean;
  rooms?: boolean;
  reservations?: boolean;
};

export type ExportPmsPayload = {
  exportedAt: string;
  guests?: Array<{ name: string; email?: string | null; phone?: string | null }>;
  rooms?: Array<{ number: string; type: string; status?: string; price?: number | null }>;
  reservations?: Array<{
    guestName: string;
    roomNumber: string;
    checkIn: string;
    checkOut: string;
    status: string;
    confirmationNumber?: string | null;
  }>;
};

export async function exportPmsData(options: ExportOptions): Promise<
  { success: true; data: ExportPmsPayload; json: string } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const data: ExportPmsPayload = {
    exportedAt: new Date().toISOString(),
  };

  try {
    if (options.guests) {
      const guests = await prisma.guest.findMany({
        select: { name: true, email: true, phone: true },
        orderBy: { name: "asc" },
      });
      data.guests = guests.map((g) => ({
        name: g.name,
        email: g.email,
        phone: g.phone,
      }));
    }

    if (options.rooms) {
      const rooms = await prisma.room.findMany({
        select: { number: true, type: true, status: true, price: true },
        orderBy: { number: "asc" },
      });
      data.rooms = rooms.map((r) => ({
        number: r.number,
        type: r.type,
        status: r.status,
        price: r.price != null ? Number(r.price) : null,
      }));
    }

    if (options.reservations) {
      const reservations = await prisma.reservation.findMany({
        select: {
          confirmationNumber: true,
          checkIn: true,
          checkOut: true,
          status: true,
          guest: { select: { name: true } },
          room: { select: { number: true } },
        },
        orderBy: { checkIn: "desc" },
        take: 10000,
      });
      data.reservations = reservations.map((r) => ({
        guestName: r.guest.name,
        roomNumber: r.room.number,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
        status: r.status,
        confirmationNumber: r.confirmationNumber,
      }));
    }

    const json = JSON.stringify(data, null, 2);
    return { success: true, data, json };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd eksportu",
    };
  }
}
