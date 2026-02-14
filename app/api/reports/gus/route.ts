import { NextRequest, NextResponse } from "next/server";
import { getGusReport } from "@/app/actions/reports-legal";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const allowed = await can(session.role, "reports.official");
  if (!allowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  if (!from.trim() || !to.trim()) {
    return new NextResponse("Parametry from i to (YYYY-MM-DD) wymagane", { status: 400 });
  }
  const fromStr = from.trim();
  const toStr = to.trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(fromStr) || !dateRegex.test(toStr)) {
    return new NextResponse("Parametry from i to muszą być w formacie YYYY-MM-DD", { status: 400 });
  }
  const fromDate = new Date(fromStr + "T00:00:00.000Z");
  const toDate = new Date(toStr + "T23:59:59.999Z");
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return new NextResponse("Nieprawidłowe daty", { status: 400 });
  }
  if (fromDate > toDate) {
    return new NextResponse("Data od nie może być późniejsza niż data do", { status: 400 });
  }
  const maxDays = 366;
  const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (diffDays > maxDays) {
    return new NextResponse(`Maksymalny zakres dat to ${maxDays} dni (1 rok)`, { status: 400 });
  }
  const result = await getGusReport(fromStr, toStr);
  if (!result.success) {
    return new NextResponse(result.error ?? "Błąd raportu", { status: 400 });
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
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="raport_gus_${dateFrom}_${dateTo}.csv"`,
    },
  });
}
