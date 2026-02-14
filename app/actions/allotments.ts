"use server";

import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { headers } from "next/headers";
import type { ActionResult } from "./reservations";

export interface AllotmentInput {
  companyName: string;
  roomTypeId?: string;
  roomCount: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  releaseDate: string;
  releaseDays?: number;
  note?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface Allotment {
  id: string;
  companyName: string;
  roomTypeId: string | null;
  roomTypeName?: string;
  roomCount: number;
  startDate: string;
  endDate: string;
  releaseDate: string;
  releaseDays: number;
  status: string;
  usedCount: number;
  note: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Lista allotmentów z opcjonalnym filtrem
 */
export async function getAllotments(filter?: {
  status?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<ActionResult<Allotment[]>> {
  try {
    const where: Record<string, unknown> = {};
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.fromDate || filter?.toDate) {
      where.OR = [];
      if (filter.fromDate) {
        (where.OR as unknown[]).push({ endDate: { gte: new Date(filter.fromDate) } });
      }
      if (filter.toDate) {
        (where.OR as unknown[]).push({ startDate: { lte: new Date(filter.toDate) } });
      }
    }

    const allotments = await prisma.allotment.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { roomType: true },
      orderBy: { startDate: "asc" },
    });

    return {
      success: true,
      data: allotments.map((a) => ({
        id: a.id,
        companyName: a.companyName,
        roomTypeId: a.roomTypeId,
        roomTypeName: a.roomType?.name,
        roomCount: a.roomCount,
        startDate: formatDate(a.startDate),
        endDate: formatDate(a.endDate),
        releaseDate: formatDate(a.releaseDate),
        releaseDays: a.releaseDays,
        status: a.status,
        usedCount: a.usedCount,
        note: a.note,
        contactEmail: a.contactEmail,
        contactPhone: a.contactPhone,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    };
  } catch (error) {
    console.error("getAllotments error:", error);
    return { success: false, error: "Błąd pobierania allotmentów" };
  }
}

/**
 * Tworzenie nowego allotmentu
 */
export async function createAllotment(
  input: AllotmentInput
): Promise<ActionResult<Allotment>> {
  try {
    // Walidacja dat
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    const release = new Date(input.releaseDate);

    if (end <= start) {
      return { success: false, error: "Data końcowa musi być po dacie początkowej" };
    }
    if (release > end) {
      return { success: false, error: "Data release nie może być po dacie końcowej" };
    }

    const allotment = await prisma.allotment.create({
      data: {
        companyName: input.companyName,
        roomTypeId: input.roomTypeId || null,
        roomCount: input.roomCount,
        startDate: start,
        endDate: end,
        releaseDate: release,
        releaseDays: input.releaseDays ?? 7,
        note: input.note || null,
        contactEmail: input.contactEmail || null,
        contactPhone: input.contactPhone || null,
        status: "ACTIVE",
        usedCount: 0,
      },
      include: { roomType: true },
    });

    const ipAddress = getClientIp(await headers());
    await createAuditLog({
      actionType: "CREATE",
      entityType: "Allotment",
      entityId: allotment.id,
      newValue: { ...input },
      ipAddress,
    });

    return {
      success: true,
      data: {
        id: allotment.id,
        companyName: allotment.companyName,
        roomTypeId: allotment.roomTypeId,
        roomTypeName: allotment.roomType?.name,
        roomCount: allotment.roomCount,
        startDate: formatDate(allotment.startDate),
        endDate: formatDate(allotment.endDate),
        releaseDate: formatDate(allotment.releaseDate),
        releaseDays: allotment.releaseDays,
        status: allotment.status,
        usedCount: allotment.usedCount,
        note: allotment.note,
        contactEmail: allotment.contactEmail,
        contactPhone: allotment.contactPhone,
        createdAt: allotment.createdAt,
        updatedAt: allotment.updatedAt,
      },
    };
  } catch (error) {
    console.error("createAllotment error:", error);
    return { success: false, error: "Błąd tworzenia allotmentu" };
  }
}

/**
 * Aktualizacja allotmentu
 */
export async function updateAllotment(
  id: string,
  input: Partial<AllotmentInput>
): Promise<ActionResult<Allotment>> {
  try {
    const existing = await prisma.allotment.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Allotment nie znaleziony" };
    }

    const updateData: Record<string, unknown> = {};
    if (input.companyName !== undefined) updateData.companyName = input.companyName;
    if (input.roomTypeId !== undefined) updateData.roomTypeId = input.roomTypeId || null;
    if (input.roomCount !== undefined) updateData.roomCount = input.roomCount;
    if (input.startDate !== undefined) updateData.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) updateData.endDate = new Date(input.endDate);
    if (input.releaseDate !== undefined) updateData.releaseDate = new Date(input.releaseDate);
    if (input.releaseDays !== undefined) updateData.releaseDays = input.releaseDays;
    if (input.note !== undefined) updateData.note = input.note || null;
    if (input.contactEmail !== undefined) updateData.contactEmail = input.contactEmail || null;
    if (input.contactPhone !== undefined) updateData.contactPhone = input.contactPhone || null;

    const allotment = await prisma.allotment.update({
      where: { id },
      data: updateData,
      include: { roomType: true },
    });

    const ipAddress = getClientIp(await headers());
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Allotment",
      entityId: id,
      oldValue: { ...existing },
      newValue: { ...allotment },
      ipAddress,
    });

    return {
      success: true,
      data: {
        id: allotment.id,
        companyName: allotment.companyName,
        roomTypeId: allotment.roomTypeId,
        roomTypeName: allotment.roomType?.name,
        roomCount: allotment.roomCount,
        startDate: formatDate(allotment.startDate),
        endDate: formatDate(allotment.endDate),
        releaseDate: formatDate(allotment.releaseDate),
        releaseDays: allotment.releaseDays,
        status: allotment.status,
        usedCount: allotment.usedCount,
        note: allotment.note,
        contactEmail: allotment.contactEmail,
        contactPhone: allotment.contactPhone,
        createdAt: allotment.createdAt,
        updatedAt: allotment.updatedAt,
      },
    };
  } catch (error) {
    console.error("updateAllotment error:", error);
    return { success: false, error: "Błąd aktualizacji allotmentu" };
  }
}

/**
 * Zmiana statusu allotmentu
 */
export async function changeAllotmentStatus(
  id: string,
  status: "ACTIVE" | "RELEASED" | "CONVERTED"
): Promise<ActionResult<Allotment>> {
  try {
    const existing = await prisma.allotment.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Allotment nie znaleziony" };
    }

    const allotment = await prisma.allotment.update({
      where: { id },
      data: { status },
      include: { roomType: true },
    });

    const ipAddress = getClientIp(await headers());
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Allotment",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status },
      ipAddress,
    });

    return {
      success: true,
      data: {
        id: allotment.id,
        companyName: allotment.companyName,
        roomTypeId: allotment.roomTypeId,
        roomTypeName: allotment.roomType?.name,
        roomCount: allotment.roomCount,
        startDate: formatDate(allotment.startDate),
        endDate: formatDate(allotment.endDate),
        releaseDate: formatDate(allotment.releaseDate),
        releaseDays: allotment.releaseDays,
        status: allotment.status,
        usedCount: allotment.usedCount,
        note: allotment.note,
        contactEmail: allotment.contactEmail,
        contactPhone: allotment.contactPhone,
        createdAt: allotment.createdAt,
        updatedAt: allotment.updatedAt,
      },
    };
  } catch (error) {
    console.error("changeAllotmentStatus error:", error);
    return { success: false, error: "Błąd zmiany statusu allotmentu" };
  }
}

/**
 * Wykorzystanie pokoju z allotmentu (przy tworzeniu rezerwacji)
 */
export async function useAllotmentRoom(
  id: string
): Promise<ActionResult<{ remaining: number }>> {
  try {
    const allotment = await prisma.allotment.findUnique({ where: { id } });
    if (!allotment) {
      return { success: false, error: "Allotment nie znaleziony" };
    }
    if (allotment.status !== "ACTIVE") {
      return { success: false, error: "Allotment nie jest aktywny" };
    }
    if (allotment.usedCount >= allotment.roomCount) {
      return { success: false, error: "Wszystkie pokoje z allotmentu już wykorzystane" };
    }

    const updated = await prisma.allotment.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });

    return {
      success: true,
      data: { remaining: updated.roomCount - updated.usedCount },
    };
  } catch (error) {
    console.error("useAllotmentRoom error:", error);
    return { success: false, error: "Błąd wykorzystania pokoju z allotmentu" };
  }
}

/**
 * Automatyczne zwalnianie przeterminowanych allotmentów
 */
export async function releaseExpiredAllotments(): Promise<ActionResult<{ releasedCount: number }>> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await prisma.allotment.updateMany({
      where: {
        status: "ACTIVE",
        releaseDate: { lt: today },
      },
      data: { status: "RELEASED" },
    });

    return {
      success: true,
      data: { releasedCount: result.count },
    };
  } catch (error) {
    console.error("releaseExpiredAllotments error:", error);
    return { success: false, error: "Błąd zwalniania allotmentów" };
  }
}

/**
 * Usuwanie allotmentu
 */
export async function deleteAllotment(id: string): Promise<ActionResult<void>> {
  try {
    const existing = await prisma.allotment.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Allotment nie znaleziony" };
    }

    await prisma.allotment.delete({ where: { id } });

    const ipAddress = getClientIp(await headers());
    await createAuditLog({
      actionType: "DELETE",
      entityType: "Allotment",
      entityId: id,
      oldValue: { ...existing },
      ipAddress,
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("deleteAllotment error:", error);
    return { success: false, error: "Błąd usuwania allotmentu" };
  }
}
