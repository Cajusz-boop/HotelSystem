import { NextRequest, NextResponse } from "next/server";
import { getGusReport } from "@/app/actions/reports-legal";
import { sendMailViaResend } from "@/app/actions/mailing";

/**
 * GET /api/cron/gus-monthly
 * Uruchamiane przez crona (np. 1. dnia miesiąca o 06:00). Generuje raport GUS za poprzedni miesiąc i wysyła e-mailem.
 * Wymaga: CRON_SECRET (Bearer), GUS_REPORT_EMAILS (adresy po przecinku), RESEND_API_KEY, RESEND_FROM.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const emailsStr = process.env.GUS_REPORT_EMAILS?.trim();
  if (!emailsStr) {
    return NextResponse.json(
      { ok: false, error: "GUS_REPORT_EMAILS nie skonfigurowane" },
      { status: 503 }
    );
  }
  const emails = emailsStr.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  if (emails.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Brak adresów w GUS_REPORT_EMAILS" },
      { status: 503 }
    );
  }

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayPrev = new Date(firstOfMonth);
  lastDayPrev.setUTCDate(0);
  const firstDayPrev = new Date(lastDayPrev.getFullYear(), lastDayPrev.getMonth(), 1);

  const fromStr = firstDayPrev.toISOString().slice(0, 10);
  const toStr = lastDayPrev.toISOString().slice(0, 10);

  const result = await getGusReport(fromStr, toStr);
  if (!result.success) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Błąd generowania raportu GUS" },
      { status: 500 }
    );
  }

  const { dateFrom, dateTo, totalNights, totalGuests, rows } = result.data;
  const lines = [
    "Raport GUS",
    `Okres;${dateFrom};${dateTo}`,
    `Razem noclegów;${totalNights ?? 0}`,
    `Razem gości;${totalGuests ?? 0}`,
    "Data;Noclegi;Goście",
    ...(Array.isArray(rows) ? rows : []).map((r) => `${r.date};${r.nights};${r.guests}`),
  ];
  const csv = lines.join("\n");
  const subject = `Raport GUS ${dateFrom} – ${dateTo} (koniec miesiąca)`;
  const html = `
    <h2>Raport GUS – koniec miesiąca</h2>
    <p>Okres: <strong>${dateFrom}</strong> – <strong>${dateTo}</strong></p>
    <p>Razem noclegów: <strong>${totalNights ?? 0}</strong></p>
    <p>Razem gości: <strong>${totalGuests ?? 0}</strong></p>
    <p>Załącznik CSV w następnej wiadomości nie jest wysyłany – treść raportu w tabeli poniżej.</p>
    <pre style="font-size:11px; overflow:auto;">${csv.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
  `;

  for (const to of emails) {
    const sendResult = await sendMailViaResend(to, subject, html, undefined);
    if (!sendResult.success) {
      return NextResponse.json(
        { ok: false, error: sendResult.error ?? "Błąd wysyłki e-mail" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    period: { from: dateFrom, to: dateTo },
    totalNights: totalNights ?? 0,
    totalGuests: totalGuests ?? 0,
    sentTo: emails.length,
  });
}
