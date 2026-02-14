"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getFolioSummary } from "@/app/actions/finance";
import { getOverdueReservations } from "@/app/actions/dunning";
import { createAuditLog } from "@/lib/audit";
import { COLLECTION_STATUSES, type CollectionStatus } from "@/lib/collections-constants";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type { CollectionStatus };

export interface CollectionCaseItem {
  id: string;
  reservationId: string;
  guestName: string;
  guestEmail: string | null;
  roomNumber: string;
  checkOut: Date;
  balance: number;
  status: CollectionStatus;
  agencyName: string | null;
  handedOverAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pobiera listę spraw windykacyjnych (z saldem i danymi rezerwacji).
 */
export async function getCollectionCases(
  propertyId: string | null
): Promise<ActionResult<CollectionCaseItem[]>> {
  try {
    const where: { reservation?: { room?: { propertyId?: string } } } = {};
    if (propertyId) {
      where.reservation = { room: { propertyId } };
    }

    const cases = await prisma.collectionCase.findMany({
      where,
      include: {
        reservation: {
          include: {
            guest: { select: { name: true, email: true } },
            room: { select: { number: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result: CollectionCaseItem[] = [];

    for (const c of cases) {
      const summary = await getFolioSummary(c.reservationId);
      const balance = summary.success ? summary.data.balance : 0;

      result.push({
        id: c.id,
        reservationId: c.reservationId,
        guestName: c.reservation.guest.name,
        guestEmail: c.reservation.guest.email?.trim() ?? null,
        roomNumber: c.reservation.room.number,
        checkOut: c.reservation.checkOut,
        balance,
        status: c.status as CollectionStatus,
        agencyName: c.agencyName,
        handedOverAt: c.handedOverAt,
        notes: c.notes,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      });
    }

    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania spraw windykacyjnych",
    };
  }
}

/**
 * Zwraca rezerwacje z zaległością, które jeszcze nie są w windykacji (kandydaci do dodania).
 */
export async function getDebtorsEligibleForCollection(
  propertyId: string | null
): Promise<ActionResult<Array<{ reservationId: string; guestName: string; roomNumber: string; balance: number; dueDate: Date; daysOverdue: number }>>> {
  try {
    const overdueRes = await getOverdueReservations(propertyId);
    if (!overdueRes.success) return overdueRes;

    const existingIds = await prisma.collectionCase.findMany({
      where: {
        reservationId: { in: overdueRes.data.map((o) => o.reservationId) },
      },
      select: { reservationId: true },
    });
    const existingSet = new Set(existingIds.map((e) => e.reservationId));

    const eligible = overdueRes.data
      .filter((o) => !existingSet.has(o.reservationId))
      .map((o) => ({
        reservationId: o.reservationId,
        guestName: o.guestName,
        roomNumber: o.roomNumber,
        balance: o.balance,
        dueDate: o.dueDate,
        daysOverdue: o.daysOverdue,
      }));

    return { success: true, data: eligible };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania listy dłużników",
    };
  }
}

/**
 * Tworzy sprawę windykacyjną dla rezerwacji (dodaje do windykacji).
 */
export async function createCollectionCase(
  reservationId: string,
  propertyId: string | null
): Promise<ActionResult<{ caseId: string }>> {
  try {
    if (!reservationId?.trim()) {
      return { success: false, error: "ID rezerwacji jest wymagane" };
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, room: { select: { propertyId: true } } },
    });
    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }

    if (propertyId && reservation.room?.propertyId !== propertyId) {
      return { success: false, error: "Rezerwacja nie należy do wybranego obiektu" };
    }

    const existing = await prisma.collectionCase.findUnique({
      where: { reservationId },
    });
    if (existing) {
      return { success: false, error: "Sprawa windykacyjna dla tej rezerwacji już istnieje" };
    }

    const summary = await getFolioSummary(reservationId);
    if (!summary.success) return summary;
    if (summary.data.balance <= 0) {
      return { success: false, error: "Saldo rezerwacji nie jest zaległe (<= 0). Nie można dodać do windykacji." };
    }

    const c = await prisma.collectionCase.create({
      data: {
        reservationId,
        status: "IN_COLLECTION",
      },
    });

    await createAuditLog({
      actionType: "CREATE",
      entityType: "CollectionCase",
      entityId: c.id,
      newValue: {
        reservationId,
        status: "IN_COLLECTION",
        balance: summary.data.balance,
      } as unknown as Record<string, unknown>,
    });

    revalidatePath("/finance");
    revalidatePath("/finance/windykacja");
    return { success: true, data: { caseId: c.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia sprawy windykacyjnej",
    };
  }
}

/**
 * Aktualizuje sprawę windykacyjną (status, agencja, data przekazania, notatki).
 */
export async function updateCollectionCase(
  caseId: string,
  params: {
    status?: CollectionStatus;
    agencyName?: string | null;
    handedOverAt?: Date | string | null;
    notes?: string | null;
  }
): Promise<ActionResult<void>> {
  try {
    if (!caseId?.trim()) {
      return { success: false, error: "ID sprawy jest wymagane" };
    }

    if (params.status && !COLLECTION_STATUSES.includes(params.status)) {
      return {
        success: false,
        error: `Nieprawidłowy status. Dozwolone: ${COLLECTION_STATUSES.join(", ")}`,
      };
    }

    const existing = await prisma.collectionCase.findUnique({
      where: { id: caseId },
    });
    if (!existing) {
      return { success: false, error: "Sprawa windykacyjna nie istnieje" };
    }

    const updateData: {
      status?: string;
      agencyName?: string | null;
      handedOverAt?: Date | null;
      notes?: string | null;
    } = {};
    if (params.status !== undefined) updateData.status = params.status;
    if (params.agencyName !== undefined) updateData.agencyName = params.agencyName ?? null;
    if (params.handedOverAt !== undefined) {
      updateData.handedOverAt =
        params.handedOverAt == null
          ? null
          : typeof params.handedOverAt === "string"
            ? new Date(params.handedOverAt)
            : params.handedOverAt;
    }
    if (params.notes !== undefined) updateData.notes = params.notes ?? null;

    if (params.status === "HANDED_TO_AGENCY" && params.handedOverAt == null && !existing.handedOverAt) {
      updateData.handedOverAt = new Date();
    }

    await prisma.collectionCase.update({
      where: { id: caseId },
      data: updateData,
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "CollectionCase",
      entityId: caseId,
      newValue: updateData as unknown as Record<string, unknown>,
    });

    revalidatePath("/finance");
    revalidatePath("/finance/windykacja");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji sprawy windykacyjnej",
    };
  }
}

/**
 * Oznacza sprawę jako zapłaconą (saldo uregulowane).
 */
export async function markCollectionCasePaid(caseId: string): Promise<ActionResult<void>> {
  return updateCollectionCase(caseId, { status: "PAID" });
}

/**
 * Oznacza sprawę jako umorzoną (nieściągalna). Opcjonalnie dopisuje powód do notatek.
 */
export async function markCollectionCaseWrittenOff(
  caseId: string,
  reason?: string
): Promise<ActionResult<void>> {
  try {
    const existing = await prisma.collectionCase.findUnique({
      where: { id: caseId },
      select: { notes: true },
    });
    if (!existing) {
      return { success: false, error: "Sprawa windykacyjna nie istnieje" };
    }
    const newNotes = reason
      ? `${existing.notes ?? ""}\nUmorzenie: ${reason}`.trim()
      : existing.notes ?? undefined;
    return updateCollectionCase(caseId, { status: "WRITTEN_OFF", notes: newNotes });
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd oznaczania sprawy jako umorzonej",
    };
  }
}
