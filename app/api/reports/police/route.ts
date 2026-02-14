import { NextRequest, NextResponse } from "next/server";
import { getPoliceReport } from "@/app/actions/reports-legal";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

/**
 * GET /api/reports/police?date=YYYY-MM-DD
 * Zwraca raport policyjny (melding gości) w formacie CSV.
 */
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
  const dateParam = searchParams.get("date") ?? "";
  if (!dateParam.trim()) {
    return new NextResponse("Parametr date (YYYY-MM-DD) jest wymagany", { status: 400 });
  }
  const dateStr = dateParam.trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return new NextResponse("Parametr date musi być w formacie YYYY-MM-DD", { status: 400 });
  }
  const dateObj = new Date(dateStr + "T12:00:00.000Z");
  if (Number.isNaN(dateObj.getTime())) {
    return new NextResponse("Nieprawidłowa data", { status: 400 });
  }
  const result = await getPoliceReport(dateStr);
  if (!result.success) {
    return new NextResponse(result.error ?? "Błąd raportu", { status: 400 });
  }
  const rows = Array.isArray(result.data) ? result.data : [];
  const escape = (s: string | null) => (s == null ? "" : s.includes(";") || s.includes('"') ? `"${String(s).replace(/"/g, '""')}"` : s);
  const lines: string[] = [
    "Raport policyjny / Straż Graniczna (melding gości, dane cudzoziemców)",
    `Data;${dateStr}`,
    "Gość;Pokój;Zameldowanie;Wymeldowanie;Obywatelstwo;Typ dokumentu;Numer dokumentu;Data urodzenia;Miejsce urodzenia;Kraj",
    ...rows.map(
      (r) =>
        [
          escape(r.guestName),
          r.roomNumber,
          r.checkIn,
          r.checkOut,
          escape(r.nationality),
          escape(r.documentType),
          escape(r.documentNumber),
          r.dateOfBirth ?? "",
          escape(r.placeOfBirth),
          escape(r.country),
        ].join(";")
    ),
  ];
  const csv = lines.join("\n");
  const filename = `raport_policyjny_${dateStr}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
