"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendMailViaResend } from "@/app/actions/mailing";
import { getManagementReportData, getCommissionReport } from "@/app/actions/finance";
import { getOccupancyReport, getRevenueReport } from "@/app/actions/dashboard";
import { type ScheduledReportType } from "@/lib/scheduled-reports-constants";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type { ScheduledReportType };

export interface ScheduledReportRow {
  id: string;
  reportType: string;
  scheduleType: string;
  scheduleTime: string;
  scheduleDayOfWeek: number | null;
  recipientEmails: string;
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

export async function listScheduledReports(): Promise<ActionResult<ScheduledReportRow[]>> {
  try {
    const list = await prisma.scheduledReport.findMany({
      orderBy: { createdAt: "desc" },
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        reportType: r.reportType,
        scheduleType: r.scheduleType,
        scheduleTime: r.scheduleTime,
        scheduleDayOfWeek: r.scheduleDayOfWeek,
        recipientEmails: r.recipientEmails,
        enabled: r.enabled,
        lastRunAt: r.lastRunAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd listowania harmonogramów",
    };
  }
}

export async function createScheduledReport(data: {
  reportType: string;
  scheduleType: "DAILY" | "WEEKLY";
  scheduleTime: string;
  scheduleDayOfWeek?: number | null;
  recipientEmails: string;
}): Promise<ActionResult<ScheduledReportRow>> {
  if (!/^\d{2}:\d{2}$/.test(data.scheduleTime)) {
    return { success: false, error: "Godzina w formacie HH:mm (np. 08:00)" };
  }
  const emails = data.recipientEmails.split(/[\s,;]+/).filter(Boolean);
  if (emails.length === 0) {
    return { success: false, error: "Podaj co najmniej jeden adres e-mail" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const e of emails) {
    if (!emailRegex.test(e.trim())) {
      return { success: false, error: `Nieprawidłowy adres e-mail: ${e}` };
    }
  }
  if (data.scheduleType === "WEEKLY" && (data.scheduleDayOfWeek == null || data.scheduleDayOfWeek < 0 || data.scheduleDayOfWeek > 6)) {
    return { success: false, error: "Dla harmonogramu tygodniowego wybierz dzień (0–6)" };
  }
  try {
    const created = await prisma.scheduledReport.create({
      data: {
        reportType: data.reportType,
        scheduleType: data.scheduleType,
        scheduleTime: data.scheduleTime,
        scheduleDayOfWeek: data.scheduleType === "WEEKLY" ? data.scheduleDayOfWeek ?? 0 : null,
        recipientEmails: emails.map((e) => e.trim()).join(", "),
        enabled: true,
      },
    });
    revalidatePath("/reports");
    return {
      success: true,
      data: {
        id: created.id,
        reportType: created.reportType,
        scheduleType: created.scheduleType,
        scheduleTime: created.scheduleTime,
        scheduleDayOfWeek: created.scheduleDayOfWeek,
        recipientEmails: created.recipientEmails,
        enabled: created.enabled,
        lastRunAt: created.lastRunAt?.toISOString() ?? null,
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu harmonogramu",
    };
  }
}

export async function updateScheduledReport(
  id: string,
  data: { enabled?: boolean; recipientEmails?: string; scheduleTime?: string; scheduleDayOfWeek?: number | null }
): Promise<ActionResult<ScheduledReportRow>> {
  try {
    const existing = await prisma.scheduledReport.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Nie znaleziono harmonogramu" };
    if (data.recipientEmails !== undefined) {
      const emails = data.recipientEmails.split(/[\s,;]+/).filter(Boolean);
      if (emails.length === 0) return { success: false, error: "Podaj co najmniej jeden adres e-mail" };
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const e of emails) {
        if (!emailRegex.test(e.trim())) return { success: false, error: `Nieprawidłowy adres: ${e}` };
      }
    }
    if (data.scheduleTime !== undefined && !/^\d{2}:\d{2}$/.test(data.scheduleTime)) {
      return { success: false, error: "Godzina w formacie HH:mm" };
    }
    const updated = await prisma.scheduledReport.update({
      where: { id },
      data: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.recipientEmails !== undefined && { recipientEmails: data.recipientEmails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean).join(", ") }),
        ...(data.scheduleTime !== undefined && { scheduleTime: data.scheduleTime }),
        ...(data.scheduleDayOfWeek !== undefined && { scheduleDayOfWeek: data.scheduleDayOfWeek }),
      },
    });
    revalidatePath("/reports");
    return {
      success: true,
      data: {
        id: updated.id,
        reportType: updated.reportType,
        scheduleType: updated.scheduleType,
        scheduleTime: updated.scheduleTime,
        scheduleDayOfWeek: updated.scheduleDayOfWeek,
        recipientEmails: updated.recipientEmails,
        enabled: updated.enabled,
        lastRunAt: updated.lastRunAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji",
    };
  }
}

export async function deleteScheduledReport(id: string): Promise<ActionResult<void>> {
  try {
    await prisma.scheduledReport.delete({ where: { id } });
    revalidatePath("/reports");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania",
    };
  }
}

/** Wysyła wygenerowany raport e-mailem (ręczne „Wyślij e-mailem”). */
export async function sendReportByEmail(
  reportType: string,
  options: { date?: string; dateFrom?: string; dateTo?: string },
  recipientEmails: string
): Promise<ActionResult<void>> {
  const emails = recipientEmails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  if (emails.length === 0) {
    return { success: false, error: "Podaj co najmniej jeden adres e-mail." };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const e of emails) {
    if (!emailRegex.test(e)) {
      return { success: false, error: `Nieprawidłowy adres: ${e}` };
    }
  }

  let subject = "";
  let html = "";

  try {
    if (reportType === "MANAGEMENT_DAILY" && options.date) {
      const result = await getManagementReportData(options.date);
      if (!result.success) return { success: false, error: result.error ?? "Błąd raportu" };
      const d = result.data;
      subject = `Raport dobowy ${d.date}`;
      html = `
        <h2>Raport dobowy – ${d.date}</h2>
        <p>Suma transakcji: <strong>${d.totalAmount.toFixed(2)} ${d.currency}</strong></p>
        <p>Liczba transakcji: ${d.transactionCount}</p>
        <table border="1" cellpadding="6" style="border-collapse:collapse;">
          <tr><th>Typ</th><th>Kwota</th></tr>
          ${Object.entries(d.byType).map(([type, amount]) => `<tr><td>${type}</td><td>${amount.toFixed(2)}</td></tr>`).join("")}
        </table>
      `;
    } else if (reportType === "COMMISSION_OTA" && options.dateFrom && options.dateTo) {
      const result = await getCommissionReport(options.dateFrom, options.dateTo);
      if (!result.success) return { success: false, error: result.error ?? "Błąd raportu" };
      const d = result.data;
      subject = `Raport prowizji OTA ${d.dateFrom} – ${d.dateTo}`;
      html = `
        <h2>Raport prowizji OTA</h2>
        <p>Okres: ${d.dateFrom} – ${d.dateTo}</p>
        <p>Łączny przychód: ${d.totalRevenue.toFixed(2)} ${d.currency}, prowizja: ${d.totalCommission.toFixed(2)} ${d.currency}</p>
        <table border="1" cellpadding="6" style="border-collapse:collapse;">
          <tr><th>Agent</th><th>%</th><th>Rezerwacji</th><th>Przychód</th><th>Prowizja</th></tr>
          ${d.rows.map((r) => `<tr><td>${r.agentName}</td><td>${r.commissionPercent}%</td><td>${r.reservationCount}</td><td>${r.totalRevenue.toFixed(2)}</td><td>${r.totalCommission.toFixed(2)}</td></tr>`).join("")}
        </table>
      `;
    } else if (reportType === "OCCUPANCY" && options.dateFrom && options.dateTo) {
      const result = await getOccupancyReport(options.dateFrom, options.dateTo);
      if (!result.success) return { success: false, error: result.error ?? "Błąd raportu" };
      const d = result.data;
      subject = `Raport obłożenia ${d.dateFrom} – ${d.dateTo}`;
      html = `
        <h2>Raport obłożenia</h2>
        <p>Średnie obłożenie: <strong>${d.avgOccupancyPercent}%</strong></p>
        <table border="1" cellpadding="6" style="border-collapse:collapse;">
          <tr><th>Data</th><th>Zajęte</th><th>Łącznie</th><th>%</th></tr>
          ${d.days.slice(-14).map((row) => `<tr><td>${row.date}</td><td>${row.occupiedRooms}</td><td>${row.totalRooms}</td><td>${row.occupancyPercent}%</td></tr>`).join("")}
        </table>
      `;
    } else if (reportType === "REVENUE" && options.dateFrom && options.dateTo) {
      const result = await getRevenueReport(options.dateFrom, options.dateTo);
      if (!result.success) return { success: false, error: result.error ?? "Błąd raportu" };
      const d = result.data;
      subject = `Raport przychodów ${options.dateFrom} – ${options.dateTo}`;
      html = `
        <h2>Raport przychodów</h2>
        <p>Łącznie: <strong>${d.total.toFixed(2)} PLN</strong></p>
        <table border="1" cellpadding="6" style="border-collapse:collapse;">
          <tr><th>Typ</th><th>Kwota</th></tr>
          ${d.byType.map((r) => `<tr><td>${r.type}</td><td>${r.amount.toFixed(2)}</td></tr>`).join("")}
        </table>
      `;
    } else {
      return { success: false, error: "Nieobsługiwany typ raportu lub brak parametrów (date / dateFrom, dateTo)." };
    }

    for (const to of emails) {
      const sendResult = await sendMailViaResend(to, subject, html, undefined);
      if (!sendResult.success) {
        return { success: false, error: sendResult.error ?? "Błąd wysyłki e-mail." };
      }
    }
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłki raportu",
    };
  }
}
