"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export type HotelEventType = "CONFERENCE" | "WEDDING" | "MAINTENANCE" | "HOLIDAY" | "OTHER";

export type HotelEventEntry = {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  eventType: HotelEventType;
  description: string | null;
  propertyId: string | null;
  createdAt: string;
  updatedAt: string;
};

const EVENT_TYPE_LABELS: Record<HotelEventType, string> = {
  CONFERENCE: "Konferencja",
  WEDDING: "Wesele",
  MAINTENANCE: "Konserwacja",
  HOLIDAY: "Święto",
  OTHER: "Inne",
};

export { EVENT_TYPE_LABELS };

export async function getHotelEvents(options?: {
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<
  { success: true; data: HotelEventEntry[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const limit = Math.min(options?.limit ?? 100, 500);
  const where: { startDate?: { gte?: Date }; endDate?: { lte?: Date } } = {};
  if (options?.fromDate) {
    where.startDate = { gte: new Date(options.fromDate + "T00:00:00Z") };
  }
  if (options?.toDate) {
    where.endDate = { lte: new Date(options.toDate + "T23:59:59Z") };
  }
  // For range query we need: event overlaps [from, to] => startDate <= to AND (endDate >= from OR endDate null)
  const from = options?.fromDate ? new Date(options.fromDate + "T00:00:00Z") : null;
  const to = options?.toDate ? new Date(options.toDate + "T23:59:59Z") : null;
  const whereOverlap =
    from && to
      ? {
          startDate: { lte: to },
          OR: [
            { endDate: { gte: from } },
            { endDate: null, startDate: { gte: from } },
          ],
        }
      : undefined;

  try {
    const list = await prisma.hotelEvent.findMany({
      where: whereOverlap ?? (Object.keys(where).length ? where : undefined),
      orderBy: { startDate: "asc" },
      take: limit,
    });
    return {
      success: true,
      data: list.map((e) => ({
        id: e.id,
        title: e.title,
        startDate: e.startDate.toISOString().slice(0, 10),
        endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
        eventType: (e.eventType as HotelEventType) || "OTHER",
        description: e.description,
        propertyId: e.propertyId,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Błąd odczytu wydarzeń",
    };
  }
}

export async function createHotelEvent(data: {
  title: string;
  startDate: string;
  endDate?: string | null;
  eventType?: HotelEventType;
  description?: string | null;
}): Promise<
  { success: true; data: HotelEventEntry } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const title = String(data.title ?? "").trim();
  if (!title) return { success: false, error: "Tytuł jest wymagany" };
  const startDate = new Date(data.startDate + "T12:00:00Z");
  if (Number.isNaN(startDate.getTime())) return { success: false, error: "Nieprawidłowa data rozpoczęcia" };
  const endDate = data.endDate?.trim()
    ? new Date(data.endDate + "T12:00:00Z")
    : null;
  if (data.endDate?.trim() && endDate && Number.isNaN(endDate.getTime())) {
    return { success: false, error: "Nieprawidłowa data zakończenia" };
  }
  const eventType = data.eventType && ["CONFERENCE", "WEDDING", "MAINTENANCE", "HOLIDAY", "OTHER"].includes(data.eventType)
    ? data.eventType
    : "OTHER";

  try {
    const created = await prisma.hotelEvent.create({
      data: {
        title,
        startDate,
        endDate,
        eventType,
        description: data.description?.trim() || null,
      },
    });
    return {
      success: true,
      data: {
        id: created.id,
        title: created.title,
        startDate: created.startDate.toISOString().slice(0, 10),
        endDate: created.endDate ? created.endDate.toISOString().slice(0, 10) : null,
        eventType: (created.eventType as HotelEventType) || "OTHER",
        description: created.description,
        propertyId: created.propertyId,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Błąd zapisu wydarzenia",
    };
  }
}

export async function updateHotelEvent(
  id: string,
  data: {
    title?: string;
    startDate?: string;
    endDate?: string | null;
    eventType?: HotelEventType;
    description?: string | null;
  }
): Promise<
  { success: true; data: HotelEventEntry } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const updateData: { title?: string; startDate?: Date; endDate?: Date | null; eventType?: string; description?: string | null } = {};
  if (data.title !== undefined) {
    const t = String(data.title).trim();
    if (!t) return { success: false, error: "Tytuł nie może być pusty" };
    updateData.title = t;
  }
  if (data.startDate !== undefined) {
    const d = new Date(data.startDate + "T12:00:00Z");
    if (Number.isNaN(d.getTime())) return { success: false, error: "Nieprawidłowa data rozpoczęcia" };
    updateData.startDate = d;
  }
  if (data.endDate !== undefined) {
    updateData.endDate = data.endDate?.trim()
      ? (() => {
          const d = new Date(data.endDate! + "T12:00:00Z");
          return Number.isNaN(d.getTime()) ? null : d;
        })()
      : null;
  }
  if (data.eventType !== undefined && ["CONFERENCE", "WEDDING", "MAINTENANCE", "HOLIDAY", "OTHER"].includes(data.eventType)) {
    updateData.eventType = data.eventType;
  }
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;

  try {
    const updated = await prisma.hotelEvent.update({
      where: { id },
      data: updateData,
    });
    return {
      success: true,
      data: {
        id: updated.id,
        title: updated.title,
        startDate: updated.startDate.toISOString().slice(0, 10),
        endDate: updated.endDate ? updated.endDate.toISOString().slice(0, 10) : null,
        eventType: (updated.eventType as HotelEventType) || "OTHER",
        description: updated.description,
        propertyId: updated.propertyId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Błąd aktualizacji wydarzenia",
    };
  }
}

export async function deleteHotelEvent(id: string): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  try {
    await prisma.hotelEvent.delete({ where: { id } });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Błąd usunięcia wydarzenia",
    };
  }
}
