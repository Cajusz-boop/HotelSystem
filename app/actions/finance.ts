"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { blindDropSchema } from "@/lib/validations/schemas";

const MANAGER_PIN = process.env.MANAGER_PIN ?? "1234";

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Night Audit: zamraża transakcje z daty < today (ustawia isReadOnly) */
export async function runNightAudit(): Promise<
  ActionResult<{ closedCount: number; reportSummary: Record<string, number> }>
> {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const today = startOfToday();

  try {
    const result = await prisma.transaction.updateMany({
      where: { createdAt: { lt: today } },
      data: { isReadOnly: true },
    });

    const report = await prisma.transaction.aggregate({
      where: { createdAt: { lt: today } },
      _sum: { amount: true },
      _count: true,
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "NightAudit",
      entityId: today.toISOString(),
      newValue: {
        closedCount: result.count,
        totalAmount: report._sum.amount?.toString(),
        transactionCount: report._count,
      } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
    return {
      success: true,
      data: {
        closedCount: result.count,
        reportSummary: {
          transactionsClosed: result.count,
          totalAmount: Number(report._sum.amount ?? 0),
        },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd Night Audit",
    };
  }
}

export interface ManagementReportRow {
  id: string;
  reservationId: string;
  amount: number;
  type: string;
  isReadOnly: boolean;
  createdAt: string;
}

export interface ManagementReportData {
  date: string;
  totalAmount: number;
  transactionCount: number;
  byType: Record<string, number>;
  transactions: ManagementReportRow[];
  currency: string;
}

/** Raport dobowy (Management Report) – transakcje z danego dnia */
export async function getManagementReportData(
  dateStr: string
): Promise<ActionResult<ManagementReportData>> {
  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  if (Number.isNaN(dayStart.getTime())) {
    return { success: false, error: "Nieprawidłowa data (użyj YYYY-MM-DD)" };
  }
  try {
    const [transactions, config] = await Promise.all([
      prisma.transaction.findMany({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.cennikConfig.findUnique({ where: { id: "default" } }).catch(() => null),
    ]);
    const currency = config?.currency ?? "PLN";
    const byType: Record<string, number> = {};
    let totalAmount = 0;
    for (const t of transactions) {
      const amt = Number(t.amount);
      totalAmount += amt;
      byType[t.type] = (byType[t.type] ?? 0) + amt;
    }
    return {
      success: true,
      data: {
        date: dateStr,
        totalAmount,
        transactionCount: transactions.length,
        byType,
        transactions: transactions.map((t) => ({
          id: t.id,
          reservationId: t.reservationId,
          amount: Number(t.amount),
          type: t.type,
          isReadOnly: t.isReadOnly,
          createdAt: t.createdAt.toISOString(),
        })),
        currency,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu raportu",
    };
  }
}

/** Transakcje z dziś – do listy wyboru przy Void (GAP 3.2) */
export interface TransactionForList {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
  isReadOnly: boolean;
}

export async function getTransactionsForToday(): Promise<
  ActionResult<TransactionForList[]>
> {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  try {
    const list = await prisma.transaction.findMany({
      where: { createdAt: { gte: today, lt: tomorrow } },
      orderBy: { createdAt: "desc" },
    });
    return {
      success: true,
      data: list.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        createdAt: t.createdAt.toISOString(),
        isReadOnly: t.isReadOnly,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu listy transakcji",
    };
  }
}

/** Suma gotówki (transakcje CASH) na dziś – do Blind Drop */
export async function getCashSumForToday(): Promise<
  ActionResult<{ expectedCash: number }>
> {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  try {
    const result = await prisma.transaction.aggregate({
      where: {
        type: "CASH",
        createdAt: { gte: today, lt: tomorrow },
      },
      _sum: { amount: true },
    });
    const expectedCash = Number(result._sum.amount ?? 0);
    return { success: true, data: { expectedCash } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu sumy gotówki",
    };
  }
}

/** Blind Drop: porównanie policzonej gotówki z systemem; po zatwierdzeniu zwraca różnicę */
export async function submitBlindDrop(countedCash: number): Promise<
  ActionResult<{
    expectedCash: number;
    countedCash: number;
    difference: number;
    isShortage: boolean;
  }>
> {
  const parsed = blindDropSchema.safeParse({ countedCash });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Nieprawidłowa kwota",
    };
  }

  const sumResult = await getCashSumForToday();
  if (!sumResult.success) {
    return { success: false, error: sumResult.error ?? "Błąd odczytu sumy gotówki" };
  }
  if (!sumResult.data) {
    return { success: false, error: "Brak danych sumy gotówki" };
  }

  const expectedCash = sumResult.data.expectedCash;
  const difference = parsed.data.countedCash - expectedCash;
  const isShortage = difference < 0;

  return {
    success: true,
    data: {
      expectedCash,
      countedCash: parsed.data.countedCash,
      difference: Math.abs(difference),
      isShortage,
    },
  };
}

/** Void Security: weryfikacja PIN managera (symulacja) */
export async function verifyManagerPin(pin: string): Promise<ActionResult<boolean>> {
  if (pin === MANAGER_PIN) {
    return { success: true, data: true };
  }
  return { success: false, error: "Nieprawidłowy PIN" };
}

/** Rejestracja płatności zaliczkowej (Przelew/Zadatek) – automatycznie „wystawiana” faktura zaliczkowa */
export async function createDepositPayment(
  reservationId: string,
  amount: number
): Promise<ActionResult<{ transactionId: string }>> {
  if (amount <= 0) {
    return { success: false, error: "Kwota musi być dodatnia" };
  }

  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };

    const tx = await prisma.transaction.create({
      data: {
        reservationId,
        amount,
        type: "DEPOSIT",
        isReadOnly: false,
      },
    });

    await createAuditLog({
      actionType: "CREATE",
      entityType: "Transaction",
      entityId: tx.id,
      newValue: {
        amount: tx.amount.toString(),
        type: "DEPOSIT",
        reservationId,
        depositInvoiceGenerated: true,
      } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    return { success: true, data: { transactionId: tx.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd rejestracji zaliczki",
    };
  }
}

/** Usunięcie transakcji (Void) – wymaga PIN managera */
export async function voidTransaction(
  transactionId: string,
  managerPin: string
): Promise<ActionResult> {
  const pinResult = await verifyManagerPin(managerPin);
  if (!pinResult.success) return pinResult;

  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) return { success: false, error: "Transakcja nie istnieje" };
    if (tx.isReadOnly) return { success: false, error: "Transakcja zamknięta (Night Audit)" };

    await prisma.transaction.delete({ where: { id: transactionId } });

    await createAuditLog({
      actionType: "DELETE",
      entityType: "Transaction",
      entityId: transactionId,
      oldValue: { amount: tx.amount.toString(), type: tx.type } as unknown as Record<string, unknown>,
      newValue: null,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd void transakcji",
    };
  }
}
