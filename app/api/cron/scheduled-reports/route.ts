import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMailViaResend } from "@/app/actions/mailing";
import { getManagementReportData } from "@/app/actions/finance";
import { getCommissionReport } from "@/app/actions/finance";
import { getOccupancyReport } from "@/app/actions/dashboard";
import { getRevenueReport } from "@/app/actions/dashboard";

/**
 * GET /api/cron/scheduled-reports
 * Uruchamiane przez crona (np. co 15 min). Sprawdza harmonogramy i wysyła raporty e-mailem.
 * Wymaga: CRON_SECRET (Bearer), RESEND_API_KEY i RESEND_FROM do wysyłki.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Unauthorized: CRON_SECRET not configured" },
      { status: 401 }
    );
  }
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const results: { id: string; sent: boolean; error?: string }[] = [];

  const schedules = await prisma.scheduledReport.findMany({
    where: { enabled: true },
  });

  for (const s of schedules) {
    const [hour, min] = s.scheduleTime.split(":").map(Number);
    const todaySchedule = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, min, 0);

    let due = false;
    if (s.scheduleType === "DAILY") {
      due = now >= todaySchedule && (!s.lastRunAt || new Date(s.lastRunAt) < todaySchedule);
    } else {
      // WEEKLY
      if (s.scheduleDayOfWeek !== null && s.scheduleDayOfWeek === dayOfWeek) {
        due = now >= todaySchedule && (!s.lastRunAt || new Date(s.lastRunAt) < todaySchedule);
      }
    }

    if (!due) {
      results.push({ id: s.id, sent: false });
      continue;
    }

    const emails = s.recipientEmails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) {
      results.push({ id: s.id, sent: false, error: "Brak adresów" });
      continue;
    }

    let subject = "";
    let html = "";

    try {
      if (s.reportType === "MANAGEMENT_DAILY") {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().slice(0, 10);
        const result = await getManagementReportData(dateStr);
        if (!result.success) {
          results.push({ id: s.id, sent: false, error: result.error });
          continue;
        }
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
      } else if (s.reportType === "COMMISSION_OTA") {
        const from = new Date(today);
        from.setDate(from.getDate() - 30);
        const result = await getCommissionReport(from.toISOString().slice(0, 10), yesterdayToStr());
        if (!result.success) {
          results.push({ id: s.id, sent: false, error: result.error });
          continue;
        }
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
      } else if (s.reportType === "OCCUPANCY") {
        const from = new Date(today);
        from.setDate(from.getDate() - 30);
        const result = await getOccupancyReport(from.toISOString().slice(0, 10), yesterdayToStr());
        if (!result.success) {
          results.push({ id: s.id, sent: false, error: result.error });
          continue;
        }
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
      } else if (s.reportType === "REVENUE") {
        const from = new Date(today);
        from.setDate(from.getDate() - 30);
        const result = await getRevenueReport(from.toISOString().slice(0, 10), yesterdayToStr());
        if (!result.success) {
          results.push({ id: s.id, sent: false, error: result.error });
          continue;
        }
        const d = result.data;
        subject = `Raport przychodów ${from.toISOString().slice(0, 10)} – ${yesterdayToStr()}`;
        html = `
          <h2>Raport przychodów</h2>
          <p>Łącznie: <strong>${d.total.toFixed(2)} PLN</strong></p>
          <table border="1" cellpadding="6" style="border-collapse:collapse;">
            <tr><th>Typ</th><th>Kwota</th></tr>
            ${d.byType.map((r) => `<tr><td>${r.type}</td><td>${r.amount.toFixed(2)}</td></tr>`).join("")}
          </table>
        `;
      } else {
        results.push({ id: s.id, sent: false, error: "Nieobsługiwany typ raportu" });
        continue;
      }

      const sendResult = await sendMailViaResend(
        emails[0],
        subject,
        html,
        undefined
      );
      if (!sendResult.success) {
        results.push({ id: s.id, sent: false, error: sendResult.error });
        continue;
      }
      // Jeśli więcej adresów – wyślij do każdego (Resend może przyjąć to: [emails])
      for (let i = 1; i < emails.length; i++) {
        await sendMailViaResend(emails[i], subject, html, undefined);
      }

      await prisma.scheduledReport.update({
        where: { id: s.id },
        data: { lastRunAt: new Date() },
      });
      results.push({ id: s.id, sent: true });
    } catch (err) {
      results.push({
        id: s.id,
        sent: false,
        error: err instanceof Error ? err.message : "Błąd generowania raportu",
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}

function yesterdayToStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
