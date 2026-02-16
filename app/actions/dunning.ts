"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getFolioSummary } from "@/app/actions/finance";
import { sendMailViaResend } from "@/app/actions/mailing";
import { createAuditLog } from "@/lib/audit";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Domyślna konfiguracja przypomnień o płatności */
export interface DunningConfig {
  enabled: boolean;
  /** Termin płatności = checkOut + N dni */
  paymentDueDaysAfterCheckout: number;
  /** Po ilu dniach zaległości wysłać 1. przypomnienie */
  level1Days: number;
  /** Po ilu dniach zaległości wysłać 2. przypomnienie */
  level2Days: number;
  /** Po ilu dniach zaległości wysłać 3. przypomnienie (windykacja) */
  level3Days: number;
  /** Maks. liczba przypomnień na rezerwację (1–3) */
  maxReminders: number;
  templateSubject1?: string;
  templateBody1?: string;
  templateSubject2?: string;
  templateBody2?: string;
  templateSubject3?: string;
  templateBody3?: string;
}

const DEFAULT_DUNNING_CONFIG: DunningConfig = {
  enabled: true,
  paymentDueDaysAfterCheckout: 14,
  level1Days: 7,
  level2Days: 14,
  level3Days: 30,
  maxReminders: 3,
  templateSubject1: "Przypomnienie o płatności – zaległa kwota",
  templateBody1:
    "Dzień dobry {{guestName}},\n\nPrzypominamy o zaległej płatności w kwocie {{balance}} PLN (termin płatności: {{dueDate}}).\n\nProsimy o uregulowanie należności.\n\nZ poważaniem,\nRecepcja",
  templateSubject2: "Drugie przypomnienie o płatności",
  templateBody2:
    "Dzień dobry {{guestName}},\n\nPo raz drugi przypominamy o zaległej płatności w kwocie {{balance}} PLN (termin: {{dueDate}}).\n\nProsimy o pilne uregulowanie należności.\n\nZ poważaniem,\nRecepcja",
  templateSubject3: "Ostateczne przypomnienie – windykacja",
  templateBody3:
    "Dzień dobry {{guestName}},\n\nTo ostatnie przypomnienie o zaległej płatności w kwocie {{balance}} PLN (termin: {{dueDate}}).\n\nW przypadku braku płatności sprawa zostanie przekazana do windykacji.\n\nZ poważaniem,\nRecepcja",
};

function replaceVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${k}}}`, "g"), v);
  }
  return out;
}

/**
 * Pobiera konfigurację dunning dla obiektu (lub domyślną).
 */
export async function getDunningConfig(
  propertyId: string | null
): Promise<ActionResult<DunningConfig>> {
  try {
    if (propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { dunningConfig: true },
      });
      if (property?.dunningConfig && typeof property.dunningConfig === "object") {
        const raw = property.dunningConfig as Record<string, unknown>;
        return {
          success: true,
          data: {
            ...DEFAULT_DUNNING_CONFIG,
            ...(typeof raw.enabled === "boolean" && { enabled: raw.enabled }),
            ...(typeof raw.paymentDueDaysAfterCheckout === "number" && {
              paymentDueDaysAfterCheckout: raw.paymentDueDaysAfterCheckout,
            }),
            ...(typeof raw.level1Days === "number" && { level1Days: raw.level1Days }),
            ...(typeof raw.level2Days === "number" && { level2Days: raw.level2Days }),
            ...(typeof raw.level3Days === "number" && { level3Days: raw.level3Days }),
            ...(typeof raw.maxReminders === "number" && {
              maxReminders: Math.min(3, Math.max(1, raw.maxReminders)),
            }),
            ...(typeof raw.templateSubject1 === "string" && { templateSubject1: raw.templateSubject1 }),
            ...(typeof raw.templateBody1 === "string" && { templateBody1: raw.templateBody1 }),
            ...(typeof raw.templateSubject2 === "string" && { templateSubject2: raw.templateSubject2 }),
            ...(typeof raw.templateBody2 === "string" && { templateBody2: raw.templateBody2 }),
            ...(typeof raw.templateSubject3 === "string" && { templateSubject3: raw.templateSubject3 }),
            ...(typeof raw.templateBody3 === "string" && { templateBody3: raw.templateBody3 }),
          },
        };
      }
    }
    return { success: true, data: { ...DEFAULT_DUNNING_CONFIG } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu konfiguracji dunning",
    };
  }
}

export interface OverdueReservationItem {
  reservationId: string;
  guestName: string;
  guestEmail: string | null;
  roomNumber: string;
  checkOut: Date;
  dueDate: Date;
  daysOverdue: number;
  balance: number;
  suggestedLevel: 1 | 2 | 3;
  alreadySentLevels: number[];
}

/**
 * Zwraca listę rezerwacji z zaległym saldem (termin płatności minął, saldo > 0).
 * Dla każdej wyznacza sugerowany poziom przypomnienia (1–3) i listę już wysłanych poziomów.
 */
export async function getOverdueReservations(
  propertyId: string | null
): Promise<ActionResult<OverdueReservationItem[]>> {
  try {
    const configResult = await getDunningConfig(propertyId);
    if (!configResult.success) return configResult;
    const config = configResult.data;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CHECKED_OUT", "CONFIRMED", "CHECKED_IN"] },
        ...(propertyId && { room: { propertyId } }),
      },
      include: {
        guest: { select: { name: true, email: true } },
        room: { select: { number: true } },
        dunningLogs: {
          where: { success: true },
          select: { level: true },
          orderBy: { sentAt: "desc" },
        },
      },
      orderBy: { checkOut: "desc" },
    });

    const dueDateOffsetDays = config.paymentDueDaysAfterCheckout;
    const result: OverdueReservationItem[] = [];

    for (const res of reservations) {
      const checkOut = new Date(res.checkOut);
      checkOut.setHours(0, 0, 0, 0);
      const dueDate = new Date(checkOut);
      dueDate.setDate(dueDate.getDate() + dueDateOffsetDays);

      if (dueDate > today) continue;

      const summary = await getFolioSummary(res.id);
      if (!summary.success || summary.data.balance <= 0) continue;

      const balance = summary.data.balance;
      const daysOverdue = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysOverdue < 0) continue;

      let suggestedLevel: 1 | 2 | 3 = 1;
      if (daysOverdue >= config.level3Days) suggestedLevel = 3;
      else if (daysOverdue >= config.level2Days) suggestedLevel = 2;
      else if (daysOverdue >= config.level1Days) suggestedLevel = 1;

      const alreadySentLevels = ([...new Set(res.dunningLogs.map((l) => l.level))] as number[]).sort(
        (a, b) => a - b
      );
      if (alreadySentLevels.length >= config.maxReminders) continue;
      if (alreadySentLevels.includes(suggestedLevel)) continue;

      result.push({
        reservationId: res.id,
        guestName: res.guest.name,
        guestEmail: res.guest.email?.trim() || null,
        roomNumber: res.room.number,
        checkOut: new Date(res.checkOut),
        dueDate,
        daysOverdue,
        balance,
        suggestedLevel,
        alreadySentLevels,
      });
    }

    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania listy zaległości",
    };
  }
}

/**
 * Wysyła jedno przypomnienie o płatności (dunning letter) dla rezerwacji na wybranym poziomie.
 * Zapisuje wpis w DunningLog i audit log.
 */
export async function sendDunningReminder(
  reservationId: string,
  level: 1 | 2 | 3,
  propertyId: string | null
): Promise<ActionResult<{ dunningLogId: string; sentTo: string }>> {
  try {
    if (!reservationId || !level || level < 1 || level > 3) {
      return { success: false, error: "Nieprawidłowe parametry (reservationId, level 1–3)" };
    }

    const configResult = await getDunningConfig(propertyId);
    if (!configResult.success) return configResult;
    const config = configResult.data;
    if (!config.enabled) {
      return { success: false, error: "Przypomnienia o płatności są wyłączone w konfiguracji" };
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }

    const email = reservation.guest.email?.trim();
    if (!email) {
      return { success: false, error: "Brak adresu e-mail u gościa – nie można wysłać przypomnienia" };
    }

    const summary = await getFolioSummary(reservationId);
    if (!summary.success) return summary;
    if (summary.data.balance <= 0) {
      return { success: false, error: "Saldo rezerwacji nie jest zaległe (<= 0)" };
    }

    const dueDateOffsetDays = config.paymentDueDaysAfterCheckout;
    const checkOut = new Date(reservation.checkOut);
    const dueDate = new Date(checkOut);
    dueDate.setDate(dueDate.getDate() + dueDateOffsetDays);

    const existingForLevel = await prisma.dunningLog.count({
      where: { reservationId, level, success: true },
    });
    if (existingForLevel > 0) {
      return {
        success: false,
        error: `Przypomnienie poziomu ${level} dla tej rezerwacji zostało już wysłane`,
      };
    }

    const subjectKey = `templateSubject${level}` as keyof DunningConfig;
    const bodyKey = `templateBody${level}` as keyof DunningConfig;
    const subjectTemplate =
      (config[subjectKey] as string | undefined) ||
      `Przypomnienie o płatności (${level}) – zaległa kwota`;
    const bodyTemplate =
      (config[bodyKey] as string | undefined) ||
      `Dzień dobry {{guestName}},\n\nPrzypominamy o zaległej płatności w kwocie {{balance}} PLN (termin: {{dueDate}}).\n\nZ poważaniem,\nRecepcja`;

    const vars: Record<string, string> = {
      guestName: reservation.guest.name,
      balance: summary.data.balance.toFixed(2),
      dueDate: dueDate.toLocaleDateString("pl-PL"),
      roomNumber: reservation.room.number,
      reservationId,
    };

    const subject = replaceVars(subjectTemplate, vars);
    const bodyPlain = replaceVars(bodyTemplate, vars);
    const bodyHtml = `<p>${bodyPlain.replace(/\n/g, "</p><p>")}</p>`;

    const sendResult = await sendMailViaResend(email, subject, bodyHtml, bodyPlain);

    const dunningLog = await prisma.dunningLog.create({
      data: {
        reservationId,
        level,
        channel: "EMAIL",
        recipientEmail: email,
        success: sendResult.success,
        errorMessage: sendResult.success ? null : sendResult.error ?? "Nieznany błąd",
        balanceAtSend: summary.data.balance,
        dueDate,
      },
    });

    await createAuditLog({
      actionType: "CREATE",
      entityType: "DunningLog",
      entityId: dunningLog.id,
      newValue: {
        reservationId,
        level,
        sentTo: email,
        success: sendResult.success,
        balance: summary.data.balance,
        dueDate: dueDate.toISOString().slice(0, 10),
      } as unknown as Record<string, unknown>,
    });

    revalidatePath("/finance");
    revalidatePath("/reports");

    if (!sendResult.success) {
      return {
        success: false,
        error: sendResult.error ?? "Błąd wysyłania e-mail (wpis DunningLog zapisany)",
      };
    }

    return {
      success: true,
      data: { dunningLogId: dunningLog.id, sentTo: email },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania przypomnienia o płatności",
    };
  }
}

/**
 * Uruchamia zadanie dunning: dla wszystkich rezerwacji z zaległością wysyła przypomnienie
 * na sugerowanym poziomie (jeśli jeszcze nie wysłane).
 */
export async function runDunningJob(
  propertyId: string | null
): Promise<
  ActionResult<{ sent: number; skipped: number; errors: Array<{ reservationId: string; error: string }> }>
> {
  try {
    const listResult = await getOverdueReservations(propertyId);
    if (!listResult.success) return listResult;

    const items = listResult.data;
    let sent = 0;
    let skipped = 0;
    const errors: Array<{ reservationId: string; error: string }> = [];

    for (const item of items) {
      if (!item.guestEmail) {
        skipped++;
        continue;
      }
      const sendResult = await sendDunningReminder(
        item.reservationId,
        item.suggestedLevel,
        propertyId
      );
      if (sendResult.success) {
        sent++;
      } else {
        errors.push({ reservationId: item.reservationId, error: sendResult.error });
      }
    }

    revalidatePath("/finance");
    revalidatePath("/reports");

    return {
      success: true,
      data: { sent, skipped, errors },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd uruchomienia zadania dunning",
    };
  }
}

/**
 * Zapisuje konfigurację dunning dla obiektu (Property.dunningConfig).
 */
export async function saveDunningConfig(
  propertyId: string,
  config: Partial<DunningConfig>
): Promise<ActionResult<void>> {
  try {
    if (!propertyId) {
      return { success: false, error: "propertyId jest wymagane" };
    }

    const existing = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { dunningConfig: true },
    });
    if (!existing) {
      return { success: false, error: "Obiekt nie istnieje" };
    }

    const current = (existing.dunningConfig as Record<string, unknown> | null) ?? {};
    const merged: Record<string, unknown> = {
      ...current,
      ...(typeof config.enabled === "boolean" && { enabled: config.enabled }),
      ...(typeof config.paymentDueDaysAfterCheckout === "number" && {
        paymentDueDaysAfterCheckout: config.paymentDueDaysAfterCheckout,
      }),
      ...(typeof config.level1Days === "number" && { level1Days: config.level1Days }),
      ...(typeof config.level2Days === "number" && { level2Days: config.level2Days }),
      ...(typeof config.level3Days === "number" && { level3Days: config.level3Days }),
      ...(typeof config.maxReminders === "number" && {
        maxReminders: Math.min(3, Math.max(1, config.maxReminders)),
      }),
      ...(config.templateSubject1 !== undefined && { templateSubject1: config.templateSubject1 }),
      ...(config.templateBody1 !== undefined && { templateBody1: config.templateBody1 }),
      ...(config.templateSubject2 !== undefined && { templateSubject2: config.templateSubject2 }),
      ...(config.templateBody2 !== undefined && { templateBody2: config.templateBody2 }),
      ...(config.templateSubject3 !== undefined && { templateSubject3: config.templateSubject3 }),
      ...(config.templateBody3 !== undefined && { templateBody3: config.templateBody3 }),
    };

    await prisma.property.update({
      where: { id: propertyId },
      data: { dunningConfig: merged as Prisma.InputJsonValue },
    });

    revalidatePath("/ustawienia");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu konfiguracji dunning",
    };
  }
}
