"use server";

import { prisma } from "@/lib/db";
import { getRevenueAndCostsForProperty } from "@/app/actions/properties";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface OwnerSettlementItem {
  id: string;
  propertyId: string;
  propertyName: string;
  period: string;
  periodFrom: string;
  periodTo: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  documentUrl: string | null;
}

/** Lista rozliczeń właściciela (z DB + obliczone kwoty dla brakujących okresów). */
export async function getOwnerSettlements(
  ownerId: string
): Promise<ActionResult<OwnerSettlementItem[]>> {
  try {
    const props = await prisma.property.findMany({
      where: { ownerId },
      select: { id: true, name: true },
    });
    if (props.length === 0) return { success: true, data: [] };

    const roomIdsByProp = new Map<string, string[]>();
    for (const p of props) {
      const rooms = await prisma.room.findMany({
        where: { propertyId: p.id },
        select: { id: true },
      });
      roomIdsByProp.set(p.id, rooms.map((r) => r.id));
    }

    const existing = await prisma.ownerSettlement.findMany({
      where: { ownerId },
      orderBy: { periodFrom: "desc" },
      take: 24,
    });

    const result: OwnerSettlementItem[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = d.getMonth();
      const periodStr = `${y}-${String(m + 1).padStart(2, "0")}`;
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0, 23, 59, 59);

      for (const prop of props) {
        const roomIds = roomIdsByProp.get(prop.id) ?? [];
        const settlement = existing.find(
          (s) =>
            s.propertyId === prop.id &&
            s.periodFrom.getFullYear() === y &&
            s.periodFrom.getMonth() === m
        );

        let amount = 0;
        if (settlement) {
          amount = Number(settlement.amount);
        } else if (roomIds.length > 0) {
          const rev = await getRevenueAndCostsForProperty(prop.id, {
            dateFrom: start.toISOString().slice(0, 10),
            dateTo: end.toISOString().slice(0, 10),
          });
          amount = rev.success && rev.data ? rev.data.revenue : 0;
        }

        result.push({
          id: settlement?.id ?? "",
          propertyId: prop.id,
          propertyName: prop.name,
          period: periodStr,
          periodFrom: start.toISOString().slice(0, 10),
          periodTo: end.toISOString().slice(0, 10),
          amount,
          currency: "PLN",
          status: settlement?.status ?? "PENDING",
          paidAt: settlement?.paidAt?.toISOString() ?? null,
          documentUrl: settlement ? `/api/owner/settlement/${settlement.id}/pdf` : null,
        });
      }
    }

    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd odczytu" };
  }
}

/** Generuje dokument rozliczenia i zapisuje w DB. */
export async function generateOwnerSettlementDocument(
  ownerId: string,
  propertyId: string,
  periodFrom: string,
  periodTo: string
): Promise<ActionResult<{ id: string; documentUrl: string }>> {
  try {
    const prop = await prisma.property.findFirst({
      where: { id: propertyId, ownerId },
    });
    if (!prop) return { success: false, error: "Obiekt nie istnieje lub brak uprawnień" };

    const from = new Date(periodFrom + "T00:00:00Z");
    const to = new Date(periodTo + "T23:59:59Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const rev = await getRevenueAndCostsForProperty(propertyId, {
      dateFrom: periodFrom,
      dateTo: periodTo,
    });
    const amount = rev.success && rev.data ? rev.data.revenue : 0;

    const existing = await prisma.ownerSettlement.findUnique({
      where: {
        propertyId_periodFrom: { propertyId, periodFrom: from },
      },
    });

    let settlement;
    if (existing) {
      settlement = await prisma.ownerSettlement.update({
        where: { id: existing.id },
        data: {
          amount,
          periodTo: to,
          documentGeneratedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      settlement = await prisma.ownerSettlement.create({
        data: {
          propertyId,
          ownerId,
          periodFrom: from,
          periodTo: to,
          amount,
          currency: "PLN",
          status: "PENDING",
          documentGeneratedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      data: {
        id: settlement.id,
        documentUrl: `/api/owner/settlement/${settlement.id}/pdf`,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania dokumentu",
    };
  }
}

/** Oznacza rozliczenie jako zapłacone. */
export async function markOwnerSettlementPaid(
  settlementId: string,
  ownerId: string
): Promise<ActionResult> {
  try {
    const settlement = await prisma.ownerSettlement.findFirst({
      where: { id: settlementId, ownerId },
    });
    if (!settlement) return { success: false, error: "Rozliczenie nie istnieje lub brak uprawnień" };

    await prisma.ownerSettlement.update({
      where: { id: settlementId },
      data: { status: "ZAPLACONE", paidAt: new Date() },
    });
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd aktualizacji" };
  }
}
