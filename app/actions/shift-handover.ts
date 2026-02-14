"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export type ShiftHandoverEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  authorId: string | null;
  authorName: string | null;
  content: string;
  shiftDate: string | null;
  propertyId: string | null;
};

export async function getShiftHandovers(options?: {
  limit?: number;
  fromDate?: string;
  toDate?: string;
}): Promise<
  { success: true; data: ShiftHandoverEntry[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };

  const limit = Math.min(options?.limit ?? 50, 200);
  const where: { shiftDate?: { gte?: Date; lte?: Date }; createdAt?: { gte?: Date; lte?: Date } } = {};
  if (options?.fromDate) {
    where.shiftDate = { ...where.shiftDate, gte: new Date(options.fromDate + "T00:00:00Z") };
  }
  if (options?.toDate) {
    where.shiftDate = { ...where.shiftDate, lte: new Date(options.toDate + "T23:59:59Z") };
  }

  try {
    const list = await prisma.shiftHandover.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { author: { select: { name: true } } },
    });
    return {
      success: true,
      data: list.map((h) => ({
        id: h.id,
        createdAt: h.createdAt.toISOString(),
        updatedAt: h.updatedAt.toISOString(),
        authorId: h.authorId,
        authorName: h.author?.name ?? null,
        content: h.content,
        shiftDate: h.shiftDate ? h.shiftDate.toISOString().slice(0, 10) : null,
        propertyId: h.propertyId,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu przekazań zmiany",
    };
  }
}

export async function createShiftHandover(data: {
  content: string;
  shiftDate?: string | null;
}): Promise<
  { success: true; data: ShiftHandoverEntry } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };

  const content = String(data.content ?? "").trim();
  if (!content) return { success: false, error: "Treść przekazania jest wymagana" };

  const shiftDate = data.shiftDate?.trim()
    ? new Date(data.shiftDate + "T12:00:00Z")
    : null;
  if (data.shiftDate?.trim() && shiftDate && Number.isNaN(shiftDate.getTime())) {
    return { success: false, error: "Nieprawidłowa data zmiany" };
  }

  try {
    const created = await prisma.shiftHandover.create({
      data: {
        authorId: session.userId,
        content,
        shiftDate,
      },
      include: { author: { select: { name: true } } },
    });
    return {
      success: true,
      data: {
        id: created.id,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        authorId: created.authorId,
        authorName: created.author?.name ?? null,
        content: created.content,
        shiftDate: created.shiftDate ? created.shiftDate.toISOString().slice(0, 10) : null,
        propertyId: created.propertyId,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu przekazania",
    };
  }
}
